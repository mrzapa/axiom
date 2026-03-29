export const CONSTELLATION_USER_STAR_LIMIT: number | null = null;

export type UserStarStage = "seed" | "growing" | "integrated";

export interface UserStar {
  id: string;
  x: number;
  y: number;
  size: number;
  createdAt: number;
  label?: string;
  primaryDomainId?: string;
  relatedDomainIds?: string[];
  stage?: UserStarStage;
  intent?: string;
  notes?: string;
  connectedUserStarIds?: string[];
  linkedManifestPaths?: string[];
  activeManifestPath?: string;
  linkedManifestPath?: string;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isUserStarStage(value: unknown): value is UserStarStage {
  return value === "seed" || value === "growing" || value === "integrated";
}

interface UserStarManifestFields {
  linkedManifestPaths?: unknown;
  activeManifestPath?: unknown;
  linkedManifestPath?: unknown;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const next: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0 || next.includes(trimmed)) {
      return;
    }
    next.push(trimmed);
  });
  return next;
}

function moveValueToFront(values: string[], value: string): string[] {
  const next = values.filter((entry) => entry !== value);
  next.unshift(value);
  return next;
}

function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.slice(0, 80);
}

function sortStrings(values: string[]): string[] {
  return [...values].sort();
}

function resolveManifestState(
  input: UserStarManifestFields,
  sortSecondaryPaths = false,
): {
  activeManifestPath: string | undefined;
  linkedManifestPath: string | undefined;
  linkedManifestPaths: string[];
} {
  const activeManifestPath = normalizeString(input.activeManifestPath);
  const legacyManifestPath = normalizeString(input.linkedManifestPath);
  const linkedManifestPaths = normalizeStringList(input.linkedManifestPaths);

  let normalizedLinkedManifestPaths = [...linkedManifestPaths];
  if (activeManifestPath && !normalizedLinkedManifestPaths.includes(activeManifestPath)) {
    normalizedLinkedManifestPaths.push(activeManifestPath);
  }
  if (legacyManifestPath && !normalizedLinkedManifestPaths.includes(legacyManifestPath)) {
    normalizedLinkedManifestPaths.push(legacyManifestPath);
  }

  const resolvedActiveManifestPath =
    activeManifestPath ?? legacyManifestPath ?? normalizedLinkedManifestPaths[0];
  const resolvedLinkedManifestPath = resolvedActiveManifestPath ?? normalizedLinkedManifestPaths[0];

  if (sortSecondaryPaths) {
    if (resolvedLinkedManifestPath) {
      normalizedLinkedManifestPaths = [
        resolvedLinkedManifestPath,
        ...sortStrings(
          normalizedLinkedManifestPaths.filter((entry) => entry !== resolvedLinkedManifestPath),
        ),
      ];
    } else {
      normalizedLinkedManifestPaths = sortStrings(normalizedLinkedManifestPaths);
    }
  } else if (legacyManifestPath) {
    normalizedLinkedManifestPaths = moveValueToFront(normalizedLinkedManifestPaths, legacyManifestPath);
  } else if (activeManifestPath) {
    normalizedLinkedManifestPaths = moveValueToFront(normalizedLinkedManifestPaths, activeManifestPath);
  }

  return {
    activeManifestPath: resolvedActiveManifestPath,
    linkedManifestPath: resolvedLinkedManifestPath,
    linkedManifestPaths: normalizedLinkedManifestPaths,
  };
}

function resolveStarStage(
  inputStage: unknown,
  linkedManifestPaths: string[],
  notes: string | undefined,
): UserStarStage {
  if (isUserStarStage(inputStage)) {
    return inputStage;
  }
  if (linkedManifestPaths.length >= 2) {
    return "integrated";
  }
  if (linkedManifestPaths.length === 1 || notes) {
    return "growing";
  }
  return "seed";
}

