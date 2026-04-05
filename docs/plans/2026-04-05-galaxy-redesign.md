# Galaxy Redesign + Scroll Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat, dark galaxy background with a dramatic three-layer composited galaxy (radial core glow + fBm cloud arms + three-tier star field) where the constellation nucleus sits at the brightest centre, and extend the galaxy fade range to 2.5×.

**Architecture:** All changes are in `apps/metis-web/app/page.tsx`. The scroll direction is already correct (`Math.exp(-e.deltaY * 0.0014)`). Only two things change: (1) the body of `renderGalaxyToCanvas` is replaced wholesale with the three-pass renderer, and (2) the `smoothstep` upper bound in `drawGalaxy` changes from `1.5` to `2.5`.

**Tech Stack:** TypeScript, HTML Canvas 2D API, `ImageData` for pixel-level density map, `createRadialGradient` for core glow, inline hash/fBm noise (already in file).

**Design doc:** `docs/plans/2026-04-05-galaxy-scroll-redesign.md`

---

### Task 1: Extend galaxy fade range

**Files:**
- Modify: `apps/metis-web/app/page.tsx:2174`

**Context:** `drawGalaxy` at line 2172 computes `galaxyAlpha = 1 - smoothstep(0.75, 1.5, zoomFactor)`. The upper bound `1.5` makes the galaxy disappear too quickly as you zoom in. Changing it to `2.5` makes the galaxy linger — the "diving into the nucleus" feeling.

**Step 1: Make the change**

Find at line 2174:
```ts
      const galaxyAlpha = 1 - smoothstep(0.75, 1.5, zoomFactor);
```

Replace with:
```ts
      const galaxyAlpha = 1 - smoothstep(0.75, 2.5, zoomFactor);
```

**Step 2: TypeScript check**
```
powershell.exe -Command "Set-Location 'C:\Users\samwe\Documents\metis'; pnpm --filter metis-web exec tsc --noEmit 2>&1 | Select-Object -First 20"
```
Expected: no new errors.

**Step 3: Commit and push**
```
powershell.exe -Command "Set-Location 'C:\Users\samwe\Documents\metis'; git add apps/metis-web/app/page.tsx; git commit -m 'fix: extend galaxy fade range to 2.5x for deeper nucleus dive feel'; git push origin main"
```

---

### Task 2: Replace galaxy render with three-pass composited version

**Files:**
- Modify: `apps/metis-web/app/page.tsx:2094–2167`

**Context:** The current `renderGalaxyToCanvas` is a single-pass tilted-band renderer with very low opacity. Replace the entire body of the function (lines 2094–2167) with the three-pass version below. The function signature stays identical: `function renderGalaxyToCanvas(offscreen: HTMLCanvasElement, cW: number, cH: number)`.

The helpers `hash2`, `valueNoise`, `fbm4` are already defined earlier in the same closure (lines ~2068–2092) — do NOT redefine them.

**Step 1: Replace the function body**

Replace the entire `renderGalaxyToCanvas` function (from `function renderGalaxyToCanvas` through its closing `}`) with:

