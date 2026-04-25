import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  NetworkAuditEvent,
  NetworkAuditProvider,
  NetworkAuditStreamFrame,
  RecentCountResponse,
  SyntheticPassResponse,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/settings/privacy",
  useSearchParams: () => new URLSearchParams(),
}));

// Lightweight PageChrome stub — avoids pulling in the WebGPUCompanionProvider
// and MetisCompanionDock (each drags hundreds of modules and unrelated side
// effects into this test).
vi.mock("@/components/shell/page-chrome", () => ({
  PageChrome: ({
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{children}</div>
    </div>
  ),
}));

// Capture the stream listener so the test can fire SSE frames on demand.
const streamListeners: Array<(frame: NetworkAuditStreamFrame) => void> = [];
const streamStatusListeners: Array<
  (status: "connecting" | "open" | "reconnecting" | "closed") => void
> = [];
const streamUnsubscribers: Array<() => void> = [];

vi.mock("@/lib/api", async () => {
  return {
    fetchNetworkAuditEvents: vi.fn(),
    fetchNetworkAuditProviders: vi.fn(),
    fetchNetworkAuditRecentCount: vi.fn(),
    fetchSettings: vi.fn(),
    updateSettings: vi.fn(),
    runNetworkAuditSyntheticPass: vi.fn(),
    downloadNetworkAuditExport: vi.fn(),
    subscribeNetworkAuditStream: vi.fn(
      (
        listener: (frame: NetworkAuditStreamFrame) => void,
        options?: {
          onStatusChange?: (
            status: "connecting" | "open" | "reconnecting" | "closed",
          ) => void;
        },
      ) => {
        streamListeners.push(listener);
        if (options?.onStatusChange) {
          streamStatusListeners.push(options.onStatusChange);
        }
        const unsub = vi.fn(() => {
          const idx = streamListeners.indexOf(listener);
          if (idx >= 0) streamListeners.splice(idx, 1);
        });
        streamUnsubscribers.push(unsub);
        return unsub;
      },
    ),
  };
});

// Import after the mocks are installed.
const api = await import("@/lib/api");
const fetchNetworkAuditEvents = api.fetchNetworkAuditEvents as ReturnType<
  typeof vi.fn
>;
const fetchNetworkAuditProviders = api.fetchNetworkAuditProviders as ReturnType<
  typeof vi.fn
>;
const fetchNetworkAuditRecentCount =
  api.fetchNetworkAuditRecentCount as ReturnType<typeof vi.fn>;
const fetchSettings = api.fetchSettings as ReturnType<typeof vi.fn>;
const updateSettings = api.updateSettings as ReturnType<typeof vi.fn>;
const runNetworkAuditSyntheticPass =
  api.runNetworkAuditSyntheticPass as ReturnType<typeof vi.fn>;
const downloadNetworkAuditExport =
  api.downloadNetworkAuditExport as ReturnType<typeof vi.fn>;

const { default: PrivacySettingsPage } = await import("../page");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<NetworkAuditEvent> = {}): NetworkAuditEvent {
  return {
    id: "event-1",
    timestamp: "2026-04-19T12:34:56Z",
    method: "POST",
    url_host: "api.openai.com",
    url_path_prefix: "/v1/chat/completions",
    query_params_stored: false,
    provider_key: "openai",
    trigger_feature: "chat.direct",
    size_bytes_in: 1024,
    size_bytes_out: 512,
    latency_ms: 320,
    status_code: 200,
    user_initiated: true,
    blocked: false,
    source: "sdk_invocation",
    ...overrides,
  };
}

