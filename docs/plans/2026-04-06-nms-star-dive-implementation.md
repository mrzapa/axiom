# NMS-Style Star Dive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current hard-edged sphere overlay with a No Man's Sky-style radiant bloom — a soft-edged luminous disc whose corona floods surrounding space with the star's color, additively composited over the live starfield.

**Architecture:** Full-screen WebGL2 canvas (instead of a star-centered sized canvas) renders a pure-light star: smooth disc + large corona + wide ambient tint, all via additive blending (`ONE, ONE`). The background canvas fade drops from 92% to 12% so the world stays alive. The overlay moves above `#universe` in the DOM.

**Tech Stack:** WebGL2 (GLSL ES 3.00), React (refs, useEffect), TypeScript, Next.js (app router)

---

## Task 1: Rework the shader — remove surface texture, add full-screen geometry

**Files:**
- Modify: `apps/metis-web/lib/landing-stars/star-surface-shader.ts`

This is the biggest change. The shader needs to:
1. Accept `u_starPos` (vec2 physical pixels) and `u_focusStrength` (float 0→1) as new uniforms
2. Compute all distances from the star position rather than canvas center
3. Drop granulation / plasma turbulence — replace with a smooth, limb-darkened disc
4. Expand the corona to 3-4× the disc radius
5. Add a wide ambient tint bloom that reaches screen edges
6. Keep: diffraction spikes, prominences, core bloom, tonemapping

### Step 1: Replace STAR_VERT

The vertex shader stays the same (full-screen quad, outputs `v_uv`). No change needed.

### Step 2: Replace STAR_FRAG

Replace the entire `STAR_FRAG` string. Here is the new shader:

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform float u_seed;
uniform vec3  u_color;       // palette.core (0-255 range — divide by 255 in shader)
uniform vec3  u_color2;      // palette.halo
uniform vec3  u_color3;      // palette.accent
uniform float u_hasColor2;
uniform float u_hasColor3;
uniform float u_hasDiffraction;
uniform float u_stage;
uniform vec2  u_res;          // physical canvas size (full screen × DPR)
uniform vec2  u_starPos;      // star centre in physical pixels
uniform float u_focusStrength; // 0→1

/* ── helpers ──────────────────────────────────────────────────────────── */
float hash(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash2(vec2 p){ return vec2(hash(p), hash(p + 127.1)); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
}

float fbm(vec2 p, int oct){
  float v=0.0, a=0.5, tot=0.0;
  mat2 rot=mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<8;i++){
    if(i>=oct) break;
    v+=a*vnoise(p); tot+=a;
    p=rot*p*2.03; a*=0.49;
  }
  return v/tot;
}

float dither(vec2 fc){ return (hash(fc+fract(u_time))-0.5)/255.0; }

