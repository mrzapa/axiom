// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL POLISH — CSS, shader, and rendering refinements
// ═══════════════════════════════════════════════════════════════════════════════
// Drop-in improvements for the coding agent to apply.

// ──────────────────────────────────────────────────────────────────────────────
// 1. IMPROVED FRAGMENT SHADER — richer star rendering with chromatic corona
// ──────────────────────────────────────────────────────────────────────────────

// Replace the fragmentShader in landing-starfield-webgl.tsx:
export const IMPROVED_FRAGMENT_SHADER = `
varying float vAddable;
varying float vBloom;
varying float vBrightness;
varying float vCoreRadius;
varying float vDiffraction;
varying float vTier;
varying float vTwinkle;
varying vec3 vAccentColor;
varying vec3 vCoreColor;
varying vec3 vHaloColor;

float safeSmoothstep(float edge0, float edge1, float x) {
  if (edge0 == edge1) return x < edge0 ? 0.0 : 1.0;
  return smoothstep(edge0, edge1, x);
}

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);
  if (dist > 1.0) discard;

  float tierBlend = vTier > 1.5 ? 1.0 : (vTier > 0.5 ? 0.6 : 0.0);

  // Softer halo falloff with exponential decay
  float haloMask = exp(-dist * dist * (2.0 + (1.0 - tierBlend) * 1.5));

  // Sharper core with Gaussian profile
  float coreWidth = max(0.08, vCoreRadius * 0.5);
  float coreMask = exp(-dist * dist / (2.0 * coreWidth * coreWidth));

  // Surface transition between halo and core
  float surfaceMask = safeSmoothstep(0.82, max(0.08, vCoreRadius * 1.8), dist);

  // Chromatic aberration ring (subtle colour fringe at the edge)
  float chromaRing = safeSmoothstep(0.92, 0.72, dist) * safeSmoothstep(0.42, 0.62, dist);

  // Base colour mixing
  vec3 surfaceColor = mix(vHaloColor, vCoreColor, 0.42);
  vec3 color = mix(vHaloColor, surfaceColor, surfaceMask);
  color = mix(color, vCoreColor, coreMask * 0.85);

  // Chromatic corona: shift accent colour toward the rim
  color += vAccentColor * chromaRing * (0.06 + tierBlend * 0.1);

  // Hot white core for bright stars
  float whiteCore = coreMask * coreMask * vBrightness * 0.35;
  color = mix(color, vec3(1.0), whiteCore);

  // Hero tier: swirling detail
  if (vTier > 1.5) {
    float angle = atan(uv.y, uv.x);
    float swirl = sin(angle * 3.0 + dist * 12.0) * 0.5 + 0.5;
    float swirlMask = safeSmoothstep(0.88, 0.14, dist) * swirl * 0.08 * vBloom;
    color += vAccentColor * swirlMask;

    // Limb darkening for hero/closeup
    float limb = 1.0 - pow(1.0 - dist * dist, 0.5);
    color *= 1.0 - limb * 0.15;
  }

  // Diffraction spikes — sharper, more cinematic
  if (vDiffraction > 0.02) {
    float crossX = exp(-abs(uv.x) * 16.0);
    float crossY = exp(-abs(uv.y) * 16.0);
    float spike45a = exp(-(abs(uv.x - uv.y) * 0.707) * 22.0);
    float spike45b = exp(-(abs(uv.x + uv.y) * 0.707) * 22.0);
    float primarySpike = max(crossX, crossY);
    float secondarySpike = max(spike45a, spike45b) * 0.35;
    float spikeMask = (primarySpike + secondarySpike) * (1.0 - dist * 0.6);
    float spikeStrength = vDiffraction * (0.16 + tierBlend * 0.22);
    color += vAccentColor * spikeMask * spikeStrength;
  }

  // Addable stars: warm tint
  if (vAddable > 0.5) {
    color = mix(color, vec3(0.95, 0.82, 0.55), 0.10);
  }

  // Alpha compositing with better depth
  float alphaBase = (0.16 + vBrightness * 0.52) * vTwinkle;
  float alpha = haloMask * alphaBase + coreMask * 0.32 + chromaRing * 0.05;
  alpha = clamp(alpha * (0.88 + vBloom * 0.14), 0.0, 1.0);

  gl_FragColor = vec4(color * (0.84 + vBrightness * 0.36), alpha);
}
`;

// ──────────────────────────────────────────────────────────────────────────────
// 2. IMPROVED STAR DIVE HUD STYLES
// ──────────────────────────────────────────────────────────────────────────────

export const STAR_DIVE_HUD_STYLES = `
.metis-star-dive-hud {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  padding: 16px 24px;
  border-radius: 16px;
  background: rgba(4, 6, 14, 0.65);
  border: 1px solid rgba(200, 210, 225, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s ease;
}

.metis-star-dive-hud-name {
  font-family: 'Outfit', sans-serif;
  font-weight: 300;
  font-size: 20px;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: -0.02em;
}

.metis-star-dive-hud-class {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: rgba(232, 184, 74, 0.82);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metis-star-dive-hud-stats {
  font-size: 11px;
  color: rgba(180, 190, 210, 0.6);
  letter-spacing: 0.02em;
}

.metis-star-dive-hud-hint {
  font-size: 10px;
  color: rgba(180, 190, 210, 0.35);
  margin-top: 2px;
}
`;

