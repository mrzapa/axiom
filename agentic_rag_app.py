import tkinter as tk
from tkinter import ttk


class AgenticRAGApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.setup_ui()

    def setup_ui(self) -> None:
        style = ttk.Style()
        style.theme_use("clam")

        palette = {
            "background": "#0f172a",
            "surface": "#1e293b",
            "accent": "#38bdf8",
            "text": "#e2e8f0",
            "muted": "#94a3b8",
        }

        self.root.configure(background=palette["background"])

        style.configure(
            "TFrame",
            background=palette["background"],
            padding=16,
        )
        style.configure(
            "TLabel",
            background=palette["background"],
            foreground=palette["text"],
            padding=(8, 4),
        )
        style.configure(
            "TButton",
            background=palette["accent"],
            foreground=palette["background"],
            padding=(14, 8),
            bordercolor=palette["accent"],
        )
        style.map(
            "TButton",
            background=[("active", palette["surface"])],
            foreground=[("active", palette["text"])],
        )
        style.configure(
            "TEntry",
            fieldbackground=palette["surface"],
            foreground=palette["text"],
            bordercolor=palette["muted"],
            padding=(10, 6),
        )
        style.configure(
            "TCombobox",
            fieldbackground=palette["surface"],
            foreground=palette["text"],
            background=palette["surface"],
            bordercolor=palette["muted"],
            padding=(10, 6),
        )
        style.map(
            "TCombobox",
            fieldbackground=[("readonly", palette["surface"])],
            foreground=[("readonly", palette["text"])],
        )
        style.configure(
            "TNotebook",
            background=palette["background"],
            bordercolor=palette["muted"],
            padding=(12, 8),
        )
        style.configure(
            "TNotebook.Tab",
            background=palette["surface"],
            foreground=palette["text"],
            padding=(12, 6),
        )
        style.map(
            "TNotebook.Tab",
            background=[("selected", palette["accent"])],
            foreground=[("selected", palette["background"])],
        )

        container = ttk.Frame(self.root)
        container.pack(fill="both", expand=True, padx=24, pady=24)

        header = ttk.Label(container, text="Agentic RAG")
        header.pack(anchor="w")

        controls = ttk.Frame(container)
        controls.pack(fill="x", pady=16)

        query_label = ttk.Label(controls, text="Query")
        query_label.grid(row=0, column=0, sticky="w", padx=(0, 8))

        query_entry = ttk.Entry(controls, width=40)
        query_entry.grid(row=0, column=1, sticky="ew", padx=(0, 12))

        source_box = ttk.Combobox(
            controls,
            values=["Docs", "Web", "Hybrid"],
            state="readonly",
        )
        source_box.current(0)
        source_box.grid(row=0, column=2, sticky="w", padx=(0, 12))

        run_button = ttk.Button(controls, text="Run")
        run_button.grid(row=0, column=3, sticky="w")

        controls.columnconfigure(1, weight=1)

        notebook = ttk.Notebook(container)
        notebook.pack(fill="both", expand=True)

        results_frame = ttk.Frame(notebook)
        logs_frame = ttk.Frame(notebook)
        notebook.add(results_frame, text="Results")
        notebook.add(logs_frame, text="Logs")


if __name__ == "__main__":
    root = tk.Tk()
    root.title("Agentic RAG")
    root.geometry("720x480")
    AgenticRAGApp(root)
    root.mainloop()
