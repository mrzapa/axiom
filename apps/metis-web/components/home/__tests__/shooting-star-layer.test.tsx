import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShootingStarLayer } from "../shooting-star-layer";

describe("ShootingStarLayer", () => {
  it("mounts a fixed full-viewport canvas", () => {
    render(<ShootingStarLayer />);
    const canvas = screen.getByTestId("shooting-star-layer");
    expect(canvas.tagName).toBe("CANVAS");
    expect(canvas.className).toMatch(/fixed/);
    expect(canvas.className).toMatch(/h-screen/);
    expect(canvas.className).toMatch(/w-screen/);
    expect(canvas.className).toMatch(/pointer-events-none/);
  });

  it("merges in custom className", () => {
    render(<ShootingStarLayer className="z-10" />);
    const canvas = screen.getByTestId("shooting-star-layer");
    expect(canvas.className).toContain("z-10");
  });

  it("is hidden from the accessibility tree", () => {
    render(<ShootingStarLayer />);
    const canvas = screen.getByTestId("shooting-star-layer");
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });
});