// ──────────────────────────────────────────────────────────────────────────────
// 3. IMPROVED CATALOGUE STAR TOOLTIP + OBSERVATORY DIALOG
// ──────────────────────────────────────────────────────────────────────────────

export const CATALOGUE_OBSERVATORY_STYLES = `
/* Star Observatory Dialog — opened when clicking a catalogue star */
.metis-star-observatory {
  position: fixed;
  z-index: 200;
  width: min(380px, calc(100vw - 32px));
  background: rgba(6, 10, 20, 0.94);
  border: 1px solid rgba(200, 210, 225, 0.09);
  border-radius: 18px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  animation: metis-observatoryIn 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes metis-observatoryIn {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Star colour strip at top (shows the star's palette) */
.metis-star-observatory-strip {
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--star-halo, rgba(100, 150, 255, 0.6)),
    var(--star-core, rgba(255, 240, 220, 0.8)),
    var(--star-accent, rgba(255, 180, 100, 0.5))
  );
}

.metis-star-observatory-body {
  padding: 22px 24px 20px;
}

.metis-star-observatory-type {
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(232, 184, 74, 0.72);
  font-family: 'Space Grotesk', sans-serif;
}

.metis-star-observatory-name {
  margin-top: 8px;
  font-family: 'Outfit', sans-serif;
  font-weight: 300;
  font-size: 26px;
  color: rgba(240, 244, 255, 0.96);
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.metis-star-observatory-class {
  margin-top: 6px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: rgba(200, 210, 225, 0.7);
}

.metis-star-observatory-stats {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.metis-star-observatory-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(200, 210, 225, 0.05);
}

.metis-star-observatory-stat-label {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(180, 190, 210, 0.4);
}

.metis-star-observatory-stat-value {
  font-family: 'Outfit', sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: rgba(240, 244, 255, 0.9);
  letter-spacing: -0.01em;
}

.metis-star-observatory-actions {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(200, 210, 225, 0.06);
  display: flex;
  gap: 10px;
}

.metis-star-observatory-add-btn {
  flex: 1;
  border: 1px solid rgba(232, 184, 74, 0.22);
  background: rgba(28, 40, 72, 0.56);
  color: rgba(255, 245, 221, 0.94);
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: 'Inter', sans-serif;
}

.metis-star-observatory-add-btn:hover {
  border-color: rgba(232, 184, 74, 0.42);
  background: rgba(36, 50, 88, 0.72);
  transform: translateY(-1px);
}

.metis-star-observatory-close-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(200, 210, 225, 0.1);
  background: rgba(15, 22, 40, 0.56);
  color: rgba(200, 210, 225, 0.5);
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
}

.metis-star-observatory-close-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  border-color: rgba(200, 210, 225, 0.2);
}
`;

// ──────────────────────────────────────────────────────────────────────────────
// 4. STAR OBSERVATORY DIALOG — React JSX component
// ──────────────────────────────────────────────────────────────────────────────

// Add this JSX inside the return block (after the existing star tooltip):
export const STAR_OBSERVATORY_JSX = `
{selectedCatalogueStar && (() => {
  const cat = selectedCatalogueStar;
  const p = cat.profile.palette;
  return (
    <div
      className="metis-star-observatory"
      style={{
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className="metis-star-observatory-strip"
        style={{
          "--star-halo": \`rgb(\${p.halo[0]}, \${p.halo[1]}, \${p.halo[2]})\`,
          "--star-core": \`rgb(\${p.core[0]}, \${p.core[1]}, \${p.core[2]})\`,
          "--star-accent": \`rgb(\${p.accent[0]}, \${p.accent[1]}, \${p.accent[2]})\`,
        } as React.CSSProperties}
      />
      <div className="metis-star-observatory-body">
        <div className="metis-star-observatory-type">
          {cat.profile.stellarType.replace(/_/g, " ")}
        </div>
        <div className="metis-star-observatory-name">{cat.name}</div>
        <div className="metis-star-observatory-class">
          {cat.profile.spectralClass}
          {cat.profile.luminosityClass ? \` \${cat.profile.luminosityClass}\` : ""}
        </div>

        <div className="metis-star-observatory-stats">
          <div className="metis-star-observatory-stat">
            <div className="metis-star-observatory-stat-label">Temperature</div>
            <div className="metis-star-observatory-stat-value">
              {Math.round(cat.profile.temperatureK).toLocaleString()} K
            </div>
          </div>
          <div className="metis-star-observatory-stat">
            <div className="metis-star-observatory-stat-label">Luminosity</div>
            <div className="metis-star-observatory-stat-value">
              {cat.profile.luminositySolar.toFixed(1)} L☉
            </div>
          </div>
          <div className="metis-star-observatory-stat">
            <div className="metis-star-observatory-stat-label">Mass</div>
            <div className="metis-star-observatory-stat-value">
              {cat.profile.massSolar.toFixed(2)} M☉
            </div>
          </div>
          <div className="metis-star-observatory-stat">
            <div className="metis-star-observatory-stat-label">Radius</div>
            <div className="metis-star-observatory-stat-value">
              {cat.profile.radiusSolar.toFixed(2)} R☉
            </div>
          </div>
        </div>

        <div className="metis-star-observatory-actions">
          <button
            type="button"
            className="metis-star-observatory-add-btn"
            onClick={() => promoteCatalogueStarToUser(cat)}
          >
            Add to Constellation
          </button>
          <button
            type="button"
            className="metis-star-observatory-close-btn"
            onClick={() => setSelectedCatalogueStar(null)}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
})()}
`;

export {};
