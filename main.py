"""main.py — Canonical entry point for the Axiom application.

Default behaviour (AXIOM_NEW_APP unset or 0):
  Delegates to agentic_rag_gui so that ``python main.py`` is identical to
  ``python agentic_rag_gui.py``.

New MVC skeleton (opt-in):
  Set the environment variable AXIOM_NEW_APP=1 to run the refactored
  axiom_app.app.run_app() instead::

      AXIOM_NEW_APP=1 python main.py

  This lets developers test the MVC skeleton without breaking the default
  experience for anyone running the production app.

Migration path:
  TODO (Phase N): once AgenticRAGApp has been fully split into
  axiom_app controllers/views, remove the legacy branch and make the
  new app the only code path.

  TODO: add CLI argument parsing here (--smoke, --profile, --theme …)
        so agentic_rag_gui.py no longer needs to inspect sys.argv directly.

  TODO: set up logging configuration before handing off to the app bootstrap.
"""

import os
import sys


def main() -> None:
    if os.environ.get("AXIOM_NEW_APP", "0").strip() == "1":
        # -----------------------------------------------------------------------
        # New MVC skeleton (opt-in via AXIOM_NEW_APP=1)
        # -----------------------------------------------------------------------
        from axiom_app.app import run_app

        run_app()
    else:
        # -----------------------------------------------------------------------
        # Legacy path: run the monolithic app unchanged.
        # -----------------------------------------------------------------------
        # Import triggers module-level setup in agentic_rag_gui (UI backend
        # detection, constant definitions) exactly as if the file were run directly.
        import agentic_rag_gui  # noqa: F401  (imported for side-effects / __main__ block)

        # agentic_rag_gui uses `if __name__ == "__main__"` to start the Tk loop.
        # We replicate that logic here so `python main.py` works the same way.
        import tkinter as tk
        import traceback
        from tkinter import messagebox

        from agentic_rag_gui import AgenticRAGApp

        try:
            root = tk.Tk()
            # Hide window while UI builds to avoid a blank flash (mirrors
            # the behaviour in agentic_rag_gui.__main__).
            root.withdraw()
            app = AgenticRAGApp(root)  # noqa: F841
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
    main()
