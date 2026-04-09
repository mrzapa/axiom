import { CONSTELLATION_FACULTIES } from "@/lib/constellation-home";

export interface ConstellationFacultyArtDefinition {
  src: string;
  scale: number;
  offsetY: number;
  idleOpacity: number;
  activeOpacity: number;
  dialogScale: number;
  dialogOffsetY: number;
}

export const FACULTY_ART_MANIFEST = {
  autonomy: {
    src: "/constellation/faculties/autonomy.svg",
    scale: 0.46,
    offsetY: -0.05,
    idleOpacity: 0.18,
    activeOpacity: 0.36,
    dialogScale: 1.04,
    dialogOffsetY: -0.03,
  },
  emergence: {
    src: "/constellation/faculties/emergence.svg",
    scale: 0.44,
    offsetY: -0.03,
    idleOpacity: 0.16,
    activeOpacity: 0.34,
    dialogScale: 1.06,
    dialogOffsetY: -0.01,
  },
  knowledge: {
    src: "/constellation/faculties/knowledge.svg",
    scale: 0.43,
    offsetY: -0.05,
    idleOpacity: 0.16,
    activeOpacity: 0.32,
    dialogScale: 1.02,
    dialogOffsetY: -0.02,
  },
  memory: {
    src: "/constellation/faculties/memory.svg",
    scale: 0.42,
    offsetY: -0.02,
    idleOpacity: 0.16,
    activeOpacity: 0.32,
    dialogScale: 1.03,
    dialogOffsetY: 0.01,
  },
  perception: {
    src: "/constellation/faculties/perception.svg",
    scale: 0.46,
    offsetY: -0.08,
    idleOpacity: 0.17,
    activeOpacity: 0.34,
    dialogScale: 1.05,
    dialogOffsetY: -0.05,
  },
  personality: {
    src: "/constellation/faculties/personality.svg",
    scale: 0.43,
    offsetY: -0.02,
    idleOpacity: 0.16,
    activeOpacity: 0.32,
    dialogScale: 1.04,
    dialogOffsetY: 0,
  },
  reasoning: {
    src: "/constellation/faculties/reasoning.svg",
    scale: 0.41,
    offsetY: -0.04,
    idleOpacity: 0.15,
    activeOpacity: 0.3,
    dialogScale: 1,
    dialogOffsetY: -0.02,
  },
  skills: {
    src: "/constellation/faculties/skills.svg",
    scale: 0.42,
    offsetY: -0.04,
    idleOpacity: 0.15,
    activeOpacity: 0.31,
    dialogScale: 1.02,
    dialogOffsetY: -0.02,
  },
  strategy: {
    src: "/constellation/faculties/strategy.svg",
    scale: 0.45,
    offsetY: -0.03,
    idleOpacity: 0.17,
    activeOpacity: 0.34,
    dialogScale: 1.03,
    dialogOffsetY: -0.01,
  },
  synthesis: {
    src: "/constellation/faculties/synthesis.svg",
    scale: 0.45,
    offsetY: -0.02,
    idleOpacity: 0.17,
    activeOpacity: 0.34,
    dialogScale: 1.06,
    dialogOffsetY: -0.01,
  },
  values: {
    src: "/constellation/faculties/values.svg",
    scale: 0.42,
    offsetY: -0.04,
    idleOpacity: 0.16,
    activeOpacity: 0.31,
    dialogScale: 1.02,
    dialogOffsetY: -0.02,
  },
} as const satisfies Record<string, ConstellationFacultyArtDefinition>;

export function getFacultyArtDefinition(
  facultyId?: string | null,
): ConstellationFacultyArtDefinition | null {
  if (!facultyId) {
    return null;
  }

  return FACULTY_ART_MANIFEST[facultyId as keyof typeof FACULTY_ART_MANIFEST] ?? null;
}

export function getFacultyArtManifestEntries(): Array<
  readonly [string, ConstellationFacultyArtDefinition]
> {
  return Object.entries(FACULTY_ART_MANIFEST);
}

export function hasFacultyArtForEveryFaculty(): boolean {
  return CONSTELLATION_FACULTIES.every((faculty) => Boolean(getFacultyArtDefinition(faculty.id)));
}
