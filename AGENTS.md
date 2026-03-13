# Axiom Agent Context

## What Axiom Is

Axiom is a local-first, provider-agnostic RAG app for indexing personal documents and asking grounded questions without locking the user to one model stack. It supports both a PySide6 desktop shell and a shared CLI, and it can run fully offline with local models.

User-facing modes:
- `Q&A`
- `Summary`
- `Tutor`
- `Research`
- `Evidence Pack`

## Canonical Entry Points

- `main.py`: canonical process entry; routes between the MVC GUI, explicit `--cli` mode, and the legacy fallback when `AXIOM_NEW_APP=0`.
- `axiom_app/app.py`: MVC bootstrap; initializes logging, creates `AppModel`/`AppView`/`AppController`, wires the poll loop, and enters Qt.
- `axiom_app/controllers/app_controller.py`: top-level orchestration for indexing, querying, session state, skill state, and settings persistence.

## Code Map

- `axiom_app/services/*`: core app capabilities such as index build/load/query, runtime resolution, response pipelines, vector-store adapters, local model helpers, sessions, skills, profiles, and traces.
- `axiom_app/utils/*`: shared plumbing such as document loading, embedding/LLM providers, background runners, logging, dependency bootstrap, mock embeddings, model presets, and knowledge-graph helpers.
- `axiom_app/models/*`: central app state plus typed payloads used by services and controllers.
- `axiom_app/views/*`: PySide6 UI shell and widgets. Keep view concerns here rather than in services.

## Persistence And Repo Data

Repo-root persistence paths used by the MVC app and related services:
- `rag_sessions.db`: SQLite chat/session history.
- `indexes/`: persisted index bundles and manifests.
- `profiles/`: file-backed agent profiles.
- `skills/`: skill folders discovered via `*/SKILL.md`.
- `traces/`: run traces, including `runs.jsonl` and per-run logs.

Notes:
- Some directories are created on demand by the owning repository/service.
- Default settings live in `axiom_app/default_settings.json`.
- User overrides are written to `settings.json` in the repo root.

## Dev Commands

Install:

```powershell
pip install -e ".[dev]"
pip install -e ".[dev,runtime-all]"   # optional full runtime bundle
```

Run:

```powershell
python main.py
python main.py --cli index --file README.md
python main.py --cli query --file README.md --question "how do I install this?"
python -m axiom_app.cli --help
```

Checks:

```powershell
ruff check .
python -m pytest -q
$env:QT_QPA_PLATFORM="offscreen"; python -m pytest -q tests/test_app_view_smoke.py
```

## Style Conventions

- Use `ruff` and `pytest` as the default lint/test baseline.
- Prefer small, composable functions over large mixed-responsibility methods.
- Avoid unrelated refactors while solving the task at hand.
- Keep runtime behavior changes out of UI-only work unless the task explicitly calls for them.

## Extend Safely

- Add new settings keys in `axiom_app/default_settings.json` first; user overrides layer on top via repo-root `settings.json`.
- Preserve `populate_settings()` and `collect_settings()` as the settings-facing UI persistence boundary.
- Keep UI concerns in `axiom_app/views/*` and orchestration in controllers; keep business logic and persistence in services.
- When extending the shell, do not rewrite backend, controller, service, or model behavior as incidental cleanup.

## UI Guardrails

These are active working agreements for the PySide6 shell redesign:

- Keep the app in PySide6 MVC.
- Clean by default: drawers and side panels should stay closed unless the current task needs them.
- Preserve the prompt-first empty-state workflow; avoid cluttering the primary compose area.
- Keep context visible in lightweight summaries or chips before expanding into heavier controls.
- Treat library, session, and inspector surfaces as contextual tools, not always-on chrome.
- Keep everyday surfaces calm; developer-only controls should stay outside the main workspace.
- Shared tokens, palettes, fonts, spacing, and reusable theme values belong in `axiom_app/views/styles.py`.
- One-off widget styling belongs in local widget/component QSS, not duplicated shared literals.
