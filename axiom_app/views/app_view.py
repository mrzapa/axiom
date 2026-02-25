"""axiom_app.views.app_view — Top-level application window (skeleton).

AppView owns the root Tk window and the top-level frame layout.  It does
NOT recreate the full Axiom UI yet; that happens incrementally as each
panel is migrated from agentic_rag_gui.py.

Current state: a root window with a single label and a placeholder frame
that future panels will be placed into.
"""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass  # future: from axiom_app.models.app_model import AppModel


class AppView:
    """Minimal root window for the MVC skeleton.

    Parameters
    ----------
    root:
        The ``tk.Tk`` instance created by ``run_app()``.  AppView does not
        call ``mainloop()``; that is the responsibility of the caller.
    """

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self._build()

    # ------------------------------------------------------------------
    # Window construction
    # ------------------------------------------------------------------

    def _build(self) -> None:
        """Build the minimal placeholder UI."""
        self.root.title("Axiom")
        self.root.geometry("800x600")
        self.root.minsize(480, 320)

        # Top-level container
        self._outer = ttk.Frame(self.root)
        self._outer.pack(fill="both", expand=True, padx=16, pady=16)

        # Placeholder banner
        self._banner = ttk.Label(
            self._outer,
            text="Axiom  (refactor in progress)",
            font=("TkDefaultFont", 16, "bold"),
            anchor="center",
        )
        self._banner.pack(fill="x", pady=(0, 12))

        # Placeholder content frame — panels will be packed here later
        self.content_frame = ttk.Frame(self._outer, relief="sunken", borderwidth=1)
        self.content_frame.pack(fill="both", expand=True)

        ttk.Label(
            self.content_frame,
            text="[ UI panels will appear here as they are migrated ]",
            foreground="gray",
            anchor="center",
        ).pack(expand=True)

        # Status bar at the bottom
        self._status_var = tk.StringVar(value="Ready.")
        self._status_bar = ttk.Label(
            self.root,
            textvariable=self._status_var,
            relief="sunken",
            anchor="w",
            padding=(4, 2),
        )
        self._status_bar.pack(side="bottom", fill="x")

    # ------------------------------------------------------------------
    # Public helpers (controller will call these)
    # ------------------------------------------------------------------

    def set_status(self, message: str) -> None:
        """Update the status-bar text."""
        self._status_var.set(message)

    def show(self) -> None:
        """Make the window visible (call after controller.wire_events())."""
        self.root.deiconify()
        self.root.lift()
