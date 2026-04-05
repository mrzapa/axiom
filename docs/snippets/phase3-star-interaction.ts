// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: Star Interaction System — Every catalogue star is clickable
// ═══════════════════════════════════════════════════════════════════════════════
//
// Currently only "addable" background stars get spatial hashing and interaction.
// We need ALL catalogue stars to respond to hover and click.

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3.1: Build a catalogue star lookup map (inside the render effect)
// ──────────────────────────────────────────────────────────────────────────────

// ADD after the `refreshVisibleStars` function completes, around line 2740:
/*
// Map from star ID → CatalogueStar for quick lookup on hover/click
const catalogueStarLookup = new Map<string, CatalogueStar>();

// Inside refreshVisibleStars, after iterating catalogueStars:
for (const cat of catalogueStars) {
  catalogueStarLookup.set(cat.id, cat);
}
*/

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3.2: Extend the spatial hash to include ALL visible stars (not just addable)
// ──────────────────────────────────────────────────────────────────────────────

// MODIFY the spatial hash building (around line 2720-2730).
// Currently it only hashes addable targets:
//   const addableTargets = landingRenderableStars.filter((star) => star.addable);
//   landingStarSpatialHash = addableTargets.length > 0
//     ? buildLandingStarSpatialHash(addableTargets) : null;
//
// CHANGE to hash ALL visible stars:
/*
landingStarSpatialHash = landingRenderableStars.length > 0
  ? buildLandingStarSpatialHash(landingRenderableStars)
  : null;
*/

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3.3: Hover tooltip showing star name + spectral class
// ──────────────────────────────────────────────────────────────────────────────

// ADD a new ref for the hovered catalogue star:
/*
const hoveredCatalogueStarRef = useRef<CatalogueStar | null>(null);
const [hoveredCatalogueStarId, setHoveredCatalogueStarId] = useState<string | null>(null);
*/

// MODIFY the mousemove handler. After the existing user star hover check,
// add catalogue star hover detection:
/*
// Inside the mousemove handler, after checking hoveredAddCandidate:
if (!hoveredAddCandidateRef.current && landingStarSpatialHash) {
  const closest = findClosestLandingStarHitTarget(
    landingStarSpatialHash,
    clientX,
    clientY,
  );
  if (closest) {
    const catStar = catalogueStarLookup.get(closest.id);
    if (catStar && hoveredCatalogueStarRef.current?.id !== catStar.id) {
      hoveredCatalogueStarRef.current = catStar;
      setHoveredCatalogueStarId(catStar.id);
    }
  } else if (hoveredCatalogueStarRef.current) {
    hoveredCatalogueStarRef.current = null;
    setHoveredCatalogueStarId(null);
  }
}
*/

// ADD the tooltip JSX (add after the existing star-tooltip div, around line 4700):
/*
{hoveredCatalogueStarId && hoveredCatalogueStarRef.current && (() => {
  const cat = hoveredCatalogueStarRef.current;
  // Find the screen position from the spatial hash
  const renderState = landingRenderableStars.find(s => s.id === cat.id);
  if (!renderState) return null;
  return (
    <div
      className="metis-catalogue-tooltip"
      style={{
        position: "fixed",
        left: renderState.x + 16,
        top: renderState.y - 40,
        zIndex: 210,
        pointerEvents: "none",
      }}
    >
      <div className="metis-catalogue-tooltip-name">{cat.name}</div>
      <div className="metis-catalogue-tooltip-class">
        {cat.profile.spectralClass} · {cat.profile.stellarType.replace(/_/g, " ")}
      </div>
      <div className="metis-catalogue-tooltip-stats">
        {Math.round(cat.profile.temperatureK).toLocaleString()} K · {cat.profile.luminositySolar.toFixed(1)} L☉
      </div>
    </div>
  );
})()}
*/

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3.4: Tooltip CSS (add to metisStyles)
// ──────────────────────────────────────────────────────────────────────────────

export const catalogueTooltipStyles = `
.metis-catalogue-tooltip {
  background: rgba(6, 10, 20, 0.92);
  border: 1px solid rgba(200, 210, 225, 0.12);
  border-radius: 10px;
  padding: 10px 14px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  max-width: 240px;
  animation: metis-tooltipIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes metis-tooltipIn {
  from { opacity: 0; transform: translateY(6px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.metis-catalogue-tooltip-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: rgba(240, 244, 255, 0.96);
  letter-spacing: -0.01em;
}

.metis-catalogue-tooltip-class {
  margin-top: 4px;
  font-size: 11px;
  color: rgba(232, 184, 74, 0.82);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.metis-catalogue-tooltip-stats {
  margin-top: 3px;
  font-size: 10px;
  color: rgba(180, 190, 210, 0.55);
  letter-spacing: 0.02em;
}
`;

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3.5: Click to open star detail / "Add to Constellation" promotion
// ──────────────────────────────────────────────────────────────────────────────

// MODIFY the mousedown/click handler. After checking for user star clicks,
// add catalogue star click:
/*
// Inside the click handler, after user star and node checks:
if (!handled && landingStarSpatialHash) {
  const closest = findClosestLandingStarHitTarget(
    landingStarSpatialHash,
    clientX,
    clientY,
  );
  if (closest) {
    const catStar = catalogueStarLookup.get(closest.id);
    if (catStar) {
      // Open the star observatory dialog for this catalogue star
      openCatalogueStarDetails(catStar);
      handled = true;
    }
  }
}
*/

// ADD the openCatalogueStarDetails function:
/*
function openCatalogueStarDetails(catStar: CatalogueStar) {
  // Populate the star observatory dialog with catalogue star data
  setSelectedCatalogueStarForDialog(catStar);
}
*/

// The "Add to Constellation" action in the dialog creates a UserStar:
/*
async function promoteCatalogueStarToUser(catStar: CatalogueStar) {
  // Convert catalogue star world position to constellation coordinates
  const cam = readBackgroundCamera();
  const screenX = (catStar.wx - cam.x) * getBackgroundCameraScale(cam.zoomFactor) + W / 2;
  const screenY = (catStar.wy - cam.y) * getBackgroundCameraScale(cam.zoomFactor) + H / 2;
  const constellationPoint = screenToConstellationPoint(
    { x: screenX, y: screenY }, W, H, cam,
  );

  const createdStar = await addUserStar({
    x: constellationPoint.x,
    y: constellationPoint.y,
    size: 0.82 + catStar.profile.luminositySolar * 0.1,
    label: catStar.name,
    stage: "seed",
  });

  if (createdStar) {
    openStarDetails(createdStar, "new");
    showToast(`${catStar.name} added to your constellation`);
  }
}
*/

export {};