function makeProvider(
  overrides: Partial<NetworkAuditProvider> = {},
): NetworkAuditProvider {
  return {
    key: "openai",
    display_name: "OpenAI",
    category: "llm",
    kill_switch_setting_key: "provider_block_llm",
    blocked: false,
    events_7d: 12,
    last_call_at: "2026-04-19T12:20:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Default mock responses (reset between tests)
// ---------------------------------------------------------------------------

function stubDefaults(): void {
  fetchNetworkAuditRecentCount.mockResolvedValue({
    count: 0,
    window_seconds: 300,
  } satisfies RecentCountResponse);
  fetchNetworkAuditProviders.mockResolvedValue([]);
  fetchNetworkAuditEvents.mockResolvedValue([]);
  fetchSettings.mockResolvedValue({
    network_audit_airplane_mode: false,
    provider_block_llm: {},
  });
  updateSettings.mockResolvedValue({});
  runNetworkAuditSyntheticPass.mockResolvedValue({
    duration_ms: 12,
    airplane_mode: false,
    providers: [],
  } satisfies SyntheticPassResponse);
  downloadNetworkAuditExport.mockResolvedValue({
    filename: "metis-network-audit-30d-20260420T120000Z.csv",
  });
}

beforeEach(() => {
  streamListeners.length = 0;
  streamStatusListeners.length = 0;
  streamUnsubscribers.length = 0;
  stubDefaults();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PrivacySettingsPage — structure", () => {
  it("renders the three section headings on mount", async () => {
    render(<PrivacySettingsPage />);

    // Wait for async effects to flush. The headings are static and appear
    // on the very first render, but findByRole also awaits any pending
    // promises so we don't leave effects mid-flight across tests.
    expect(
      await screen.findByRole("heading", { level: 2, name: /airplane mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /providers/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /live event feed/i }),
    ).toBeInTheDocument();
  });
});

describe("PrivacySettingsPage — Section 1 (airplane / recent count)", () => {
  it("populates the indicator from the mocked recent-count response", async () => {
    fetchNetworkAuditRecentCount.mockResolvedValue({
      count: 7,
      window_seconds: 300,
    });

    render(<PrivacySettingsPage />);

    await waitFor(() => {
      expect(fetchNetworkAuditRecentCount).toHaveBeenCalled();
    });

    const indicator = await screen.findByText("7");
    expect(indicator).toBeInTheDocument();
    expect(screen.getByText(/in the last 5m/i)).toBeInTheDocument();
  });

  it("renders the airplane toggle enabled (Phase 6 enforcement)", async () => {
    render(<PrivacySettingsPage />);

    const toggle = (await screen.findByLabelText(
      /enable airplane mode/i,
    )) as HTMLInputElement;
    // Phase 6: toggle is functional. It may start disabled for a tick
    // while settings hydrate; wait for it to become enabled.
    await waitFor(() => {
      expect(toggle).not.toBeDisabled();
    });
  });

  it("reflects the hydrated airplane_mode setting in the checkbox", async () => {
    fetchSettings.mockResolvedValue({
      network_audit_airplane_mode: true,
      provider_block_llm: {},
    });
    render(<PrivacySettingsPage />);

    const toggle = (await screen.findByLabelText(
      /enable airplane mode/i,
    )) as HTMLInputElement;
    await waitFor(() => {
      expect(toggle.checked).toBe(true);
    });
  });
});

describe("PrivacySettingsPage — Phase 6 airplane toggle write path", () => {
  it("writes network_audit_airplane_mode=true when flipped on", async () => {
    render(<PrivacySettingsPage />);

    const toggle = (await screen.findByLabelText(
      /enable airplane mode/i,
    )) as HTMLInputElement;
    // Ensure settings hydrate runs and toggle becomes actionable.
    await waitFor(() => expect(toggle.checked).toBe(false));

    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        network_audit_airplane_mode: true,
      });
    });
    expect(toggle.checked).toBe(true);
  });

  it("disables the toggle while the write is in flight", async () => {
    let resolveWrite: (value: Record<string, unknown>) => void = () => undefined;
    updateSettings.mockImplementation(
      () =>
        new Promise<Record<string, unknown>>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    render(<PrivacySettingsPage />);
    const toggle = (await screen.findByLabelText(
      /enable airplane mode/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(toggle.checked).toBe(false));

    await act(async () => {
      fireEvent.click(toggle);
    });

    // Mid-flight: disabled.
    expect(toggle.disabled).toBe(true);

    await act(async () => {
      resolveWrite({});
    });

    await waitFor(() => expect(toggle.disabled).toBe(false));
  });

  it("rolls back and surfaces an error when the write rejects", async () => {
    updateSettings.mockRejectedValue(new Error("write failed: 500"));

    render(<PrivacySettingsPage />);
    const toggle = (await screen.findByLabelText(
      /enable airplane mode/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(toggle.checked).toBe(false));

    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() => {
      expect(screen.getByText(/write failed: 500/i)).toBeInTheDocument();
    });
    // Rollback: checkbox returns to unchecked.
    expect(toggle.checked).toBe(false);
  });
});

