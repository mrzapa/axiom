import { describe, expect, it } from "vitest";

import {
  catalogueStarToConstellationPoint,
  buildPromotedUserStarPayload,
} from "../catalogue-promote";

describe("catalogueStarToConstellationPoint", () => {
  it("uses screen-space conversion when a screen position is provided", () => {
    // At zoom 1, viewport center → constellation point (0.5, 0.5).
    const point = catalogueStarToConstellationPoint(
      {
        worldX: 0,
        worldY: 0,
        screenX: 500,
        screenY: 400,
      },
      {
        width: 1000,
        height: 800,
        camera: { x: 0, y: 0, zoomFactor: 1 },
      },
    );
    expect(point.x).toBeCloseTo(0.5, 5);
    expect(point.y).toBeCloseTo(0.5, 5);
  });

  it("falls back to world-coord conversion when screen position is undefined", () => {
    // World point (W/2, H/2) → constellation (1.0, 1.0) per
    // worldPointToConstellationPoint definition.
    const point = catalogueStarToConstellationPoint(
      {
        worldX: 500,
        worldY: 400,
        screenX: undefined,
        screenY: undefined,
      },
      {
        width: 1000,
        height: 800,
        camera: { x: 0, y: 0, zoomFactor: 1 },
      },
    );
    expect(point.x).toBeCloseTo(1.0, 5);
    expect(point.y).toBeCloseTo(1.0, 5);
  });

  it("falls back to world-coord conversion for null screen position", () => {
    const point = catalogueStarToConstellationPoint(
      {
        worldX: 0,
        worldY: 0,
        screenX: null,
        screenY: null,
      },
      {
        width: 1000,
        height: 800,
        camera: { x: 0, y: 0, zoomFactor: 1 },
      },
    );
    expect(point.x).toBeCloseTo(0.5, 5);
    expect(point.y).toBeCloseTo(0.5, 5);
  });

  it("returns finite numbers for all inputs", () => {
    const point = catalogueStarToConstellationPoint(
      {
        worldX: 12345,
        worldY: -67890,
        screenX: undefined,
        screenY: undefined,
      },
      {
        width: 1920,
        height: 1080,
        camera: { x: 100, y: 50, zoomFactor: 0.25 },
      },
    );
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});

describe("buildPromotedUserStarPayload", () => {
  const baseInput = {
    point: { x: 0.5, y: 0.5 },
    primaryDomainId: "perception",
    relatedDomainId: "knowledge" as string | null,
    anchorStarId: null as string | null,
  };

  it("emits a payload addUserStar can consume", () => {
    const payload = buildPromotedUserStarPayload(baseInput, () => 0.5);
    expect(payload.x).toBe(0.5);
    expect(payload.y).toBe(0.5);
    expect(payload.primaryDomainId).toBe("perception");
    expect(payload.stage).toBe("seed");
    expect(payload.relatedDomainIds).toEqual(["knowledge"]);
  });

  it("uses provided random for size jitter so the payload stays deterministic in tests", () => {
    // size = 0.82 + jitter * 0.55
    const payload = buildPromotedUserStarPayload(baseInput, () => 0);
    expect(payload.size).toBeCloseTo(0.82, 5);
    const payload2 = buildPromotedUserStarPayload(baseInput, () => 1);
    expect(payload2.size).toBeCloseTo(0.82 + 0.55, 5);
  });

  it("omits relatedDomainIds when there is no bridge suggestion", () => {
    const payload = buildPromotedUserStarPayload(
      { ...baseInput, relatedDomainId: null },
      () => 0.5,
    );
    expect(payload.relatedDomainIds).toBeUndefined();
  });

  it("includes connectedUserStarIds when an anchor is provided", () => {
    const payload = buildPromotedUserStarPayload(
      { ...baseInput, anchorStarId: "user-star-1" },
      () => 0.5,
    );
    expect(payload.connectedUserStarIds).toEqual(["user-star-1"]);
  });

  it("omits connectedUserStarIds when no anchor (first-star-anywhere case)", () => {
    const payload = buildPromotedUserStarPayload(
      { ...baseInput, anchorStarId: null },
      () => 0.5,
    );
    expect(payload.connectedUserStarIds).toBeUndefined();
  });
});