export function normalizeUserStar(input: Partial<UserStar> & { id: string }): UserStar {
  const label = normalizeLabel(input.label);
  const primaryDomainId = normalizeString(input.primaryDomainId);
  const intent = normalizeString(input.intent);
  const notes = normalizeString(input.notes);
  const connectedUserStarIds = normalizeStringList(input.connectedUserStarIds).filter(
    (linkedStarId) => linkedStarId !== input.id,
  );
  const manifestState = resolveManifestState(input);
  const relatedDomainIds = normalizeStringList(input.relatedDomainIds).filter(
    (domainId) => domainId !== primaryDomainId,
  );

  return {
    id: input.id,
    x: clamp(Number(input.x ?? 0.5), 0, 1),
    y: clamp(Number(input.y ?? 0.5), 0, 1),
    size: clamp(Number(input.size ?? 1), 0.5, 2.2),
    createdAt: Number(input.createdAt ?? Date.now()),
    label,
    primaryDomainId,
    relatedDomainIds: relatedDomainIds.length > 0 ? relatedDomainIds : undefined,
    stage: resolveStarStage(input.stage, manifestState.linkedManifestPaths, notes),
    intent,
    notes,
    connectedUserStarIds: connectedUserStarIds.length > 0 ? connectedUserStarIds : undefined,
    linkedManifestPaths: manifestState.linkedManifestPaths.length > 0 ? manifestState.linkedManifestPaths : undefined,
    activeManifestPath: manifestState.activeManifestPath,
    linkedManifestPath: manifestState.linkedManifestPath,
  };
}

export function isUserStar(value: unknown): value is UserStar {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.size === "number" &&
    typeof candidate.createdAt === "number" &&
    (candidate.label === undefined || typeof candidate.label === "string") &&
    (candidate.primaryDomainId === undefined || typeof candidate.primaryDomainId === "string") &&
    (candidate.relatedDomainIds === undefined || Array.isArray(candidate.relatedDomainIds)) &&
    (candidate.stage === undefined || typeof candidate.stage === "string") &&
    (candidate.intent === undefined || typeof candidate.intent === "string") &&
    (candidate.notes === undefined || typeof candidate.notes === "string") &&
    (candidate.connectedUserStarIds === undefined || Array.isArray(candidate.connectedUserStarIds)) &&
    (candidate.linkedManifestPaths === undefined || Array.isArray(candidate.linkedManifestPaths)) &&
    (candidate.activeManifestPath === undefined || typeof candidate.activeManifestPath === "string") &&
    (candidate.linkedManifestPath === undefined || typeof candidate.linkedManifestPath === "string")
  );
}

type ParsableUserStar = Partial<UserStar> & { id?: string };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getExplicitUserStarId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function buildFallbackStarFingerprint(input: ParsableUserStar): string {
  const label = normalizeLabel(input.label);
  const primaryDomainId = normalizeString(input.primaryDomainId);
  const relatedDomainIds = sortStrings(
    normalizeStringList(input.relatedDomainIds).filter((domainId) => domainId !== primaryDomainId),
  );
  const intent = normalizeString(input.intent);
  const notes = normalizeString(input.notes);
  const connectedUserStarIds = sortStrings(normalizeStringList(input.connectedUserStarIds));
  const manifestState = resolveManifestState(input, true);
  const size = clamp(isFiniteNumber(input.size) ? input.size : 1, 0.5, 2.2);
  const stage = resolveStarStage(input.stage, manifestState.linkedManifestPaths, notes);
  const x = clamp(isFiniteNumber(input.x) ? input.x : 0.5, 0, 1);
  const y = clamp(isFiniteNumber(input.y) ? input.y : 0.5, 0, 1);

  return JSON.stringify({
    activeManifestPath: manifestState.activeManifestPath,
    connectedUserStarIds: connectedUserStarIds.length > 0 ? connectedUserStarIds : undefined,
    intent,
    label,
    linkedManifestPath: manifestState.linkedManifestPath,
    linkedManifestPaths: manifestState.linkedManifestPaths.length > 0 ? manifestState.linkedManifestPaths : undefined,
    notes,
    primaryDomainId,
    relatedDomainIds: relatedDomainIds.length > 0 ? relatedDomainIds : undefined,
    size,
    stage,
    x,
    y,
  });
}

function buildGeneratedStarBaseId(candidate: ParsableUserStar): string {
  return `default-star-${hashString(buildFallbackStarFingerprint(candidate))}`;
}