describe("PrivacySettingsPage — Phase 6 provider kill-switch toggles", () => {
  it("writes {provider_block_llm: {openai: true}} on first flip", async () => {
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({
        key: "openai",
        display_name: "OpenAI",
        kill_switch_setting_key: null,
        blocked: false,
      }),
    ]);

    render(<PrivacySettingsPage />);

    const checkbox = (await screen.findByLabelText(
      /block openai/i,
    )) as HTMLInputElement;
    await waitFor(() => expect(checkbox.checked).toBe(false));

    await act(async () => {
      fireEvent.click(checkbox);
    });

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        provider_block_llm: { openai: true },
      });
    });
  });

  it("renders the toggle disabled for providers with a legacy kill_switch_setting_key", async () => {
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({
        key: "reddit_api",
        display_name: "Reddit API",
        category: "ingestion",
        kill_switch_setting_key: "news_comets_enabled",
        blocked: false,
      }),
    ]);

    render(<PrivacySettingsPage />);

    const checkbox = (await screen.findByLabelText(
      /block reddit api/i,
    )) as HTMLInputElement;
    expect(checkbox).toBeDisabled();
    // The inline note renders "Controlled by <Link>News comets</Link>
    // in other settings" — the raw setting key is now hidden behind a
    // user-friendly label that deep-links to the relevant control. We
    // assert on the link rather than the legacy <code> element.
    const link = screen.getByRole("link", { name: /news comets/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("serializes rapid provider flips — second POST waits for the first", async () => {
    // Regression combining Task C I1 (atomic merge inside the
    // functional updater) and PR #525 Codex P1 #2 (writes must be
    // serialised so out-of-order server arrival can't clobber a newer
    // map with an older one). Two clicks fire, first is slow-resolved:
    // the second POST must not land on the server until the first
    // completes. When it does land, its payload must contain both
    // flips (the merge still reads the override set atomically).
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({
        key: "openai",
        display_name: "OpenAI",
        kill_switch_setting_key: null,
        blocked: false,
      }),
      makeProvider({
        key: "anthropic",
        display_name: "Anthropic",
        kill_switch_setting_key: null,
        blocked: false,
      }),
    ]);
    let resolveFirst: () => void = () => undefined;
    updateSettings
      .mockImplementationOnce(
        () =>
          new Promise<Record<string, unknown>>((r) => {
            resolveFirst = () => r({});
          }),
      )
      .mockImplementationOnce(() => Promise.resolve({}));

    render(<PrivacySettingsPage />);

    const openaiToggle = await screen.findByLabelText(/Block OpenAI/i);
    const anthropicToggle = await screen.findByLabelText(/Block Anthropic/i);

    // Two clicks inside one act — the serialisation queue must hold
    // the second write back until the first resolves.
    await act(async () => {
      fireEvent.click(openaiToggle);
      fireEvent.click(anthropicToggle);
    });

    // Before the first resolves, only the first POST should have fired.
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledTimes(1);
    });
    const firstCall = updateSettings.mock.calls[0]?.[0] as {
      provider_block_llm?: Record<string, boolean>;
    };
    expect(firstCall?.provider_block_llm).toEqual({ openai: true });

    // Resolve the first POST. The second is now free to fire.
    await act(async () => {
      resolveFirst();
    });

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledTimes(2);
    });

    // Second call's patch must include BOTH flips — the atomic-merge
    // property from the I1 polish still holds.
    const secondCall = updateSettings.mock.calls[1]?.[0] as {
      provider_block_llm?: Record<string, boolean>;
    };
    expect(secondCall?.provider_block_llm).toEqual({
      openai: true,
      anthropic: true,
    });
  });

  it("keeps the checkbox visually blocked after a successful toggle (no revert until next poll)", async () => {
    // Regression for PR #525 Codex P1 #1: after a successful toggle,
    // the local override was cleared and the checkbox fell back to
    // provider.blocked — which is stale until the 10 s providers poll
    // catches up. The fix makes providerBlock the render-time source
    // of truth for any provider the user has touched, so the checkbox
    // stays checked immediately after the POST resolves (no visible
    // revert).
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({
        key: "openai",
        display_name: "OpenAI",
        kill_switch_setting_key: null,
        blocked: false, // server hasn't heard about the block yet
      }),
    ]);
    updateSettings.mockResolvedValue({});

    render(<PrivacySettingsPage />);

    const toggle = (await screen.findByLabelText(
      /Block OpenAI/i,
    )) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    await act(async () => {
      fireEvent.click(toggle);
    });

    // Let the POST resolve + the post-success state updates flush.
    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledTimes(1);
    });

    // The override is now cleared, but providerBlock[openai] = true
    // should keep the render showing checked, even though
    // provider.blocked on the server-fetched row is still false.
    // No additional fetchNetworkAuditProviders call (poll interval is
    // 10 s and we've only advanced real time by a few ms).
    await waitFor(() => {
      expect(toggle.checked).toBe(true);
    });
  });
});

