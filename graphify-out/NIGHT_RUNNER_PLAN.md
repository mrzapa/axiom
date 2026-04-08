GOAL
Wire the already-implemented QueryResultCache (metis_app/services/knowledge_cache.py)
into query_rag() (metis_app/engine/querying.py) so that repeated questions against
the same index skip the full retrieval + LLM pipeline and return instantly from
DuckDB. The cache must invalidate on provider OR model change (use
manifest.embedding_signature, not just embedding_provider). Gate with
settings["enable_query_cache"] defaulting to False so no existing test breaks.

ESTIMATED_ITERATIONS
5

PLAN

=== ITERATION 1: Read and map (NO CODE CHANGES) ===

Read the following files in full before touching a single line:

1. metis_app/services/knowledge_cache.py  (entire file, ~250 lines)
   KEY FACTS to extract:
   - _cache_key(question, embedding_provider, index_id) → SHA-256 hex (line 54)
   - QueryResultCache.__init__ takes: db_path, index_id, embedding_provider, ttl_hours
   - build(settings, index_id) reads settings["embedding_provider"] — NOT the full
     signature. This is intentional; we will BYPASS build() and construct directly.
   - get(question) → dict | None.  Returns None on miss, TTL expiry, schema mismatch.
   - put(question, result_dict) → None.  Uses INSERT OR REPLACE.
   - All methods are no-ops if duckdb is not installed (graceful degradation).