void main(){
  // Work in physical pixels relative to star centre
  vec2 px     = gl_FragCoord.xy - u_starPos;
  float dist  = length(px);
  float angle = atan(px.y, px.x);

  // Disc radius — ~28% of the shorter viewport dimension at full focus
  float vmin    = min(u_res.x, u_res.y);
  float discR   = vmin * 0.28;        // physical pixels

  float rNorm     = dist / discR;
  float coronaDist = max(0.0, dist - discR);

  vec3  fc_col = u_color  / 255.0;
  vec3  fc_col2= u_color2 / 255.0;
  vec3  fc_col3= u_color3 / 255.0;
  vec3  hot    = vec3(1.0, 0.97, 0.92);
  vec3  warm   = vec3(1.0, 0.85, 0.55);

  float t = u_time * 0.6;

  /* ── DISC (smooth limb-darkened sphere, no hard edge) ──────────────── */
  // Soft edge: smoothstep gives a painterly fade, no mathematical clip
  float discMask = smoothstep(1.18, 0.65, rNorm);

  // Limb darkening — classic stellar mu law
  float mu   = sqrt(max(0.0, 1.0 - min(rNorm, 1.0)*min(rNorm, 1.0)));
  float limb = pow(mu, 0.45) * 0.65 + pow(mu, 2.2) * 0.35;

  // Colour: blinding white core → warm → star colour at limb
  float coreT  = smoothstep(0.0, 0.9, rNorm);
  vec3  discCol = mix(hot, mix(warm, fc_col, coreT * 0.7), coreT);

  // Subtle slow surface shimmer (replaces granulation — just a slow noise roll)
  float shimmer = 0.92 + fbm(vec2(angle*3.0+u_seed, rNorm*4.0+t*0.05), 3) * 0.16;

  vec3 disc = discCol * limb * shimmer * discMask;

  /* ── PROMINENCES ───────────────────────────────────────────────────── */
  float prom = 0.0;
  if(u_stage >= 1.0){
    int nProm = u_stage >= 2.0 ? 4 : 2;
    for(int k=0; k<4; k++){
      if(k >= nProm) break;
      float pa      = u_seed * 6.28318 * float(k+1) * 0.618;
      float angDiff = abs(mod(angle - pa + 3.14159, 6.28318) - 3.14159);
      float arcW    = 0.12 + hash(vec2(u_seed, float(k))) * 0.12;
      float arcH    = discR * (0.12 + hash(vec2(float(k), u_seed*3.0)) * 0.18);
      float radPeak = discR + arcH;
      float turbArc = fbm(vec2(angDiff*10.0+u_seed*float(k+1), dist*0.015+t*0.1), 4);
      float arcShape = exp(-angDiff*angDiff/(arcW*arcW))
                     * exp(-pow(dist - radPeak - turbArc*discR*0.03, 2.0) / (discR*discR*0.04));
      prom += arcShape * 0.6;
    }
  }

  /* ── CORONA ────────────────────────────────────────────────────────── */
  // Extended — fades over ~3× disc radius
  float coronaFade = exp(-coronaDist / (discR * 0.9));

  // Asymmetric rays (domain-warped)
  float nRays      = 5.0 + u_seed * 5.0;
  float warpedAngle = angle + fbm(vec2(angle*0.3+u_seed*9.0, coronaDist/discR*3.0), 4) * 1.1;
  float rays        = pow(abs(cos(warpedAngle * nRays * 0.5)), 5.0);

  // Filament detail
  float fil1 = fbm(vec2(angle*8.0+u_seed,      coronaDist/discR*12.0 - t*0.3), 6);
  float fil2 = fbm(vec2(angle*16.0-u_seed*2.0, coronaDist/discR*24.0 + t*0.2), 5);
  float detail = fil1 * 0.6 + fil2 * 0.4;

  float corona = coronaFade * (rays * 0.5 + 0.25) * (0.4 + detail * 0.85);
  corona *= smoothstep(0.0, discR * 0.06, coronaDist);

  // Corona colour blended from palette
  vec3 coronaCol = mix(fc_col, hot, 0.35);
  if(u_hasColor2 > 0.5) coronaCol = mix(coronaCol, fc_col2, smoothstep(-0.3, 0.5, sin(angle+u_seed*2.0)) * 0.4);
  if(u_hasColor3 > 0.5) coronaCol = mix(coronaCol, fc_col3, smoothstep(-0.3, 0.5, sin(angle+u_seed*4.0+2.1)) * 0.35);

  /* ── WIDE AMBIENT TINT ─────────────────────────────────────────────── */
  // Bleeds star colour across the entire viewport — the NMS "space tinted by the star" look
  float ambient = exp(-(dist*dist) / (vmin * vmin * 0.55)) * 0.18;
  vec3  ambientCol = mix(fc_col, fc_col2 * u_hasColor2 + fc_col * (1.0 - u_hasColor2), 0.35);

  /* ── DIFFRACTION SPIKES ─────────────────────────────────────────────── */
  float spikes = 0.0;
  if(u_hasDiffraction > 0.5){
    float sa = u_seed * 0.7854;
    for(int k=0; k<4; k++){
      float target = sa + float(k) * 1.5708;
      float diff   = abs(mod(angle - target + 3.14159, 6.28318) - 3.14159);
      float spike  = exp(-diff*diff * 1100.0);
      spike *= exp(-coronaDist/(discR*1.6)) * 0.55 + exp(-coronaDist/(discR*4.0)) * 0.28;
      spikes += spike;
    }
    for(int k=0; k<4; k++){
      float target = sa + 0.7854 + float(k) * 1.5708;
      float diff   = abs(mod(angle - target + 3.14159, 6.28318) - 3.14159);
      float spike  = exp(-diff*diff * 2800.0) * exp(-coronaDist/(discR*0.9)) * 0.18;
      spikes += spike;
    }
    spikes *= smoothstep(0.0, discR*0.04, coronaDist);
  }

  /* ── CORE BLOOM ────────────────────────────────────────────────────── */
  float bloom1 = exp(-(dist*dist) / (discR * discR * 0.018));  // tight white-hot
  float bloom2 = exp(-(dist*dist) / (discR * discR * 0.12));   // medium halo

  /* ── COMPOSE ───────────────────────────────────────────────────────── */
  float twinkle = 0.94 + sin(t*0.7+u_seed*6.0)*0.04 + cos(t*0.5)*0.02;

  vec3 col = vec3(0.0);
  col += disc;
  col += mix(fc_col*1.1, hot, 0.5) * prom;
  col += coronaCol * corona * 0.9;
  col += coronaCol * spikes * 0.7;
  col += hot * bloom1 * 0.7;
  col += mix(hot, fc_col, 0.3) * bloom2 * 0.22;
  col += ambientCol * ambient;
  col *= twinkle;

  // Scale entire output by focus strength — glow builds as you zoom in
  float intensity = smoothstep(0.0, 0.4, u_focusStrength);
  col *= intensity;

  // Reinhard tonemap
  col = col / (1.0 + col * 0.18);
  col = pow(col, vec3(0.97));

  // Alpha: disc is solid, everything else additive-soft
  float alpha = discMask * limb;
  float glowA  = corona * 0.9 + prom + spikes * 0.55 + bloom2 * 0.4 + ambient * 0.6;
  alpha = max(alpha, clamp(glowA * twinkle, 0.0, 1.0));
  alpha *= intensity;

  col += dither(gl_FragCoord.xy);

  fragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
}
```

### Step 3: Verify shader compiles

The `createStarProgram` function is unchanged — it calls `compileShader` with the new `STAR_FRAG`. No test for compilation other than runtime console check; the integration test in Task 3 covers this.

### Step 4: Commit

```bash
git add apps/metis-web/lib/landing-stars/star-surface-shader.ts
git commit -m "feat: NMS-style star shader — soft disc, large corona, ambient tint"
```

---

## Task 2: Rework StarDiveOverlay — full-screen canvas, additive blend, new uniforms

**Files:**
- Modify: `apps/metis-web/components/home/star-dive-overlay.tsx`

### Step 1: Update the `StarDiveOverlayView` interface

The interface needs `focusStrength` passed through (currently computed inside the component via prop; we now also need the overlay to be full-screen so screen position logic changes):

```ts
export interface StarDiveOverlayView {
  screenX: number;
  screenY: number;
  focusStrength: number;
  profile: StellarProfile;
  starName?: string;
}
```

This interface is unchanged — `focusStrength` was already there. Good.

### Step 2: Replace the canvas sizing + positioning logic

Current code sizes the canvas to `focusStrength * 52% * vmin` and CSS-positions the wrapper centred on the star. Replace with:
- Canvas is always `window.innerWidth × window.innerHeight` (CSS) / `× DPR` (physical)
- Wrapper is `position: fixed; inset: 0; width: 100vw; height: 100vh` — no transforms
- Star position is passed as `gl.uniform2f(uStarPos, view.screenX * DPR, view.screenY * DPR)`

The resize check becomes:
```ts
const cssW = window.innerWidth;
const cssH = window.innerHeight;
const physW = Math.round(cssW * DPR);
const physH = Math.round(cssH * DPR);

