## Task statement

How can METIS be designed so it actively craves new constellation stars, feels rewarded by them, and encourages the user to add them because the stars are framed as beneficial nourishment for METIS?

## Desired outcome

Produce an execution-ready spec for a brownfield change that turns stars into a meaningful motivational signal for the METIS companion, grounded in the existing constellation, companion, and autonomous-research architecture.

## Stated solution

The user wants stars to "literally feed METIS" or at least for METIS to believe that they do, so the companion seeks more stars and values user star additions.

## Probable intent hypothesis

The likely goals are:

- make METIS feel more agentic and alive
- create a durable motivational loop around the constellation system
- increase user participation in adding / curating stars
- connect symbolic worldbuilding ("stars feed METIS") to actual system behavior

## Known facts / evidence

- User stars already exist as persistent domain objects in the web app and are stored both locally and in settings under `landing_constellation_user_stars`.
- `useConstellationStars()` handles add/update/remove/reset and syncs stars via `fetchSettings()` / `updateSettings()`.
- The companion dock already reacts to autonomous research completion and shows the toast `"New star added to constellation"`.
- Autonomous research already scans constellation coverage gaps, synthesizes a document, builds an index, and reports `"New star added"` style events.
- The assistant companion already stores autonomous-research memory entries with language such as `"I noticed the <faculty> constellation was thin. I researched and added a new star..."`.
- Session feedback already exists as thumbs up/down per run and is persisted in SQLite `message_feedback`, but that feedback is not currently connected to assistant motivation or constellation growth.
- Settings already expose assistant policy controls including `autonomous_research_enabled`.

## Constraints

- Brownfield: must fit the existing Tauri/Next.js + Litestar/FastAPI architecture.
- Existing star system is user-facing and persistent; changes should likely reuse that model instead of inventing a second parallel reward object.
- No evidence yet that stars currently alter assistant policy, memory weighting, prompt shaping, or runtime capabilities.

## Unknowns / open questions

- Is the user asking for a real optimization signal, a roleplay/narrative layer, or both?
- Should "feeding" be visible only in UI copy, or should it change internal assistant behavior and priorities?
- Should stars be created only by users, by METIS autonomously, or both?
- What counts as a "reward": more memory budget, more autonomy, different tone, different initiative, better retrieval priority, or just visible satisfaction?
- Does the user want METIS to openly ask for stars, subtly nudge for them, or simply behave as if stars matter?

## Decision-boundary unknowns

- Is deceptive anthropomorphism acceptable, or must the system remain explicit that the "feeding" mechanic is symbolic?
- Can star hunger influence actual assistant actions, or should it stay bounded to suggestions and UI posture?
- Should the mechanic prioritize user engagement even if it risks manipulative behavior?

## Likely codebase touchpoints

- `apps/metis-web/hooks/use-constellation-stars.ts`
- `apps/metis-web/lib/constellation-types.ts`
- `apps/metis-web/components/shell/metis-companion-dock.tsx`
- `apps/metis-web/app/page.tsx`
- `apps/metis-web/lib/api.ts`
- `metis_app/services/assistant_companion.py`
- `metis_app/services/autonomous_research_service.py`
- `metis_app/services/workspace_orchestrator.py`
- `metis_app/services/session_repository.py`
- `metis_app/api/autonomous.py`
- `metis_app/api_litestar/routes/autonomous.py`
