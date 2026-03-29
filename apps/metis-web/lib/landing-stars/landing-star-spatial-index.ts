import type {
  LandingStarHitTarget,
  LandingStarSpatialHash,
  LandingStarSpatialHashOptions,
} from "@/lib/landing-stars/landing-star-types";

const DEFAULT_CELL_SIZE = 96;
const DEFAULT_QUERY_PADDING_PX = 0;

function normalizeOptions(
  options?: LandingStarSpatialHashOptions,
): Required<LandingStarSpatialHashOptions> {
  return {
    cellSize: options?.cellSize ?? DEFAULT_CELL_SIZE,
    queryPaddingPx: options?.queryPaddingPx ?? DEFAULT_QUERY_PADDING_PX,
  };
}

function getCellKey(x: number, y: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
}

function getNeighborCellKeys(
  x: number,
  y: number,
  cellSize: number,
  radiusInCells: number,
): string[] {
  const centerX = Math.floor(x / cellSize);
  const centerY = Math.floor(y / cellSize);
  const keys: string[] = [];

  for (let offsetX = -radiusInCells; offsetX <= radiusInCells; offsetX += 1) {
    for (let offsetY = -radiusInCells; offsetY <= radiusInCells; offsetY += 1) {
      keys.push(`${centerX + offsetX}:${centerY + offsetY}`);
    }
  }

  return keys;
}

function getSearchRadiusInCells(
  maxHitRadius: number,
  cellSize: number,
  queryPaddingPx: number,
): number {
  return Math.max(0, Math.ceil((maxHitRadius + queryPaddingPx) / cellSize));
}

export function buildLandingStarSpatialHash<TStar extends LandingStarHitTarget>(
  stars: readonly TStar[],
  options?: LandingStarSpatialHashOptions,
): LandingStarSpatialHash<TStar> {
  const normalizedOptions = normalizeOptions(options);
  const cells = new Map<string, Array<TStar>>();
  let maxHitRadius = 0;

  for (const star of stars) {
    maxHitRadius = Math.max(maxHitRadius, star.hitRadius);
    const key = getCellKey(star.x, star.y, normalizedOptions.cellSize);
    const cell = cells.get(key);
    if (cell) {
      cell.push(star);
    } else {
      cells.set(key, [star]);
    }
  }

  return {
    cellSize: normalizedOptions.cellSize,
    cells,
    maxHitRadius,
    starCount: stars.length,
  };
}

export function queryLandingStarSpatialHash<TStar extends LandingStarHitTarget>(
  spatialHash: LandingStarSpatialHash<TStar>,
  x: number,
  y: number,
  options?: LandingStarSpatialHashOptions,
): Array<TStar> {
  const normalizedOptions = normalizeOptions(options);
  const radiusInCells = getSearchRadiusInCells(
    spatialHash.maxHitRadius,
    spatialHash.cellSize,
    normalizedOptions.queryPaddingPx,
  );
  const seen = new Set<string>();
  const matches: Array<TStar> = [];

  for (const key of getNeighborCellKeys(x, y, spatialHash.cellSize, radiusInCells)) {
    const cell = spatialHash.cells.get(key);
    if (!cell) {
      continue;
    }

    for (const star of cell) {
      if (seen.has(star.id)) {
        continue;
      }

      const dx = star.x - x;
      const dy = star.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance > star.hitRadius + normalizedOptions.queryPaddingPx) {
        continue;
      }

      seen.add(star.id);
      matches.push(star);
    }
  }

  matches.sort((left, right) => {
    const leftDistance = Math.hypot(left.x - x, left.y - y);
    const rightDistance = Math.hypot(right.x - x, right.y - y);

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    if (left.hitRadius !== right.hitRadius) {
      return right.hitRadius - left.hitRadius;
    }

    return left.id.localeCompare(right.id);
  });

  return matches;
}

export function findClosestLandingStarHitTarget<TStar extends LandingStarHitTarget>(
  spatialHash: LandingStarSpatialHash<TStar>,
  x: number,
  y: number,
  options?: LandingStarSpatialHashOptions,
): TStar | null {
  const matches = queryLandingStarSpatialHash(spatialHash, x, y, options);
  return matches.length > 0 ? matches[0] : null;
}

