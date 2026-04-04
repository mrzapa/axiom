"""Lightweight Monte Carlo Evidence Sampling (MCES) for METIS.

Inspired by sirchmunk's MonteCarloEvidenceSampling (Apache-2.0), adapted to run
inside METIS with *no additional dependencies* (stdlib only):

  - difflib instead of rapidfuzz for fuzzy anchor detection
  - Cosine similarity via existing embeddings instead of LLM window evaluation
  - Synchronous (no asyncio)

Three-phase algorithm
---------------------
Phase 1  Fuzzy anchors — sliding-window difflib ratio identifies positions in the
         source file most similar to the query string.
Phase 2  Gaussian expansion — random samples are drawn around the top anchors
         (plus a few random exploration points to avoid getting stuck).
Phase 3  Scoring — probe windows are scored with embedding cosine similarity.
         The highest-scoring window is expanded to `roi_window` chars and returned.

The function is only called when `enable_mces: true` and the source file still
exists on disk.  All failures degrade silently (the original chunk text is kept).
"""

from __future__ import annotations

import difflib
import math
import random
from pathlib import Path
from typing import Any

# Tuneable constants (can be overridden via settings)
_SMALL_FILE_THRESHOLD = 50_000   # chars — skip sampling, return full doc
_PROBE_WINDOW = 400              # chars per probe window
_ROI_WINDOW = 1_800              # chars of final expanded context
_FUZZ_CANDIDATES = 5             # top-N fuzzy anchors to keep
_RANDOM_EXPLORE = 2              # extra random exploration points
_GAUSSIAN_PER_ANCHOR = 3        # Gaussian draws per anchor
_GAUSSIAN_STD_FACTOR = 0.15     # std = factor × doc_len
_MAX_FILE_BYTES = 2_000_000     # 2 MB hard cap on file reads


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_source_file(file_path: str) -> str | None:
    """Read source file text.  Returns None if unreadable or too large."""
    try:
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return None
        if path.stat().st_size > _MAX_FILE_BYTES:
            return None
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def _sliding_fuzzy_anchors(
    doc: str,
    query: str,
    probe_window: int = _PROBE_WINDOW,
    top_k: int = _FUZZ_CANDIDATES,
) -> list[int]:
    """Phase 1 — sliding-window fuzzy search.

    Returns a list of start positions (best-first) where doc most closely
    resembles the query string.
    """
    doc_lower = doc.lower()
    query_lower = query.lower()
    stride = max(1, probe_window // 2)
    starts = list(range(0, max(1, len(doc) - probe_window), stride))
    if not starts:
        return [0]

    scored: list[tuple[float, int]] = []
    matcher = difflib.SequenceMatcher(None, query_lower, "", autojunk=False)
    for s in starts:
        window = doc_lower[s: s + probe_window]
        matcher.set_seq2(window)
        scored.append((matcher.ratio(), s))

    scored.sort(key=lambda x: x[0], reverse=True)

    seen: set[int] = set()
    anchors: list[int] = []
    for _, start in scored:
        if start not in seen:
            seen.add(start)
            anchors.append(start)
            if len(anchors) >= top_k:
                break
    return anchors


def _gaussian_samples(
    anchors: list[int],
    doc_len: int,
    seed_val: int = 0,
    samples_per_anchor: int = _GAUSSIAN_PER_ANCHOR,
    std_factor: float = _GAUSSIAN_STD_FACTOR,
    random_explore: int = _RANDOM_EXPLORE,
) -> list[int]:
    """Phase 2 — Gaussian draws around anchors plus exploration."""
    rng = random.Random(seed_val)
    std = max(50, int(doc_len * std_factor))
    candidates: set[int] = set(anchors)

    for anchor in anchors:
        for _ in range(samples_per_anchor):
            offset = int(rng.gauss(0, std))
            pos = max(0, min(doc_len - _PROBE_WINDOW, anchor + offset))
            candidates.add(pos)

    for _ in range(random_explore):
        candidates.add(rng.randint(0, max(0, doc_len - _PROBE_WINDOW)))

    return list(candidates)


def _cosine_sim(v1: list[float], v2: list[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1))
    n2 = math.sqrt(sum(b * b for b in v2))
    return dot / (n1 * n2) if n1 > 0 and n2 > 0 else 0.0


def _score_candidates(
    doc: str,
    candidates: list[int],
    query_vector: list[float] | None,
    embed_fn: Any | None,
    probe_window: int = _PROBE_WINDOW,
) -> list[tuple[float, int]]:
    """Phase 3 — score probe windows.

    Uses embedding cosine similarity when embed_fn is available, otherwise
    falls back to anchor-order ranking.
    """
    if not candidates:
        return []

    if query_vector and embed_fn:
        scored: list[tuple[float, int]] = []
        for start in candidates:
            window = doc[start: start + probe_window]
            try:
                vec = embed_fn(window)
                score = _cosine_sim(query_vector, vec)
            except Exception:  # noqa: BLE001
                score = 0.0
            scored.append((score, start))
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored

    # No embeddings — rank anchors first, then random candidates
    return [(1.0 / (i + 1), s) for i, s in enumerate(candidates)]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def sample_expanded_context(
    doc: str,
    query: str,
    *,
    query_vector: list[float] | None = None,
    embed_fn: Any | None = None,
    seed: int = 0,
    roi_window: int = _ROI_WINDOW,
) -> str:
    """Return the best ROI window from *doc* for *query*.

    For small documents ( ≤ ``_SMALL_FILE_THRESHOLD`` chars) the full document
    is returned unchanged.

    Args:
        doc:          Full source-file text.
        query:        User question.
        query_vector: Pre-computed query embedding (optional but improves scoring).
        embed_fn:     Callable ``embed_fn(text) -> list[float]`` (optional).
        seed:         Random seed — set deterministically per (question, file).
        roi_window:   Number of characters to return.

    Returns:
        The best context window as a plain string.
    """
    doc_len = len(doc)
    if doc_len <= _SMALL_FILE_THRESHOLD:
        return doc

    # Phase 1
    anchors = _sliding_fuzzy_anchors(doc, query)
    # Phase 2
    candidates = _gaussian_samples(anchors, doc_len, seed_val=seed)
    # Phase 3
    scored = _score_candidates(doc, candidates, query_vector, embed_fn)

    if not scored:
        return doc[:roi_window]

    best_start = scored[0][1]
    centre = best_start + _PROBE_WINDOW // 2
    roi_start = max(0, centre - roi_window // 2)
    roi_end = min(doc_len, roi_start + roi_window)
    if roi_end == doc_len:
        roi_start = max(0, doc_len - roi_window)
    return doc[roi_start:roi_end]


def apply_mces(
    sources: list[Any],
    question: str,
    settings: dict[str, Any],
    *,
    embed_fn: Any | None = None,
    query_vector: list[float] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Apply MCES to each EvidenceSource that has a readable file_path.

    Args:
        sources:       List of ``EvidenceSource`` objects from a ``QueryResult``.
        question:      The user question.
        settings:      Active METIS settings dict.
        embed_fn:      ``embed_query`` callable for window scoring (optional).
        query_vector:  Pre-computed query embedding (optional).

    Returns:
        ``(snippets, expanded_count)`` where *snippets* is a list of dicts::

            {
                "file_path":          str,
                "expanded_text":      str,
                "original_chunk_idx": int | None,
            }

        and *expanded_count* is how many sources were successfully re-sampled.
    """
    roi_window = int(settings.get("mces_roi_window", _ROI_WINDOW))
    snippets: list[dict[str, Any]] = []
    expanded = 0

    for source in sources:
        file_path = getattr(source, "file_path", None) or ""
        if not file_path:
            continue
        doc = _read_source_file(file_path)
        if doc is None:
            continue

        seed = hash(question + file_path) & 0x7FFF_FFFF
        expanded_text = sample_expanded_context(
            doc,
            question,
            query_vector=query_vector,
            embed_fn=embed_fn,
            seed=seed,
            roi_window=roi_window,
        )
        snippets.append(
            {
                "file_path": file_path,
                "expanded_text": expanded_text,
                "original_chunk_idx": getattr(source, "chunk_idx", None),
            }
        )
        expanded += 1

    return snippets, expanded
