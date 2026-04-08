from __future__ import annotations

from importlib import import_module

from fastapi.testclient import TestClient as FastAPITestClient
from litestar.testing import TestClient as LitestarTestClient


def _entry_payload() -> dict[str, object]:
    return {
        "entry_id": "improvement-1",
        "artifact_key": "idea:reflection:completed_run:session-1:run-1:mem-1",
        "artifact_type": "idea",
        "created_at": "2026-04-06T20:00:00Z",
        "updated_at": "2026-04-06T20:05:00Z",
        "title": "Research follow-up idea",
        "summary": "Turn the last reflection into a durable idea.",
        "body_md": "Inspect the run and propose a better next experiment.",
        "session_id": "session-1",
        "run_id": "run-1",
        "status": "draft",
        "tags": ["assistant_reflection", "completed_run"],
        "upstream_ids": ["source-1"],
        "metadata": {"origin": "assistant_reflection"},
        "slug": "research-follow-up-idea",
        "saved_at": "2026-04-06T20:05:00Z",
        "markdown_path": "C:/tmp/improvements/ideas/research-follow-up-idea.md",
    }


def test_improvement_routes_round_trip_for_fastapi_and_litestar(monkeypatch) -> None:
    fastapi_improvements = import_module("metis_app.api.improvements")
    litestar_improvements = import_module("metis_app.api_litestar.routes.improvements")
    fastapi_app = import_module("metis_app.api.app")
    litestar_app = import_module("metis_app.api_litestar")

    captured: dict[str, object] = {}

    class _FakeOrchestrator:
        def list_improvement_entries(self, *, artifact_type: str = "", status: str = "", limit: int = 20):
            captured["list"] = (artifact_type, status, limit)
            return [_entry_payload()]

        def get_improvement_entry(self, entry_id: str):
            captured["get"] = entry_id
            if entry_id == "missing":
                return None
            return _entry_payload()

    monkeypatch.setattr(fastapi_improvements, "WorkspaceOrchestrator", lambda: _FakeOrchestrator())
    monkeypatch.setattr(litestar_improvements, "WorkspaceOrchestrator", lambda: _FakeOrchestrator())

    with FastAPITestClient(fastapi_app.create_app()) as fastapi_client, LitestarTestClient(
        app=litestar_app.create_app()
    ) as litestar_client:
        fast_list = fastapi_client.get(
            "/v1/improvements",
            params={"artifact_type": "idea", "status": "draft", "limit": 5},
        )
        lit_list = litestar_client.get(
            "/v1/improvements",
            params={"artifact_type": "idea", "status": "draft", "limit": 5},
        )
        assert fast_list.status_code == 200
        assert lit_list.status_code == 200
        assert fast_list.json()[0]["entry_id"] == "improvement-1"
        assert lit_list.json()[0]["entry_id"] == "improvement-1"

        fast_get = fastapi_client.get("/v1/improvements/improvement-1")
        lit_get = litestar_client.get("/v1/improvements/improvement-1")
        assert fast_get.status_code == 200
        assert lit_get.status_code == 200

        fast_missing = fastapi_client.get("/v1/improvements/missing")
        lit_missing = litestar_client.get("/v1/improvements/missing")
        assert fast_missing.status_code == 404
        assert lit_missing.status_code == 404

    assert captured["list"] == ("idea", "draft", 5)
    assert captured["get"] == "missing"


def test_create_improvement_entry_fastapi_and_litestar(monkeypatch) -> None:
    fastapi_improvements = import_module("metis_app.api.improvements")
    litestar_improvements = import_module("metis_app.api_litestar.routes.improvements")
    fastapi_app = import_module("metis_app.api.app")
    litestar_app = import_module("metis_app.api_litestar")

    created_payloads: list[dict] = []

    def _fake_upsert(payload: dict) -> dict:
        created_payloads.append(payload)
        return {
            **_entry_payload(),
            "artifact_type": payload["artifact_type"],
            "title": payload["title"],
            "artifact_key": payload.get("artifact_key", "idea:manual:test-hypothesis:abc12345"),
        }

    class _FakeOrchestrator:
        def upsert_improvement_entry(self, payload: dict) -> dict:
            return _fake_upsert(payload)

    monkeypatch.setattr(fastapi_improvements, "WorkspaceOrchestrator", lambda: _FakeOrchestrator())
    monkeypatch.setattr(litestar_improvements, "WorkspaceOrchestrator", lambda: _FakeOrchestrator())

    body = {"artifact_type": "idea", "title": "Test Hypothesis"}

    with FastAPITestClient(fastapi_app.create_app()) as fastapi_client:
        resp = fastapi_client.post("/v1/improvements", json=body)
        assert resp.status_code == 201
        data = resp.json()
        assert data["artifact_type"] == "idea"
        assert data["title"] == "Test Hypothesis"
        # auto-generated key must contain artifact_type and "manual"
        assert "idea" in data.get("artifact_key", "")
        assert "manual" in data.get("artifact_key", "")

    with LitestarTestClient(app=litestar_app.create_app()) as litestar_client:
        resp = litestar_client.post("/v1/improvements", json=body)
        assert resp.status_code == 201
        data = resp.json()
        assert data["artifact_type"] == "idea"
        assert data["title"] == "Test Hypothesis"

    assert len(created_payloads) == 2
