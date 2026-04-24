"""In-process activity bridge for Seedling worker events."""

from __future__ import annotations

from collections import deque
import threading
import time
import uuid
from typing import Any

_MAX_EVENTS = 20
_VALID_STATES = {"running", "completed", "error"}
_events: deque[dict[str, Any]] = deque(maxlen=_MAX_EVENTS)
_lock = threading.Lock()
_sequence = 0
# Random per-process boot ID. Long-lived browser tabs use the prefix to tell
# pre- and post-restart events apart so the client-side dedup set cannot drop
# replayed sequence numbers as duplicates after the API restarts.
_boot_id = uuid.uuid4().hex[:12]


def get_seedling_activity_boot_id() -> str:
    """Return the boot ID embedded in this process's event IDs."""
    return _boot_id


def record_seedling_activity(event: dict[str, object]) -> None:
    """Record a worker progress event as a CompanionActivityEvent payload."""
    global _sequence
    state = str(event.get("state") or "running")
    if state not in _VALID_STATES:
        state = "running"
    summary = str(event.get("summary") or "Seedling heartbeat")
    trigger = str(event.get("trigger") or "lifecycle")
    payload = event.get("status")
    with _lock:
        _sequence += 1
        event_id = f"seedling-{_boot_id}-{_sequence}"
        _events.append(
            {
                "source": "seedling",
                "state": state,
                "trigger": trigger,
                "summary": summary,
                "timestamp": int(time.time() * 1000),
                "payload": {
                    "event_id": event_id,
                    "boot_id": _boot_id,
                    "status": payload if isinstance(payload, dict) else {},
                },
            }
        )


def list_seedling_activity_events(limit: int = 8) -> list[dict[str, Any]]:
    """Return recent Seedling events without consuming them."""
    limit = max(0, min(int(limit), _MAX_EVENTS))
    with _lock:
        return list(_events)[-limit:]


def clear_seedling_activity_events() -> None:
    """Clear buffered events for tests."""
    global _sequence, _boot_id
    with _lock:
        _events.clear()
        _sequence = 0
        _boot_id = uuid.uuid4().hex[:12]
