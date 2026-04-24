/**
 * M12 Phase 2 — Catalogue search helper.
 *
 * Pure, testable substring search over a caller-supplied index of searchable
 * stars. Used by the `CatalogueSearchOverlay` HUD to find landmark stars
 * (and, later, user stars) by name. Kept provider-agnostic so Phase 4 can
 * extend the index without touching the helper.
 *
 * Scoring: exact match (0) > prefix match (1) > substring match (2),
 * ties broken by shorter name length.
 */

export type CatalogueSearchKind = "landmark" | "user" | "catalogue";

export interface CatalogueSearchEntry {
  /** Stable id for the entry (used as React key and selection payload). */
  id: string;
  /** Display name searched over. Empty strings never match. */
  name: string;
  kind: CatalogueSearchKind;
  /** Normalised constellation-space coordinates (0–1). */
  x: number;
  y: number;
  /** Faculty id when `kind === "landmark"` — lets consumers pan to it. */
  facultyId?: string;
  /** Classical-label shape-star index inside the faculty. */
  starIndex?: number;
  /** Optional spectral class chip (e.g. "A0 V"). */
  spectralClass?: string;
  /** Optional magnitude chip. */
  magnitude?: number;
}

const MATCH_EXACT = 0;
const MATCH_PREFIX = 1;
const MATCH_SUBSTRING = 2;

function scoreMatch(haystack: string, needle: string): number | null {
  if (!haystack) return null;
  const h = haystack.toLowerCase();
  if (h === needle) return MATCH_EXACT;
  if (h.startsWith(needle)) return MATCH_PREFIX;
  if (h.includes(needle)) return MATCH_SUBSTRING;
  return null;
}

export function searchCatalogueIndex(
  rawQuery: string,
  entries: readonly CatalogueSearchEntry[],
  limit = 8,
): CatalogueSearchEntry[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length === 0) return [];

  const scored: Array<{ entry: CatalogueSearchEntry; score: number }> = [];
  for (const entry of entries) {
    const score = scoreMatch(entry.name, query);
    if (score === null) continue;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.entry.name.length - b.entry.name.length;
  });

  return scored.slice(0, limit).map(({ entry }) => entry);
}
