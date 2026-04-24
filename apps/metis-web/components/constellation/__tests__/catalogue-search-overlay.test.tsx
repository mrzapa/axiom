import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogueSearchOverlay } from "../catalogue-search-overlay";
import type { CatalogueSearchEntry } from "@/lib/star-catalogue";

function landmark(
  id: string,
  name: string,
  extras: Partial<CatalogueSearchEntry> = {},
): CatalogueSearchEntry {
  return {
    id,
    name,
    kind: "landmark",
    x: 0.5,
    y: 0.5,
    ...extras,
  };
}

describe("CatalogueSearchOverlay", () => {
  it("renders a collapsed toggle button when not expanded", () => {
    render(
      <CatalogueSearchOverlay
        expanded={false}
        query=""
        index={[]}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /toggle catalogue search/i })).toBeTruthy();
  });

  it("shows the input and placeholder when expanded", () => {
    render(
      <CatalogueSearchOverlay
        expanded
        query=""
        index={[]}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/search the star catalogue/i);
    expect(input).toBeTruthy();
  });

  it("fires onQueryChange when the user types", () => {
    const onQueryChange = vi.fn();
    render(
      <CatalogueSearchOverlay
        expanded
        query=""
        index={[]}
        onExpandedChange={vi.fn()}
        onQueryChange={onQueryChange}
        onSelect={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/search the star catalogue/i);
    fireEvent.change(input, { target: { value: "veg" } });
    expect(onQueryChange).toHaveBeenCalledWith("veg");
  });

  it("renders result entries with name + kind chip", () => {
    const index = [
      landmark("l1", "Vega", { spectralClass: "A0 V" }),
      landmark("l2", "Altair"),
    ];
    render(
      <CatalogueSearchOverlay
        expanded
        query="a"
        index={index}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Vega")).toBeTruthy();
    expect(screen.getByText("Altair")).toBeTruthy();
    // Spectral class chip appears when set.
    expect(screen.getByText("A0 V")).toBeTruthy();
  });

  it("shows 'No matches' when a non-empty query yields nothing", () => {
    render(
      <CatalogueSearchOverlay
        expanded
        query="zzz"
        index={[landmark("l1", "Vega")]}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/no matches/i)).toBeTruthy();
  });

  it("does not render a results list or empty state for an empty query", () => {
    render(
      <CatalogueSearchOverlay
        expanded
        query=""
        index={[landmark("l1", "Vega")]}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText(/no matches/i)).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("calls onSelect with the clicked entry", () => {
    const onSelect = vi.fn();
    render(
      <CatalogueSearchOverlay
        expanded
        query="veg"
        index={[landmark("l1", "Vega", { facultyId: "perception" })]}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("Vega"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe("l1");
    expect(onSelect.mock.calls[0][0].facultyId).toBe("perception");
  });

  it("collapses and clears the query when Escape is pressed in the input", () => {
    const onExpandedChange = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <CatalogueSearchOverlay
        expanded
        query="veg"
        index={[landmark("l1", "Vega")]}
        onExpandedChange={onExpandedChange}
        onQueryChange={onQueryChange}
        onSelect={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText(/search the star catalogue/i);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onQueryChange).toHaveBeenCalledWith("");
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("toggle button fires onExpandedChange when clicked", () => {
    const onExpandedChange = vi.fn();
    render(
      <CatalogueSearchOverlay
        expanded={false}
        query=""
        index={[]}
        onExpandedChange={onExpandedChange}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /toggle catalogue search/i }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it("caps rendered results at 8 even if the index has more matches", () => {
    const index = Array.from({ length: 20 }, (_, i) =>
      landmark(`l-${i}`, `Vegatron ${i}`),
    );
    render(
      <CatalogueSearchOverlay
        expanded
        query="vegatron"
        index={index}
        onExpandedChange={vi.fn()}
        onQueryChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    const rendered = screen.getAllByRole("option");
    expect(rendered.length).toBe(8);
  });
});