describe("PrivacySettingsPage — Phase 6 prove offline button + modal", () => {
  it("opens a modal with the synthetic-pass results", async () => {
    runNetworkAuditSyntheticPass.mockResolvedValue({
      duration_ms: 42,
      airplane_mode: true,
      providers: [
        {
          provider_key: "openai",
          display_name: "OpenAI",
          category: "llm",
          attempted: false,
          blocked: true,
          actual_calls: 0,
          error: null,
        },
      ],
    } satisfies SyntheticPassResponse);

    render(<PrivacySettingsPage />);

    const button = await screen.findByRole("button", {
      name: /prove offline/i,
    });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(runNetworkAuditSyntheticPass).toHaveBeenCalled();
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/synthetic pass completed in 42ms/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/airplane mode: on/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/0 outbound calls/i)).toBeInTheDocument();
    expect(within(dialog).getByText("OpenAI")).toBeInTheDocument();
  });

  it("does not highlight blocked providers as anomalous in non-airplane mode", async () => {
    // Regression for Task C N6: a blocked provider reports
    // ``attempted=false, actual_calls=0`` which is exactly the kill
    // switch working, not an anomaly. The old highlight condition
    // triggered on ``actual_calls !== 1`` unconditionally so blocked
    // rows lit amber even when airplane mode was OFF.
    runNetworkAuditSyntheticPass.mockResolvedValue({
      duration_ms: 5,
      airplane_mode: false,
      providers: [
        {
          provider_key: "openai",
          display_name: "OpenAI",
          category: "llm",
          attempted: false,
          blocked: true,
          actual_calls: 0,
          error: null,
        },
        {
          provider_key: "anthropic",
          display_name: "Anthropic",
          category: "llm",
          attempted: true,
          blocked: false,
          actual_calls: 1,
          error: null,
        },
      ],
    } satisfies SyntheticPassResponse);
    render(<PrivacySettingsPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: /prove offline/i }),
    );
    await screen.findByRole("dialog");

    const rows = screen.getAllByRole("row");
    const openaiRow = rows.find((r) => within(r).queryByText("OpenAI"));
    expect(openaiRow).toBeDefined();
    // Blocked provider's row must not carry the amber anomaly class.
    expect(openaiRow?.className ?? "").not.toMatch(/amber/);
  });

  it("shows an inline error when the synthetic pass rejects", async () => {
    runNetworkAuditSyntheticPass.mockRejectedValue(new Error("probe exploded"));

    render(<PrivacySettingsPage />);
    const button = await screen.findByRole("button", {
      name: /prove offline/i,
    });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/synthetic pass failed: probe exploded/i),
      ).toBeInTheDocument();
    });
  });
});

