"""Typed records for companion-suggested Atlas entries."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
import re
import uuid


def atlas_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return int(default)


def slugify_atlas_title(title: str, *, fallback: str = "atlas-entry") -> str:
    candidate = re.sub(r"[^a-z0-9]+", "-", str(title or "").strip().lower()).strip("-")
    return candidate[:80] or fallback


@dataclass(slots=True)
class AtlasEntry:
    entry_id: str
    created_at: str
    updated_at: str
    session_id: str
    run_id: str
    title: str
    summary: str
    body_md: str
    sources: list[dict[str, Any]] = field(default_factory=list)
    mode: str = ""
    index_id: str = ""
    top_score: float = 0.0
    source_count: int = 0
    confidence: float = 0.0
    rationale: str = ""
    slug: str = ""
    status: str = "candidate"
    saved_at: str = ""
    markdown_path: str = ""

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def create_candidate(
        cls,
        *,
        session_id: str,
        run_id: str,
        title: str,
        summary: str,
        body_md: str,
        sources: list[dict[str, Any]] | None = None,
        mode: str = "",
        index_id: str = "",
        top_score: float = 0.0,
        source_count: int = 0,
        confidence: float = 0.0,
        rationale: str = "",
    ) -> "AtlasEntry":
        now = atlas_now_iso()
        slug = slugify_atlas_title(title)
        return cls(
            entry_id=str(uuid.uuid4()),
            created_at=now,
            updated_at=now,
            session_id=str(session_id or "").strip(),
            run_id=str(run_id or "").strip(),
            title=str(title or "").strip() or "Untitled Atlas Entry",
            summary=str(summary or "").strip(),
            body_md=str(body_md or "").strip(),
            sources=[dict(item) for item in (sources or []) if isinstance(item, dict)],
            mode=str(mode or "").strip(),
            index_id=str(index_id or "").strip(),
            top_score=max(0.0, _coerce_float(top_score, 0.0)),
            source_count=max(_coerce_int(source_count, 0), 0),
            confidence=max(0.0, min(1.0, _coerce_float(confidence, 0.0))),
            rationale=str(rationale or "").strip(),
            slug=slug,
            status="candidate",
            saved_at="",
            markdown_path="",
        )

    @classmethod
    def from_payload(cls, payload: dict[str, Any] | None) -> "AtlasEntry":
        data = dict(payload or {})
        title = str(data.get("title") or "Untitled Atlas Entry").strip()
        slug = str(data.get("slug") or "").strip() or slugify_atlas_title(title)
        return cls(
            entry_id=str(data.get("entry_id") or uuid.uuid4()),
            created_at=str(data.get("created_at") or atlas_now_iso()),
            updated_at=str(data.get("updated_at") or data.get("created_at") or atlas_now_iso()),
            session_id=str(data.get("session_id") or "").strip(),
            run_id=str(data.get("run_id") or "").strip(),
            title=title,
            summary=str(data.get("summary") or "").strip(),
            body_md=str(data.get("body_md") or "").strip(),
            sources=[
                dict(item)
                for item in (data.get("sources") or [])
                if isinstance(item, dict)
            ],
            mode=str(data.get("mode") or "").strip(),
            index_id=str(data.get("index_id") or "").strip(),
            top_score=max(0.0, _coerce_float(data.get("top_score"), 0.0)),
            source_count=max(_coerce_int(data.get("source_count"), 0), 0),
            confidence=max(0.0, min(1.0, _coerce_float(data.get("confidence"), 0.0))),
            rationale=str(data.get("rationale") or "").strip(),
            slug=slug,
            status=str(data.get("status") or "candidate").strip() or "candidate",
            saved_at=str(data.get("saved_at") or "").strip(),
            markdown_path=str(data.get("markdown_path") or "").strip(),
        )
