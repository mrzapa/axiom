"""DuckDB-backed query-result cache for METIS.

Inspired by sirchmunk's DuckDB storage layer (Apache-2.0), simplified to act
as a transparent look-aside cache for the RAG retrieval path.

Cache key: SHA-256( question.strip().lower() | embedding_provider | index_id )

The cache is keyed on *question + embedding_provider + index_id* so that
cache hits are only served when the same question is asked against the same
index with the same embedding model.  If the user switches embedding providers
the signature changes and all old entries are treated as misses (no crash).

Graceful degradation
--------------------
When ``duckdb`` is not installed the class still works — every method becomes
a no-op.  The caller should always check ``cache.get(...)`` for ``None`` before
short-circuiting.

Usage::

    cache = QueryResultCache.build(settings, index_id="my-index")
    cached = cache.get(question)
    if cached is not None:
        return cached          # fast path

    result = do_expensive_retrieval(...)
    cache.put(question, result.to_dict())
"""

from __future__ import annotations

import hashlib
import json
import logging
import pathlib
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_SCHEMA_VERSION = 1
_TABLE = "query_cache"
_DEFAULT_TTL_HOURS = 24


def _try_import_duckdb() -> Any:
    try:
        import duckdb  # noqa: PLC0415
        return duckdb
    except ImportError:
        return None


def _cache_key(question: str, embedding_provider: str, index_id: str) -> str:
    payload = f"{question.strip().lower()}|{embedding_provider}|{index_id}"
    return hashlib.sha256(payload.encode()).hexdigest()


class QueryResultCache:
    """Thread-*cooperative* DuckDB cache for QueryResult payloads.

    Thread safety: DuckDB connections are *per-instance* and the default METIS
    architecture is single-process with an async event loop, so one connection
    per request is safe.  Do not share instances across threads.
    """

    def __init__(
        self,
        db_path: pathlib.Path,
        index_id: str = "",
        embedding_provider: str = "",
        ttl_hours: int = _DEFAULT_TTL_HOURS,
    ) -> None:
        self._path = db_path
        self._index_id = index_id
        self._embedding_provider = embedding_provider
        self._ttl_hours = ttl_hours
        self._duckdb = _try_import_duckdb()
        self._db: Any = None

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    @classmethod
    def build(
        cls,
        settings: dict[str, Any],
        *,
        index_id: str = "",
    ) -> "QueryResultCache":
        """Create a cache instance from a METIS settings dict."""
        cache_dir = pathlib.Path(
            settings.get("cache_dir") or ".metis_cache"
        ).expanduser()
        cache_dir.mkdir(parents=True, exist_ok=True)
        db_path = cache_dir / "query_cache.db"
        ttl = int(settings.get("knowledge_cache_ttl_hours", _DEFAULT_TTL_HOURS))
        provider = str(settings.get("embedding_provider") or "")
        return cls(
            db_path=db_path,
            index_id=index_id,
            embedding_provider=provider,
            ttl_hours=ttl,
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _connect(self) -> Any | None:
        if self._duckdb is None:
            return None
        if self._db is not None:
            return self._db
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._db = self._duckdb.connect(str(self._path))
            self._ensure_schema()
            return self._db
        except Exception as exc:  # noqa: BLE001
            logger.debug("QueryResultCache: DuckDB connect failed: %s", exc)
            return None

    def _ensure_schema(self) -> None:
        assert self._db is not None
        self._db.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {_TABLE} (
                cache_key          VARCHAR PRIMARY KEY,
                question           VARCHAR NOT NULL,
                embedding_provider VARCHAR NOT NULL,
                index_id           VARCHAR NOT NULL,
                schema_ver         INTEGER NOT NULL,
                result_json        VARCHAR NOT NULL,
                created_at         TIMESTAMPTZ NOT NULL
            )
            """
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, question: str) -> dict[str, Any] | None:
        """Return a cached result dict, or ``None`` on miss/expired/error."""
        db = self._connect()
        if db is None:
            return None
        try:
            key = _cache_key(question, self._embedding_provider, self._index_id)
            rows = db.execute(
                f"SELECT result_json, created_at, schema_ver "
                f"FROM {_TABLE} WHERE cache_key = ?",
                [key],
            ).fetchall()
            if not rows:
                return None
            result_json, created_at, schema_ver = rows[0]
            if schema_ver != _SCHEMA_VERSION:
                return None
            # TTL check — created_at is a datetime object from DuckDB
            age_hours = (
                datetime.now(timezone.utc)
                - created_at.replace(tzinfo=timezone.utc)
            ).total_seconds() / 3600
            if age_hours > self._ttl_hours:
                return None
            return json.loads(result_json)
        except Exception as exc:  # noqa: BLE001
            logger.debug("QueryResultCache.get failed: %s", exc)
            return None

    def put(self, question: str, result: dict[str, Any]) -> None:
        """Store *result* in the cache (no-op on error)."""
        db = self._connect()
        if db is None:
            return
        try:
            key = _cache_key(question, self._embedding_provider, self._index_id)
            now = datetime.now(timezone.utc)
            db.execute(
                f"""
                INSERT OR REPLACE INTO {_TABLE}
                    (cache_key, question, embedding_provider, index_id,
                     schema_ver, result_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    key,
                    question,
                    self._embedding_provider,
                    self._index_id,
                    _SCHEMA_VERSION,
                    json.dumps(result),
                    now,
                ],
            )
        except Exception as exc:  # noqa: BLE001
            logger.debug("QueryResultCache.put failed: %s", exc)

    def invalidate(self, question: str) -> None:
        """Remove a specific question from the cache."""
        db = self._connect()
        if db is None:
            return
        try:
            key = _cache_key(question, self._embedding_provider, self._index_id)
            db.execute(f"DELETE FROM {_TABLE} WHERE cache_key = ?", [key])
        except Exception as exc:  # noqa: BLE001
            logger.debug("QueryResultCache.invalidate failed: %s", exc)

    def purge_expired(self) -> int:
        """Delete all expired entries.  Returns the count removed."""
        db = self._connect()
        if db is None:
            return 0
        try:
            # Use epoch arithmetic available in DuckDB
            rows = db.execute(
                f"""
                DELETE FROM {_TABLE}
                WHERE (epoch_us(current_timestamp) - epoch_us(created_at))
                      > CAST(? AS BIGINT) * 3600 * 1000000
                RETURNING cache_key
                """,
                [self._ttl_hours],
            ).fetchall()
            return len(rows)
        except Exception as exc:  # noqa: BLE001
            logger.debug("QueryResultCache.purge_expired failed: %s", exc)
            return 0

    def close(self) -> None:
        """Close the underlying DuckDB connection."""
        if self._db is not None:
            try:
                self._db.close()
            except Exception:  # noqa: BLE001
                pass
            self._db = None
