import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { SeedlingPulseWidget } from "../seedling-pulse-widget";
import type { SeedlingStatus } from "@/lib/api";

// Stub subscribeCompanionActivity so the comet-streak useEffect doesn't try
// to register against the real (browser-only) listener registry.  The widget
// returns the unsubscribe fn it gets back, so a no-op is sufficient here.
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    subscribeCompanionActivity: vi.fn(() => () => {}),
  };
});

function buildStatus(
  overrides: Partial<SeedlingStatus> = {},
): SeedlingStatus {
  return {
    running: true,
    last_tick_at: "2026-04-25T10:36:36.826849+00:00",
    next_action_at: "2026-04-25T10:37:36.826849+00:00",
    current_stage: "seedling",
    queue_depth: 0,
    ...overrides,
  };
}

describe("SeedlingPulseWidget", () => {
  it("renders without crashing when status is null (loading state)", () => {
    render(<SeedlingPulseWidget status={null} />);
    const widget = screen.getByTestId("seedling-pulse-widget");
    expect(widget).toBeInTheDocument();
    // Defaults to seedling stage when status is unknown so the placeholder
    // is visually meaningful instead of empty.
    expect(widget).toHaveAttribute("data-stage", "seedling");
    expect(widget).toHaveAttribute("data-running", "false");
    expect(widget.getAttribute("title")).toContain("loading");
  });

  it("renders distinct widget data-stage for each lifecycle stage", () => {
    const stages: SeedlingStatus["current_stage"][] = [
      "seedling",
      "sapling",
      "bloom",
      "elder",
    ];
    for (const stage of stages) {
      const { unmount } = render(
        <SeedlingPulseWidget
          status={buildStatus({ current_stage: stage })}
        />,
      );
      const widget = screen.getByTestId("seedling-pulse-widget");
      expect(widget).toHaveAttribute("data-stage", stage);
      unmount();
    }
  });

  it("invokes onActivate when the widget is clicked", () => {
    const onActivate = vi.fn();
    render(
      <SeedlingPulseWidget
        status={buildStatus()}
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByTestId("seedling-pulse-widget"));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("updates the tooltip text when status changes", () => {
    const { rerender } = render(
      <SeedlingPulseWidget
        status={buildStatus({ queue_depth: 0 })}
      />,
    );
    const widget = screen.getByTestId("seedling-pulse-widget");
    expect(widget.getAttribute("title")).toContain("0 in queue");

    rerender(
      <SeedlingPulseWidget
        status={buildStatus({ queue_depth: 3 })}
      />,
    );
    expect(widget.getAttribute("title")).toContain("3 in queue");
  });

  it("reflects running=false in the data attribute when the seedling rests", () => {
    render(
      <SeedlingPulseWidget
        status={buildStatus({ running: false })}
      />,
    );
    expect(screen.getByTestId("seedling-pulse-widget")).toHaveAttribute(
      "data-running",
      "false",
    );
  });
});
