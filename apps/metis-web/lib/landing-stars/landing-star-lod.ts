import type {
  LandingProjectedStar,
  LandingStarLodThresholds,
  LandingStarRenderBatches,
  LandingStarRenderItem,
  LandingStarRenderPlan,
  LandingStarRenderTier,
} from "@/lib/landing-stars/landing-star-types";

export const DEFAULT_LANDING_STAR_LOD_THRESHOLDS: Required<LandingStarLodThresholds> = {
  heroBrightness: 0.82,
  heroSizePx: 7.5,
  heroZoomFactor: 64,
  maxHeroCount: 192,
  spriteBrightness: 0.34,
  spriteSizePx: 2.4,
  spriteZoomFactor: 16,
};

function normalizeThresholds(
  thresholds?: LandingStarLodThresholds,
): Required<LandingStarLodThresholds> {
  return {
    ...DEFAULT_LANDING_STAR_LOD_THRESHOLDS,
    ...thresholds,
  };
}

function compareLandingStarRenderPriority<TStar extends LandingProjectedStar>(
  left: TStar,
  right: TStar,
): number {
  if (left.brightness !== right.brightness) {
    return right.brightness - left.brightness;
  }

  if (left.apparentSize !== right.apparentSize) {
    return right.apparentSize - left.apparentSize;
  }

  return left.id.localeCompare(right.id);
}

function getLandingStarHeroPriority(star: LandingProjectedStar): number {
  return star.brightness * 2.1 + star.apparentSize * 1.3;
}

function compareLandingStarHeroPriority<TStar extends LandingProjectedStar>(
  left: TStar,
  right: TStar,
): number {
  const priorityDelta = getLandingStarHeroPriority(right) - getLandingStarHeroPriority(left);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return compareLandingStarRenderPriority(left, right);
}

export function classifyLandingStarRenderTier(
  star: LandingProjectedStar,
  zoomFactor: number,
  thresholds?: LandingStarLodThresholds,
  closeupStarId?: string | null,
): LandingStarRenderTier {
  // Star Dive closeup override — the focused star gets its own tier
  if (closeupStarId && star.id === closeupStarId) {
    return "closeup";
  }

  const normalizedThresholds = normalizeThresholds(thresholds);

  if (zoomFactor < normalizedThresholds.spriteZoomFactor) {
    return "point";
  }

  const isSpriteCandidate =
    star.apparentSize >= normalizedThresholds.spriteSizePx
    || star.brightness >= normalizedThresholds.spriteBrightness;

  if (zoomFactor < normalizedThresholds.heroZoomFactor) {
    return isSpriteCandidate ? "sprite" : "point";
  }

  const isHeroCandidate =
    star.apparentSize >= normalizedThresholds.heroSizePx
    || star.brightness >= normalizedThresholds.heroBrightness;

  if (isHeroCandidate) {
    return "hero";
  }

  return isSpriteCandidate ? "sprite" : "point";
}

export function assignLandingStarRenderTier<TStar extends LandingProjectedStar>(
  star: TStar,
  zoomFactor: number,
  thresholds?: LandingStarLodThresholds,
  closeupStarId?: string | null,
): LandingStarRenderItem<TStar> {
  return {
    ...star,
    renderTier: classifyLandingStarRenderTier(star, zoomFactor, thresholds, closeupStarId),
  };
}

export function buildLandingStarRenderPlan<TStar extends LandingProjectedStar>(
  stars: readonly TStar[],
  zoomFactor: number,
  thresholds?: LandingStarLodThresholds,
  closeupStarId?: string | null,
): LandingStarRenderPlan<TStar> {
  const normalizedThresholds = normalizeThresholds(thresholds);
  const assignedStars = stars.map((star) => assignLandingStarRenderTier(star, zoomFactor, normalizedThresholds, closeupStarId));
  const closeupCandidates: Array<LandingStarRenderItem<TStar>> = [];
  const heroCandidates: Array<LandingStarRenderItem<TStar>> = [];
  const spriteCandidates: Array<LandingStarRenderItem<TStar>> = [];
  const pointCandidates: Array<LandingStarRenderItem<TStar>> = [];

  for (const star of assignedStars) {
    if (star.renderTier === "closeup") {
      closeupCandidates.push(star);
      continue;
    }

    if (star.renderTier === "hero") {
      heroCandidates.push(star);
      continue;
    }

    if (star.renderTier === "sprite") {
      spriteCandidates.push(star);
      continue;
    }

    pointCandidates.push(star);
  }

  heroCandidates.sort(compareLandingStarHeroPriority);
  spriteCandidates.sort(compareLandingStarRenderPriority);
  pointCandidates.sort(compareLandingStarRenderPriority);

  const promotedHeroes =
    heroCandidates.length > normalizedThresholds.maxHeroCount
      ? heroCandidates.slice(0, normalizedThresholds.maxHeroCount)
      : heroCandidates;
  const demotedHeroes =
    heroCandidates.length > normalizedThresholds.maxHeroCount
      ? heroCandidates.slice(normalizedThresholds.maxHeroCount).map((star) => ({
          ...star,
          renderTier: "sprite" as const,
        }))
      : [];

  const batches: LandingStarRenderBatches<TStar> = {
    closeup: closeupCandidates,
    hero: promotedHeroes,
    point: pointCandidates,
    sprite: [...spriteCandidates, ...demotedHeroes].sort(compareLandingStarRenderPriority),
  };

  return {
    batches,
    tierCounts: {
      closeup: batches.closeup.length,
      hero: batches.hero.length,
      point: batches.point.length,
      sprite: batches.sprite.length,
    },
  };
}
