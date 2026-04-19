import { describe, expect, it } from "vitest";
import { generateStellarProfile } from "../stellar-profile";
import {
  injectFocusedUserStarIntoWebglBatch,
  type FocusedUserStarWebglEntry,
} from "../star-webgl-injection";
import type { StellarProfile } from "../types";
import type { StarAnnotations } from "../star-annotations";
import type { LandingWebglStar } from "@/components/home/landing-starfield-webgl.types";

/**
 * M02 Phase 6 follow-up — validate that the WebGL batch injection helper
 * puts the focused user star into `landingStarfieldFrameRef.current.stars`
 * with its annotations preserved, without duplicating entries or disturbing
 * field / landmark rendering.
 */

const ANNOTATIONS: StarAnnotations = {
  halo: { strength: 0.82 },
  ring: { count: 2 },
  satellites: { count: 3, radius: 2.4 },
};

function makeProfile(seed: string, annotations?: StarAnnotations): StellarProfile {
  const profile = generateStellarProfile(seed);
  return annotations ? { ...profile, annotations } : profile;
}

function makeCatalogueStar(id: string, x: number, y: number): LandingWebglStar {
  return {
    addable: false,
    apparentSize: 2.5,
    brightness: 0.6,
    id,
    profile: makeProfile(id),
    renderTier: "sprite",
    x,
    y,
  };
}

function makeFocusedEntry(overrides: Partial<FocusedUserStarWebglEntry> = {}): FocusedUserStarWebglEntry {
  return {
    id: "user-star-abc",
    x: 500,
    y: 300,
    apparentSize: 48,
    brightness: 1,
    profile: makeProfile("user-star-abc", ANNOTATIONS),
    ...overrides,
  };
}

describe("injectFocusedUserStarIntoWebglBatch", () => {
  it("returns a copy of the batch untouched when no focused entry is provided", () => {
    const batch = [
      makeCatalogueStar("cat-1", 100, 100),
      makeCatalogueStar("cat-2", 200, 200),
    ];
    const result = injectFocusedUserStarIntoWebglBatch(batch, null);
    expect(result).toHaveLength(2);
    expect(result).not.toBe(batch); // always returns an owned array
    expect(result.map((star) => star.id)).toEqual(["cat-1", "cat-2"]);
  });

  it("appends the focused user star at the closeup tier when there is no id collision", () => {
    const batch = [
      makeCatalogueStar("cat-1", 100, 100),
      makeCatalogueStar("cat-2", 200, 200),
    ];
    const focused = makeFocusedEntry();
    const result = injectFocusedUserStarIntoWebglBatch(batch, focused);
    expect(result).toHaveLength(3);
    // Catalogue stars remain unchanged in order and content.
    expect(result[0]).toBe(batch[0]);
    expect(result[1]).toBe(batch[1]);
    const injected = result[2];
    expect(injected.id).toBe(focused.id);
    expect(injected.renderTier).toBe("closeup");
    expect(injected.x).toBe(focused.x);
    expect(injected.y).toBe(focused.y);
    expect(injected.apparentSize).toBe(focused.apparentSize);
    expect(injected.addable).toBe(false);
  });

  it("preserves the annotations attached to the focused profile", () => {
    const batch: LandingWebglStar[] = [];
    const focused = makeFocusedEntry();
    const result = injectFocusedUserStarIntoWebglBatch(batch, focused);
    expect(result).toHaveLength(1);
    const injected = result[0];
    expect(injected.profile.annotations).toBeDefined();
    expect(injected.profile.annotations?.halo?.strength).toBeCloseTo(0.82, 5);
    expect(injected.profile.annotations?.ring?.count).toBe(2);
    expect(injected.profile.annotations?.satellites?.count).toBe(3);
  });

  it("replaces (does not duplicate) an existing batch entry with the same id", () => {
    // Catalogue twin with the same id — the injection must override the
    // twin rather than render two sprites at the same location.
    const twin = makeCatalogueStar("user-star-abc", 100, 100);
    const batch = [makeCatalogueStar("cat-1", 1, 1), twin, makeCatalogueStar("cat-2", 2, 2)];
    const focused = makeFocusedEntry({ x: 500, y: 300 });
    const result = injectFocusedUserStarIntoWebglBatch(batch, focused);
    expect(result).toHaveLength(3);
    const replaced = result.find((star) => star.id === "user-star-abc");
    expect(replaced).toBeDefined();
    expect(replaced?.renderTier).toBe("closeup");
    expect(replaced?.x).toBe(500);
    expect(replaced?.y).toBe(300);
    expect(replaced?.profile.annotations?.halo?.strength).toBeCloseTo(0.82, 5);
    // Other catalogue stars untouched.
    expect(result.filter((star) => star.id === "user-star-abc")).toHaveLength(1);
    expect(result.find((star) => star.id === "cat-1")).toBe(batch[0]);
    expect(result.find((star) => star.id === "cat-2")).toBe(batch[2]);
  });

  it("does not mutate the input batch", () => {
    const batch = [makeCatalogueStar("cat-1", 100, 100)];
    const before = batch.slice();
    const focused = makeFocusedEntry();
    injectFocusedUserStarIntoWebglBatch(batch, focused);
    expect(batch).toEqual(before);
    expect(batch).toHaveLength(1);
  });

  it("emits a deterministic entry for the same focused input on successive frames", () => {
    const batch = [makeCatalogueStar("cat-1", 100, 100)];
    const focused = makeFocusedEntry();
    const frameA = injectFocusedUserStarIntoWebglBatch(batch, focused);
    const frameB = injectFocusedUserStarIntoWebglBatch(batch, focused);
    const injectedA = frameA.find((star) => star.id === focused.id);
    const injectedB = frameB.find((star) => star.id === focused.id);
    expect(injectedA).toEqual(injectedB);
  });

  it("honours a caller-supplied renderTier override", () => {
    const batch: LandingWebglStar[] = [];
    const focused = makeFocusedEntry({ renderTier: "hero" });
    const [injected] = injectFocusedUserStarIntoWebglBatch(batch, focused);
    expect(injected.renderTier).toBe("hero");
  });
});
