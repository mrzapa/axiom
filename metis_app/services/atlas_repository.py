"""SQLite-backed persistence and markdown materialization for Atlas entries."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
import json
import pathlib
import sqlite3
from typing import Any, Iterator

from metis_app.models.atlas_types import AtlasEntry, atlas_now_iso, slugify_atlas_title

_HERE = pathlib.Path(__file__).resolve().parent
_PACKAGE_ROOT = _HERE.parent
_REPO_ROOT = _PACKAGE_ROOT.parent
_DEFAULT_DB_PATH = _REPO_ROOT / "rag_sessions.db"
_DEFAULT_ATLAS_ROOT = _REPO_ROOT / ".metis_cache" / "atlas"


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_load(value: str | bytes | None, default: Any) -> Any:
    if value in (None, ""):
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError, json.JSONDecodeError):
        return default


def _write_text_atomic(path: pathlib.Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    temp_path.write_text(content, encoding="utf-8")
    temp_path.replace(path)


class AtlasRepository:
    """Persist Atlas candidate/save decisions in the shared session database."""

    def __init__(
        self,
        db_path: str | pathlib.Path | None = None,
        atlas_root: str | pathlib.Path | None = None,
    ) -> None:
        configured_target = db_path or _DEFAULT_DB_PATH
        self.db_path = pathlib.Path(configured_target) if configured_target != ":memory:" else ":memory:"
        self._db_target = ":memory:" if configured_target == ":memory:" else str(pathlib.Path(configured_target))
        self._shared_conn: sqlite3.Connection | None = None
        if self._db_target == ":memory:":
            self._shared_conn = sqlite3.connect(
                self._db_target,
                check_same_thread=False,
            )
            self._shared_conn.row_factory = sqlite3.Row

        self.atlas_root = pathlib.Path(atlas_root or _DEFAULT_ATLAS_ROOT)
        self.entries_dir = self.atlas_root / "entries"
        self.index_path = self.atlas_root / "index.md"
        self._schema_ready = False

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        if self._shared_conn is not None:
            yield self._shared_conn
            self._shared_conn.commit()
            return

        target = pathlib.Path(self._db_target)
        target.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(target), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        conn: sqlite3.Connection | None = None
        try:
            if self._shared_conn is not None:
                conn = self._shared_conn
            else:
                conn = sqlite3.connect(str(self._db_target), timeout=30.0)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA busy_timeout=30000")
            conn.execute("BEGIN IMMEDIATE")
            yield conn
            conn.commit()
        except Exception:
            if conn is not None:
                conn.rollback()
            raise
        finally:
            if conn is not None and conn is not self._shared_conn:
                conn.close()

    def init_db(self) -> None:
        if self._schema_ready:
            return
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS atlas_entries(
                    entry_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    run_id TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    body_md TEXT NOT NULL,
                    sources_json TEXT NOT NULL,
                    mode TEXT NOT NULL,
                    index_id TEXT NOT NULL,
                    top_score REAL NOT NULL,
                    source_count INTEGER NOT NULL,
                    confidence REAL NOT NULL,
                    rationale TEXT NOT NULL,
                    slug TEXT NOT NULL,
                    status TEXT NOT NULL,
                    saved_at TEXT NOT NULL,
                    markdown_path TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_atlas_entries_status_updated ON atlas_entries(status, updated_at DESC)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_atlas_entries_session_run ON atlas_entries(session_id, run_id)"
            )
        self._schema_ready = True

    def _ensure_ready(self) -> None:
        self.init_db()

    @staticmethod
    def _entry_from_row(row: sqlite3.Row | None) -> AtlasEntry | None:
        if row is None:
            return None
        payload = dict(row)
        payload["sources"] = _json_load(payload.pop("sources_json", "[]"), [])
        return AtlasEntry.from_payload(payload)

    @staticmethod
    def _entry_row(entry: AtlasEntry) -> dict[str, Any]:
        payload = entry.to_payload()
        return {
            "entry_id": payload["entry_id"],
            "created_at": payload["created_at"],
            "updated_at": payload["updated_at"],
            "session_id": payload["session_id"],
            "run_id": payload["run_id"],
            "title": payload["title"],
            "summary": payload["summary"],
            "body_md": payload["body_md"],
            "sources_json": _json_dumps(payload["sources"]),
            "mode": payload["mode"],
            "index_id": payload["index_id"],
            "top_score": payload["top_score"],
            "source_count": payload["source_count"],
            "confidence": payload["confidence"],
            "rationale": payload["rationale"],
            "slug": payload["slug"],
            "status": payload["status"],
            "saved_at": payload["saved_at"],
            "markdown_path": payload["markdown_path"],
        }

    def get_entry_by_run(self, run_id: str) -> AtlasEntry | None:
        self._ensure_ready()
        candidate = str(run_id or "").strip()
        if not candidate:
            return None
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM atlas_entries WHERE run_id = ?",
                (candidate,),
            ).fetchone()
        return self._entry_from_row(row)

    def get_candidate(self, session_id: str, run_id: str) -> AtlasEntry | None:
        entry = self.get_entry_by_run(run_id)
        if entry is None:
            return None
        if entry.session_id != str(session_id or "").strip():
            return None
        if entry.status != "candidate":
            return None
        return entry

    def get_entry(self, entry_id: str) -> AtlasEntry | None:
        self._ensure_ready()
        candidate = str(entry_id or "").strip()
        if not candidate:
            return None
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM atlas_entries WHERE entry_id = ?",
                (candidate,),
            ).fetchone()
        return self._entry_from_row(row)

    def upsert_candidate(self, entry: AtlasEntry) -> AtlasEntry:
        self._ensure_ready()
        existing = self.get_entry_by_run(entry.run_id)
        if existing is not None and existing.status in {"declined", "saved", "snoozed"}:
            return existing
        if existing is not None:
            entry.entry_id = existing.entry_id
            entry.created_at = existing.created_at
        entry.updated_at = atlas_now_iso()
        entry.status = "candidate"
        entry.saved_at = ""
        entry.markdown_path = ""
        with self._transaction() as conn:
            conn.execute(
                """
                INSERT INTO atlas_entries(
                    entry_id, created_at, updated_at, session_id, run_id, title, summary,
                    body_md, sources_json, mode, index_id, top_score, source_count,
                    confidence, rationale, slug, status, saved_at, markdown_path
                ) VALUES (
                    :entry_id, :created_at, :updated_at, :session_id, :run_id, :title, :summary,
                    :body_md, :sources_json, :mode, :index_id, :top_score, :source_count,
                    :confidence, :rationale, :slug, :status, :saved_at, :markdown_path
                )
                ON CONFLICT(run_id) DO UPDATE SET
                    updated_at = excluded.updated_at,
                    title = excluded.title,
                    summary = excluded.summary,
                    body_md = excluded.body_md,
                    sources_json = excluded.sources_json,
                    mode = excluded.mode,
                    index_id = excluded.index_id,
                    top_score = excluded.top_score,
                    source_count = excluded.source_count,
                    confidence = excluded.confidence,
                    rationale = excluded.rationale,
                    slug = excluded.slug,
                    status = excluded.status,
                    saved_at = excluded.saved_at,
                    markdown_path = excluded.markdown_path
                """,
                self._entry_row(entry),
            )
        return entry

    def record_decision(self, session_id: str, run_id: str, decision: str) -> AtlasEntry:
        self._ensure_ready()
        normalized_decision = str(decision or "").strip()
        if normalized_decision not in {"snoozed", "declined"}:
            raise ValueError("decision must be 'snoozed' or 'declined'")
        entry = self.get_entry_by_run(run_id)
        if entry is None or entry.session_id != str(session_id or "").strip():
            raise FileNotFoundError(f"Atlas candidate not found for run: {run_id}")
        entry.status = normalized_decision
        entry.updated_at = atlas_now_iso()
        with self._transaction() as conn:
            conn.execute(
                """
                UPDATE atlas_entries
                SET status = ?, updated_at = ?
                WHERE run_id = ?
                """,
                (entry.status, entry.updated_at, entry.run_id),
            )
        return entry

    def save_entry(
        self,
        session_id: str,
        run_id: str,
        *,
        title: str | None = None,
        summary: str | None = None,
    ) -> AtlasEntry:
        self._ensure_ready()
        entry = self.get_entry_by_run(run_id)
        if entry is None or entry.session_id != str(session_id or "").strip():
            raise FileNotFoundError(f"Atlas candidate not found for run: {run_id}")

        if title is not None and str(title).strip():
            entry.title = str(title).strip()
        if summary is not None and str(summary).strip():
            entry.summary = str(summary).strip()

        entry.slug = self._resolve_unique_slug(slugify_atlas_title(entry.title), current_entry_id=entry.entry_id)
        entry.status = "saved"
        entry.saved_at = atlas_now_iso()
        entry.updated_at = entry.saved_at
        markdown_path = self._write_markdown_entry(entry)
        entry.markdown_path = str(markdown_path)

        with self._transaction() as conn:
            conn.execute(
                """
                UPDATE atlas_entries
                SET updated_at = ?, title = ?, summary = ?, slug = ?, status = ?,
                    saved_at = ?, markdown_path = ?
                WHERE run_id = ?
                """,
                (
                    entry.updated_at,
                    entry.title,
                    entry.summary,
                    entry.slug,
                    entry.status,
                    entry.saved_at,
                    entry.markdown_path,
                    entry.run_id,
                ),
            )
        self._write_index()
        return entry

    def list_entries(self, *, status: str = "saved", limit: int | None = None) -> list[AtlasEntry]:
        self._ensure_ready()
        query = "SELECT * FROM atlas_entries WHERE status = ? ORDER BY updated_at DESC"
        params: list[Any] = [status]
        if limit is not None:
            normalized_limit = max(int(limit), 0)
            if normalized_limit == 0:
                return []
            query = f"{query} LIMIT ?"
            params.append(normalized_limit)
        with self._connect() as conn:
            rows = conn.execute(query, tuple(params)).fetchall()
        return [entry for row in rows if (entry := self._entry_from_row(row)) is not None]

    def _resolve_unique_slug(self, base_slug: str, *, current_entry_id: str = "") -> str:
        slug = base_slug or "atlas-entry"
        existing = {entry.slug: entry.entry_id for entry in self.list_entries(limit=500)}
        if slug not in existing or existing[slug] == current_entry_id:
            return slug
        suffix = 2
        while True:
            candidate = f"{slug}-{suffix}"
            if candidate not in existing or existing[candidate] == current_entry_id:
                return candidate
            suffix += 1

    def _write_markdown_entry(self, entry: AtlasEntry) -> pathlib.Path:
        self.entries_dir.mkdir(parents=True, exist_ok=True)
        path = self.entries_dir / f"{entry.slug}.md"
        _write_text_atomic(path, self._build_markdown_document(entry))
        return path

    def _write_index(self) -> None:
        self.atlas_root.mkdir(parents=True, exist_ok=True)
        entries = self.list_entries(limit=200)
        lines = ["# METIS Atlas", ""]
        if not entries:
            lines.append("_No Atlas entries saved yet._")
            lines.append("")
            _write_text_atomic(self.index_path, "\n".join(lines))
            return

        for entry in entries:
            saved_at = self._format_saved_at(entry.saved_at or entry.updated_at)
            lines.append(
                f"- **[{entry.title}](entries/{entry.slug}.md)** — {entry.summary or 'Saved from companion suggestion.'}"
            )
            lines.append(
                f"  - mode: `{entry.mode or 'Q&A'}` | sources: `{entry.source_count}` | saved: `{saved_at}`"
            )
        lines.append("")
        _write_text_atomic(self.index_path, "\n".join(lines))

    @staticmethod
    def _format_saved_at(value: str) -> str:
        candidate = str(value or "").strip()
        if not candidate:
            return ""
        try:
            dt = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d %H:%M UTC")
        except ValueError:
            return candidate

    @staticmethod
    def _yaml_quote(value: str) -> str:
        return str(value or "").replace("\\", "\\\\").replace('"', '\\"')

    @classmethod
    def _build_markdown_document(cls, entry: AtlasEntry) -> str:
        lines = [
            "---",
            f'title: "{cls._yaml_quote(entry.title)}"',
            f'summary: "{cls._yaml_quote(entry.summary)}"',
            f'session_id: "{cls._yaml_quote(entry.session_id)}"',
            f'run_id: "{cls._yaml_quote(entry.run_id)}"',
            f'mode: "{cls._yaml_quote(entry.mode)}"',
            f'index_id: "{cls._yaml_quote(entry.index_id)}"',
            f"source_count: {entry.source_count}",
            f"top_score: {entry.top_score:.4f}",
            f'created_at: "{cls._yaml_quote(entry.created_at)}"',
            f'updated_at: "{cls._yaml_quote(entry.updated_at)}"',
            "---",
            "",
            f"# {entry.title}",
            "",
        ]
        if entry.summary:
            lines.append(entry.summary)
            lines.append("")
        lines.append(entry.body_md.strip() or "_No body content recorded._")
        lines.append("")
        lines.append("## Sources")
        lines.append("")
        if not entry.sources:
            lines.append("- No grounded sources were captured.")
        else:
            for source in entry.sources:
                label = str(source.get("source") or source.get("title") or "Unknown source").strip()
                snippet = str(source.get("snippet") or "").strip()
                score = source.get("score")
                score_text = ""
                if isinstance(score, (int, float)):
                    score_text = f" (score {float(score):.2f})"
                lines.append(f"- {label}{score_text}")
                if snippet:
                    lines.append(f"  - {snippet[:240]}")
        lines.append("")
        return "\n".join(lines)
