import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConstellationStars } from "@/hooks/use-constellation-stars";
import { fetchSettings, updateSettings } from "@/lib/api";
import { normalizeUserStar, type UserStar } from "@/lib/constellation-types";

vi.mock("@/lib/api", () => ({
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

const STORAGE_KEY = "metis_constellation_user_stars";
const SETTINGS_KEY = "landing_constellation_user_stars";

function seedLocalStars(stars: UserStar[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stars));
}

describe("useConstellationStars", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchSettings).mockResolvedValue({} as Record<string, unknown>);
    vi.mocked(updateSettings).mockResolvedValue({});
  });

  it("removeUserStarById uses current stars and prunes inbound connections", async () => {
    seedLocalStars([
      { id: "a", x: 0.1, y: 0.2, size: 1, createdAt: 1 },
      { id: "b", x: 0.2, y: 0.3, size: 1, createdAt: 2 },
    ]);

    const { result } = renderHook(() => useConstellationStars());
    const staleRemoveUserStarById = result.current.removeUserStarById;

    await act(async () => {
      const added = await result.current.addUserStars([
        {
          x: 0.3,
          y: 0.4,
          size: 1,
          label: "new-link",
          connectedUserStarIds: ["b"],
        },
      ]);
      expect(added).toBe(1);
    });

    await act(async () => {
      await staleRemoveUserStarById("b");
    });

    expect(result.current.userStars.map((star) => star.id)).not.toContain("b");
    expect(result.current.userStars).toHaveLength(2);

    const addedStar = result.current.userStars.find((star) => star.label === "new-link");
    expect(addedStar).toBeDefined();
    expect(addedStar?.connectedUserStarIds).toBeUndefined();

    expect(vi.mocked(fetchSettings)).not.toHaveBeenCalled();
    expect(vi.mocked(updateSettings)).toHaveBeenCalledWith({ [SETTINGS_KEY]: expect.any(Array) });
  });

  it("removeLastUserStar uses current stars when called from a stale callback", async () => {
    seedLocalStars([
      { id: "a", x: 0.1, y: 0.2, size: 1, createdAt: 1 },
      { id: "b", x: 0.2, y: 0.3, size: 1, createdAt: 2 },
    ]);

    const { result } = renderHook(() => useConstellationStars());
    const staleRemoveLastUserStar = result.current.removeLastUserStar;

    await act(async () => {
      const added = await result.current.addUserStars([
        {
          x: 0.4,
          y: 0.5,
          size: 1,
          label: "tail",
        },
      ]);
      expect(added).toBe(1);
    });

    await act(async () => {
      await staleRemoveLastUserStar();
    });

    expect(result.current.userStars).toHaveLength(2);
    expect(result.current.userStars.map((star) => star.id)).toEqual(["a", "b"]);
  });

  it("replaceUserStars restores an exact saved snapshot including user-star links", async () => {
    const originalSnapshot: UserStar[] = [
      {
        id: "a",
        createdAt: 1,
        x: 0.1,
        y: 0.2,
        size: 1,
        label: "Alpha",
        connectedUserStarIds: ["b"],
        linkedManifestPaths: ["/tmp/alpha.json"],
        relatedDomainIds: ["memory"],
      },
      {
        id: "b",
        createdAt: 2,
        x: 0.2,
        y: 0.3,
        size: 1.1,
        label: "Beta",
        connectedUserStarIds: ["a"],
      },
    ];
    const normalizedSnapshot = originalSnapshot.map((star) => normalizeUserStar(star));
    seedLocalStars(originalSnapshot);

    const { result } = renderHook(() => useConstellationStars());

    await act(async () => {
      await result.current.removeUserStarById("a");
    });

    expect(result.current.userStars.map((star) => star.id)).toEqual(["b"]);
    expect(result.current.userStars[0]?.connectedUserStarIds).toBeUndefined();

    await act(async () => {
      await result.current.replaceUserStars(originalSnapshot);
    });

    expect(result.current.userStars).toEqual(normalizedSnapshot);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual(normalizedSnapshot);
    expect(vi.mocked(updateSettings)).toHaveBeenLastCalledWith({ [SETTINGS_KEY]: normalizedSnapshot });
  });
});
