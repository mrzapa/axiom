import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// next/link uses the app router; stub it to a plain anchor so we don't
// pull the router into this unit test.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api", () => ({
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

const api = await import("@/lib/api");
const fetchSettings = api.fetchSettings as ReturnType<typeof vi.fn>;
const updateSettings = api.updateSettings as ReturnType<typeof vi.fn>;

const { NetworkAuditFirstRunCard } = await import("../first-run-card");

beforeEach(() => {
  fetchSettings.mockReset();
  updateSettings.mockReset();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe("NetworkAuditFirstRunCard", () => {
  it("stays hidden while settings are loading", () => {
    fetchSettings.mockImplementation(() => new Promise(() => undefined));
    const { container } = render(<NetworkAuditFirstRunCard />);
    // Tri-state starts at null — nothing rendered. Flicker-free.
    expect(container.textContent).toBe("");
  });

  it("renders the card when the dismissed flag is false", async () => {
    fetchSettings.mockResolvedValue({
      network_audit_discoverability_dismissed: false,
    });
    render(<NetworkAuditFirstRunCard />);
    expect(
      await screen.findByText(/METIS shows you every outbound call/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open audit/i }),
    ).toHaveAttribute("href", "/settings/privacy");
  });

  it("stays hidden when the server says the user has dismissed", async () => {
    fetchSettings.mockResolvedValue({
      network_audit_discoverability_dismissed: true,
    });
    render(<NetworkAuditFirstRunCard />);
    // Wait for the async effect to flush before asserting absence.
    await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
    expect(
      screen.queryByText(/METIS shows you every outbound call/i),
    ).not.toBeInTheDocument();
  });

  it("writes dismissed=true and hides the card when Dismiss is clicked", async () => {
    fetchSettings.mockResolvedValue({
      network_audit_discoverability_dismissed: false,
    });
    updateSettings.mockResolvedValue({});

    render(<NetworkAuditFirstRunCard />);
    const dismiss = await screen.findByRole("button", { name: /dismiss/i });

    await act(async () => {
      fireEvent.click(dismiss);
    });

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        network_audit_discoverability_dismissed: true,
      });
    });
    expect(
      screen.queryByText(/METIS shows you every outbound call/i),
    ).not.toBeInTheDocument();
  });

  it("restores the card when the dismiss write fails", async () => {
    fetchSettings.mockResolvedValue({
      network_audit_discoverability_dismissed: false,
    });
    updateSettings.mockRejectedValue(new Error("network"));

    render(<NetworkAuditFirstRunCard />);
    const dismiss = await screen.findByRole("button", { name: /dismiss/i });

    await act(async () => {
      fireEvent.click(dismiss);
    });

    // Optimistically hidden → write rejects → card re-renders so the
    // user hasn't silently consumed their dismissal.
    await waitFor(() => {
      expect(
        screen.getByText(/METIS shows you every outbound call/i),
      ).toBeInTheDocument();
    });
  });

  it("treats fetch failures as 'already dismissed' (fail-quiet)", async () => {
    fetchSettings.mockRejectedValue(new Error("settings endpoint down"));
    render(<NetworkAuditFirstRunCard />);
    await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
    expect(
      screen.queryByText(/METIS shows you every outbound call/i),
    ).not.toBeInTheDocument();
  });
});
