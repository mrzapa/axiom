import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <header {...props}>{children}</header>,
  },
}));

vi.mock("@/components/shell/metis-companion-dock", () => ({
  MetisCompanionDock: () => <div data-testid="companion-dock" />,
}));

vi.mock("@/lib/webgpu-companion/webgpu-companion-context", () => ({
  WebGPUCompanionProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const { PageChrome } = await import("./page-chrome");

describe("PageChrome", () => {
  it("keeps diagnostics out of the primary navigation", () => {
    render(
      <PageChrome title="Workspace" description="Description" withWebGPUProvider={false}>
        <div>content</div>
      </PageChrome>,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.queryByText("Diagnostics")).not.toBeInTheDocument();
  });
});
