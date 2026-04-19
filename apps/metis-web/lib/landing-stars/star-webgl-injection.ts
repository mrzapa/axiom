/**
 * M02 Phase 6 follow-up — inject the focused user star into the WebGL
 * closeup-tier batch.
 *
 * Phase 6 landed annotation plumbing end-to-end on the CPU side, and the
 * WebGL shader consumes halo / ring / satellite attributes. However, the
 * WebGL starfield batch was catalogue-only — user stars never entered
 * the batch, so no sprite actually carried annotations. This helper
 * bridges the gap: given the existing catalogue-derived batch and the
 * (optional) focused user-star entry, it returns a new batch that
 * includes the focused user star at the closeup tier.
 *
 * Scope constraints:
 *  - Only the focused user star is injected. Every other user star
 *    stays CPU-rendered — the WebGL batch is not the place for them.
 *  - If a catalogue twin happens to share the same id, the twin is
 *    replaced (upgraded) in place rather than duplicated.
 *  - Catalogue stars without a twin id collision are unchanged in
 *    position, order, and tier.
 *  - Field / landmark tiers are never touched.
 */

import type { LandingStarRenderTier } from "@/lib/landing-stars/landing-star-types";
import type { StellarProfile } from "@/lib/landing-stars/types";
import type { LandingWebglStar } from "@/components/home/landing-starfield-webgl.types";

/**
 * Payload describing the focused user star at the moment the batch is
 * built. `profile` must already carry annotations (callers derive them
 * via `deriveStarAnnotations` before constructing the entry).
 */
export interface FocusedUserStarWebglEntry {
  /** User star id (also used as the batch entry id). */
  id: string;
  /** Screen-space X in pixels. */
  x: number;
  /** Screen-space Y in pixels. */
  y: number;
  /** Apparent size in pixels (matches catalogue `baseSize` semantics). */
  apparentSize: number;
  /** 0..1 brightness scalar (matches catalogue brightness semantics). */
  brightness: number;
  /**
   * Fully-built stellar profile for this star — annotations should
   * already be attached if they exist. The renderer will consume the
   * `annotations` field directly.
   */
  profile: StellarProfile;
  /**
   * Optional override — defaults to `"closeup"`, which is what the
   * follow-up needs. Exposed so tests can assert the tier explicitly.
   */
  renderTier?: LandingStarRenderTier;
}

/**
 * Return a shallow-copied batch with the focused user star injected.
 *
 * - If no focused entry is provided, the batch is returned untouched
 *   (same reference — safe to use as a frame-over-frame no-op).
 * - If the focused entry id collides with an existing batch member, the
 *   existing member is replaced with a closeup-tier entry derived from
 *   the focused payload (no duplication).
 * - Otherwise, the focused entry is appended at the end of the batch.
 *   The renderer consumes the batch linearly so append order has no
 *   visual meaning beyond draw-call order within the same tier.
 *
 * The function is pure: it never mutates its inputs.
 */
export function injectFocusedUserStarIntoWebglBatch(
  batch: readonly LandingWebglStar[],
  focusedEntry: FocusedUserStarWebglEntry | null | undefined,
): LandingWebglStar[] {
  if (!focusedEntry) {
    // Copy to a mutable array so callers never accidentally share the
    // input reference when they expected an owned array.
    return batch.slice();
  }

  const renderTier: LandingStarRenderTier = focusedEntry.renderTier ?? "closeup";
  const injected: LandingWebglStar = {
    addable: false,
    apparentSize: focusedEntry.apparentSize,
    brightness: focusedEntry.brightness,
    id: focusedEntry.id,
    profile: focusedEntry.profile,
    renderTier,
    x: focusedEntry.x,
    y: focusedEntry.y,
  };

  const twinIndex = batch.findIndex((star) => star.id === focusedEntry.id);
  if (twinIndex === -1) {
    const next = batch.slice();
    next.push(injected);
    return next;
  }

  const next = batch.slice();
  next[twinIndex] = injected;
  return next;
}
