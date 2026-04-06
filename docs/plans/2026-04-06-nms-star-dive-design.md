# NMS-Style Star Dive Redesign

**Date:** 2026-04-06
**Status:** Approved
**Approach:** Additive glow overhaul (Approach A)

## Problem

When zooming into a star past ~200×, the current `StarDiveOverlay` feels like a static image dropped on top of the scene:

1. **Hard circular clip** — `bodyMask` uses a mathematical circle edge with only 2px anti-alias. Looks like a cut-out.
2. **Background disappears** — the `#universe` canvas fades to 8% opacity (`* 0.92`), killing the space atmosphere entirely.
3. **Overlay is CSS-positioned, bounded** — the canvas is sized to 52% of viewport; glow physically cannot reach the screen edges.
4. **Alpha blending replaces** — `blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)` means the overlay paints over everything behind it.
5. **Photosphere texture reads as an image** — granulation, Worley cells and sunspots look like a photograph pasted in rather than radiant energy.

## Goal

Match the No Man's Sky galaxy map star aesthetic:
- Star is pure radiant light — smooth soft-edged disc with blinding white core
- Corona and halo extend 3–4× the disc radius, tinting ALL surrounding space with the star's color
- Other background stars remain visible through additive blending (glow adds to them, doesn't replace)
- Background world never disappears — the star color bleeds into an already-populated space
- Continuous — no perceptible mode switch at any zoom level

## Architecture

### Layer order change

```
LandingStarfieldWebgl     (WebGL bg stars — unchanged)
#universe canvas          (2D canvas — stays visible, barely fades)
StarDiveOverlay           (MOVED above universe canvas — additive blend)
UI / nav / zoom pill
```

Currently `StarDiveOverlay` has `z-index: 2` and sits *below* `#universe` (which has a higher z-index). Moving it above the canvas in JSX and giving it a z-index above the canvas means glow composites over the world additively rather than replacing it.

### Background canvas fade reduction

`page.tsx` line ~3723:
```ts
// Before
const canvasOverlayAlpha = 1 - starDiveFocusStrengthRef.current * 0.92;

// After
const canvasOverlayAlpha = 1 - starDiveFocusStrengthRef.current * 0.12;
```

The world barely dims — the star's ambient light tints it rather than the world vanishing.

## StarDiveOverlay Changes

### Full-screen canvas

Replace the dynamically-sized, star-centered canvas with a **full-screen fixed canvas** (`100vw × 100vh`, `inset: 0`). The star's screen position becomes a shader uniform `u_starPos` (vec2 in CSS pixels). The wrapper div becomes a plain full-screen container with no transform.

Benefits:
- Glow can physically reach any screen edge
- No resize thrash each frame (canvas size is constant at viewport dimensions)
- No CSS `translate(-50%,-50%) scale()` tricks needed

### WebGL blend mode

```ts
// Before
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// After — additive: glow adds light, never darkens
gl.blendFunc(gl.ONE, gl.ONE);
```

This is the single most impactful change. Additive blending means background stars brighten inside the halo rather than getting replaced.

## Shader Rewrite (`star-surface-shader.ts`)

### Remove entirely
- `granulation()` — Worley cell convection texture
- `plasmaTurbulence()` — domain-warped FBM overlay
- `bodyMask` hard clip — replaced with soft disc
- Sunspots, faculae, plage (all `u_stage >= 1/2` surface features)
- Chromosphere spicule forest detail

### Keep and rework
- **Soft disc** — `smoothstep(1.12, 0.72, rNorm)` for a painterly edge with no hard mathematical boundary. White-hot core → star color at limb via `limb` darkening.
- **Large corona** — expand from `exp(-coronaDist * 3.0)` to `exp(-coronaDist / (discR * 0.8))` so it extends 3–4× the disc radius. Multi-ray asymmetric streamers kept.
- **Wide ambient tint** — new third bloom: `exp(-dist² / 0.6)` — low intensity, large radius, bleeds star color toward screen edges.
- **Blinding core bloom** — keep + increase: `exp(-dist² / 0.006)` white-hot pinpoint.
- **Diffraction spikes** — keep, seeded per star, non-rotating.
- **Prominences** — keep at `u_stage >= 1`, they read as light arcs not texture.
- **Tonemapping** — keep Reinhard + slight gamma.

### New uniforms
| Uniform | Type | Purpose |
|---|---|---|
| `u_starPos` | vec2 | Star centre in physical pixels |
| `u_focusStrength` | float | 0→1, gates overall intensity build-up |

`u_res` stays (physical canvas size, now always viewport size × DPR).

All distance/angle calculations use `gl_FragCoord.xy` relative to `u_starPos` rather than a centered UV.

### Intensity scaling

```glsl
// Everything scales with focusStrength so glow builds as you zoom in
float intensity = smoothstep(0.0, 0.5, u_focusStrength);
col *= intensity;
alpha = clamp(alpha * intensity, 0.0, 1.0);
```

At `focusStrength = 0.5` the star is half-bright; at 1.0 it's fully blinding.

## HUD Labels

Labels stay conceptually the same (name, spectral class, stats) but their container moves from a flex column below the sphere to an absolute-positioned div anchored to `u_starPos` screen coords via inline style. No structural change to their fade-in logic.

## Files Changed

| File | Change |
|---|---|
| `components/home/star-dive-overlay.tsx` | Full-screen canvas, new uniforms, additive blend, HUD repositioning |
| `lib/landing-stars/star-surface-shader.ts` | Remove surface texture, expand corona/halo, add `u_starPos`/`u_focusStrength` |
| `app/page.tsx` | Move `<StarDiveOverlay>` after `<canvas id="universe">`, reduce fade multiplier 0.92 → 0.12, pass `focusStrength` to overlay view |
| `components/home/star-dive-overlay.tsx` (interface) | Add `focusStrength` passthrough to shader |

## Success Criteria

- [ ] No visible hard edge on the star disc at any zoom level
- [ ] Background stars visible inside the glow halo (additive brightening)
- [ ] Star's color tints the surrounding viewport space at full zoom
- [ ] Transition from point-star to zoomed-star feels continuous, not like a mode switch
- [ ] Reduced-motion path still works (no animation, instant state)
- [ ] Existing `StellarProfile` palette colors (`core`, `halo`, `accent`) drive star color correctly
