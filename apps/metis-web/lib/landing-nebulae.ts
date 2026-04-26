/**
 * Procedurally generated nebulae for the landing-page cosmos backdrop.
 *
 * Replaces the previous three hardcoded blobs with a seeded set of
 * 6–10 nebulae per session. Each nebula gets its own slow sinusoidal
 * drift so the backdrop is never perfectly static. The seed is stable
 * per user (localStorage), so a returning user sees their own sky —
 * not a different one every visit.
 *
 * Pure module — no React, no DOM. Drives the existing `drawNebulae`
 * routine in `app/page.tsx`.
 */

import { fnv1a32, SeededRNG } from "@/lib/star-catalogue";

const SEED_STORAGE_KEY = "metis:cosmos-seed";

export interface Nebula {
  /** Base x in CSS px (no drift applied). */
  x: number;
  /** Base y in CSS px (no drift applied). */
  y: number;
  /** Major-axis radius. */
  rx: number;
  /** Minor-axis radius. */
  ry: number;
  /** Rotation in radians. */
  angle: number;
  /** RGB color tuple. */
  color: [number, number, number];
  /** Peak opacity 0..1. */
  opacity: number;
  /** Drift amplitude in CSS px (each nebula's own value, 14–34). */
  driftAmpX: number;
  driftAmpY: number;
  /** Drift frequency in cycles/sec. Values between 1/120 and 1/60 Hz. */
  driftFreqX: number;
  driftFreqY: number;
  /** Phase offsets so multiple nebulae don't pulse together. */
  driftPhaseX: number;
  driftPhaseY: number;
}

/**
 * Curated palette — colours skew cool/deep so they read as "void", not
 * children's-cartoon. Each entry is a base RGB + opacity range.
 */
const PALETTE: Array<{ rgb: [number, number, number]; opacityMin: number; opacityMax: number }> = [
  { rgb: [14, 22, 60], opacityMin: 0.18, opacityMax: 0.28 }, // deep navy
  { rgb: [20, 15, 35], opacityMin: 0.14, opacityMax: 0.22 }, // dark plum
  { rgb: [10, 18, 48], opacityMin: 0.12, opacityMax: 0.22 }, // ink-blue
  { rgb: [44, 18, 56], opacityMin: 0.12, opacityMax: 0.22 }, // dim violet
  { rgb: [10, 30, 52], opacityMin: 0.10, opacityMax: 0.20 }, // teal-deep
  { rgb: [38, 14, 30], opacityMin: 0.10, opacityMax: 0.18 }, // wine
  { rgb: [12, 30, 24], opacityMin: 0.08, opacityMax: 0.14 }, // forest-deep
];

/**
 * Get a stable per-user cosmos seed. Stored in localStorage so the
 * user's sky looks the same on every visit.
 *
 * SSR-safe: returns a deterministic fallback when localStorage is
 * unavailable so the function can be called from contexts that may
 * pre-render before hydration.
 */
export function getCosmosSeed(): number {
  if (typeof window === "undefined") return 0xC05E05;
  try {
    const stored = window.localStorage.getItem(SEED_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const fresh = fnv1a32(`metis-cosmos-${Date.now()}-${Math.random()}`);
    window.localStorage.setItem(SEED_STORAGE_KEY, String(fresh));
    return fresh;
  } catch {
    return 0xC05E05;
  }
}

/**
 * Generate a deterministic set of nebulae for the given viewport.
 * Same `(seed, W, H)` always produces the same arrangement. Count
 * scales gently with viewport area so wider screens look denser
 * without the nebulae losing breathing room.
 */
export function generateNebulae(seed: number, W: number, H: number): Nebula[] {
  const rng = new SeededRNG(seed);
  // Density: 5 nebulae for a phone-portrait viewport, up to ~10 for a
  // 16:10 desktop. Floor at 5 so every viewport has presence.
  const area = Math.max(1, (W * H) / (1280 * 800));
  const count = Math.max(5, Math.min(10, Math.round(5 + area * 3)));

  const nebulae: Nebula[] = [];
  for (let i = 0; i < count; i++) {
    // Place nebulae in the inner 10–90% of the viewport so edges stay
    // dark — bright blobs at the screen edge feel cheap.
    const cx = W * (0.1 + rng.next() * 0.8);
    const cy = H * (0.1 + rng.next() * 0.8);
    const baseRadius = Math.min(W, H) * (0.18 + rng.next() * 0.26);
    const aspect = 0.55 + rng.next() * 0.55; // mild eccentricity
    const palette = PALETTE[Math.floor(rng.next() * PALETTE.length)];
    const opacity =
      palette.opacityMin
      + rng.next() * (palette.opacityMax - palette.opacityMin);

    nebulae.push({
      x: cx,
      y: cy,
      rx: baseRadius,
      ry: baseRadius * aspect,
      angle: rng.next() * Math.PI * 2,
      color: palette.rgb,
      opacity,
      driftAmpX: 14 + rng.next() * 20,
      driftAmpY: 10 + rng.next() * 16,
      // Frequencies between 1/120 Hz (very slow) and 1/55 Hz so drifts
      // never visibly synchronise. Sign randomised so half drift the
      // other way around.
      driftFreqX: (1 / 120 + rng.next() * (1 / 55 - 1 / 120)) * (rng.next() < 0.5 ? -1 : 1),
      driftFreqY: (1 / 120 + rng.next() * (1 / 55 - 1 / 120)) * (rng.next() < 0.5 ? -1 : 1),
      driftPhaseX: rng.next() * Math.PI * 2,
      driftPhaseY: rng.next() * Math.PI * 2,
    });
  }
  return nebulae;
}

/**
 * Compute the drifted (x, y) position of a nebula at time `tSec`.
 * Drift is purely additive on top of the base position — never
 * scales the radii or rotation.
 */
export function nebulaPositionAt(
  nebula: Nebula,
  tSec: number,
): { x: number; y: number } {
  return {
    x:
      nebula.x
      + Math.sin(tSec * nebula.driftFreqX * Math.PI * 2 + nebula.driftPhaseX)
        * nebula.driftAmpX,
    y:
      nebula.y
      + Math.cos(tSec * nebula.driftFreqY * Math.PI * 2 + nebula.driftPhaseY)
        * nebula.driftAmpY,
  };
}
