import { describe, expect, it } from "vitest";
import {
  buildLandingStarSpatialHash,
  findClosestLandingStarHitTarget,
  queryLandingStarSpatialHash,
} from "@/lib/landing-stars/landing-star-spatial-index";
import type { LandingStarHitTarget } from "@/lib/landing-stars/landing-star-types";

function makeTarget(overrides: Partial<LandingStarHitTarget> = {}): LandingStarHitTarget {
  return {
    id: "star-a",
    x: 32,
    y: 32,
    apparentSize: 2,
    brightness: 0.5,
    hitRadius: 18,
    ...overrides,
  };
}

describe("landing star spatial hash", () => {
  it("indexes stars into screen-space cells", () => {
    const hash = buildLandingStarSpatialHash([
      makeTarget({ id: "star-a", x: 12, y: 14 }),
      makeTarget({ id: "star-b", x: 140, y: 18 }),
      makeTarget({ id: "star-c", x: 151, y: 22 }),
    ]);

    expect(hash.starCount).toBe(3);
    expect(hash.cells.size).toBeGreaterThan(1);
  });

  it("returns only nearby stars for a hover query", () => {
    const hash = buildLandingStarSpatialHash(
      [
        makeTarget({ id: "star-a", x: 40, y: 40, hitRadius: 20 }),
        makeTarget({ id: "star-b", x: 180, y: 40, hitRadius: 20 }),
        makeTarget({ id: "star-c", x: 44, y: 44, hitRadius: 20 }),
      ],
      { cellSize: 64 },
    );

    const matches = queryLandingStarSpatialHash(hash, 42, 41);

    expect(matches.map((star) => star.id)).toEqual(["star-a", "star-c"]);
  });

  it("finds the closest hit target across neighboring cells", () => {
    const hash = buildLandingStarSpatialHash(
      [
        makeTarget({ id: "star-a", x: 62, y: 62, hitRadius: 18 }),
        makeTarget({ id: "star-b", x: 75, y: 64, hitRadius: 18 }),
      ],
      { cellSize: 32 },
    );

    expect(findClosestLandingStarHitTarget(hash, 68, 63)?.id).toBe("star-a");
  });

  it("respects query padding when looking up hover targets", () => {
    const hash = buildLandingStarSpatialHash([
      makeTarget({ id: "star-a", x: 100, y: 100, hitRadius: 8 }),
    ]);

    expect(queryLandingStarSpatialHash(hash, 109, 100)).toHaveLength(0);
    expect(queryLandingStarSpatialHash(hash, 109, 100, { queryPaddingPx: 2 })).toHaveLength(1);
  });
});
