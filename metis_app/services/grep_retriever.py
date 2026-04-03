"""rga (ripgrep-all) based supplementary retriever for METIS.

Implements ``GrepRetriever`` — a thin wrapper around the ``rga`` command-line
tool — that adds BM25-style keyword matching on original source files as a
complement to dense vector retrieval.  Results from both paths are fused with
Reciprocal Rank Fusion (RRF, k=60) so neither signal dominates.

Architecture
------------
``GrepRetriever`` is a standalone helper, not a ``VectorStoreAdapter``; it is
designed to be called from ``execute_retrieval_plan()`` in
``retrieval_pipeline.py`` after the primary vector window and used to
*re-rank* / supplement the hit list.  The ``GrepVectorStoreAdapter`` in
``vector_store.py`` wires it into the adapter interface.

Availability
------------
If ``rga`` is not on ``PATH`` the class still works — every method returns an
empty list so callers receive unmodified vector results.

Design is inspired by sirchmunk's ``TextRetriever`` (Apache-2.0).
rga outputs newline-delimited JSON (``--json``) which we parse per line.
Exit codes: 0=match found, 1=no match (OK), ≥2=fatal error.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import subprocess
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_RGA_TIMEOUT_S = 30
_MAX_KEYWORDS = 6
_RRF_K = 60

_STOPWORDS: frozenset[str] = frozenset(
    {
        "a", "an", "and", "are", "as", "at", "be", "been", "by", "can",
        "do", "does", "for", "from", "has", "have", "how", "i", "if",
        "in", "is", "it", "its", "me", "my", "no", "not", "of", "on",
        "or", "our", "s", "that", "the", "their", "them", "there",
        "this", "to", "us", "was", "we", "what", "when", "where",
        "which", "who", "will", "with", "would", "you", "your",
    }
)


# ---------------------------------------------------------------------------
# Keyword extraction
# ---------------------------------------------------------------------------


def extract_keywords(question: str, max_terms: int = _MAX_KEYWORDS) -> list[str]:
    """Extract the most informative keywords from *question*.

    Strategy: lower, split on non-word chars, drop stopwords and single-char
    tokens, return up to *max_terms* (preserving occurrence order).
    """
    tokens = re.split(r"\W+", question.lower())
    seen: set[str] = set()
    keywords: list[str] = []
    for tok in tokens:
        if len(tok) < 2 or tok in _STOPWORDS or tok in seen:
            continue
        seen.add(tok)
        keywords.append(tok)
        if len(keywords) >= max_terms:
            break
    return keywords


# ---------------------------------------------------------------------------
# rga subprocess
# ---------------------------------------------------------------------------


def is_rga_available() -> bool:
    """Return *True* if ``rga`` (ripgrep-all) is on ``PATH``."""
    return shutil.which("rga") is not None


def _parse_rga_stdout(stdout: str) -> list[dict[str, Any]]:
    """Parse newline-delimited rga JSON output into a list of match dicts.

    Each returned dict has::

        {"file": str, "line_number": int, "text": str}
    """
    hits: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if obj.get("type") != "match":
            continue
        data = obj.get("data", {})
        file_path = (data.get("path") or {}).get("text", "")
        line_num = data.get("line_number", 0)
        lines_data = data.get("lines") or {}
        text = lines_data.get("text", "").rstrip("\n")
        if file_path:
            hits.append({"file": file_path, "line_number": line_num, "text": text})
    return hits


def run_rga(
    keywords: list[str],
    file_paths: list[str],
    *,
    max_count: int = 50,
    timeout: int = _RGA_TIMEOUT_S,
) -> list[dict[str, Any]]:
    """Run ``rga --json`` and return parsed match dicts.

    ``FileNotFoundError`` (rga not installed) is re-raised as ``RuntimeError``
    with a user-friendly message.  All other subprocess errors are logged and
    result in an empty list (graceful degradation).

    Args:
        keywords: Terms to search (ORed with ``|``).
        file_paths: Absolute paths to search.
        max_count: Maximum matches per file (``-m``).
        timeout: Subprocess timeout in seconds.

    Returns:
        List of ``{"file", "line_number", "text"}`` dicts.
    """
    if not keywords or not file_paths:
        return []

    pattern = "|".join(re.escape(k) for k in keywords)
    cmd = [
        "rga",
        "--no-config",
        "--json",
        "--ignore-case",
        f"--max-count={max_count}",
        pattern,
        *file_paths,
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "rga (ripgrep-all) is not installed or not on PATH. "
            "Install it from https://github.com/phiresky/ripgrep-all and ensure "
            "it is accessible as 'rga'."
        ) from exc
    except subprocess.TimeoutExpired:
        logger.warning("grep_retriever: rga timed out after %ds", timeout)
        return []
    except Exception as exc:  # noqa: BLE001
        logger.debug("grep_retriever: rga error: %s", exc)
        return []

    # Exit code 1 = no matches (not an error)
    # Exit code ≥ 2 = partial errors; still parse stdout if present
    if proc.returncode >= 2 and not proc.stdout.strip():
        logger.debug(
            "grep_retriever: rga exited %d, stderr: %s",
            proc.returncode,
            proc.stderr[:200],
        )
        return []

    return _parse_rga_stdout(proc.stdout)


async def run_rga_async(
    keywords: list[str],
    file_paths: list[str],
    *,
    max_count: int = 50,
    timeout: int = _RGA_TIMEOUT_S,
    semaphore: asyncio.Semaphore | None = None,
) -> list[dict[str, Any]]:
    """Async wrapper around :func:`run_rga` using ``asyncio.to_thread``."""
    sem = semaphore or asyncio.Semaphore(1)
    async with sem:
        return await asyncio.to_thread(
            run_rga, keywords, file_paths, max_count=max_count, timeout=timeout
        )


# ---------------------------------------------------------------------------
# Chunk mapping
# ---------------------------------------------------------------------------


def map_hits_to_chunks(
    hits: list[dict[str, Any]],
    chunks: list[dict[str, Any]],
) -> list[int]:
    """Map rga matches to chunk indices via file_path proximity.

    For each hit we find chunks whose ``file_path`` matches the rga
    ``file`` field and score them by how close the chunk's start position
    (byte offset or sentinel 0) is to the hit line number.  The returned
    list is a deduplicated ranking of chunk indices (best first).

    Args:
        hits: Output of :func:`run_rga`.
        chunks: ``bundle.chunks`` list of dicts with at least ``file_path``.

    Returns:
        Ordered, deduplicated list of chunk indices ranked by relevance.
    """
    # Build file → [(chunk_idx, start_line)] index
    file_chunks: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for idx, chunk in enumerate(chunks):
        fp = chunk.get("file_path", "")
        if fp:
            # Use chunk_idx as a proxy for line position when not available
            start_line = chunk.get("start_line", idx * 10)
            file_chunks[fp].append((idx, start_line))

    # Score: for each hit pick the best-matching chunk
    chunk_scores: dict[int, float] = {}
    for hit_rank, hit in enumerate(hits):
        fp = hit["file"]
        hit_line = hit.get("line_number", 0)
        candidates = file_chunks.get(fp, [])
        if not candidates:
            continue
        # Closest chunk wins
        best_idx, _ = min(
            candidates, key=lambda x: abs(x[1] - hit_line)
        )
        # Higher rank → higher score (inverse of rank)
        score = 1.0 / (hit_rank + 1)
        if chunk_scores.get(best_idx, 0) < score:
            chunk_scores[best_idx] = score

    return sorted(chunk_scores, key=lambda i: chunk_scores[i], reverse=True)


# ---------------------------------------------------------------------------
# RRF fusion helpers
# ---------------------------------------------------------------------------


def rrf_fuse(
    ranked_a: list[int],
    ranked_b: list[int],
    k: int = _RRF_K,
) -> list[int]:
    """Reciprocal Rank Fusion of two ranked index lists.

    Returns a unified ranking (no scores, just indices).
    """
    scores: dict[int, float] = {}
    for rank, idx in enumerate(ranked_a):
        scores[idx] = scores.get(idx, 0.0) + 1.0 / (k + rank + 1)
    for rank, idx in enumerate(ranked_b):
        scores[idx] = scores.get(idx, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores, key=lambda i: scores[i], reverse=True)
