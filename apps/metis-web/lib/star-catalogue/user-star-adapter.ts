/**
 * M12 Phase 4b — adapter that projects a legacy `UserStar` (the storage
 * shape) into a `CatalogueUserStar` (the unified read shape).
 *
 * Storage stays `UserStar` per ADR 0012; this adapter is what downstream
 * consumers (M14 Forge, M16 evals, future marketplace) call when they want
 * the unified shape. Pure / side-effect-free.
 */

import { constellationPointToWorldPoint } from "@/lib/constellation-home";
import { fnv1a32 } from "./rng";
import type { CatalogueUserStar } from "./types";
import type { StellarProfile } from "@/lib/landing-stars/types";
import type { UserStar } from "@/lib/constellation-types";

export interface UserStarAdapterOptions {
  /** Viewport used to project normalised constellation coords → world coords. */
  viewport: { width: number; height: number };
  /**
   * Stellar profile generator (typically the project's `generateStellarProfile`).
   * Injected rather than imported to avoid a heavy module dependency in pure
   * tests.
   */
  generateProfile: (seed: string | number) => StellarProfile;
  /**
   * Optional explicit profile (e.g. one already derived from a promoted
   * catalogue star). When set, `generateProfile` is bypassed.
   */
  profileOverride?: StellarProfile;
}

const APPARENT_MAGNITUDE_MIN = 0;
const APPARENT_MAGNITUDE_MAX = 6.5;

/** Hash → [0, 1] uniform float, deterministic. */
function hashToUnit(hash: number): number {
  return (hash >>> 0) / 0x1_0000_0000;
}

function deriveApparentMagnitude(seedHash: number): number {
  // Spread the magnitude across the visible band; biased toward dimmer end
  // so promoted user stars feel like points, not central blazars.
  const u = hashToUnit(seedHash);
  return APPARENT_MAGNITUDE_MIN + u * (APPARENT_MAGNITUDE_MAX - APPARENT_MAGNITUDE_MIN);
}

function deriveDepthLayer(seedHash: number): number {
  return hashToUnit(seedHash ^ 0x9e3779b9);
}

export function userStarToCatalogueUserStar(
  user: UserStar,
  options: UserStarAdapterOptions,
): CatalogueUserStar {
  const { viewport, generateProfile, profileOverride } = options;
  const world = constellationPointToWorldPoint(
    { x: user.x, y: user.y },
    viewport.width,
    viewport.height,
  );

  const profile = profileOverride ?? generateProfile(user.id);
  const seedHash = fnv1a32(user.id);

  return {
    id: user.id,
    wx: world.x,
    wy: world.y,
    profile,
    name: user.label ?? null,
    apparentMagnitude: deriveApparentMagnitude(seedHash),
    depthLayer: deriveDepthLayer(seedHash),
    label: user.label ?? "",
    primaryDomainId: user.primaryDomainId ?? null,
    relatedDomainIds: user.relatedDomainIds ?? [],
    stage: user.stage ?? "seed",
    notes: user.notes ?? "",
    connectedUserStarIds: user.connectedUserStarIds ?? [],
    learningRoute: user.learningRoute ?? null,
  };
}
