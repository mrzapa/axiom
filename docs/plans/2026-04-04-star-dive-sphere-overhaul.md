# Star Dive Sphere Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fullscreen `StarCloseupWebgl` overlay with a positioned WebGL2 canvas that renders the observatory-quality star shader (Worley granulation, plasma turbulence, coronal streamers) overlaid on the starfield at the focused star's screen position. Fix scroll direction so scroll-up = zoom in.

**Architecture:** Re-use the raw WebGL2 shader already in `star-observatory-dialog.tsx` by extracting it to a shared file. Create a new `StarDiveOverlay` component that positions a raw canvas over the focused star, animated by refs the page render loop writes every frame — no new React state, no new RAF loop. Delete `star-closeup-webgl.tsx`.

**Tech Stack:** React, WebGL2, TypeScript, Next.js

---

### Task 1: Fix scroll direction

**Files:**
- Modify: `apps/metis-web/app/page.tsx`

**Step 1: Find the zoom multiplier line**

It is at approximately line 4040:
```ts
const zoomMultiplier = Math.exp(e.deltaY * 0.0014);
```

**Step 2: Negate deltaY**

Change to:
```ts
const zoomMultiplier = Math.exp(-e.deltaY * 0.0014);
```

Scroll UP (negative `deltaY`) now produces `exp(positive)` > 1 → zoom in. Scroll DOWN → zoom out.

**Step 3: Commit**

```bash
git add apps/metis-web/app/page.tsx
git commit -m "fix: invert scroll direction so scroll-up zooms in during star dive"
```

---

### Task 2: Extract shared shader to `lib/landing-stars/star-surface-shader.ts`

**Files:**
- Create: `apps/metis-web/lib/landing-stars/star-surface-shader.ts`
- Modify: `apps/metis-web/components/constellation/star-observatory-dialog.tsx`

**Step 1: Create the shared shader file**

Create `apps/metis-web/lib/landing-stars/star-surface-shader.ts` with this content — copy `STAR_VERT`, `STAR_FRAG`, `compileShader`, and `createStarProgram` verbatim from lines 188–631 of `star-observatory-dialog.tsx`, then add exports:

```ts
// Shared WebGL2 procedural star shader.
// Used by: star-observatory-dialog.tsx, star-dive-overlay.tsx

export const STAR_VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}` as const;

export const STAR_FRAG = /* copy verbatim from star-observatory-dialog.tsx lines 197–602 */ `` as const;

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function createStarProgram(
  gl: WebGL2RenderingContext,
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, STAR_VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, STAR_FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}
```

Important: the `STAR_FRAG` body must be copied exactly from `star-observatory-dialog.tsx` lines 197–602 (the full `#version 300 es … fragColor = …` string).

**Step 2: Update `star-observatory-dialog.tsx` to import from shared file**

At the top of `star-observatory-dialog.tsx`, add:
```ts
import {
  STAR_VERT,
  STAR_FRAG,
  compileShader,
  createStarProgram,
} from "@/lib/landing-stars/star-surface-shader";
```

Then delete the `STAR_VERT`, `STAR_FRAG`, `compileShader`, and `createStarProgram` definitions from lines 188–631 of that file (they are now imported).

**Step 3: Verify the dialog still compiles**

Run:
```bash
cd apps/metis-web && npx tsc --noEmit
```
Expected: no errors relating to `star-observatory-dialog.tsx`.

**Step 4: Commit**

```bash
git add apps/metis-web/lib/landing-stars/star-surface-shader.ts \
        apps/metis-web/components/constellation/star-observatory-dialog.tsx
git commit -m "refactor: extract procedural star shader to shared lib/landing-stars/star-surface-shader.ts"
```

---

### Task 3: Create `StarDiveOverlay` component

**Files:**
- Create: `apps/metis-web/components/home/star-dive-overlay.tsx`

**Overview:** A `position: fixed` WebGL2 canvas that reads from refs written by the page render loop each frame. Sizes and positions itself over the focused star. Uses the same shader as the observatory dialog.

**Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  createStarProgram,
} from "@/lib/landing-stars/star-surface-shader";
import type { StellarProfile } from "@/lib/landing-stars/types";

export interface StarDiveOverlayView {
  screenX: number;   // star centre in CSS pixels from viewport left
  screenY: number;   // star centre in CSS pixels from viewport top
  focusStrength: number; // 0→1
  profile: StellarProfile;
}

interface StarDiveOverlayProps {
  viewRef: React.MutableRefObject<StarDiveOverlayView | null>;
  reducedMotion?: boolean;
}

