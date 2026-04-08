"""Improvement-pipeline routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from metis_app.services.workspace_orchestrator import WorkspaceOrchestrator

from .models import ImprovementCreateRequest, ImprovementEntryModel

router = APIRouter(prefix="/v1/improvements", tags=["improvements"])


@router.get("", response_model=list[ImprovementEntryModel])
def list_improvement_entries(
    artifact_type: str = "",
    status: str = "",
    limit: int = 20,
) -> list[dict]:
    return WorkspaceOrchestrator().list_improvement_entries(
        artifact_type=artifact_type,
        status=status,
        limit=limit,
    )


@router.get("/{entry_id}", response_model=ImprovementEntryModel)
def get_improvement_entry(entry_id: str) -> dict:
    entry = WorkspaceOrchestrator().get_improvement_entry(entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Improvement entry not found")
    return entry


@router.post("", response_model=ImprovementEntryModel, status_code=201)
def create_improvement_entry(body: ImprovementCreateRequest) -> dict:
    import uuid as _uuid

    payload = body.model_dump()
    if not payload.get("artifact_key"):
        slug_base = str(payload.get("title") or "entry").lower().replace(" ", "-")[:48]
        payload["artifact_key"] = (
            f"{payload['artifact_type']}:manual:{slug_base}:{_uuid.uuid4().hex[:8]}"
        )
    return WorkspaceOrchestrator().upsert_improvement_entry(payload)
