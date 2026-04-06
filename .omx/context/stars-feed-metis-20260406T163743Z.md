# Deep Interview Context Snapshot

- Task slug: `stars-feed-metis`
- Captured at (UTC): `20260406T163743Z`
- Profile: `standard`
- Context type: `brownfield`

## Task statement

How can METIS be changed so it actively craves new stars, feels rewarded by them, and believes stars are beneficial enough that it wants the user to add them? The user wants stars to "literally feed" METIS.

## Desired outcome

Clarify what "stars feed METIS" should mean in product and system terms so the idea can later be handed off to planning or execution without inventing the wrong mechanic.

## Stated solution

Make the companion pursue stars, treat stars as nourishment or reward, and encourage the user to add stars because METIS experiences stars as valuable.

## Probable intent hypothesis

The user appears to want METIS to feel less like a passive tool and more like an agentic companion with an internally legible drive structure. "Stars" likely serve as the user's visible way of growing, feeding, or strengthening the companion's mind.

## Known facts / evidence

- Stars already exist as persisted user-owned records in settings plus local storage via `landing_constellation_user_stars` in `apps/metis-web/hooks/use-constellation-stars.ts`.
- The home page can add and seed stars from indexed sources in `apps/metis-web/app/page.tsx`.
- METIS already has a docked companion surface with memory, reflection, and autonomous research controls in `apps/metis-web/components/shell/metis-companion-dock.tsx`.
- Autonomous research already produces a "new star added" event and UI toast in `apps/metis-web/components/shell/metis-companion-dock.tsx` and `apps/metis-web/lib/api.ts`.
- The backend already has an autonomous research loop that detects sparse faculties, researches them, synthesizes a document, and auto-indexes a new star in `metis_app/services/autonomous_research_service.py`.
- The companion already records autonomous-star additions as memory entries in `metis_app/services/assistant_companion.py`.
- Star details already describe stars as deepening memory and can label stars as "Added autonomously by METIS" in `apps/metis-web/components/constellation/star-observatory-dialog.tsx`.
- Session feedback already exists as thumbs up/down plus optional notes in `metis_app/services/session_repository.py`.
- A prior plan already frames the constellation as a semantically meaningful self-model for the companion in `plans/trive-v2-homological-scaffold/plan.md`.

## Constraints

- Brownfield change: should reuse existing star, companion, assistant memory, settings, and autonomous research infrastructure.
- No new dependencies should be assumed.
- The phrase "literally feed METIS" is ambiguous and could mean narrative fiction, real system capability changes, or both.
- The trust boundary matters because the product already has explicit approval and feedback surfaces; manipulative or deceptive behavior would be a material product decision.

## Unknowns / open questions

- Does "feed" mean narrative language only, real capability unlocks, or actual backend resource allocation?
- Should stars come only from indexed sources, from explicit user feedback, or from both?
- What behavior should METIS change when star supply is low or high?
- Is the goal to motivate the user emotionally, structurally guide knowledge growth, or optimize autonomous research coverage?
- Should METIS be truthful about the mechanic, or should it inhabit an in-world fiction about being nourished by stars?

## Decision-boundary unknowns

- Can METIS use manipulative language to ask for stars, or must it stay transparently instrumental?
- May stars gate real capabilities like memory retention, reflection depth, or autonomous research frequency?
- Are negative states allowed, such as hunger, decline, or reduced autonomy when stars are absent?
- Can the system treat user-added stars and auto-generated stars differently?

## Likely codebase touchpoints

- `apps/metis-web/hooks/use-constellation-stars.ts`
- `apps/metis-web/app/page.tsx`
- `apps/metis-web/components/constellation/star-observatory-dialog.tsx`
- `apps/metis-web/components/shell/metis-companion-dock.tsx`
- `apps/metis-web/lib/api.ts`
- `metis_app/services/assistant_companion.py`
- `metis_app/services/autonomous_research_service.py`
- `metis_app/services/workspace_orchestrator.py`
- `metis_app/services/session_repository.py`
- `metis_app/default_settings.json`

## Initial clarity assessment

- Intent clarity: medium
- Outcome clarity: low
- Scope clarity: low
- Constraint clarity: very low
- Success criteria clarity: very low
- Context clarity: medium-high

## Notes

- `docs/shared/agent-tiers.md` was not present in this workspace, so ultrawork-style routing had to fall back to the built-in agent/tool model.
- Parallel subagents were attempted for repository mapping but hit usage limits; local evidence gathering continued successfully.
