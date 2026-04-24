/**
 * M12 Phase 4 — pure helpers for promoting a catalogue star into the user's
 * constellation. The page-level handler in `app/page.tsx` composes these
 * with `addUserStar` to build the full promote flow.
 *
 * Coordinate-system reminder:
 * - `CatalogueStar.wx/wy` live in galaxy world space (px, unbounded).
 * - `UserStar.x/y` live in normalised constellation-point space (~[0, 1]).
 * - The two must be bridged whenever a catalogue star becomes a user star.
 */

import {
  screenToConstellationPoint,
  worldPointToConstellationPoint,
  type BackgroundCameraState,
  type Point,
} from "@/lib/constellation-home";

export interface CatalogueToConstellationInput {
  /** World-space coordinates from the underlying CatalogueStar. */
  worldX: number;
  worldY: number;
  /**
   * Currently-projected screen position, when available. Preferred over the
   * raw world coords because it reflects parallax + camera state at the
   * exact moment of promotion. May be null/undefined if the star has been
   * panned out of view since the inspector opened.
   */
  screenX?: number | null;
  screenY?: number | null;
}

export interface CatalogueViewportState {
  width: number;
  height: number;
  camera: BackgroundCameraState;
}

export function catalogueStarToConstellationPoint(
  star: CatalogueToConstellationInput,
  viewport: CatalogueViewportState,
): Point {
  const { width, height, camera } = viewport;
  if (
    typeof star.screenX === "number"
    && typeof star.screenY === "number"
    && Number.isFinite(star.screenX)
    && Number.isFinite(star.screenY)
  ) {
    return screenToConstellationPoint(
      { x: star.screenX, y: star.screenY },
      width,
      height,
      camera,
    );
  }
  return worldPointToConstellationPoint(
    { x: star.worldX, y: star.worldY },
    width,
    height,
  );
}

export interface PromotedUserStarPayloadInput {
  point: Point;
  primaryDomainId: string;
  relatedDomainId: string | null;
  anchorStarId: string | null;
}

export interface PromotedUserStarPayload {
  x: number;
  y: number;
  size: number;
  primaryDomainId: string;
  relatedDomainIds?: string[];
  connectedUserStarIds?: string[];
  stage: "seed";
}

const SIZE_BASE = 0.82;
const SIZE_JITTER = 0.55;

export function buildPromotedUserStarPayload(
  input: PromotedUserStarPayloadInput,
  random: () => number = Math.random,
): PromotedUserStarPayload {
  const payload: PromotedUserStarPayload = {
    x: input.point.x,
    y: input.point.y,
    size: SIZE_BASE + random() * SIZE_JITTER,
    primaryDomainId: input.primaryDomainId,
    stage: "seed",
  };
  if (input.relatedDomainId) {
    payload.relatedDomainIds = [input.relatedDomainId];
  }
  if (input.anchorStarId) {
    payload.connectedUserStarIds = [input.anchorStarId];
  }
  return payload;
}