if (canvas.width !== physW || canvas.height !== physH) {
  canvas.width  = physW;
  canvas.height = physH;
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  gl.viewport(0, 0, physW, physH);
}
```

### Step 3: Add new uniform locations

After `const uRes = gl.getUniformLocation(prog, "u_res");` add:
```ts
const uStarPos       = gl.getUniformLocation(prog, "u_starPos");
const uFocusStrength = gl.getUniformLocation(prog, "u_focusStrength");
```

### Step 4: Switch to additive blending

```ts
// Replace:
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// With:
gl.blendFunc(gl.ONE, gl.ONE);
```

### Step 5: Update per-frame uniform calls

Replace the old `wrapper.style` positioning block and canvas resize block with the new logic. The full updated draw function body (key changes only):

```ts
// Canvas size: full screen
const cssW = window.innerWidth;
const cssH = window.innerHeight;
const physW = Math.round(cssW * DPR);
const physH = Math.round(cssH * DPR);
if (canvas!.width !== physW || canvas!.height !== physH) {
  canvas!.width  = physW;
  canvas!.height = physH;
  canvas!.style.width  = `${cssW}px`;
  canvas!.style.height = `${cssH}px`;
  gl.viewport(0, 0, physW, physH);
}

// Wrapper visibility — no transform/scale, just opacity
if (wrapper) {
  wrapper.style.opacity = String(Math.min(1, view.focusStrength * 1.8));
}

