import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateNebulae,
  getCosmosSeed,
  nebulaPositionAt,
} from "../landing-nebulae";

describe("generateNebulae", () => {
  it("produces a deterministic arrangement for the same seed + viewport", () => {
    const a = generateNebulae(42, 1280, 800);
    const b = generateNebulae(42, 1280, 800);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toEqual(b[i]);
    }
  });

  it("scales count with viewport area, capped at 10", () => {
    const small = generateNebulae(7, 380, 720);
    const desk = generateNebulae(7, 1440, 900);
    const wide = generateNebulae(7, 3840, 2160);
    expect(small.length).toBeGreaterThanOrEqual(5);
    expect(desk.length).toBeGreaterThanOrEqual(small.length);
    expect(wide.length).toBeLessThanOrEqual(10);
  });

  it("places each nebula inside the inner 80% of the viewport", () => {
    const W = 1200;
    const H = 800;
    const nebulae = generateNebulae(123, W, H);
    for (const n of nebulae) {
      expect(n.x).toBeGreaterThanOrEqual(W * 0.1);
      expect(n.x).toBeLessThanOrEqual(W * 0.9);
      expect(n.y).toBeGreaterThanOrEqual(H * 0.1);
      expect(n.y).toBeLessThanOrEqual(H * 0.9);
    }
  });

  it("gives every nebula non-zero drift parameters", () => {
    const nebulae = generateNebulae(99, 1024, 768);
    for (const n of nebulae) {
      expect(n.driftAmpX).toBeGreaterThan(0);
      expect(n.driftAmpY).toBeGreaterThan(0);
      expect(Math.abs(n.driftFreqX)).toBeGreaterThan(0);
      expect(Math.abs(n.driftFreqY)).toBeGreaterThan(0);
    }
  });
});

describe("nebulaPositionAt", () => {
  it("returns base position when drift sin/cos hits the trough", () => {
    const nebula = {
      x: 100,
      y: 200,
      rx: 50,
      ry: 30,
      angle: 0,
      color: [10, 10, 10] as [number, number, number],
      opacity: 0.2,
      driftAmpX: 20,
      driftAmpY: 15,
      driftFreqX: 1,
      driftFreqY: 1,
      driftPhaseX: 0,
      driftPhaseY: Math.PI / 2,
    };
    // sin(0) = 0 → x stays at base; cos(π/2) = 0 → y stays at base.
    const p = nebulaPositionAt(nebula, 0);
    expect(p.x).toBeCloseTo(100, 5);
    expect(p.y).toBeCloseTo(200, 5);
  });

  it("displaces inside the configured amplitude envelope over time", () => {
    const nebula = {
      x: 0,
      y: 0,
      rx: 50,
      ry: 30,
      angle: 0,
      color: [10, 10, 10] as [number, number, number],
      opacity: 0.2,
      driftAmpX: 30,
      driftAmpY: 20,
      driftFreqX: 0.05,
      driftFreqY: 0.03,
      driftPhaseX: 0,
      driftPhaseY: 0,
    };
    for (let t = 0; t < 600; t += 13) {
      const p = nebulaPositionAt(nebula, t);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(30 + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(20 + 1e-9);
    }
  });
});

describe("getCosmosSeed", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns a stable value across calls within the same session", () => {
    const a = getCosmosSeed();
    const b = getCosmosSeed();
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it("persists the seed in localStorage", () => {
    const seed = getCosmosSeed();
    expect(window.localStorage.getItem("metis:cosmos-seed")).toBe(String(seed));
  });

  it("reuses an existing stored seed without overwriting it", () => {
    window.localStorage.setItem("metis:cosmos-seed", "12345");
    expect(getCosmosSeed()).toBe(12345);
  });
});
