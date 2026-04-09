import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getApiBase: vi.fn(),
}));

vi.mock("@/components/shell/launch-stage", () => ({
  LaunchStage: ({
    actions,
    aside,
    description,
    title,
  }: {
    actions?: React.ReactNode;
    aside?: React.ReactNode;
    description: string;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
      {aside}
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/animated-lucide-icon", () => ({
  AnimatedLucideIcon: () => <span data-testid="animated-icon" />,
}));

const { getApiBase } = await import("@/lib/api");
const { DesktopReadyGuard } = await import("./desktop-ready");

describe("DesktopReadyGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiBase).mockRejectedValue(new Error("server unreachable"));
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("keeps diagnostics out of the visible launch recovery UI", async () => {
    render(
      <DesktopReadyGuard>
        <div>ready</div>
      </DesktopReadyGuard>,
    );

    expect(await screen.findByText("The local API did not come up cleanly.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open diagnostics/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/diagnostics/i)).not.toBeInTheDocument();
  });
});
