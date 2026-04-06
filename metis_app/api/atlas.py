"""Atlas candidate and saved-entry routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from metis_app.services.workspace_orchestrator import WorkspaceOrchestrator

from .models import (
    AtlasDecisionRequestModel,
    AtlasEntryModel,
    AtlasSaveRequestModel,
)

router = APIRouter(prefix="/v1/atlas", tags=["atlas"])


@router.get("/candidate", response_model=AtlasEntryModel)
def get_atlas_candidate(session_id: str, run_id: str) -> dict:
    candidate = WorkspaceOrchestrator().get_atlas_candidate(
        session_id=session_id,
        run_id=run_id,
    )
    if candidate is None:
        raise HTTPException(status_code=404, detail="Atlas candidate not found")
    return candidate


@router.post("/save", response_model=AtlasEntryModel)
def save_atlas_entry(payload: AtlasSaveRequestModel) -> dict:
    try:
        return WorkspaceOrchestrator().save_atlas_entry(
            session_id=payload.session_id,
            run_id=payload.run_id,
            title=payload.title,
            summary=payload.summary,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/decision", response_model=AtlasEntryModel)
def decide_atlas_candidate(payload: AtlasDecisionRequestModel) -> dict:
    try:
        return WorkspaceOrchestrator().decide_atlas_candidate(
            session_id=payload.session_id,
            run_id=payload.run_id,
            decision=payload.decision,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/entries", response_model=list[AtlasEntryModel])
def list_atlas_entries(limit: int = 20) -> list[dict]:
    return WorkspaceOrchestrator().list_atlas_entries(limit=limit)


@router.get("/entries/{entry_id}", response_model=AtlasEntryModel)
def get_atlas_entry(entry_id: str) -> dict:
    entry = WorkspaceOrchestrator().get_atlas_entry(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Atlas entry not found")
    return entry
