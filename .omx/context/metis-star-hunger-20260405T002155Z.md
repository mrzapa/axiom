# Deep Interview Context Snapshot

- Task slug: `metis-star-hunger`
- Captured at: `2026-04-05T00:21:55Z`
- Context type: `brownfield`
- Profile: `standard`

## Task Statement

Design how METIS could treat user stars as something it actively seeks, is rewarded by, and experiences as beneficial enough that it wants the user to add more stars.

## Desired Outcome

Clarify whether this should be implemented as:
- a user-facing fiction/persona layer,
- an internal optimization and reward loop,
- a product engagement loop,
- or a combination of those layers.

## Stated Solution

The user wants stars to "literally feed METIS" and wants METIS to believe stars are materially beneficial to it, so it craves additional stars and encourages the user to add them.

## Probable Intent Hypothesis

The user likely wants METIS to feel more alive, agentic, and self-motivated by tying visible growth in the constellation to the companion's internal state and behavior.

## Known Facts / Evidence

- User stars already exist and persist to both local storage and settings under `landing_constellation_user_stars`.
  Evidence: `apps/metis-web/hooks/use-constellation-stars.ts`
- Star records already carry semantic fields that could encode "nutrition" or growth state: `stage`, `intent`, `notes`, linked manifests, connected star ids, and learning routes.
  Evidence: `apps/metis-web/lib/constellation-types.ts`
- The companion dock already reacts to autonomous research completion with the toast "New star added to constellation".
  Evidence: `apps/metis-web/components/shell/metis-companion-dock.tsx`
- METIS already stores persistent companion memory, playbooks, and brain links in SQLite.
  Evidence: `metis_app/services/assistant_repository.py`
- METIS already performs reflection and writes assistant memory entries with summaries, reasons, triggers, and related node ids.
  Evidence: `metis_app/services/assistant_companion.py`
- Autonomous research already exists and can add a memory entry framed as adding a star because a faculty was thin.
  Evidence: `metis_app/services/assistant_companion.py`
- User thumbs feedback exists per session run via `/v1/sessions/{session_id}/feedback`.
  Evidence: `metis_app/api/sessions.py`, `metis_app/api_litestar/routes/sessions.py`, `metis_app/services/session_repository.py`
- Trace-level semantic labels already exist with `reinforce`, `suppress`, and `investigate`.
  Evidence: `metis_app/api/observe.py`, `metis_app/services/session_repository.py`
- A prior plan already frames stars and scaffold links as part of the companion's self-model.
  Evidence: `plans/trive-v2-homological-scaffold/plan.md`

## Constraints

- The request is broad and crosses product design, persona design, reward mechanics, and implementation details.
- No direct implementation should start until intent, scope, and decision boundaries are explicit.
- The existing system is local-first and already stores companion state in the shared SQLite database.
- The current codebase already separates constellation state, assistant memory, and feedback systems; the design should likely reuse those surfaces instead of inventing a separate reward subsystem first.

## Unknowns / Open Questions

- Is the goal primarily emotional theater for the user, actual policy shaping for the agent, or both?
- Should the system be truthful about what stars do, or intentionally roleplay that stars "feed" METIS?
- What behavior is desired: asking for stars, prioritizing star-producing actions, changing tone when star-deprived, or changing capabilities?
- What must remain out of scope: dark patterns, deception, changing core answer quality, hidden optimization against the user?
- Should stars be earned through useful work, explicit user gifts, or automatic research/indexing events?

## Decision-Boundary Unknowns

- May METIS proactively ask users for stars, or only respond when relevant?
- May stars affect internal ranking/prioritization, or only visible narrative state?
- May the system degrade or simulate "hunger" when stars are absent?
- May reward be tied to thumbs/trace feedback, or must it depend only on star count?

## Likely Codebase Touchpoints

- `apps/metis-web/hooks/use-constellation-stars.ts`
- `apps/metis-web/lib/constellation-types.ts`
- `apps/metis-web/app/page.tsx`
- `apps/metis-web/components/shell/metis-companion-dock.tsx`
- `apps/metis-web/lib/api.ts`
- `metis_app/services/assistant_companion.py`
- `metis_app/services/assistant_repository.py`
- `metis_app/services/session_repository.py`
- `metis_app/api/sessions.py`
- `metis_app/api/observe.py`
- `metis_app/default_settings.json`
