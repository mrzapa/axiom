// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Unified Star Identity — UserStar extends CatalogueStar
// ═══════════════════════════════════════════════════════════════════════════════
//
// Make user stars and catalogue stars the same kind of object rendered through
// the same WebGL pipeline. User stars are just catalogue stars with extra metadata.

// ──────────────────────────────────────────────────────────────────────────────
// STEP 5.1: Create the unified UserStar type
// ──────────────────────────────────────────────────────────────────────────────

// MODIFY constellation-types.ts to extend CatalogueStar:
/*
import type { CatalogueStar } from "@/lib/star-catalogue";

export interface UserStar extends CatalogueStar {
  // Existing user-specific fields:
  id: string;
  x: number;       // constellation-space x (0-1)
  y: number;       // constellation-space y (0-1)
  size: number;
  createdAt: number;
  label?: string;
  primaryDomainId?: string;
  relatedDomainIds?: string[];
  stage?: UserStarStage;
  intent?: string;
  notes?: string;
  connectedUserStarIds?: string[];
  scaffoldWeights?: Record<string, number>;
  linkedManifestPaths?: string[];
  activeManifestPath?: string;
  linkedManifestPath?: string;
  learningRoute?: LearningRoute;

  // New: link back to original catalogue star
  catalogueStarId?: string;  // ID of the CatalogueStar this was promoted from
}
*/

// ──────────────────────────────────────────────────────────────────────────────
// STEP 5.2: Render user stars through the WebGL pipeline
// ──────────────────────────────────────────────────────────────────────────────

// Currently user stars are drawn on the 2D canvas via drawUserStars().
// To unify, include user star positions in the WebGL frame alongside catalogue stars.

// MODIFY the frame building (around line 2725-2735 in page.tsx):
/*
// After building nextWebglStars from catalogue stars, append user stars:
const userStarWebglEntries: LandingWebglStar[] = [];
projectedUserStarRenderState.forEach((projectedState) => {
  const { star, target, stellarProfile } = projectedState;
  userStarWebglEntries.push({
    addable: false,
    apparentSize: star.size * 3.5 * userStarScale,  // User stars are visually larger
    brightness: Math.min(0.98, 0.6 + (star.size - 0.5) * 0.3),
    id: star.id,
    profile: stellarProfile,
    renderTier: "hero" as const,  // User stars always render at hero tier minimum
    x: target.x,
    y: target.y,
  });
});

const allWebglStars = [...nextWebglStars, ...userStarWebglEntries];

landingStarfieldFrameRef.current = {
  height: H,
  revision: landingStarfieldFrameRef.current.revision + 1,
  stars: allWebglStars,
  width: W,
  zoomScale: zoomNorm,
};
*/

// KEEP the 2D canvas drawUserStars() for overlays only:
// - Faculty colour rings
// - Labels
// - Connection edges
// - Selection highlights
// - RAG pulse effects
// - Diffraction spikes (these can stay on 2D canvas for now)
//
// The actual star body rendering moves to WebGL.
// Modify drawUserStars to skip the core radial gradient fill and
// only draw the overlay elements:

/*
function drawUserStars(t: number) {
  if (projectedUserStarRenderState.size === 0) return;

  const renderTimeMs = getRenderEpochMs(t);
  const ragPulseState = ragPulseStateRef.current;
  const ragPulseStrength = getHomeRagPulseStrength(ragPulseState, renderTimeMs);
  const constellationScale = getConstellationCameraScale(backgroundZoomRef.current);
  const userStarScale = Math.max(0.58, 0.36 + Math.pow(constellationScale, 0.72) * 0.64);

  projectedUserStarRenderState.forEach((projectedState) => {
    const {
      dragging, fadeIn, influenceColors, mixed, profile,
      ringCount, selected, star, stellarProfile, target,
    } = projectedState;

    const ragHighlighted = ragPulseStrength > 0 && Boolean(ragPulseState?.starIds.has(star.id));
    const px = target.x;
    const py = target.y;
    const sz = (star.size * 1.5 + (selected ? 1.2 : 0) + (dragging ? 0.8 : 0)) * userStarScale;

    // REMOVED: halo gradient, aura gradient, core fill (now in WebGL)
    // KEPT: overlays only

    // Faculty colour ring
    if (star.primaryDomainId) {
      const [fr, fg, fb] = getFacultyColor(star.primaryDomainId);
      ctx!.beginPath();
      ctx!.arc(px, py, sz * 2.2, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${fr},${fg},${fb},${0.28 * fadeIn})`;
      ctx!.lineWidth = 1.2;
      ctx!.stroke();
    }

    // RAG pulse ring
    if (ragHighlighted) {
      const haloColor = stellarProfile.palette.halo;
      ctx!.beginPath();
      ctx!.arc(px, py, sz * (4.1 + ragPulseStrength * 1.1), 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(${haloColor[0]},${haloColor[1]},${haloColor[2]},${0.26 + ragPulseStrength * 0.34})`;
      ctx!.lineWidth = 1.15 + ragPulseStrength * 0.7;
      ctx!.stroke();
    }

    // Selection ring
    if (selected) {
      ctx!.beginPath();
      ctx!.arc(px, py, sz * 3.2, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(232, 184, 74, ${0.32 * fadeIn})`;
      ctx!.lineWidth = 1.0;
      ctx!.setLineDash([3, 4]);
      ctx!.stroke();
      ctx!.setLineDash([]);
    }

    // Orbiting satellites
    const satelliteCount = Math.min(projectedState.attachmentCount, 3);
    const accentColor = stellarProfile.palette.accent;
    for (let i = 0; i < satelliteCount; i++) {
      const angle = t * 0.001 + profile.twinklePhase * 0.2 + (Math.PI * 2 * i) / Math.max(1, satelliteCount);
      const orbitRadius = sz + 11 + i * 2;
      const satX = px + Math.cos(angle) * orbitRadius;
      const satY = py + Math.sin(angle) * orbitRadius * 0.8;
      ctx!.beginPath();
      ctx!.arc(satX, satY, 1.3 + i * 0.25, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(${accentColor[0]},${accentColor[1]},${accentColor[2]},${0.85 * fadeIn})`;
      ctx!.fill();
    }
  });
}
*/

// ──────────────────────────────────────────────────────────────────────────────
// STEP 5.3: Consistent parallax for all stars
// ──────────────────────────────────────────────────────────────────────────────

// Currently background stars have per-layer parallax but user stars have
// a fixed parallax (0.015). Unify by using depth layers for both:
/*
// In the mouse parallax section, apply the same depth-based parallax:
const mouseParallaxX = (mouse.x - W / 2) * star.depthLayer * 0.026;
const mouseParallaxY = (mouse.y - H / 2) * star.depthLayer * 0.026;
*/

export {};
