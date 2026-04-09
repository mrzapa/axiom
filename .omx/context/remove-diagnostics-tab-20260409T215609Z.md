## Task Statement

Remove the Diagnostics tab from the visible METIS web UI. Prefer full removal if low risk, but keeping backend or internal support surfaces is acceptable if they remain useful and are no longer shown in the main frontend navigation.

## Desired Outcome

- The Diagnostics tab no longer appears in the web UI navigation.
- The user does not encounter Diagnostics as part of the normal visible frontend flow.
- Existing backend or recovery utilities may remain if they are still valuable and can be kept out of sight safely.

## Known Facts / Evidence

- The user supplied a screenshot showing a top navigation item labeled `Diagnostics`.
- Frontend references currently exist in:
  - `apps/metis-web/components/shell/page-chrome.tsx`
  - `apps/metis-web/components/setup-guard.tsx`
  - `apps/metis-web/components/desktop-ready.tsx`
  - `apps/metis-web/app/diagnostics/*`
- Existing Ralph planning artifacts already exist in `.omx/plans/`.

## Constraints

- Follow root `AGENTS.md` instructions for the whole repo.
- Use Ralph state and verification flow.
- Read the TypeScript skill before editing `.tsx` files.
- Keep diffs small and reversible.
- No new dependencies.

## Unknowns / Open Questions

- Whether the Diagnostics route should remain directly accessible for recovery scenarios.
- Whether tests assert the visible nav labels or direct diagnostics CTAs.

## Likely Codebase Touchpoints

- `apps/metis-web/components/shell/page-chrome.tsx`
- `apps/metis-web/components/setup-guard.tsx`
- `apps/metis-web/components/desktop-ready.tsx`
- `apps/metis-web/app/layout.test.tsx`
- Possibly `apps/metis-web/app/diagnostics/page.test.tsx` only if route behavior changes
