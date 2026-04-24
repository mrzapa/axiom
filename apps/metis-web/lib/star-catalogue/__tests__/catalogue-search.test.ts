import { describe, expect, it } from "vitest";

import { searchCatalogueIndex } from "../catalogue-search";
import type { CatalogueSearchEntry } from "../catalogue-search";

function entry(
  id: string,
  name: string,
  overrides: Partial<CatalogueSearchEntry> = {},
): CatalogueSearchEntry {
  return {
    id,
    name,
    kind: "landmark",
    x: 0.5,
    y: 0.5,
    ...overrides,
  };
}

describe("searchCatalogueIndex", () => {
  it("returns [] for an empty query", () => {
    const index = [entry("a", "Vega"), entry("b", "Altair")];
    expect(searchCatalogueIndex("", index)).toEqual([]);
    expect(searchCatalogueIndex("   ", index)).toEqual([]);
  });

  it("returns [] when no entries match the query", () => {
    const index = [entry("a", "Vega"), entry("b", "Altair")];
    expect(searchCatalogueIndex("xyz", index)).toEqual([]);
  });

  it("is case-insensitive", () => {
    const index = [entry("a", "Vega"), entry("b", "Altair")];
    const result = searchCatalogueIndex("VEG", index);
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("matches substrings, not just prefixes", () => {
    const index = [entry("a", "Alpha Centauri"), entry("b", "Beta Tauri")];
    const result = searchCatalogueIndex("tauri", index);
    expect(result.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("ranks exact-match above prefix above substring", () => {
    const index = [
      entry("sub", "Baldur"),
      entry("pref", "Aldebaran"),
      entry("exact", "Ald"),
    ];
    const result = searchCatalogueIndex("ald", index);
    expect(result.map((r) => r.id)).toEqual(["exact", "pref", "sub"]);
  });

  it("breaks rank ties by shorter name length", () => {
    const index = [
      entry("a", "Antares"),
      entry("b", "Anet"),
    ];
    const result = searchCatalogueIndex("an", index);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("caps results at limit (default 8)", () => {
    const index = Array.from({ length: 20 }, (_, i) => entry(`id-${i}`, `Star-${i}`));
    const result = searchCatalogueIndex("star", index);
    expect(result.length).toBe(8);
  });

  it("respects a custom limit", () => {
    const index = Array.from({ length: 20 }, (_, i) => entry(`id-${i}`, `Star-${i}`));
    const result = searchCatalogueIndex("star", index, 3);
    expect(result.length).toBe(3);
  });

  it("trims whitespace from the query", () => {
    const index = [entry("a", "Vega")];
    expect(searchCatalogueIndex("  veg  ", index).map((r) => r.id)).toEqual(["a"]);
  });

  it("tolerates entries with empty name (no match)", () => {
    const index = [entry("a", ""), entry("b", "Vega")];
    const result = searchCatalogueIndex("v", index);
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("preserves the original entry's metadata in the result", () => {
    const index = [
      entry("a", "Vega", {
        kind: "landmark",
        facultyId: "perception",
        spectralClass: "A0",
      }),
    ];
    const result = searchCatalogueIndex("vega", index);
    expect(result[0].facultyId).toBe("perception");
    expect(result[0].spectralClass).toBe("A0");
    expect(result[0].kind).toBe("landmark");
  });
});