```ts
    function renderGalaxyToCanvas(offscreen: HTMLCanvasElement, cW: number, cH: number) {
      const gc = offscreen.getContext('2d');
      if (!gc) return;
      const dpr = window.devicePixelRatio || 1;
      const pw = Math.round(cW * dpr);
      const ph = Math.round(cH * dpr);
      offscreen.width  = pw;
      offscreen.height = ph;

      const cx = pw / 2;
      const cy = ph / 2;

      // --- Pass 1: Radial core glow ---
      const coreRadius = Math.min(pw, ph) * 0.55;
      const coreGrad = gc.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
      coreGrad.addColorStop(0,    'rgba(200,180,255,0.65)');
      coreGrad.addColorStop(0.08, 'rgba(160,120,255,0.5)');
      coreGrad.addColorStop(0.20, 'rgba(80,40,180,0.28)');
      coreGrad.addColorStop(0.50, 'rgba(20,10,60,0.12)');
      coreGrad.addColorStop(1.0,  'rgba(0,0,0,0)');
      gc.fillStyle = coreGrad;
      gc.fillRect(0, 0, pw, ph);

      // --- Pass 2: fBm cloud arms (pixel density map) ---
      const stride = 2;
      const imageData = gc.createImageData(pw, ph);
      const data = imageData.data;

      for (let py = 0; py < ph; py += stride) {
        for (let px = 0; px < pw; px += stride) {
          // Normalised coords centred on nucleus, ±1.5
          const nx = (px / pw - 0.5) * 3;
          const ny = (py / ph - 0.5) * 3;
          const r2 = nx * nx + ny * ny;

          // Radial falloff — nucleus is always bright
          const coreDensity = Math.exp(-r2 / 0.18);

          // Two spiral arm lobes (120° apart)
          const angle = Math.atan2(ny, nx);
          const lobe1 = Math.exp(-(Math.pow(angle - 0.4, 2) + r2 * 0.35) / 0.45);
          const lobe2 = Math.exp(-(Math.pow(angle - 0.4 - Math.PI, 2) + r2 * 0.35) / 0.45);
          const armDensity = (lobe1 + lobe2) * 0.65;

          const noise = fbm4(nx * 2.5, ny * 2.5);
          const rawDensity = coreDensity + armDensity;
          const density = Math.min(1, rawDensity) * (0.35 + noise * 0.65);

          // Deep violet → lavender, warming toward core
          const rc = Math.round(Math.min(255, 15  + 75  * noise + 120 * coreDensity));
          const gc2 = Math.round(Math.min(255, 8   + 52  * noise +  72 * coreDensity));
          const bc = Math.round(Math.min(255, 45  + 130 * noise + 100 * coreDensity));
          const ac = Math.round(density * 185);

          // Fill stride×stride block
          for (let dy = 0; dy < stride && py + dy < ph; dy++) {
            for (let dx = 0; dx < stride && px + dx < pw; dx++) {
              const idx = ((py + dy) * pw + (px + dx)) * 4;
              data[idx    ] = rc;
              data[idx + 1] = gc2;
              data[idx + 2] = bc;
              data[idx + 3] = ac;
            }
          }
        }
      }

      // Blur cloud arms into temp canvas to avoid self-compositing
      const armTemp = document.createElement('canvas');
      armTemp.width = pw;
      armTemp.height = ph;
      const atx = armTemp.getContext('2d');
      if (atx) {
        atx.putImageData(imageData, 0, 0);
        const blurTemp = document.createElement('canvas');
        blurTemp.width = pw;
        blurTemp.height = ph;
        const btx = blurTemp.getContext('2d');
        if (btx) {
          btx.filter = 'blur(6px)';
          btx.drawImage(armTemp, 0, 0);
          btx.filter = 'none';
          gc.drawImage(blurTemp, 0, 0);
        }
      }

      // --- Pass 3: Three-tier procedural star field ---
      // Recompute density per sample point for star placement
      for (let py = 0; py < ph; py += 2) {
        for (let px = 0; px < pw; px += 2) {
          const nx = (px / pw - 0.5) * 3;
          const ny = (py / ph - 0.5) * 3;
          const r2 = nx * nx + ny * ny;
          const coreDensity = Math.exp(-r2 / 0.18);
          const angle = Math.atan2(ny, nx);
          const lobe1 = Math.exp(-(Math.pow(angle - 0.4, 2) + r2 * 0.35) / 0.45);
          const lobe2 = Math.exp(-(Math.pow(angle - 0.4 - Math.PI, 2) + r2 * 0.35) / 0.45);
          const armDensity = (lobe1 + lobe2) * 0.65;
          const noise = fbm4(nx * 2.5 + 1.3, ny * 2.5 + 0.7);
          const density = Math.min(1, coreDensity + armDensity) * (0.35 + noise * 0.65);

          const h = Math.abs(hash2(px, py));

          if (h < density * 0.003) {
            // Large bright star — filled circle
            gc.fillStyle = `rgba(230,220,255,${(density * 0.95).toFixed(3)})`;
            gc.beginPath();
            gc.arc(px, py, 1.5, 0, Math.PI * 2);
            gc.fill();
          } else if (h < density * 0.025) {
            // Medium star
            gc.fillStyle = `rgba(190,170,255,${(density * 0.85).toFixed(3)})`;
            gc.fillRect(px, py, 1, 1);
          } else if (h < density * 0.10) {
            // Tiny dim star
            gc.fillStyle = `rgba(150,130,225,${(density * 0.55).toFixed(3)})`;
            gc.fillRect(px, py, 1, 1);
          }
        }
      }
    }
```

**Important notes for the implementer:**
- The variable name `gc2` is used for the green channel to avoid shadowing the outer `gc` (canvas context). Do not rename `gc`.
- Do NOT touch anything outside the `renderGalaxyToCanvas` function — `drawGalaxy`, `galaxyCanvas`, and the resize call are all unchanged.
- The `hash2`, `valueNoise`, `fbm4` helpers defined at lines ~2068–2092 are still in scope — do not add them again.

**Step 2: TypeScript check**
```
powershell.exe -Command "Set-Location 'C:\Users\samwe\Documents\metis'; pnpm --filter metis-web exec tsc --noEmit 2>&1 | Select-Object -First 30"
```
Expected: no new errors.

**Step 3: Verify in browser preview**

The preview server is running at http://localhost:3000 (serverId: `04a950c0-8fef-4834-ad8c-fdec209495cd`).

Zoom out to ~0.75× — you should see:
- A bright violet-white nucleus glow at the canvas centre
- Two sweeping arm structures with cloud texture
- Thousands of stars at varying sizes clustered toward the centre
- The constellation's faculty hub nodes sitting inside the nucleus glow

Zoom in past 2.5× — galaxy should fade completely.

**Step 4: Commit and push**
```
powershell.exe -Command "Set-Location 'C:\Users\samwe\Documents\metis'; git add apps/metis-web/app/page.tsx; git commit -m 'feat: replace galaxy with three-pass composited nucleus + arms + star field'; git push origin main"
```

---

## Files Changed

| File | Change |
|------|--------|
| `apps/metis-web/app/page.tsx` | Task 1: `smoothstep(0.75, 2.5, ...)` fade range; Task 2: full `renderGalaxyToCanvas` replacement |
