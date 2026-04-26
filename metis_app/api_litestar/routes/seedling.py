"""Seedling lifecycle endpoints."""

from __future__ import annotations

from litestar import Router, get

import metis_app.settings_store as _settings_store
from metis_app.seedling import (
    get_seedling_status,
    get_seedling_worker,
    list_seedling_activity_events,
)
from metis_app.seedling.overnight import compute_model_status


@get("/v1/seedling/status", sync_to_thread=False)
def get_status() -> dict:
    """Return the current Seedling status payload.

    ``model_status`` is recomputed on every request so the dock sees
    settings changes within one poll. Two stickiness rules apply:

    - When the worker has cached ``backend_unavailable`` (the runtime
      tried to load the GGUF and failed), keep ``backend_unavailable``
      even if the fresh settings-derived value would say
      ``backend_configured``. The runtime is known broken; the user
      shouldn't see a healthy pill until either the model fixes itself
      (next successful tick clears it) or the user changes settings.
    - When the user toggles the path or enabled flag away from
      ``backend_configured`` (so the fresh value is something else),
      clear the sticky ``backend_unavailable`` because the policy
      changed — the next opt-in attempt should get a fresh shot.
    """
    settings = _settings_store.load_settings()
    fresh = compute_model_status(settings)

    cached: str | None = None
    try:
        cached = get_seedling_status().model_status
    except Exception:
        cached = None

    if cached == "backend_unavailable" and fresh == "backend_configured":
        effective = "backend_unavailable"
    else:
        effective = fresh
        try:
            get_seedling_worker().set_overnight_status(model_status=effective)
        except Exception:
            # Status reads must never fail because the worker is mid-shutdown.
            pass

    payload = get_seedling_status().to_dict()
    payload["model_status"] = effective
    payload["activity_events"] = list_seedling_activity_events()
    return payload


router = Router(
    path="",
    route_handlers=[get_status],
    tags=["seedling"],
)
