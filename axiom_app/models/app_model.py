"""axiom_app.models.app_model — Central application state.

AppModel is the single source of truth for mutable app state.  It owns no
Tkinter objects; the view layer observes it (via callbacks) and the controller
mutates it.

All fields are placeholders for now.  Real implementations will replace the
TODO stubs as each controller is migrated from agentic_rag_gui.py.
"""

from __future__ import annotations

import logging
from typing import Any


class AppModel:
    """Holds application state; owns no UI objects.

    Attributes
    ----------
    documents:
        List of loaded document paths (str) or metadata dicts.
    index_state:
        Freeform dict describing the current vector-index state
        (e.g. ``{"built": False, "doc_count": 0}``).
    chat_history:
        List of chat turn dicts, each with at least ``"role"`` and
        ``"content"`` keys.
    settings:
        Flat dict of user-configurable settings loaded from disk.
    logger:
        Module-level logger for this model; controllers may inject their own.
    """

    def __init__(self) -> None:
        self.documents: list[Any] = []
        self.index_state: dict[str, Any] = {"built": False, "doc_count": 0}
        self.chat_history: list[dict[str, Any]] = []
        self.settings: dict[str, Any] = {}
        self.logger: logging.Logger = logging.getLogger(__name__)

    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------

    def load_settings(self) -> None:
        """Load user settings from disk into ``self.settings``.

        TODO: read from axiom_app/config.py / a JSON config file and
        populate self.settings.  For now this is a no-op.
        """
        pass  # TODO

    # ------------------------------------------------------------------
    # Documents
    # ------------------------------------------------------------------

    def set_documents(self, paths: list[Any]) -> None:
        """Replace the current document list.

        TODO: validate paths, update index_state accordingly.
        """
        self.documents = list(paths)  # TODO: enrich with metadata

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    def get_status_snapshot(self) -> dict[str, Any]:
        """Return a lightweight dict describing current state.

        Intended for logging and status-bar updates; must not be slow.
        """
        return {
            "document_count": len(self.documents),
            "index_built": self.index_state.get("built", False),
            "chat_turns": len(self.chat_history),
            "settings_loaded": bool(self.settings),
        }
