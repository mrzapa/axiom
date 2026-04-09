import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONSTELLATION_FACULTIES } from "@/lib/constellation-home";
import {
  FACULTY_ART_MANIFEST,
  getFacultyArtDefinition,
  hasFacultyArtForEveryFaculty,
} from "@/lib/constellation-faculty-art";

describe("constellation faculty art manifest", () => {
  it("covers every faculty in the landing constellation", () => {
    expect(hasFacultyArtForEveryFaculty()).toBe(true);
    expect(Object.keys(FACULTY_ART_MANIFEST).sort()).toEqual(
      CONSTELLATION_FACULTIES.map((faculty) => faculty.id).sort(),
    );
  });

  it("keeps opacity and placement values inside the intended range", () => {
    CONSTELLATION_FACULTIES.forEach((faculty) => {
      const art = getFacultyArtDefinition(faculty.id);

      expect(art).not.toBeNull();
      expect(art?.src.startsWith("/constellation/faculties/")).toBe(true);
      expect(
        existsSync(path.join(process.cwd(), "public", art?.src.replace(/^\//, "") ?? "")),
      ).toBe(true);
      expect(art?.scale).toBeGreaterThan(0.35);
      expect(art?.scale).toBeLessThanOrEqual(0.5);
      expect(art?.idleOpacity).toBeGreaterThanOrEqual(0.15);
      expect(art?.idleOpacity).toBeLessThanOrEqual(0.18);
      expect(art?.activeOpacity).toBeGreaterThan(art?.idleOpacity ?? 0);
      expect(art?.activeOpacity).toBeLessThanOrEqual(0.36);
    });
  });
});