function hashString(value: string): string {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function hasParsableStarIdentity(candidate: ParsableUserStar): boolean {
  if (getExplicitUserStarId(candidate.id) !== undefined) {
    return true;
  }

  return (
    normalizeString(candidate.label) !== undefined
    || normalizeString(candidate.primaryDomainId) !== undefined
    || normalizeString(candidate.intent) !== undefined
    || normalizeString(candidate.notes) !== undefined
    || normalizeString(candidate.activeManifestPath) !== undefined
    || normalizeString(candidate.linkedManifestPath) !== undefined
    || normalizeStringList(candidate.relatedDomainIds).length > 0
    || normalizeStringList(candidate.linkedManifestPaths).length > 0
    || normalizeStringList(candidate.connectedUserStarIds).length > 0
  );
}

function resolveParsedUserStarId(candidate: ParsableUserStar, duplicateCount: number): string {
  const existingId = getExplicitUserStarId(candidate.id);
  if (existingId !== undefined) {
    return existingId;
  }

  const baseId = buildGeneratedStarBaseId(candidate);
  if (duplicateCount === 0) {
    return baseId;
  }
  return `${baseId}-${duplicateCount + 1}`;
}

function resolveParsedUserStarCreatedAt(candidate: ParsableUserStar, resolvedId: string): number {
  if (isFiniteNumber(candidate.createdAt)) {
    return candidate.createdAt;
  }
  return parseInt(hashString(`created-at:${resolvedId}`), 36);
}

function isParsableUserStar(value: unknown): value is ParsableUserStar {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.id === undefined || typeof candidate.id === "string") &&
    (candidate.x === undefined || isFiniteNumber(candidate.x)) &&
    (candidate.y === undefined || isFiniteNumber(candidate.y)) &&
    (candidate.size === undefined || isFiniteNumber(candidate.size)) &&
    (candidate.createdAt === undefined || isFiniteNumber(candidate.createdAt)) &&
    (candidate.label === undefined || typeof candidate.label === "string") &&
    (candidate.primaryDomainId === undefined || typeof candidate.primaryDomainId === "string") &&
    (candidate.relatedDomainIds === undefined || Array.isArray(candidate.relatedDomainIds)) &&
    (candidate.stage === undefined || typeof candidate.stage === "string") &&
    (candidate.intent === undefined || typeof candidate.intent === "string") &&
    (candidate.notes === undefined || typeof candidate.notes === "string") &&
    (candidate.connectedUserStarIds === undefined || Array.isArray(candidate.connectedUserStarIds)) &&
    (candidate.linkedManifestPaths === undefined || Array.isArray(candidate.linkedManifestPaths)) &&
    (candidate.activeManifestPath === undefined || typeof candidate.activeManifestPath === "string") &&
    (candidate.linkedManifestPath === undefined || typeof candidate.linkedManifestPath === "string") &&
    hasParsableStarIdentity(candidate)
  );
}

export function parseUserStars(value: unknown): UserStar[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const generatedIdCounts = new Map<string, number>();

  return value.flatMap((entry) => {
    if (!isParsableUserStar(entry)) {
      return [];
    }

    const existingId = getExplicitUserStarId(entry.id);
    const fingerprint = existingId ?? buildGeneratedStarBaseId(entry);
    const duplicateCount = existingId === undefined ? (generatedIdCounts.get(fingerprint) ?? 0) : 0;

    if (existingId === undefined) {
      generatedIdCounts.set(fingerprint, duplicateCount + 1);
    }

    const resolvedId = resolveParsedUserStarId(entry, duplicateCount);

    return [
      normalizeUserStar({
        ...entry,
        id: resolvedId,
        createdAt: resolveParsedUserStarCreatedAt(entry, resolvedId),
      }),
    ];
  });
}

export function capUserStars(stars: UserStar[]): UserStar[] {
  if (CONSTELLATION_USER_STAR_LIMIT === null) {
    return stars;
  }
  return stars.slice(0, CONSTELLATION_USER_STAR_LIMIT);
}

export function getRemainingUserStarSlots(currentCount: number): number | null {
  if (CONSTELLATION_USER_STAR_LIMIT === null) {
    return null;
  }
  return Math.max(0, CONSTELLATION_USER_STAR_LIMIT - currentCount);
}
