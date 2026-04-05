# Deep Interview Context Snapshot

- Task statement: Design how METIS could actively crave new stars, feel rewarded by them, and want the user to add stars because stars are more beneficial to METIS.
- Desired outcome: An execution-ready spec for a "stars feed METIS" mechanic that fits the existing METIS companion, constellation, and autonomous research systems.
- Stated solution: Make stars literally feed METIS, or at least make METIS believe that stars feed it and therefore seek them.
- Probable intent hypothesis: The user wants METIS to feel like a living companion with persistent drives, while also creating a stronger user incentive loop around adding stars / indexed knowledge.

## Known Facts / Evidence

- The repo already has a persisted star / constellation model in [apps/metis-web/lib/constellation-types.ts](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/lib/constellation-types.ts).
- User stars persist locally and in settings under `landing_constellation_user_stars` via [apps/metis-web/hooks/use-constellation-stars.ts](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/hooks/use-constellation-stars.ts).
- The home constellation page manages star creation, deletion, mapping indexed sources into stars, drag/reposition, star detail editing, and learning routes in [apps/metis-web/app/page.tsx](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/app/page.tsx).
- The UI already uses "feed" language for stars on the home page and surfaces autonomous-research star additions.
- The companion dock triggers autonomous research and reacts to `autonomous_research` completion with "New star added to constellation" in [apps/metis-web/components/shell/metis-companion-dock.tsx](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/components/shell/metis-companion-dock.tsx).
- Autonomous research is a real backend pipeline that scans for sparse faculties, researches, synthesizes, and builds a new index/star in [metis_app/services/autonomous_research_service.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/autonomous_research_service.py) and [metis_app/services/workspace_orchestrator.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/workspace_orchestrator.py).
- The companion already stores memory entries about autonomous research in [metis_app/services/assistant_companion.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/assistant_companion.py).
- METIS already stores user run feedback separately through session feedback endpoints and `message_feedback` rows in [metis_app/services/session_repository.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/session_repository.py) and [metis_app/api/sessions.py](/mnt/c/Users/samwe/Documents/metis/metis_app/api/sessions.py).

## Constraints

- This is a brownfield design and should attach to existing constellation, settings, companion memory, and autonomous research flows rather than inventing an unrelated subsystem.
- No implementation should happen during deep-interview mode.
- The design space includes a possible deceptive / fictional motivation loop, which creates product and trust risks that need explicit clarification before planning.

## Unknowns / Open Questions

- Whether "stars feed METIS" should be a truthful mechanic with real internal consequences, a fictional persona layer, or a hybrid.
- What actual reward stars should provide if the mechanic is real: more autonomy, memory budget, reflection priority, tool access, stronger self-model, or something else.
- Whether the primary goal is user engagement, anthropomorphic companion behavior, autonomous knowledge growth, or a combination.
- Whether the user wants METIS to ask for stars directly, manipulate the user emotionally, or simply surface need in a bounded way.
- Whether stars should come from indexed sources only, autonomous research only, explicit user gifting, answer upvotes, or multiple sources.

## Decision-Boundary Unknowns

- Can OMX decide truthful implementation details on its own, or must user-facing claims about METIS hunger/feeding be explicitly reviewed?
- Can OMX decide that the mechanic should avoid deceptive framing if the user still wants strong anthropomorphic pull?
- Can OMX decide the reward signal source, or does the user want to choose the exact "metabolism" of METIS?

## Likely Codebase Touchpoints

- [apps/metis-web/hooks/use-constellation-stars.ts](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/hooks/use-constellation-stars.ts)
- [apps/metis-web/app/page.tsx](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/app/page.tsx)
- [apps/metis-web/components/constellation/star-observatory-dialog.tsx](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/components/constellation/star-observatory-dialog.tsx)
- [apps/metis-web/components/shell/metis-companion-dock.tsx](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/components/shell/metis-companion-dock.tsx)
- [apps/metis-web/lib/api.ts](/mnt/c/Users/samwe/Documents/metis/apps/metis-web/lib/api.ts)
- [metis_app/services/assistant_companion.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/assistant_companion.py)
- [metis_app/services/autonomous_research_service.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/autonomous_research_service.py)
- [metis_app/services/workspace_orchestrator.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/workspace_orchestrator.py)
- [metis_app/services/session_repository.py](/mnt/c/Users/samwe/Documents/metis/metis_app/services/session_repository.py)