describe("PrivacySettingsPage — Phase 7 Export CSV button", () => {
  it("renders an Export last 30 days button in the live-feed header", async () => {
    render(<PrivacySettingsPage />);
    expect(
      await screen.findByRole("button", {
        name: /export last 30 days \(csv\)/i,
      }),
    ).toBeInTheDocument();
  });

  it("calls downloadNetworkAuditExport with days=30 when clicked", async () => {
    render(<PrivacySettingsPage />);

    const button = await screen.findByRole("button", {
      name: /export last 30 days/i,
    });
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(downloadNetworkAuditExport).toHaveBeenCalledWith({ days: 30 });
    });
  });

  it("disables the button while the export is in flight and re-enables after", async () => {
    let resolveExport: (value: { filename: string }) => void = () => undefined;
    downloadNetworkAuditExport.mockImplementation(
      () =>
        new Promise<{ filename: string }>((resolve) => {
          resolveExport = resolve;
        }),
    );

    render(<PrivacySettingsPage />);
    const button = (await screen.findByRole("button", {
      name: /export last 30 days/i,
    })) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(button);
    });

    // Mid-flight: button is disabled and reads "Exporting…".
    expect(button.disabled).toBe(true);
    expect(
      screen.getByRole("button", { name: /exporting…/i }),
    ).toBeInTheDocument();

    await act(async () => {
      resolveExport({ filename: "metis-network-audit-30d-test.csv" });
    });

    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("surfaces an inline error when the export rejects", async () => {
    downloadNetworkAuditExport.mockRejectedValue(new Error("network down"));

    render(<PrivacySettingsPage />);
    const button = await screen.findByRole("button", {
      name: /export last 30 days/i,
    });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText(/export failed: network down/i)).toBeInTheDocument();
    });
  });
});

