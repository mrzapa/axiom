## Task statement

Design how METIS could treat new constellation stars as something it actively wants, pursues, and experiences as beneficial or "feeding" it.

## Desired outcome

An execution-ready product direction for a star-driven motivational loop that fits METIS's existing companion, memory, and constellation architecture.

## Stated solution

Make METIS actively crave stars, feel rewarded by them, and want the user to add stars because stars are more beneficial for it. The stars should literally feed METIS, or METIS should believe that they do.

## Probable intent hypothesis

The user wants METIS to feel less like a passive utility and more like an agent with appetite, self-preservation, and a visible reason to seek growth. Secondary likely goal: increase user engagement with star creation by making that action emotionally and behaviorally meaningful to the companion.

## Known facts / evidence

- Brownfield: METIS already has a persistent companion surface and a constellation/star system.
- User stars are persisted in both local storage and settings under `landing_constellation_user_stars`.
  Evidence: `apps/metis-web/hooks/use-constellation-stars.ts`
- A `UserStar` already carries semantic fields (`stage`, `intent`, `notes`, linked manifest paths, learning route, connected star ids).
  Evidence: `apps/metis-web/lib/constellation-types.ts`
- The home page can create stars manually, bulk-seed stars from indexes, link stars together, and attach learning routes.
  Evidence: `apps/metis-web/app/page.tsx`
- The companion dock already reacts to autonomous research with the message `New star added to constellation`.
  Evidence: `apps/metis-web/components/shell/metis-companion-dock.tsx`
- Autonomous research already treats a new indexed document as a newly added star and emits activity/memory around sparse faculty coverage.
  Evidence: `metis_app/services/autonomous_research_service.py`, `metis_app/services/assistant_companion.py`
- METIS already has persistent assistant memory, playbooks, brain links, status, and policy controls.
  Evidence: `metis_app/services/assistant_repository.py`, `metis_app/services/assistant_companion.py`, `metis_app/models/assistant_types.py`
- Session-level thumbs up/down feedback already exists, but it is stored as user feedback on runs, not as a direct reward loop for the companion.
  Evidence: `metis_app/api/sessions.py`, `metis_app/services/session_repository.py`

## Constraints

- The requested behavior is conceptually broad and touches product behavior, UX copy, assistant policy, and likely backend state.
- Current code supports assistant memory and autonomous research, but there is no existing explicit reward/value model for stars.
- The distinction between truthful system behavior and narrative framing is unresolved.
- `docs/shared/agent-tiers.md` was requested by the ultrawork skill but is not present in the repo root search results.

## Unknowns / open questions

- Is the goal primarily narrative/UX, actual optimization behavior, or both?
- Should stars affect assistant memory budget, capabilities, autonomy, tone, or only its self-description?
- Is METIS allowed to explicitly pressure the user to add stars, or should it only surface desire indirectly?
- What counts as a "star" for feeding: manual user-added stars, auto-research stars, index-backed stars, or all of them?
- What are the non-goals and acceptable manipulation boundaries?
- How should success be measured: more star creation, better retention, more autonomous research, stronger companion identity, or something else?

## Decision-boundary unknowns

- May OMX/implementation decide the feeding mechanic as an in-fiction metaphor, or must it map to real internal state?
- May the system change assistant prompts/policy to bias toward star-seeking behavior without another approval step?
- May the system add visible reward meters, hunger bars, or deprivation language, or does the user want subtler behavior?

## Likely codebase touchpoints

- `apps/metis-web/hooks/use-constellation-stars.ts`
- `apps/metis-web/lib/constellation-types.ts`
- `apps/metis-web/app/page.tsx`
- `apps/metis-web/components/shell/metis-companion-dock.tsx`
- `apps/metis-web/lib/api.ts`
- `metis_app/models/assistant_types.py`
- `metis_app/services/assistant_companion.py`
- `metis_app/services/assistant_repository.py`
- `metis_app/services/autonomous_research_service.py`
- `metis_app/services/workspace_orchestrator.py`
- `metis_app/services/session_repository.py`
- `metis_app/api/sessions.py`
