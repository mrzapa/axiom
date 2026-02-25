"""axiom_app.app — MVC application bootstrap.

Entry point for the refactored Axiom application.  Instantiates model,
view, and controller in the correct order, wires events, then starts the
Tk main loop.

Usage (via env-var switch in main.py)::

    AXIOM_NEW_APP=1 python main.py

Or directly::

    python -m axiom_app.app
"""

from __future__ import annotations

import sys
import tkinter as tk
import traceback
from tkinter import messagebox

from axiom_app.controllers.app_controller import AppController
from axiom_app.models.app_model import AppModel
from axiom_app.views.app_view import AppView


def run_app() -> None:
    """Instantiate MVC triad, wire events, start Tk mainloop."""
    root = tk.Tk()
    # Keep window hidden until the UI is fully constructed.
    root.withdraw()

    try:
        model = AppModel()
        model.load_settings()

        view = AppView(root)

        controller = AppController(model, view)
        controller.wire_events()

        view.set_status(f"Documents: {len(model.documents)}  |  Index: {'built' if model.index_state.get('built') else 'not built'}")
        view.show()

        root.mainloop()

    except Exception as exc:
        detail = traceback.format_exc()
        concise = f"Startup Error: {exc}"
        print(concise, file=sys.stderr)
        print(detail, file=sys.stderr)
        try:
            messagebox.showerror(
                "Startup Error",
                f"{concise}\n\nDetails have been written to stderr.",
            )
        except Exception:
            pass


if __name__ == "__main__":
    run_app()