// Pass star position and focus strength to shader
gl.uniform2f(uStarPos, view.screenX * DPR, view.screenY * DPR);
gl.uniform1f(uFocusStrength, view.focusStrength);
gl.uniform2f(uRes, physW, physH);
```

Remove the old radius/diameter/physSize sizing block entirely.

### Step 6: Update the HUD label container

The labels div currently sits below the canvas in a flex column. Change it to `position: absolute` anchored to the star's screen position via inline style (updated each frame):

```tsx
// In the returned JSX, the label div gets a ref (labelContainerRef)
// In the draw loop:
if (labelContainerRef.current) {
  labelContainerRef.current.style.left = `${Math.round(view.screenX)}px`;
  labelContainerRef.current.style.top  = `${Math.round(view.screenY + discCssPx + 24)}px`;
}
```

Where `discCssPx = Math.min(window.innerWidth, window.innerHeight) * 0.28` (matching the shader's disc radius).

### Step 7: Update the wrapper div JSX

```tsx
<div
  ref={wrapperRef}
  style={{
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 3,           // above #universe (z-index: 2) — see Task 3
    opacity: 0,
    transition: reducedMotion ? "opacity 0.15s" : "opacity 0.55s ease",
    willChange: "opacity",
  }}
  aria-hidden="true"
>
  <canvas
    ref={canvasRef}
    style={{ display: "block" }}
    aria-hidden="true"
  />
  <div
    ref={labelContainerRef}
    style={{
      position: "absolute",
      transform: "translate(-50%, 0)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      fontFamily: '"Space Grotesk", sans-serif',
      textShadow: "0 1px 10px rgba(0,0,0,0.8)",
      textAlign: "center",
    }}
  >
    {/* name, sub, stats divs — unchanged */}
  </div>
