export type LandingStarRenderTier = "point" | "sprite" | "hero" | "closeup";

export interface LandingProjectedStar {
  id: string;
  x: number;
  y: number;
  apparentSize: number;
  brightness: number;
}

export interface LandingStarHitTarget extends LandingProjectedStar {
  hitRadius: number;
}

export interface LandingStarLodThresholds {
  heroBrightness?: number;
  heroSizePx?: number;
  heroZoomFactor?: number;
  maxHeroCount?: number;
  spriteBrightness?: number;
  spriteSizePx?: number;
  spriteZoomFactor?: number;
}

export type LandingStarRenderItem<TStar extends LandingProjectedStar = LandingProjectedStar> =
  TStar & {
    renderTier: LandingStarRenderTier;
  };

export interface LandingStarRenderBatches<TStar extends LandingProjectedStar = LandingProjectedStar> {
  closeup: Array<LandingStarRenderItem<TStar>>;
  hero: Array<LandingStarRenderItem<TStar>>;
  point: Array<LandingStarRenderItem<TStar>>;
  sprite: Array<LandingStarRenderItem<TStar>>;
}

export interface LandingStarRenderPlan<TStar extends LandingProjectedStar = LandingProjectedStar> {
  batches: LandingStarRenderBatches<TStar>;
  tierCounts: Record<LandingStarRenderTier, number>;
}

export interface LandingStarSpatialHashOptions {
  cellSize?: number;
  queryPaddingPx?: number;
}

export interface LandingStarSpatialHash<TStar extends LandingStarHitTarget = LandingStarHitTarget> {
  cellSize: number;
  cells: Map<string, Array<TStar>>;
  maxHitRadius: number;
  starCount: number;
}
