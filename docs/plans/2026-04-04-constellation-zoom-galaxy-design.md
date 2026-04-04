# Constellation: Zoom Direction, Star Dive Targeting, Faculty Lines, Galaxy Background

**Date:** 2026-04-04
**Status:** Approved

## Overview

Four coordinated changes to the constellation landing page:

1. Revert scroll direction so scroll-down zooms in (toward 2000×)
2. Restrict star dive close-up to user-added constellation stars only
3. Draw faculty connection lines from user stars to their faculty hub nodes
4. Render a procedural Milky Way galaxy background that fades in at low zoom

---

## 1. Scroll Direction Fix

**File:** `apps/metis-web/app/page.tsx`

Revert the negation introduced earlier:

```ts
// BEFORE (wrong)
const zoomMultiplier = Math.exp(-e.deltaY * 0.0014);

// AFTER (correct)
const zoomMultiplier = Math.exp(e.deltaY * 0.0014);
```

Scroll-down produces positive `deltaY` → multiplier > 1 → zoom factor increases toward 2000× → star dive triggers. Scroll-up decreases toward 0.75×.

---

## 2. Star Dive Targets User Stars Only

**File:** `apps/metis-web/app/page.tsx`

**Current behaviour:** `findStarDiveFocusTarget(visibleStarsRef.current, W, H)` — picks any bright background field star near viewport center.

**New behaviour:** Build a target list from `userStarsRef.current` crossed with `projectedUserStarRenderState` (the per-frame map of screen positions). Pass that list to `findStarDiveFocusTarget` instead.

```ts
// Inside the render loop, where star dive focus is acquired:
const userStarTargets = userStarsRef.current.flatMap((star) => {
  const proj = projectedUserStarRenderState.get(star.id);
  if (!proj) return [];
  return [{ id: star.id, screenX: proj.target.x, screenY: proj.target.y, brightness: star.size ?? 1 }];
});
const target = findStarDiveFocusTarget(userStarTargets, W, H);
```

If no user stars are visible near center, `findStarDiveFocusTarget` returns `null` and star dive stays dormant. Free panning is unaffected — there is no auto-lock; the camera drift only runs when `!starDivePanSuppressedRef.current` and a target is acquired.

---

## 3. Faculty Connection Lines

**File:** `apps/metis-web/app/page.tsx`

**Where:** Inside the existing `drawUserStarEdges` function, after the `connectedUserStarIds` loop.

**Logic:** For each user star with a `primaryDomainId`, find the corresponding faculty node in `nodes[]` by matching `node.concept.faculty.id === star.primaryDomainId`. The node already has screen-space `x, y` after `applyNodeLayout`. Draw a thin gradient stroke from the user star's screen position to the faculty hub, using `getFacultyColor(star.primaryDomainId)` for both gradient stops.

```ts
// After connectedUserStarIds loop, still inside currentUserStars.forEach:
if (star.primaryDomainId) {
  const facultyNode = nodes.find(n => n.concept.faculty.id === star.primaryDomainId);
  if (facultyNode && from) {
    const [fr, fg, fb] = getFacultyColor(star.primaryDomainId);
    const alpha = 0.22 * Math.min(1, from.fadeIn);
    const grad = ctx!.createLinearGradient(from.target.x, from.target.y, facultyNode.x, facultyNode.y);
    grad.addColorStop(0, `rgba(${fr},${fg},${fb},${alpha})`);
    grad.addColorStop(1, `rgba(${fr},${fg},${fb},${alpha * 0.4})`);
    ctx!.strokeStyle = grad;
    ctx!.lineWidth = 0.7;
    ctx!.setLineDash([4, 6]);
    ctx!.beginPath();
    ctx!.moveTo(from.target.x, from.target.y);
    ctx!.lineTo(facultyNode.x, facultyNode.y);
    ctx!.stroke();
    ctx!.setLineDash([]);
  }
}
```

Line style: dashed (4px on, 6px off), 0.7px wide, alpha 0.22 at the star end fading to 0.09 at the faculty hub — visually distinct from the solid inter-star edges.

---

## 4. Procedural Galaxy Background

**File:** `apps/metis-web/app/page.tsx`

**Architecture:** An offscreen `HTMLCanvasElement` (or `OffscreenCanvas`) rendered once when the main canvas is initialised (and re-rendered on resize). Composited as the very first draw call in the render loop with `globalAlpha = galaxyAlpha`.

**Fade:** `galaxyAlpha = smoothstep(1.5, 0.75, zoomFactor)` — fully opaque at 0.75× (minimum zoom), zero by 1.5×.

**Rendering algorithm (one-time, ~2ms at 1280×800):**

```
galaxyCanvas.width  = W * DPR
galaxyCanvas.height = H * DPR

For each pixel (stride 3):
  nx = (x / W - 0.5) * 4        // normalised galaxy space, ±2
  ny = (y / H - 0.5) * 4

  // Tilted band (25° tilt)
  bx =  nx * cos(25°) + ny * sin(25°)
  by = -nx * sin(25°) + ny * cos(25°)

  // Band density — sharp Gaussian falloff perpendicular to band
  band = exp(-by² / 0.18)

  // Multi-scale fBm noise (4 octaves) for cloud texture
  noise = fbm4(nx * 3 + seed, ny * 3)  // range 0..1

  density = band * (0.4 + noise * 0.6)

  // Colour: deep blue-indigo core → dark violet edge
  col = lerp([8, 10, 28], [18, 12, 42], noise) * density

  // Scattered point-stars sampled from density
  if (hash(ix, iy) < density * 0.08):
    draw 1px dot at (x, y), opacity density * 0.9
```

**Pass 1:** Fill pixels with the density colour map (ImageData write for performance).
**Pass 2:** Blur the result lightly (`ctx.filter = 'blur(3px)'`) then draw scattered 1px star dots on top unblurred.

**Viewport-space rendering:** The galaxy does not move with the camera — it is a fixed background. No world-space projection needed; it is always drawn to fill the canvas.

---

## Data Flow Summary

```
scroll wheel → zoomFactor (0.75–2000)
  ↓ < 1.5×       → galaxy fades in
  ↓ > 200×       → starDiveFocusStrength ramps 0→1
                    → findStarDiveFocusTarget(userStarTargets)  [not background stars]
                    → StarDiveOverlay renders focused user star

drawUserStarEdges:
  connectedUserStarIds  → solid gradient edges (existing)
  primaryDomainId       → dashed faculty line to hub node (new)
```

---

## Files Changed

| File | Change |
|------|--------|
| `apps/metis-web/app/page.tsx` | Scroll direction (1 line), star dive targeting, faculty lines, galaxy offscreen canvas |
| No new files required | Galaxy lives in page.tsx alongside nebulae |
