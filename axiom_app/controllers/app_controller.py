"""axiom_app.controllers.app_controller — Top-level application controller.

AppController mediates between AppModel (state) and AppView (UI).  It
binds user actions to model mutations and triggers view refreshes.

All action methods are stubs (TODO/pass) for now.  They will be filled in
as logic is extracted from agentic_rag_gui.py.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from axiom_app.models.app_model import AppModel
    from axiom_app.views.app_view import AppView


class AppController:
    """Mediates between AppModel and AppView.

    Parameters
    ----------
    model:
        The single AppModel instance holding application state.
    view:
        The AppView instance owning the root Tk window.
    """

    def __init__(self, model: AppModel, view: AppView) -> None:
        self.model = model
        self.view = view

    # ------------------------------------------------------------------
    # Event wiring
    # ------------------------------------------------------------------

    def wire_events(self) -> None:
        """Bind view widgets to controller callbacks.

        TODO: connect menu items, buttons, and keyboard shortcuts to the
        action methods below once the real UI panels are migrated.
        """
        pass  # TODO

    # ------------------------------------------------------------------
    # Action handlers (called by bound events or public API)
    # ------------------------------------------------------------------

    def on_open_files(self) -> None:
        """Let the user pick document files and load them into the model.

        TODO:
          1. Open a tk.filedialog to select files.
          2. Call self.model.set_documents(paths).
          3. Update self.view status bar.
        """
        pass  # TODO

    def on_build_index(self) -> None:
        """Trigger ingestion and vector-index construction.

        TODO:
          1. Validate self.model.documents is non-empty.
          2. Run the ingestion pipeline (currently in AgenticRAGApp).
          3. Update self.model.index_state on completion.
          4. Refresh view status.
        """
        pass  # TODO

    def on_send_prompt(self, prompt: str = "") -> None:
        """Dispatch a user query through the agentic RAG pipeline.

        Parameters
        ----------
        prompt:
            Raw text from the chat input widget.  Empty string is a no-op.

        TODO:
          1. Validate index is built.
          2. Append user turn to self.model.chat_history.
          3. Stream response tokens into the chat view panel.
          4. Append assistant turn on completion.
        """
        pass  # TODO

    def on_cancel_job(self) -> None:
        """Cancel any running background job (ingestion or query).

        TODO:
          1. Signal cancellation to the active job thread/task.
          2. Update view status bar to "Cancelled.".
        """
        pass  # TODO