export function StarDiveOverlay({
  viewRef,
  reducedMotion = false,
}: StarDiveOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = Math.min(window.devicePixelRatio ?? 1, 3);

    /* ── init WebGL2 ─────────────────────────────────────────────── */
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });
    if (!gl) return;

    const prog = createStarProgram(gl);
    if (!prog) return;

    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    /* ── uniform locations ───────────────────────────────────────── */
    const uTime        = gl.getUniformLocation(prog, "u_time");
    const uSeed        = gl.getUniformLocation(prog, "u_seed");
    const uColor       = gl.getUniformLocation(prog, "u_color");
    const uColor2      = gl.getUniformLocation(prog, "u_color2");
    const uColor3      = gl.getUniformLocation(prog, "u_color3");
    const uHasC2       = gl.getUniformLocation(prog, "u_hasColor2");
    const uHasC3       = gl.getUniformLocation(prog, "u_hasColor3");
    const uDiffraction = gl.getUniformLocation(prog, "u_hasDiffraction");
    const uStage       = gl.getUniformLocation(prog, "u_stage");
    const uRes         = gl.getUniformLocation(prog, "u_res");

    let startTime: number | null = null;
    let lastProfileId = "";
    let raf = 0;

    function draw(ts: number) {
      raf = requestAnimationFrame(draw);
      const view = viewRef.current;

      if (!view || view.focusStrength < 0.01) {
        canvas!.style.opacity = "0";
        return;
      }

      if (!startTime) startTime = ts;
      const elapsed = reducedMotion ? 0 : (ts - startTime) / 1000;

      /* Position and size the canvas over the focused star */
      const radius = view.focusStrength * 0.30 * window.innerHeight;
      const diameter = Math.round(radius * 2);
      const physSize = Math.round(diameter * DPR);

      if (canvas!.width !== physSize || canvas!.height !== physSize) {
        canvas!.width  = physSize;
        canvas!.height = physSize;
        canvas!.style.width  = `${diameter}px`;
        canvas!.style.height = `${diameter}px`;
        gl.viewport(0, 0, physSize, physSize);
      }

      canvas!.style.left    = `${Math.round(view.screenX - radius)}px`;
      canvas!.style.top     = `${Math.round(view.screenY - radius)}px`;
      canvas!.style.opacity = String(view.focusStrength);

      /* Update uniforms when profile changes */
      const pid = view.profile.seedHash + "";
      if (pid !== lastProfileId) {
        lastProfileId = pid;
        const p = view.profile;
        const seed = (p.seedHash % 1000) / 1000;
        const [cr, cg, cb] = p.palette.core;
        const [h2r, h2g, h2b] = p.palette.halo;
        const [h3r, h3g, h3b] = p.palette.accent;
        gl.uniform1f(uSeed, seed);
        gl.uniform3f(uColor,  cr,  cg,  cb);
        gl.uniform3f(uColor2, h2r, h2g, h2b);
        gl.uniform3f(uColor3, h3r, h3g, h3b);
        gl.uniform1f(uHasC2, 1.0);
        gl.uniform1f(uHasC3, 1.0);
        gl.uniform1f(uDiffraction, 1.0);  // always show diffraction for close-up
        gl.uniform1f(uStage, 2.0);        // always full detail
      }

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uRes, canvas!.width, canvas!.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [viewRef, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        pointerEvents: "none",
        borderRadius: "50%",
        opacity: 0,
        transition: "opacity 0.1s",
        zIndex: 2,
      }}
      aria-hidden="true"
    />
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/metis-web && npx tsc --noEmit
```
Expected: no errors.

**Step 3: Commit**

```bash
git add apps/metis-web/components/home/star-dive-overlay.tsx
git commit -m "feat: add StarDiveOverlay — positioned WebGL2 star shader canvas for star dive close-up"
```

---

### Task 4: Wire `StarDiveOverlay` into `page.tsx`

**Files:**
- Modify: `apps/metis-web/app/page.tsx`

**Step 1: Add `StarDiveOverlayView` type import and remove `StarCloseupWebgl` dynamic import**

Find (near line 16):
```ts
const StarCloseupWebgl = dynamic(
  () =>
    import("@/components/home/star-closeup-webgl").then(
      (m) => ({ default: m.StarCloseupWebgl }),
    ),
  { ssr: false, loading: () => null },
);
```
Replace with:
```ts
import type { StarDiveOverlayView } from "@/components/home/star-dive-overlay";
const StarDiveOverlay = dynamic(
  () =>
    import("@/components/home/star-dive-overlay").then(
      (m) => ({ default: m.StarDiveOverlay }),
    ),
  { ssr: false, loading: () => null },
);
```

**Step 2: Add `starDiveOverlayViewRef`**

Near line 897 (after the existing star dive refs):
```ts
const starDiveOverlayViewRef = useRef<StarDiveOverlayView | null>(null);
```

**Step 3: Populate `starDiveOverlayViewRef` in the render loop**

In the `render` function, after the block that sets `starDiveFocusStrengthRef.current = diveFocusStrength` (approximately line 3291), find the existing block:

```ts
if (diveFocusStrength > 0 && !starDivePanSuppressedRef.current) {
  // Acquire or maintain focus target
  if (!starDiveFocusedStarIdRef.current) {
    ...
  }
  // Auto-drift ...
  if (starDiveFocusWorldPosRef.current) {
    ...
  }
} else if (diveFocusStrength <= 0 && starDiveFocusedStarIdRef.current) {
  // Clear focus when zoomed back out
  starDiveFocusedStarIdRef.current = null;
  starDiveFocusWorldPosRef.current = null;
  starDiveFocusProfileRef.current = null;
  starDivePanSuppressedRef.current = false;
}
```

After this entire block (before `// Update reactive state`), add:

```ts
// Project focused star world position to screen coords for StarDiveOverlay
if (
  diveFocusStrength > 0
  && starDiveFocusWorldPosRef.current
  && starDiveFocusProfileRef.current
) {
  const wp = starDiveFocusWorldPosRef.current;
  const scale = getBackgroundCameraScale(backgroundCamera.zoomFactor);
  starDiveOverlayViewRef.current = {
    screenX: (wp.x - backgroundCamera.x) * scale + W / 2,
    screenY: (wp.y - backgroundCamera.y) * scale + H / 2,
    focusStrength: diveFocusStrength,
    profile: starDiveFocusProfileRef.current,
  };
} else {
  starDiveOverlayViewRef.current = null;
}
```

**Step 4: Replace `<StarCloseupWebgl>` with `<StarDiveOverlay>`**

Find (approximately line 4152):
```tsx
<StarCloseupWebgl
  className="metis-star-closeup-webgl"
  focusStrength={starDiveFocusStrength}
  profile={starDiveFocusProfileRef.current}
  reducedMotion={prefersReducedMotion()}
/>
```

Replace with:
```tsx
<StarDiveOverlay
  viewRef={starDiveOverlayViewRef}
  reducedMotion={prefersReducedMotion()}
/>
```

**Step 5: Verify TypeScript compiles**

```bash
cd apps/metis-web && npx tsc --noEmit
```
Expected: no errors.

**Step 6: Commit**

```bash
git add apps/metis-web/app/page.tsx
git commit -m "feat: wire StarDiveOverlay into page.tsx render loop; remove StarCloseupWebgl usage"
```

---

### Task 5: Delete `star-closeup-webgl.tsx`

**Files:**
- Delete: `apps/metis-web/components/home/star-closeup-webgl.tsx`

**Step 1: Verify no remaining imports**

```bash
grep -r "star-closeup-webgl\|StarCloseupWebgl" apps/metis-web/
```
Expected: no matches.

**Step 2: Delete the file**

```bash
git rm apps/metis-web/components/home/star-closeup-webgl.tsx
```

**Step 3: Check for stray CSS**

```bash
grep -r "metis-star-closeup-webgl" apps/metis-web/
```
If found, remove those CSS rules.

**Step 4: TypeScript check**

```bash
cd apps/metis-web && npx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git commit -m "chore: delete star-closeup-webgl.tsx — replaced by StarDiveOverlay"
```

---

### Task 6: Verify in browser and push

**Step 1: Start dev server**

```bash
cd apps/metis-web && npm run dev
```

**Step 2: Verify scroll direction**

Open the landing page. Scroll UP — the view should zoom IN. Scroll DOWN — zoom OUT.

**Step 3: Verify star close-up**

Scroll up past ~200× zoom. A circular star should appear at the focused star's position with the high-quality shader (visible granulation cells, coronal rays, diffraction spikes). The surrounding starfield should remain visible around it. Each star zoomed into should look visually distinct (different colors, seed-based variation).

**Step 4: Verify no oval shape**

The star should be a circle at all viewport aspect ratios. The `u_res` uniform in the shader is already used for edge anti-aliasing, and the disk is defined in UV space as `length(uv)` where the canvas is always square — no aspect correction needed since the canvas is square.

**Step 5: Push and update PR**

```bash
git push
```

PR `mrzapa/metis#470` will pick up all commits automatically.
