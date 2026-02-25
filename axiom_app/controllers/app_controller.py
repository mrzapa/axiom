"""axiom_app.controllers.app_controller — Top-level application controller.

AppController mediates between AppModel (state) and AppView (UI).  It
binds user actions to model mutations and triggers view refreshes.

Background tasks are submitted via a BackgroundRunner; a recurring
``root.after()`` poll drains the message queue and routes each message
to the appropriate view method.

All action methods are stubs (TODO/pass) for now.  They will be filled in
as logic is extracted from agentic_rag_gui.py.
"""

from __future__ import annotations

from concurrent.futures import Future
from typing import TYPE_CHECKING, Any, Callable

from axiom_app.utils.background import BackgroundRunner, CancelToken

if TYPE_CHECKING:
    from axiom_app.models.app_model import AppModel
    from axiom_app.views.app_view import AppView

# How often (ms) the main thread polls the message queue while a task runs.
_POLL_INTERVAL_MS = 100


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
        self._runner = BackgroundRunner()
        self._active_token: CancelToken | None = None
        self._active_future: Future | None = None

    # ------------------------------------------------------------------
    # Event wiring
    # ------------------------------------------------------------------

    def wire_events(self) -> None:
        """Bind view widgets to controller callbacks.

        TODO: connect menu items, buttons, and keyboard shortcuts to the
        action methods below once the real UI panels are migrated.
        """
        # Hook window close so the thread pool is cleaned up.
        self.view.root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ------------------------------------------------------------------
    # Background task management
    # ------------------------------------------------------------------

    def start_task(self, task_name: str, fn: Callable[..., Any], /, *args: Any) -> None:
        """Submit *fn* to the background runner and begin polling.

        Parameters
        ----------
        task_name:
            Human-readable label used in status messages and log output.
        fn:
            Worker callable.  BackgroundRunner prepends two arguments:
            ``post_message`` and ``cancel_token`` (see BackgroundRunner.submit).
        *args:
            Additional positional arguments forwarded to *fn* after the
            two injected ones.

        If a task is already running, it is cancelled before the new one starts.
        """
        # Cancel any in-flight task first.
        if self._active_token is not None:
            self._active_token.cancel()

        token = CancelToken()
        self._active_token = token
        self._active_future = self._runner.submit(fn, *args, cancel_token=token, task_name=task_name)
        self._schedule_poll()

    def cancel_current_task(self) -> None:
        """Signal the active background task to stop (cooperative)."""
        if self._active_token is not None:
            self._active_token.cancel()
        self.view.set_status("Cancelling…")

    def shutdown(self) -> None:
        """Tear down the thread pool (call on window close)."""
        if self._active_token is not None:
            self._active_token.cancel()
        self._runner.shutdown(wait=False)

    # ------------------------------------------------------------------
    # Internal poll loop
    # ------------------------------------------------------------------

    def _schedule_poll(self) -> None:
        self.view.root.after(_POLL_INTERVAL_MS, self._poll)

    def _poll(self) -> None:
        """Drain the message queue and update the view; reschedule if needed."""
        for msg in self._runner.poll_messages():
            self._handle_message(msg)

        # Keep polling while the task is still running.
        if self._active_future is not None and not self._active_future.done():
            self._schedule_poll()
        else:
            self._active_future = None
            self._active_token = None

    def _handle_message(self, msg: dict[str, Any]) -> None:
        mtype = msg.get("type")
        if mtype == "status":
            self.view.set_status(msg.get("text", ""))
        elif mtype == "progress":
            self.view.set_progress(int(msg.get("current", 0)), int(msg.get("total", 1)))
        elif mtype == "error":
            self.view.set_status(f"Error: {msg.get('text', 'unknown error')}")
        elif mtype == "done":
            task = msg.get("task_name", "Task")
            self.view.set_status(f"{task} complete." if task else "Done.")

    # ------------------------------------------------------------------
    # Window close
    # ------------------------------------------------------------------

    def _on_close(self) -> None:
        self.shutdown()
        self.view.root.destroy()

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
          2. Define a worker function and call self.start_task("Build index", worker).
          3. Worker updates self.model.index_state on completion via the "done" message.
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
          3. Call self.start_task("Query", worker, prompt).
          4. Stream response tokens via "status" messages into the chat panel.
          5. Append assistant turn on "done".
        """
        pass  # TODO

    def on_cancel_job(self) -> None:
        """Cancel any running background job (ingestion or query)."""
        self.cancel_current_task()
