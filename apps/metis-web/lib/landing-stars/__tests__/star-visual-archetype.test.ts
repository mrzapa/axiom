import { describe, expect, it } from "vitest";
import {
  CONTENT_TYPE_ARCHETYPE_MAP,
  DEFAULT_VISUAL_ARCHETYPE,
  STAR_VISUAL_ARCHETYPE_IDS,
  getStarVisualArchetypeId,
  selectStarVisualArchetype,
  type StarContentType,
  type StarVisualArchetype,
} from "../star-visual-archetype";

describe("selectStarVisualArchetype", () => {
  it("returns main_sequence when content type is null or undefined", () => {
    expect(selectStarVisualArchetype(null)).toBe(DEFAULT_VISUAL_ARCHETYPE);
    expect(selectStarVisualArchetype(undefined)).toBe(DEFAULT_VISUAL_ARCHETYPE);
    expect(DEFAULT_VISUAL_ARCHETYPE).toBe("main_sequence");
  });

  it("maps each canonical content type to the ADR 0006 archetype", () => {
    const cases: Array<[StarContentType, StarVisualArchetype]> = [
      ["document", "main_sequence"],
      ["podcast", "pulsar"],
      ["video", "quasar"],
      ["note", "brown_dwarf"],
      ["summary", "red_giant"],
      ["evidence_pack", "binary"],
      ["topic_cluster", "nebula"],
      ["archive", "black_hole"],
      ["live_feed", "comet"],
      ["learning_route", "constellation"],
      ["session", "variable"],
      ["skill", "wolf_rayet"],
    ];

    for (const [contentType, expected] of cases) {
      expect(selectStarVisualArchetype(contentType)).toBe(expected);
    }
  });

  it("exposes every content type in the content-type map", () => {
    const contentTypes: StarContentType[] = [
      "document",
      "podcast",
      "video",
      "note",
      "summary",
      "evidence_pack",
      "topic_cluster",
      "archive",
      "live_feed",
      "learning_route",
      "session",
      "skill",
    ];

    for (const contentType of contentTypes) {
      expect(CONTENT_TYPE_ARCHETYPE_MAP[contentType]).toBeDefined();
    }
  });
});

describe("getStarVisualArchetypeId", () => {
  it("assigns main_sequence the id 0 so defaults fall back to baseline", () => {
    expect(STAR_VISUAL_ARCHETYPE_IDS.main_sequence).toBe(0);
    expect(getStarVisualArchetypeId(null)).toBe(0);
    expect(getStarVisualArchetypeId(undefined)).toBe(0);
  });

  it("assigns a unique integer to every archetype", () => {
    const archetypes: StarVisualArchetype[] = [
      "main_sequence",
      "pulsar",
      "quasar",
      "brown_dwarf",
      "red_giant",
      "binary",
      "nebula",
      "black_hole",
      "comet",
      "constellation",
      "variable",
      "wolf_rayet",
    ];
    const ids = archetypes.map(getStarVisualArchetypeId);
    expect(new Set(ids).size).toBe(archetypes.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(0);
    }
  });

  it("round-trips via the map", () => {
    const archetypes = Object.keys(STAR_VISUAL_ARCHETYPE_IDS) as StarVisualArchetype[];
    for (const archetype of archetypes) {
      expect(getStarVisualArchetypeId(archetype)).toBe(STAR_VISUAL_ARCHETYPE_IDS[archetype]);
    }
  });
});
