# Star Close-Up Aspect Ratio Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the "potato" oval star shape in the constellation landing page star close-up WebGL effect by correcting the aspect ratio in the fragment shader.

**Architecture:** The `StarCloseupWebgl` component renders a fullscreen GLSL quad. The fragment shader computes a star disk/corona using `dist = length(uv)` where `uv` is in -1..1 space. Because the canvas is typically wider than tall, one UV unit in X represents more pixels than in Y, stretching the circle into a wide oval. Fix: add a `uAspect` uniform (width/height) and fold it into the distance calculation so the disk is a proper screen-space circle.

**Tech Stack:** React, Three.js, GLSL (WebGL), TypeScript

---

### Task 1: Add `uAspect` uniform to the star close-up shader

**Files:**
- Modify: `apps/metis-web/components/home/star-closeup-webgl.tsx`

**Step 1: Write the failing test**

No automated test for shader math — visual regression. We verify manually with the preview.

**Step 2: Update the fragment shader to use aspect-corrected distance**

In `star-closeup-webgl.tsx`, the fragment shader currently has:
```glsl
varying vec2 vUv;

void main() {
  vec2 uv = vUv * 2.0 - 1.0;   // -1..1 centred
  float aspect = 1.0;            // fullscreen quad is square in UV
  float dist = length(uv);
```

Replace with:
```glsl
varying vec2 vUv;
uniform float uAspect;           // canvas width / height

void main() {
  vec2 uv = vUv * 2.0 - 1.0;   // -1..1 centred
  // Correct for non-square canvas: scale x by aspect so equal dist = equal pixels
  float dist = length(vec2(uv.x * uAspect, uv.y));
```

Also update the prominence angle calculation below it — currently:
```glsl
float angle = atan(uv.y, uv.x);
```
Replace with:
```glsl
float angle = atan(uv.y, uv.x * uAspect);
```
This keeps prominences symmetrical (not stretched) around the limb.

Remove the now-dead `float aspect = 1.0;` line.

**Step 3: Add `uAspect` to the uniforms object in the `useEffect`**

In the Three.js setup section, find the `uniforms` object initialisation and add:
```ts
uAspect: { value: 1 },
```

**Step 4: Update `onResize` to keep `uAspect` in sync**

The existing `onResize` handler already reads `container.clientWidth` / `container.clientHeight`. Add:
```ts
function onResize() {
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  if (materialRef.current) {
    materialRef.current.uniforms.uAspect.value = w / Math.max(1, h);
  }
}
```

Also set the initial value right after creating the material:
```ts
materialRef.current = material;
// Set initial aspect
const w = container.clientWidth;
const h = container.clientHeight;
material.uniforms.uAspect.value = w / Math.max(1, h);
```

**Step 5: Verify visually**

Start the dev server, zoom into a background star past 200× zoom. The close-up star should now appear as a perfect circle (or very close to it), not a wide oval.

**Step 6: Commit**

```bash
git add apps/metis-web/components/home/star-closeup-webgl.tsx
git commit -m "fix: correct aspect ratio in star close-up WebGL shader to prevent oval/potato shape"
```

---

### Task 2: Verify preview and push

**Files:** none

**Step 1: Start preview server**

```bash
cd apps/metis-web && npm run dev
```

**Step 2: Zoom in to trigger star close-up (zoom > 200×)**

Use the `+` button in the bottom toolbar on the landing page to zoom in past 200×. Confirm the star is circular.

**Step 3: Push and add to PR**

```bash
git push
```

The existing PR mrzapa/metis#470 will pick up the new commit automatically.
