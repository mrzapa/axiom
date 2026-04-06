from __future__ import annotations

from metis_app.models.atlas_types import AtlasEntry
from metis_app.services.atlas_repository import AtlasRepository


def _make_candidate() -> AtlasEntry:
    return AtlasEntry.create_candidate(
        session_id="session-1",
        run_id="run-1",
        title="What changed in the quarter?",
        summary="Revenue improved and churn dropped.",
        body_md="Revenue improved while churn dropped in the grounded answer.",
        sources=[
            {
                "sid": "S1",
                "source": "report.txt",
                "snippet": "Revenue improved in Q4.",
                "score": 0.88,
            },
            {
                "sid": "S2",
                "source": "briefing.txt",
                "snippet": "Churn dropped in November.",
                "score": 0.81,
            },
        ],
        mode="Research",
        index_id="idx-quarterly",
        top_score=0.88,
        source_count=2,
        confidence=0.79,
        rationale="2 grounded sources, top score 0.88, mode Research.",
    )


def test_atlas_repository_candidate_save_and_decision_roundtrip(tmp_path) -> None:
    repo = AtlasRepository(
        db_path=tmp_path / "rag_sessions.db",
        atlas_root=tmp_path / "atlas",
    )

    candidate = repo.upsert_candidate(_make_candidate())

    pending = repo.get_candidate("session-1", "run-1")
    assert pending is not None
    assert pending.status == "candidate"
    assert pending.title == candidate.title

    snoozed = repo.record_decision("session-1", "run-1", "snoozed")
    assert snoozed.status == "snoozed"
    assert repo.get_candidate("session-1", "run-1") is None

    declined = repo.record_decision("session-1", "run-1", "declined")
    assert declined.status == "declined"


def test_atlas_repository_materializes_saved_markdown_and_index(tmp_path) -> None:
    repo = AtlasRepository(
        db_path=tmp_path / "rag_sessions.db",
        atlas_root=tmp_path / "atlas",
    )
    repo.upsert_candidate(_make_candidate())

    saved = repo.save_entry("session-1", "run-1")

    assert saved.status == "saved"
    assert saved.markdown_path
    markdown_path = tmp_path / "atlas" / "entries" / f"{saved.slug}.md"
    index_path = tmp_path / "atlas" / "index.md"
    assert markdown_path.exists()
    assert index_path.exists()

    markdown = markdown_path.read_text(encoding="utf-8")
    assert "# What changed in the quarter?" in markdown
    assert "## Sources" in markdown
    assert "report.txt" in markdown

    index = index_path.read_text(encoding="utf-8")
    assert "METIS Atlas" in index
    assert "What changed in the quarter?" in index

    listed = repo.list_entries(limit=10)
    assert len(listed) == 1
    assert listed[0].entry_id == saved.entry_id
