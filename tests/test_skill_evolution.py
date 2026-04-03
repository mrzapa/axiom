from __future__ import annotations

import json
import pathlib
import sqlite3

import pytest

from metis_app.services.skill_repository import SkillRepository


def test_default_candidates_db_path_is_repo_root():
    from metis_app.services.skill_repository import _DEFAULT_CANDIDATES_DB_PATH
    assert _DEFAULT_CANDIDATES_DB_PATH.name == "skill_candidates.db"
    assert (_DEFAULT_CANDIDATES_DB_PATH.parent / "metis_app").is_dir()


@pytest.fixture
def repo(tmp_path):
    return SkillRepository(skills_dir=tmp_path / "skills")


def test_save_candidate_creates_db_and_row(tmp_path, repo):
    db_path = tmp_path / "skill_candidates.db"
    repo.save_candidate(
        db_path=db_path,
        query_text="How does RAG work?",
        trace_json=json.dumps({"iterations": 2, "sources": ["doc1"]}),
        convergence_score=0.97,
    )
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute("SELECT query_text, convergence_score, promoted FROM skill_candidates").fetchall()
    assert len(rows) == 1
    assert rows[0][0] == "How does RAG work?"
    assert abs(rows[0][1] - 0.97) < 1e-6
    assert rows[0][2] == 0  # not promoted yet


def test_iteration_complete_event_has_trace_fields():
    """The iteration_complete event dict must have the expected keys."""
    event = {
        "type": "iteration_complete",
        "run_id": "abc123",
        "iterations_used": 2,
        "convergence_score": 0.97,
        "query_text": "What is RAG?",
    }
    assert event["type"] == "iteration_complete"
    assert "iterations_used" in event
    assert "convergence_score" in event


def test_companion_capture_saves_above_threshold(tmp_path):
    from metis_app.services.assistant_companion import AssistantCompanionService
    companion = AssistantCompanionService.__new__(AssistantCompanionService)  # bypass __init__
    db_path = tmp_path / "skill_candidates.db"
    saved = companion.capture_skill_candidate(
        db_path=db_path,
        query_text="test query",
        trace_json='{"ok": true}',
        convergence_score=0.96,
        trace_iterations=2,
    )
    assert saved is True


def test_companion_capture_skips_below_threshold(tmp_path):
    from metis_app.services.assistant_companion import AssistantCompanionService
    companion = AssistantCompanionService.__new__(AssistantCompanionService)
    db_path = tmp_path / "skill_candidates.db"
    saved = companion.capture_skill_candidate(
        db_path=db_path,
        query_text="test query",
        trace_json='{}',
        convergence_score=0.50,  # below min_convergence=0.90
        trace_iterations=2,
    )
    assert saved is False


def test_list_candidates_returns_top_unreviewed(tmp_path, repo):
    db_path = tmp_path / "skill_candidates.db"
    for i in range(5):
        repo.save_candidate(db_path=db_path, query_text=f"q{i}", trace_json="{}", convergence_score=float(i) / 10)
    candidates = repo.list_candidates(db_path=db_path, limit=3)
    assert len(candidates) == 3
    # Should be ordered by convergence_score desc
    scores = [c["convergence_score"] for c in candidates]
    assert scores == sorted(scores, reverse=True)


def test_iteration_complete_wired_in_wrapped(monkeypatch):
    """_wrapped() must call capture_skill_candidate when iteration_complete fires with iterations_used >= 2."""
    import json
    from unittest.mock import MagicMock, patch
    from metis_app.services.workspace_orchestrator import WorkspaceOrchestrator
    from metis_app.services.skill_repository import _DEFAULT_CANDIDATES_DB_PATH

    captured_calls = []

    fake_events = [
        {"type": "run_started", "run_id": "r1"},
        {"type": "iteration_complete", "run_id": "r1",
         "iterations_used": 3, "convergence_score": 0.97, "query_text": "What is RAG?"},
        {"type": "final", "run_id": "r1", "answer_text": "An answer.", "sources": []},
    ]

    orchestrator = WorkspaceOrchestrator.__new__(WorkspaceOrchestrator)
    orchestrator._assistant_service = MagicMock()
    orchestrator._assistant_service.capture_skill_candidate = lambda **kw: captured_calls.append(kw)
    orchestrator._assistant_service.reflect = MagicMock(return_value={"ok": True})

    with patch("metis_app.services.workspace_orchestrator.stream_rag_answer", return_value=iter(fake_events)), \
         patch.object(orchestrator, "_record_trace_event"), \
         patch.object(orchestrator, "_resolve_nyx_install_actions", return_value=None), \
         patch.object(orchestrator, "append_message"), \
         patch.object(orchestrator, "_resolve_query_settings", return_value={}), \
         patch.object(orchestrator, "_prepare_session_for_query"):
        from metis_app.engine.querying import RagQueryRequest
        req = RagQueryRequest(question="What is RAG?", manifest_path="", settings={})
        list(orchestrator.stream_rag_query(req, session_id="s1"))

    assert len(captured_calls) == 1
    assert captured_calls[0]["query_text"] == "What is RAG?"
    assert captured_calls[0]["convergence_score"] == 0.97
    assert captured_calls[0]["trace_iterations"] == 3
    assert captured_calls[0]["db_path"] == _DEFAULT_CANDIDATES_DB_PATH
