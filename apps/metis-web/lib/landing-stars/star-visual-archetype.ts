/**
 * Visual-archetype scaffold for ADR 0006.
 *
 * This is the *visual* template a star is rendered with, driven by the
 * type of content the star represents. It is deliberately distinct from
 * the backend `StarArchetype` (`metis_app/services/star_archetype.py`),
 * which is an indexing strategy (Scroll / Ledger / Codex / …).
 *
 * Mapping is per ADR 0006. Tunable — expect revision after Phase 3 playtest.
 */

export type StarVisualArchetype =
  | "main_sequence"
  | "pulsar"
  | "quasar"
  | "brown_dwarf"
  | "red_giant"
  | "binary"
  | "nebula"
  | "black_hole"
  | "comet"
  | "constellation"
  | "variable"
  | "wolf_rayet";

export type StarContentType =
  | "document"
  | "podcast"
  | "video"
  | "note"
  | "summary"
  | "evidence_pack"
  | "topic_cluster"
  | "archive"
  | "live_feed"
  | "learning_route"
  | "session"
  | "skill";

export const DEFAULT_VISUAL_ARCHETYPE: StarVisualArchetype = "main_sequence";

export const CONTENT_TYPE_ARCHETYPE_MAP: Record<StarContentType, StarVisualArchetype> = {
  document: "main_sequence",
  podcast: "pulsar",
  video: "quasar",
  note: "brown_dwarf",
  summary: "red_giant",
  evidence_pack: "binary",
  topic_cluster: "nebula",
  archive: "black_hole",
  live_feed: "comet",
  learning_route: "constellation",
  session: "variable",
  skill: "wolf_rayet",
};

export function selectStarVisualArchetype(
  contentType: StarContentType | null | undefined,
): StarVisualArchetype {
  if (contentType == null) {
    return DEFAULT_VISUAL_ARCHETYPE;
  }
  return CONTENT_TYPE_ARCHETYPE_MAP[contentType] ?? DEFAULT_VISUAL_ARCHETYPE;
}

/**
 * Stable integer encoding of `StarVisualArchetype` for passing the value
 * through a WebGL vertex attribute (floats only). Renderers must branch on
 * the archetype using these exact IDs — they are an ABI between the GPU
 * shader (`landing-starfield-webgl.tsx`) and the CPU attribute packer.
 *
 * `main_sequence` is 0 so an unset / default archetype naturally falls back
 * to the baseline path.
 */
export const STAR_VISUAL_ARCHETYPE_IDS: Record<StarVisualArchetype, number> = {
  main_sequence: 0,
  pulsar: 1,
  quasar: 2,
  brown_dwarf: 3,
  red_giant: 4,
  binary: 5,
  nebula: 6,
  black_hole: 7,
  comet: 8,
  constellation: 9,
  variable: 10,
  wolf_rayet: 11,
};

export function getStarVisualArchetypeId(
  archetype: StarVisualArchetype | null | undefined,
): number {
  if (archetype == null) {
    return STAR_VISUAL_ARCHETYPE_IDS[DEFAULT_VISUAL_ARCHETYPE];
  }
  return STAR_VISUAL_ARCHETYPE_IDS[archetype] ?? STAR_VISUAL_ARCHETYPE_IDS[DEFAULT_VISUAL_ARCHETYPE];
}
