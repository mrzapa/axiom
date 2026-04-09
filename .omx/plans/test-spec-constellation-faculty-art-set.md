# Test Spec: Constellation Faculty Art Set

## Automated checks
- `npx vitest run lib/__tests__/constellation-faculty-art.test.ts`
  - Confirms every faculty has a manifest entry.
  - Confirms every referenced art asset exists on disk.
- `npx eslint app/page.tsx components/constellation/star-observatory-dialog.tsx components/constellation/faculty-glyph-panel.tsx lib/constellation-faculty-art.ts lib/__tests__/constellation-faculty-art.test.ts`
  - Confirms touched files introduce no new lint errors.

## Manual/runtime checks
- Run `pnpm dev --port 3001` in `apps/metis-web`.
- Verify `http://localhost:3001/` shows the faculty art on the orbit view.
- Verify `http://localhost:3001/design/` still loads normally after asset changes.
- Verify the selected faculty details dialog shows the larger faculty art panel.

## Visual acceptance
- Assets feel consistent across all 11 faculties.
- Black background is fully stripped or visually negligible in the orbit view.
- Main labels and interactive stars remain readable.