</div>
```

Remove `boxShadow: "0 0 80px 20px rgba(0,0,0,0.55)"` from the canvas — that was masking the hard edge. No longer needed.

### Step 8: Commit

```bash
git add apps/metis-web/components/home/star-dive-overlay.tsx
git commit -m "feat: full-screen additive overlay canvas for NMS star dive"
```

---

## Task 3: Update page.tsx — move overlay above canvas, reduce world fade

**Files:**
- Modify: `apps/metis-web/app/page.tsx`

### Step 1: Move `<StarDiveOverlay>` in JSX

Current order in the render return (around line 4609):
```tsx
<LandingStarfieldWebgl ... />
<StarDiveOverlay ... />          {/* currently z-index 2, BELOW universe */}
<canvas id="universe" ... />    {/* z-index 2 — paints over the overlay */}
```

Move `<StarDiveOverlay>` to after the canvas:
```tsx
<LandingStarfieldWebgl ... />
<canvas id="universe" ... />
<StarDiveOverlay ... />          {/* now z-index 3, above universe */}
```

Exact lines to change: locate the `<StarDiveOverlay` JSX block (currently around line 4614–4617) and move it to after the closing `/>` of `<canvas ... id="universe"` (around line 4627).

### Step 2: Reduce background canvas fade

Line ~3723:
```ts
// Before
const canvasOverlayAlpha = 1 - starDiveFocusStrengthRef.current * 0.92;

// After
const canvasOverlayAlpha = 1 - starDiveFocusStrengthRef.current * 0.12;
```

This means at full focus the background canvas is still at 88% opacity — the world stays alive, the star's light additively composites over it.

### Step 3: Commit

```bash
git add apps/metis-web/app/page.tsx
git commit -m "feat: move star dive overlay above canvas, reduce world fade to 12%"
```

---

## Task 4: Manual visual verification

No automated test can substitute for eyeballing the NMS feel. Do these checks in the browser:

**Setup:** `cd apps/metis-web && pnpm dev` (or however the dev server starts — check `package.json` scripts)

**Check 1 — No hard edge**
- Zoom in on any star past 200×
- The disc edge should be a soft painterly gradient, not a circle stamped onto space

**Check 2 — Background stars visible through glow**
- At full zoom, background stars inside the corona should appear *brighter* (additive), not replaced by black

**Check 3 — Ambient tint**
- The star's color should tint the surrounding viewport — the whole screen takes on a warm/cool cast matching the star's spectral class

**Check 4 — No mode-switch feel**
- Slowly scroll from 150× to 300× — the transition should be a continuous brightening, not a jump

**Check 5 — Labels**
- Star name, spectral class, and stats still appear below the disc at full zoom

**Check 6 — Reduced motion**
- With `prefers-reduced-motion: reduce` set in OS, the glow should appear instantly with no animation

**Check 7 — Different star types**
- Check a red/orange M-type, a blue-white O/B-type, and a yellow G-type — each should have distinct corona color from their `palette.core`/`palette.halo`

### Step: Fix any issues found, then final commit

```bash
git add -p
git commit -m "fix: NMS star dive visual polish pass"
```

---

## Task 5: Existing test suite — verify no regressions

**Files:**
- Run: `apps/metis-web/lib/landing-stars/__tests__/`

The shader rewrite doesn't touch any TypeScript logic that is unit-tested. The overlay component has no unit tests. Run to confirm nothing broke:

```bash
cd apps/metis-web
pnpm test --testPathPattern="landing-star" --passWithNoTests
```

Expected: all tests pass. If any fail, they are pre-existing failures unrelated to this change.

### Commit if clean

```bash
# No code changes needed — just confirm green
```

---

## Summary of all changes

| File | Nature |
|---|---|
| `lib/landing-stars/star-surface-shader.ts` | Replace `STAR_FRAG` — soft disc, no granulation, large corona, ambient tint, `u_starPos`/`u_focusStrength` uniforms |
| `components/home/star-dive-overlay.tsx` | Full-screen canvas, `ONE/ONE` additive blend, new uniform bindings, label container repositioned |
| `app/page.tsx` | `<StarDiveOverlay>` moved after `<canvas id="universe">`, fade multiplier `0.92→0.12` |
