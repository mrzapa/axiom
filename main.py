"""main.py — Future canonical entry point for the Axiom application.

Current behaviour (Phase 1 scaffold):
  Delegates unconditionally to agentic_rag_gui, so running
      python main.py
  is identical to running
      python agentic_rag_gui.py

Migration path:
  TODO (Phase N): replace the import-and-run block below with:
      from axiom_app.app import main
      if __name__ == "__main__":
          main()
  once AgenticRAGApp has been split into axiom_app controllers/views.

  TODO: add CLI argument parsing here (--smoke, --profile, --theme …)
        so agentic_rag_gui.py no longer needs to inspect sys.argv directly.

  TODO: set up logging configuration before handing off to the app bootstrap.
"""

import sys


def main() -> None:
    # ---------------------------------------------------------------------------
    # Phase 1: run the monolithic app unchanged.
    # ---------------------------------------------------------------------------
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