describe("PrivacySettingsPage — Phase 6 synthetic-probe feed filter", () => {
  it("hides events with trigger_feature=synthetic_pass by default", async () => {
    fetchNetworkAuditEvents.mockResolvedValue([
      makeEvent({
        id: "ev-real",
        trigger_feature: "chat.direct",
      }),
      makeEvent({
        id: "ev-probe",
        trigger_feature: "synthetic_pass",
      }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("chat.direct");
    expect(screen.queryByText("synthetic_pass")).not.toBeInTheDocument();
  });

  it("reveals synthetic_pass events when the 'show synthetic probes' toggle is on", async () => {
    fetchNetworkAuditEvents.mockResolvedValue([
      makeEvent({
        id: "ev-real",
        trigger_feature: "chat.direct",
      }),
      makeEvent({
        id: "ev-probe",
        trigger_feature: "synthetic_pass",
      }),
    ]);

    render(<PrivacySettingsPage />);
    await screen.findByText("chat.direct");

    const showToggle = screen.getByLabelText(
      /show synthetic probes/i,
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(showToggle);
    });

    expect(screen.getByText("synthetic_pass")).toBeInTheDocument();
  });
});

describe("PrivacySettingsPage — Section 2 (providers matrix)", () => {
  it("populates the provider matrix rows from the mocked response", async () => {
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({ key: "openai", display_name: "OpenAI", events_7d: 12 }),
      makeProvider({
        key: "anthropic",
        display_name: "Anthropic",
        events_7d: 3,
        last_call_at: null,
        blocked: true,
        category: "llm",
      }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("OpenAI");
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
  });

  it("renders 'Never' for providers with last_call_at null", async () => {
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({
        key: "pinecone",
        display_name: "Pinecone",
        events_7d: 0,
        last_call_at: null,
      }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("Pinecone");
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("filters out the 'unclassified' provider defensively", async () => {
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({ key: "openai", display_name: "OpenAI" }),
      makeProvider({
        key: "unclassified",
        display_name: "Unclassified",
        events_7d: 99,
      }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("OpenAI");
    expect(screen.queryByText("Unclassified")).not.toBeInTheDocument();
  });

  it("sorts providers by events_7d DESC, then alphabetically", async () => {
    fetchNetworkAuditProviders.mockResolvedValue([
      makeProvider({
        key: "zeta",
        display_name: "Zeta",
        events_7d: 5,
      }),
      makeProvider({
        key: "alpha",
        display_name: "Alpha",
        events_7d: 5,
      }),
      makeProvider({
        key: "beta",
        display_name: "Beta",
        events_7d: 42,
      }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("Beta");

    const table = screen
      .getByRole("heading", { level: 2, name: /providers/i })
      .closest("section") as HTMLElement;
    const rows = within(table).getAllByRole("row");
    // row[0] is <thead>; order after that is data rows in sorted order.
    const dataRowTexts = rows.slice(1).map((row) => row.textContent ?? "");
    // Beta (42) comes before Alpha (5) which comes before Zeta (5).
    const betaIdx = dataRowTexts.findIndex((t) => t.includes("Beta"));
    const alphaIdx = dataRowTexts.findIndex((t) => t.includes("Alpha"));
    const zetaIdx = dataRowTexts.findIndex((t) => t.includes("Zeta"));
    expect(betaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(zetaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeLessThan(alphaIdx);
    expect(alphaIdx).toBeLessThan(zetaIdx);
  });
});

describe("PrivacySettingsPage — Section 3 (live event feed)", () => {
  it("populates the event feed from the mocked events response on mount", async () => {
    fetchNetworkAuditEvents.mockResolvedValue([
      makeEvent({ id: "ev-1", trigger_feature: "rss.poll" }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("rss.poll");
    expect(fetchNetworkAuditEvents).toHaveBeenCalled();
  });

  it("appends a new event when the mocked SSE emits an audit_event frame", async () => {
    fetchNetworkAuditEvents.mockResolvedValue([
      makeEvent({ id: "ev-initial", trigger_feature: "chat.direct" }),
    ]);

    render(<PrivacySettingsPage />);

    await screen.findByText("chat.direct");

    // Fire a new event through the SSE subscription.
    expect(streamListeners.length).toBeGreaterThan(0);
    act(() => {
      streamListeners[0]!({
        type: "audit_event",
        event: makeEvent({
          id: "ev-live",
          trigger_feature: "news.fetch",
          timestamp: "2026-04-19T12:35:00Z",
        }),
      });
    });

    expect(await screen.findByText("news.fetch")).toBeInTheDocument();
  });

  it("preserves streamed events when the initial hydrate resolves", async () => {
    // Regression for PR #521 Codex P1: mount races two effects —
    // fetchNetworkAuditEvents and subscribeNetworkAuditStream. If an
    // audit_event frame arrives before the hydrate snapshot resolves,
    // a replace-style setEvents(snapshot) would silently drop it. The
    // merge-and-dedupe hydrate path keeps the streamed row visible.
    let resolveHydrate: (rows: NetworkAuditEvent[]) => void = () => undefined;
    fetchNetworkAuditEvents.mockImplementation(
      () =>
        new Promise<NetworkAuditEvent[]>((resolve) => {
          resolveHydrate = resolve;
        }),
    );

    render(<PrivacySettingsPage />);

    // SSE subscribe fires synchronously on mount — wait for the listener
    // to register before firing a frame through it.
    await waitFor(() => expect(streamListeners.length).toBeGreaterThan(0));

    // A live event arrives before the hydrate resolves. appendEvent()
    // puts it in the buffer.
    act(() => {
      streamListeners[0]!({
        type: "audit_event",
        event: makeEvent({
          id: "ev-live-race",
          trigger_feature: "live.before.hydrate",
          timestamp: "2026-04-19T13:00:00Z",
        }),
      });
    });
    expect(
      await screen.findByText("live.before.hydrate"),
    ).toBeInTheDocument();

    // Now the hydrate resolves with a historical snapshot.
    await act(async () => {
      resolveHydrate([
        makeEvent({
          id: "ev-hydrate-1",
          trigger_feature: "historical.one",
          timestamp: "2026-04-19T12:30:00Z",
        }),
      ]);
    });

    // Both the historical row AND the pre-hydrate streamed row must
    // render. A replace-style assignment would have dropped the
    // streamed row.
    expect(
      await screen.findByText("historical.one"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("live.before.hydrate"),
    ).toBeInTheDocument();
  });

  it("dedupes by id when hydrate overlaps with streamed events", async () => {
    // If the backend's snapshot happens to include an event that was
    // also delivered via SSE (common when stream and snapshot overlap),
    // the id-based dedupe keeps only one copy.
    let resolveHydrate: (rows: NetworkAuditEvent[]) => void = () => undefined;
    fetchNetworkAuditEvents.mockImplementation(
      () =>
        new Promise<NetworkAuditEvent[]>((resolve) => {
          resolveHydrate = resolve;
        }),
    );

    render(<PrivacySettingsPage />);
    await waitFor(() => expect(streamListeners.length).toBeGreaterThan(0));

    act(() => {
      streamListeners[0]!({
        type: "audit_event",
        event: makeEvent({
          id: "ev-overlap",
          trigger_feature: "overlap.event",
          timestamp: "2026-04-19T13:00:00Z",
        }),
      });
    });
    await screen.findByText("overlap.event");

    // Hydrate also contains the same id.
    await act(async () => {
      resolveHydrate([
        makeEvent({
          id: "ev-overlap",
          trigger_feature: "overlap.event",
          timestamp: "2026-04-19T13:00:00Z",
        }),
      ]);
    });

    // Still exactly one row for this trigger — not two.
    const cells = screen.getAllByText("overlap.event");
    expect(cells.length).toBe(1);
  });

  it("shows 'Audit store unavailable' banner on a no_store frame", async () => {
    render(<PrivacySettingsPage />);

    await waitFor(() => expect(streamListeners.length).toBeGreaterThan(0));

    act(() => {
      streamListeners[0]!({ type: "no_store" });
    });

    expect(
      await screen.findByText(/audit store unavailable/i),
    ).toBeInTheDocument();
  });

  it("shows a Store-unavailable status badge when no_store is received", async () => {
    render(<PrivacySettingsPage />);
    await waitFor(() => expect(streamListeners.length).toBeGreaterThan(0));

    act(() => {
      streamListeners[0]!({ type: "no_store" });
    });

    // Both the banner ("Audit store unavailable") and the status pill
    // ("Store unavailable") should render. Pin specifically to the pill.
    expect(
      await screen.findByText(/^Store unavailable$/),
    ).toBeInTheDocument();
  });

  it("renders a 'Connecting…' status on first mount before any frame arrives", async () => {
    render(<PrivacySettingsPage />);
    // The status badge is rendered synchronously on first render.
    expect(screen.getByText(/connecting…/i)).toBeInTheDocument();
  });

  it("flips to 'Live' after the first audit_event frame arrives", async () => {
    render(<PrivacySettingsPage />);
    await waitFor(() => expect(streamListeners.length).toBeGreaterThan(0));

    act(() => {
      streamListeners[0]!({
        type: "audit_event",
        event: makeEvent({ id: "ev-live-1" }),
      });
    });

    expect(await screen.findByText(/^Live$/)).toBeInTheDocument();
  });
});

describe("PrivacySettingsPage — Section 3 (reconnect signal)", () => {
  it("shows a 'Reconnecting…' state when the subscriber reports reconnecting", async () => {
    render(<PrivacySettingsPage />);
    await waitFor(() => expect(streamStatusListeners.length).toBeGreaterThan(0));

    act(() => {
      streamStatusListeners[0]!("reconnecting");
    });

    expect(await screen.findByText(/reconnecting…/i)).toBeInTheDocument();
  });

  it("stays on 'Connecting…' when no frames arrive", async () => {
    render(<PrivacySettingsPage />);
    // Even after effects have flushed and the subscriber is attached,
    // without any frames we stay on the initial status.
    await waitFor(() => expect(streamListeners.length).toBeGreaterThan(0));
    expect(screen.getByText(/connecting…/i)).toBeInTheDocument();
  });
});