2. metis_app/engine/querying.py  (entire file, ~550 lines)
   KEY FACTS to extract:
   - _prepare_rag_settings(req) at line 266 returns (manifest_path, settings).
     It calls load_index_manifest(manifest_path) internally.
     DO NOT change this function's signature — too many callers.
   - query_rag(req) at line 280:
       a. calls _prepare_rag_settings → gets manifest_path, settings
       b. calls resolve_vector_store(settings) → adapter
       c. calls adapter.load(manifest_path) → bundle
       d. calls create_llm(settings) → llm
       e. calls execute_retrieval_plan(bundle, adapter, question, settings, llm) → retrieval_plan
       f. if fallback.triggered and strategy=="no_answer": answer = fallback.message
          else: answer = llm.invoke([system_msg, human_msg])
       g. returns RagQueryResult(run_id, answer_text, sources, context_block,
                                 top_score, selected_mode, retrieval_plan,
                                 fallback, artifacts=extract_arrow_artifacts(settings))
   - RagQueryResult fields (slots=True, line 44):
       run_id: str
       answer_text: str
       sources: list[dict]
       context_block: str
       top_score: float
       selected_mode: str
       retrieval_plan: dict  (default_factory=dict)
       fallback: dict        (default_factory=dict)
       artifacts: list[dict]|None = None
       actions: list[dict]|None = None
   - NOTE: actions is never set by query_rag → always None. Do not cache it.
   - NOTE: artifacts come from settings["artifacts"]/["arrow_artifacts"] — caller
     provided, not computed. Re-extract on cache hit (don't cache artifacts).

3. metis_app/models/parity_types.py  (find class IndexManifest)
   KEY FACTS to extract:
   - IndexManifest.index_id: str
   - IndexManifest.embedding_signature: str  — format is "provider:model"
     (e.g. "openai:text-embedding-3-large", "mock:", "sentence_transformers:all-MiniLM-L6-v2")
     Defined by _embedding_signature(settings) in index_service.py line 450.
   - This is what we will use as the embedding_provider discriminator in the cache
     key, because it encodes BOTH provider AND model name. Switching from
     text-embedding-ada-002 to text-embedding-3-large (same provider, different model)
     will correctly invalidate the cache.

4. metis_app/services/index_service.py — find load_index_manifest (line ~841)
   Confirm it returns an IndexManifest object with .index_id and .embedding_signature.

5. tests/test_engine_querying.py  (entire file, ~230 lines)
   KEY FACTS to extract:
   - All tests use embedding_provider="mock" and llm_provider="mock"
   - Tests use engine_indexing.build_index() to create real indexes in tmp_path
   - monkeypatch pattern: monkeypatch.setattr(engine_indexing, "_DEFAULT_INDEX_STORAGE_DIR", ...)
   - LLM mock: create a class with invoke() method, monkeypatch "metis_app.engine.querying.create_llm"
   - The _ExplodingLLM pattern at line 196 shows how to assert LLM is NOT called.

After reading all five files, write a comment-only summary (in a scratch file or
in-memory) confirming:
  [ ] The exact line in query_rag() where cache.get() should be checked
  [ ] The exact line where cache.put() should be called
  [ ] What index_id to use (manifest.index_id)
  [ ] What embedding_provider to pass (manifest.embedding_signature)
  [ ] Where load_index_manifest is imported in querying.py (it's in _prepare_rag_settings)

DO NOT write any production code in iteration 1. Run `pytest tests/test_knowledge_cache.py`
to confirm the baseline passes.


=== ITERATION 2: Add the cache check + store in query_rag() ===

Edit metis_app/engine/querying.py:

STEP A — Add import at the top of the file (after existing imports, ~line 11):
```
from metis_app.services.knowledge_cache import QueryResultCache
from metis_app.services.index_service import load_index_manifest as _load_index_manifest_for_cache
```
NOTE: load_index_manifest is already imported indirectly (via _prepare_rag_settings which
calls it), but to call it directly in query_rag() you need to import it explicitly.
Use an alias _load_index_manifest_for_cache to avoid name confusion.

STEP B — At the START of query_rag(), immediately after the `question = ...` and
`manifest_path, settings = _prepare_rag_settings(req)` lines, add:

```python
    # ── Cache look-aside ──────────────────────────────────────────────────
    cache_enabled = bool(settings.get("enable_query_cache", False))
    _cache: QueryResultCache | None = None
    if cache_enabled:
        _manifest_for_cache = _load_index_manifest_for_cache(manifest_path)
        _cache = QueryResultCache(
            db_path=(
                __import__("pathlib").Path(
                    settings.get("cache_dir") or ".metis_cache"
                ).expanduser()
                / "query_cache.db"
            ),
            index_id=str(_manifest_for_cache.index_id or manifest_path.stem),
            embedding_provider=str(
                _manifest_for_cache.embedding_signature
                or settings.get("embedding_provider")
                or ""
            ),
            ttl_hours=int(settings.get("knowledge_cache_ttl_hours", 24)),
        )
        _cached = _cache.get(question)
        if _cached is not None:
            _cache.close()
            return RagQueryResult(
                run_id=_normalize_run_id(req.run_id),
                answer_text=str(_cached.get("answer_text") or ""),
                sources=list(_cached.get("sources") or []),
                context_block=str(_cached.get("context_block") or ""),
                top_score=float(_cached.get("top_score") or 0.0),
                selected_mode=str(_cached.get("selected_mode") or _selected_mode(settings)),
                retrieval_plan=dict(_cached.get("retrieval_plan") or {}),
                fallback=dict(_cached.get("fallback") or {}),
                artifacts=extract_arrow_artifacts(settings) or None,
            )
    # ─────────────────────────────────────────────────────────────────────
```

STEP C — At the END of query_rag(), immediately BEFORE the `return RagQueryResult(...)`
statement, add:

```python
    # ── Cache store ───────────────────────────────────────────────────────
    if _cache is not None:
        _cache.put(question, {
            "answer_text": answer,
            "sources": [source.to_dict() for source in query_result.sources],
            "context_block": query_result.context_block,
            "top_score": float(query_result.top_score),
            "selected_mode": _selected_mode(settings),
            "retrieval_plan": retrieval_plan.to_dict(),
            "fallback": retrieval_plan.fallback.to_dict(),
        })
        _cache.close()
    # ─────────────────────────────────────────────────────────────────────
```

IMPORTANT DETAIL: The cache.put() uses `source.to_dict()` directly (not
`[source.to_dict() for source in query_result.sources]` from the final return).
This is because we have `query_result.sources` as the retrieval objects at this
point and can call .to_dict() directly. The final return also calls .to_dict()
on the same objects — that's fine.

IMPORTANT: Do NOT use `__import__("pathlib")` inline — instead import pathlib at
the top of the file (it's already imported: `from pathlib import Path`). Use Path
directly:
```python
        db_path=Path(settings.get("cache_dir") or ".metis_cache").expanduser() / "query_cache.db",
```

After editing, run:
  pytest tests/test_engine_querying.py -v

ALL 5 existing tests must pass. They don't set "enable_query_cache" so the cache
block is skipped entirely — zero behavior change.

Also run:
  pytest tests/test_knowledge_cache.py -v

All 16 tests must pass.


=== ITERATION 3: Add integration tests ===

Add 4 new tests to tests/test_engine_querying.py.

FIXTURE NEEDED: a shared build_index helper. Add at the top of the test block (or
as a module-level helper function, since pytest tmp_path can't be shared in module
scope — use per-test builds):

```python
def _build_notes_index(tmp_path, monkeypatch, index_id="cache-test-idx"):
    import metis_app.engine.indexing as engine_indexing
    src = tmp_path / "notes.txt"
    src.write_text(
        "Ada Lovelace wrote the first algorithm.\n"
        "Grace Hopper popularized compilers.\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(engine_indexing, "_DEFAULT_INDEX_STORAGE_DIR", tmp_path / "indexes")
    return engine_indexing.build_index(
        engine_indexing.IndexBuildRequest(
            document_paths=[str(src)],
            settings={
                "embedding_provider": "mock",
                "vector_db_type": "json",
                "chunk_size": 60,
                "chunk_overlap": 0,
            },
            index_id=index_id,
        )
    )
```

TEST 1 — Cache disabled by default:
```python
def test_query_rag_cache_disabled_by_default(tmp_path, monkeypatch):
    pytest.importorskip("duckdb")
    build_result = _build_notes_index(tmp_path, monkeypatch)
    call_count = {"n": 0}
    original_execute = __import__(
        "metis_app.services.retrieval_pipeline", fromlist=["execute_retrieval_plan"]
    ).execute_retrieval_plan

    def counting_execute(*args, **kwargs):
        call_count["n"] += 1
        return original_execute(*args, **kwargs)

    monkeypatch.setattr(
        "metis_app.engine.querying.execute_retrieval_plan", counting_execute
    )
    settings = {
        "embedding_provider": "mock",
        "llm_provider": "mock",
        "vector_db_type": "json",
        "top_k": 2,
        # NOTE: enable_query_cache is NOT set
    }
    query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings))
    query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings))
    assert call_count["n"] == 2  # retrieval ran twice — cache is off
```

TEST 2 — Cache hit on second call:
```python
def test_query_rag_cache_hit_on_second_call(tmp_path, monkeypatch):
    pytest.importorskip("duckdb")
    build_result = _build_notes_index(tmp_path, monkeypatch, "cache-hit-idx")
    call_count = {"n": 0}
    original_execute = __import__(
        "metis_app.services.retrieval_pipeline", fromlist=["execute_retrieval_plan"]
    ).execute_retrieval_plan

    def counting_execute(*args, **kwargs):
        call_count["n"] += 1
        return original_execute(*args, **kwargs)

    monkeypatch.setattr(
        "metis_app.engine.querying.execute_retrieval_plan", counting_execute
    )
    settings = {
        "embedding_provider": "mock",
        "llm_provider": "mock",
        "vector_db_type": "json",
        "top_k": 2,
        "enable_query_cache": True,
        "cache_dir": str(tmp_path / "cache"),
    }
    r1 = query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings))
    r2 = query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings))
    assert call_count["n"] == 1        # retrieval only ran once
    assert r1.answer_text == r2.answer_text
    assert r1.sources == r2.sources
    assert r1.context_block == r2.context_block
    assert r1.run_id != r2.run_id      # run_id is always fresh, not cached
```

TEST 3 — Cache miss when question changes:
```python
def test_query_rag_cache_miss_on_different_question(tmp_path, monkeypatch):
    pytest.importorskip("duckdb")
    build_result = _build_notes_index(tmp_path, monkeypatch, "cache-diff-q-idx")
    call_count = {"n": 0}
    original_execute = __import__(
        "metis_app.services.retrieval_pipeline", fromlist=["execute_retrieval_plan"]
    ).execute_retrieval_plan

    def counting_execute(*args, **kwargs):
        call_count["n"] += 1
        return original_execute(*args, **kwargs)

    monkeypatch.setattr(
        "metis_app.engine.querying.execute_retrieval_plan", counting_execute
    )
    settings = {
        "embedding_provider": "mock",
        "llm_provider": "mock",
        "vector_db_type": "json",
        "top_k": 2,
        "enable_query_cache": True,
        "cache_dir": str(tmp_path / "cache"),
    }
    query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings))
    query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who popularized compilers?", settings=settings))
    assert call_count["n"] == 2  # different questions → both cache misses
```

TEST 4 — Cache miss when embedding model changes (the model-invalidation test):
```python
def test_query_rag_cache_miss_on_embedding_model_change(tmp_path, monkeypatch):
    pytest.importorskip("duckdb")
    build_result = _build_notes_index(tmp_path, monkeypatch, "cache-model-idx")
    call_count = {"n": 0}
    original_execute = __import__(
        "metis_app.services.retrieval_pipeline", fromlist=["execute_retrieval_plan"]
    ).execute_retrieval_plan

    def counting_execute(*args, **kwargs):
        call_count["n"] += 1
        return original_execute(*args, **kwargs)

    monkeypatch.setattr(
        "metis_app.engine.querying.execute_retrieval_plan", counting_execute
    )
    cache_dir = str(tmp_path / "cache")
    settings_v1 = {
        "embedding_provider": "mock",
        "embedding_model": "mock-v1",
        "llm_provider": "mock",
        "vector_db_type": "json",
        "top_k": 2,
        "enable_query_cache": True,
        "cache_dir": cache_dir,
    }
    settings_v2 = dict(settings_v1)
    settings_v2["embedding_model"] = "mock-v2"  # same provider, different model

    query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings_v1))
    # IMPORTANT: since the index was built with mock provider without a specific model,
    # the embedding_signature on the manifest will be "mock:" for both calls.
    # To properly test model-level invalidation, we need to monkeypatch the manifest's
    # embedding_signature. Do it like this:
    from metis_app.models.parity_types import IndexManifest
    from unittest.mock import patch
    with patch(
        "metis_app.engine.querying._load_index_manifest_for_cache"
    ) as mock_load:
        mock_manifest_v2 = IndexManifest(
            index_id="cache-model-idx",
            backend="json",
            created_at="2025-01-01T00:00:00Z",
            embedding_signature="mock:mock-v2",
        )
        mock_load.return_value = mock_manifest_v2
        query_rag(RagQueryRequest(manifest_path=build_result.manifest_path, question="Who wrote the first algorithm?", settings=settings_v2))

    assert call_count["n"] == 2  # different embedding_signature → cache miss
```

NOTE: If the alias `_load_index_manifest_for_cache` doesn't match what you named the
import in iteration 2, adjust the patch target accordingly.

Run after adding all 4 tests:
  pytest tests/test_engine_querying.py -v

Expected: 5 original + 4 new = 9 tests, all green.


=== ITERATION 4: Verify no regressions in full test suite ===

Run:
  pytest tests/ -v --tb=short 2>&1 | head -80

If any tests fail:
  - If test_knowledge_cache.py tests fail: you accidentally changed knowledge_cache.py.
    Revert knowledge_cache.py — all changes go in querying.py only.
  - If test_engine_querying.py original 5 tests fail: the cache block is not properly
    gated behind `if cache_enabled:`. Confirm the flag check comes before any manifest
    loading.
  - If other test files fail: check if you introduced an import error at module level
    in querying.py (the new imports must be valid).

Common import error pitfall: if you used `_load_index_manifest_for_cache` as an alias,
make sure the import line at the top reads:
  from metis_app.services.index_service import load_index_manifest as _load_index_manifest_for_cache

And NOT something that would break the existing `_prepare_rag_settings` which also
calls `load_index_manifest` (that function imports it locally via `from metis_app...`
at line ~11 of querying.py).


=== ITERATION 5: Edge cases and clean-up ===

Address these edge cases:

1. Empty embedding_signature: Some indexes built before embedding_signature was a
   manifest field will have `embedding_signature=""`. If that's the case, the cache
   key will use empty string as provider, which is still correct (all such indexes
   share a key namespace, and they'd share a cache anyway).
   Current code in iteration 2 already handles this:
     str(_manifest_for_cache.embedding_signature or settings.get("embedding_provider") or "")

2. Whitespace normalization in question: _cache_key strips and lowercases the question.
   "Who wrote it?" and "who wrote it?" will hit the same cache entry. This is correct
   and intentional. Add a note in the docstring of query_rag() mentioning this.
   OPTIONAL: only add the docstring note if the function already has a docstring.
   query_rag() currently has NO docstring — just add: '''Run retrieval + synthesis.
   Repeated questions are served from DuckDB cache when enable_query_cache=True.'''

3. Cache directory permissions: if settings["cache_dir"] points to a read-only path,
   QueryResultCache silently degrades (exception caught in _connect → returns None →
   all methods no-op). No handling needed — graceful degradation is already built in.

4. TTL: if settings["knowledge_cache_ttl_hours"] is not set, the cache defaults to
   24 hours (from _DEFAULT_TTL_HOURS = 24 in knowledge_cache.py). This is correct.

5. Close() on cache hit path: the iteration-2 code already calls `_cache.close()`
   before returning on cache hit. Verify the close() is also called after cache.put()
   on the miss+store path. If not, add it.

Final run:
  pytest tests/test_knowledge_cache.py tests/test_engine_querying.py -v

Must show:
  - test_knowledge_cache.py: 16 tests PASSED
  - test_engine_querying.py: 9 tests PASSED (5 original + 4 new)
  - 0 warnings about unclosed DuckDB connections

RISKS

1. RISK: "I can't find _load_index_manifest_for_cache in the patch target"
   FIX: The patch target must match whatever alias you used in the import statement.
   If you imported as `from ... import load_index_manifest as _load_index_manifest_for_cache`
   then patch "metis_app.engine.querying._load_index_manifest_for_cache".
   If you imported as `from ... import load_index_manifest` (no alias) then patch
   "metis_app.engine.querying.load_index_manifest".
   The test in iteration 3, test 4 patches this function — keep the alias consistent.

2. RISK: "The cache DB file persists between test runs and causes false hits"
   FIX: All cache tests pass `cache_dir=str(tmp_path / "cache")`. pytest's tmp_path
   is a unique directory per test. As long as every test that enables the cache also
   sets a unique cache_dir pointing into tmp_path, isolation is guaranteed.

3. RISK: "query_swarm and knowledge_search are broken"
   FIX: Those functions are NOT modified. Only query_rag() is changed. They call
   _prepare_rag_settings() which is also unchanged. Run
   `pytest tests/test_engine_querying.py::test_knowledge_search_returns_summary_text_and_plan -v`
   to verify knowledge_search still works.

4. RISK: "IndexManifest doesn't exist in parity_types.py"
   FIX: Check the exact import path. In querying.py, the manifest comes from
   `load_index_manifest` which is imported from `metis_app.services.index_service`.
   The IndexManifest class itself lives in `metis_app.models.parity_types` but you
   don't need to import that class directly — you just call
   `_load_index_manifest_for_cache(manifest_path)` and use `.index_id` and
   `.embedding_signature` attributes dynamically. No type annotation needed.

5. RISK: "DuckDB is not installed in the test environment"
   FIX: QueryResultCache gracefully degrades — all methods become no-ops when duckdb
   is missing. The new integration tests use `pytest.importorskip("duckdb")` so they
   auto-skip in environments without duckdb. The 5 original tests don't need duckdb
   because cache_enabled defaults to False.

6. RISK: "The sources in the cached result are missing .to_dict()"
   FIX: In iteration 2 step C, cache.put() stores
   `"sources": [source.to_dict() for source in query_result.sources]`
   which are already plain dicts. On cache hit, we restore them as-is from the dict.
   They are already JSON-serializable at this point.

DONE_CONDITION

1. pytest tests/test_knowledge_cache.py passes: 16/16 tests green, NO regressions.

2. pytest tests/test_engine_querying.py passes: 9/9 tests green.
   The 4 new tests are:
   - test_query_rag_cache_disabled_by_default: execute_retrieval_plan called 2x
   - test_query_rag_cache_hit_on_second_call: execute_retrieval_plan called 1x,
     r1.answer_text == r2.answer_text, r1.run_id != r2.run_id
   - test_query_rag_cache_miss_on_different_question: execute_retrieval_plan called 2x
   - test_query_rag_cache_miss_on_embedding_model_change: execute_retrieval_plan called 2x

3. query_rag() with `enable_query_cache: False` (default) is 100% behavior-identical
   to the original. No extra file I/O, no extra imports resolved at call time.

4. Only TWO files were modified:
   - metis_app/engine/querying.py  (added ~30 lines of cache logic + 2 import lines)
   - tests/test_engine_querying.py (added 4 new test functions + 1 helper function)
   - knowledge_cache.py was NOT changed at all.
