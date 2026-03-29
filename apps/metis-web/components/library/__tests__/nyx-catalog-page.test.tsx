import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/shell/page-chrome", () => ({
  PageChrome: ({
    actions,
    children,
    heroAside,
    title,
  }: React.PropsWithChildren<{
    actions?: React.ReactNode;
    heroAside?: React.ReactNode;
    title: string;
  }>) => (
    <div>
      <h1>{title}</h1>
      {actions}
      {heroAside}
      {children}
    </div>
  ),
}));

vi.mock("@/lib/api", () => ({
  fetchNyxCatalog: vi.fn(),
}));

const { fetchNyxCatalog } = await import("@/lib/api");
const { NyxCatalogPage } = await import("../nyx-catalog-page");

function makeCatalogResponse(query = "") {
  return {
    query,
    total: 2,
    matched: query ? 1 : 2,
    curated_only: true,
    source: "nyx_registry",
    items: query
      ? [
          {
            component_name: "music-player",
            title: "Music Player",
            description: "A music player.",
            curated_description: "Compact music player interface.",
            component_type: "registry:ui",
            install_target: "@nyx/music-player",
            registry_url: "https://nyxui.com/r/music-player.json",
            schema_url: "https://ui.shadcn.com/schema/registry-item.json",
            source: "nyx_registry",
            source_repo: "https://github.com/MihirJaiswal/nyxui",
            required_dependencies: ["lucide-react"],
            dependencies: ["lucide-react"],
            dev_dependencies: [],
            registry_dependencies: [],
            file_count: 1,
            targets: ["components/ui/music-player.tsx"],
          },
        ]
      : [
          {
            component_name: "glow-card",
            title: "Glow Card",
            description: "A glow card.",
            curated_description: "Interactive card with glow-based accent effects.",
            component_type: "registry:ui",
            install_target: "@nyx/glow-card",
            registry_url: "https://nyxui.com/r/glow-card.json",
            schema_url: "https://ui.shadcn.com/schema/registry-item.json",
            source: "nyx_registry",
            source_repo: "https://github.com/MihirJaiswal/nyxui",
            required_dependencies: ["clsx", "tailwind-merge"],
            dependencies: ["clsx", "tailwind-merge"],
            dev_dependencies: [],
            registry_dependencies: [],
            file_count: 1,
            targets: ["components/ui/glow-card.tsx"],
          },
          {
            component_name: "music-player",
            title: "Music Player",
            description: "A music player.",
            curated_description: "Compact music player interface.",
            component_type: "registry:ui",
            install_target: "@nyx/music-player",
            registry_url: "https://nyxui.com/r/music-player.json",
            schema_url: "https://ui.shadcn.com/schema/registry-item.json",
            source: "nyx_registry",
            source_repo: "https://github.com/MihirJaiswal/nyxui",
            required_dependencies: ["lucide-react"],
            dependencies: ["lucide-react"],
            dev_dependencies: [],
            registry_dependencies: [],
            file_count: 1,
            targets: ["components/ui/music-player.tsx"],
          },
        ],
  };
}

describe("NyxCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(fetchNyxCatalog).mockImplementation(async (query) =>
      makeCatalogResponse(query),
    );
  });

  it("loads the local Nyx catalog and links cards to stable preview routes", async () => {
    render(<NyxCatalogPage />);

    expect(await screen.findByText("Glow Card")).toBeInTheDocument();
    expect(fetchNyxCatalog).toHaveBeenCalledWith("", { limit: 24 });

    const previewLinks = screen.getAllByRole("link", {
      name: /Preview component/i,
    });

    expect(previewLinks.map((link) => link.getAttribute("href"))).toContain(
      "/library/glow-card",
    );
  });

  it("filters the catalog and can seed chat from a result", async () => {
    render(<NyxCatalogPage />);

    await screen.findByText("Glow Card");
    fireEvent.change(screen.getByLabelText(/Find a component/i), {
      target: { value: "music" },
    });

    await waitFor(() => {
      expect(fetchNyxCatalog).toHaveBeenLastCalledWith("music", { limit: 24 });
    });
    expect((await screen.findAllByText("Music Player")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Use in chat/i }));

    expect(window.localStorage.getItem("metis_chat_seed_prompt")).toContain(
      "@nyx/music-player",
    );
    expect(pushMock).toHaveBeenCalledWith("/chat");
  });
});