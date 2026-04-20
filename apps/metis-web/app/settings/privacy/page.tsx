"use client";

/**
 * Privacy & network audit panel (M17 Phase 6 — enforcement).
 *
 * Three stacked sections:
 *
 * 1. Airplane mode + outbound-call indicator (last 5 minutes).
 *    Phase 6: functional toggle writing ``network_audit_airplane_mode``
 *    via ``updateSettings``. Optimistic UI, rollback on error.
 * 2. Per-provider matrix with kill-switch toggles. Providers whose
 *    ``kill_switch_setting_key`` is ``null`` are toggled through the
 *    new ``provider_block_llm`` settings map; providers with a legacy
 *    kill switch (e.g. ``news_comets_enabled``) render as disabled
 *    with an inline note pointing at the controlling setting.
 * 3. Live event feed (SSE-driven, 100-row ring buffer). Phase 6 hides
 *    ``trigger_feature="synthetic_pass"`` events by default; a small
 *    toggle above the feed reveals them when set.
 *
 * The page also gains a "Prove offline" button which POSTs to
 * ``/v1/network-audit/synthetic-pass`` and renders the per-provider
 * result table in a modal. The synthetic pass emits one probe event
 * per known provider — with airplane mode on every ``actual_calls``
 * MUST be ``0``.
 *
 * The page is deliberately plain. This is a trust feature: the privacy
 * audience reads audit panels the way most users read READMEs, so
 * clarity > density > flourish. No gradient backgrounds, no animated
 * glows, no marketing copy. htop, not a dashboard.
 *
 * See ``plans/network-audit/plan.md`` (Phase 6) and the Litestar
 * routes in ``metis_app/api_litestar/routes/network_audit.py``.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { PageChrome } from "@/components/shell/page-chrome";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  fetchNetworkAuditEvents,
  fetchNetworkAuditProviders,
  fetchNetworkAuditRecentCount,
  fetchSettings,
  runNetworkAuditSyntheticPass,
  subscribeNetworkAuditStream,
  updateSettings,
  type NetworkAuditEvent,
  type NetworkAuditProvider,
  type ProviderCategory,
  type SyntheticPassResponse,
  type SyntheticProviderResult,
} from "@/lib/api";
import { PROVIDER_CATEGORY_LABELS } from "@/lib/network-audit-types";

const RECENT_COUNT_WINDOW_SECONDS = 300;
const REFRESH_INTERVAL_MS = 10_000;
const EVENT_BUFFER_CAP = 100;
const INITIAL_EVENT_FETCH_LIMIT = 50;
const SYNTHETIC_TRIGGER_FEATURE = "synthetic_pass";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "Never";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "—";
  const deltaSec = Math.max(0, Math.round((now - parsed) / 1000));
  if (deltaSec < 10) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.round(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHour = Math.round(deltaMin / 60);
  if (deltaHour < 48) return `${deltaHour}h ago`;
  const deltaDay = Math.round(deltaHour / 24);
  return `${deltaDay}d ago`;
}

function formatClockTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatBytes(
  bytesIn: number | null,
  bytesOut: number | null,
): string {
  const fmt = (n: number | null): string => {
    if (n === null) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };
  if (bytesIn === null && bytesOut === null) return "—";
  return `${fmt(bytesOut)} / ${fmt(bytesIn)}`;
}

/**
 * Coerce an arbitrary settings value into a ``Record<string, boolean>``
 * shape suitable for ``provider_block_llm``. Settings come back as
 * ``Record<string, unknown>`` from :func:`fetchSettings`; this keeps the
 * write paths honest about the on-wire shape.
 */
function toProviderBlockMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === true) out[key] = true;
    // Only persist truthy entries — the backend treats a missing key as
    // "not blocked", which matches the default state and keeps the
    // settings file small.
  }
  return out;
}

// ---------------------------------------------------------------------------
// Small leaf components
// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: ProviderCategory }) {
  const label = PROVIDER_CATEGORY_LABELS[category] ?? category;
  return (
    <Badge variant="outline" className="font-normal">
      {label}
    </Badge>
  );
}

function StatusCell({ code }: { code: number | null }) {
  if (code === null) return <span className="text-muted-foreground">—</span>;
  const tone =
    code >= 500
      ? "text-destructive"
      : code >= 400
        ? "text-amber-500"
        : "text-muted-foreground";
  return <span className={cn("font-mono text-xs", tone)}>{code}</span>;
}

// ---------------------------------------------------------------------------
// Section 1 — Airplane mode + outbound-call indicator
// ---------------------------------------------------------------------------

interface AirplaneSectionProps {
  recentCount: number;
  recentWindowSeconds: number;
  recentLoading: boolean;
  airplaneMode: boolean;
  airplanePending: boolean;
  airplaneError: string | null;
  onToggleAirplane: (next: boolean) => void;
}

function AirplaneSection({
  recentCount,
  recentWindowSeconds,
  recentLoading,
  airplaneMode,
  airplanePending,
  airplaneError,
  onToggleAirplane,
}: AirplaneSectionProps) {
  const windowLabel = `${Math.round(recentWindowSeconds / 60)}m`;
  const quiet = recentCount === 0;
  const dotClass = airplaneMode
    ? "bg-emerald-500/80"
    : quiet
      ? "bg-emerald-500/80"
      : "bg-amber-500/90";

  return (
    <section
      aria-labelledby="airplane-heading"
      className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2
              id="airplane-heading"
              className="text-base font-semibold"
            >
              Airplane mode
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Blocks every outbound network call from METIS. Per-provider
              toggles below override this master switch.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="airplane-mode-toggle"
              type="checkbox"
              checked={airplaneMode}
              disabled={airplanePending}
              onChange={(e) => onToggleAirplane(e.target.checked)}
              className={cn(
                "size-4 rounded border-border/60 bg-card/40 accent-primary",
                airplanePending ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            />
            <label
              htmlFor="airplane-mode-toggle"
              className="select-none text-sm text-foreground"
            >
              Enable airplane mode
            </label>
            {airplaneMode ? (
              <Badge variant="secondary" className="font-normal">
                on
              </Badge>
            ) : null}
          </div>
          {airplaneError ? (
            <p
              role="alert"
              className="text-xs text-destructive"
            >
              {airplaneError}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 self-start sm:min-w-[14rem]">
          <div
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 px-4 py-3"
            aria-live="polite"
          >
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                dotClass,
              )}
              aria-hidden
            />
            <div className="min-w-0 text-sm">
              <div className="font-medium tabular-nums">
                {recentLoading && recentCount === 0 && !quiet
                  ? "—"
                  : recentCount}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {recentCount === 1 ? "call" : "calls"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                in the last {windowLabel}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Per-provider matrix
// ---------------------------------------------------------------------------

interface ProviderSectionProps {
  providers: NetworkAuditProvider[];
  loading: boolean;
  error: string | null;
  now: number;
  blockOverrides: Record<string, boolean>;
  pendingKeys: Set<string>;
  rowError: Record<string, string | null>;
  onToggleProvider: (provider: NetworkAuditProvider, next: boolean) => void;
}

function ProviderSection({
  providers,
  loading,
  error,
  now,
  blockOverrides,
  pendingKeys,
  rowError,
  onToggleProvider,
}: ProviderSectionProps) {
  const rows = useMemo(() => {
    const filtered = providers.filter((p) => p.key !== "unclassified");
    return [...filtered].sort((a, b) => {
      if (b.events_7d !== a.events_7d) return b.events_7d - a.events_7d;
      return a.display_name.localeCompare(b.display_name);
    });
  }, [providers]);

  return (
    <section
      aria-labelledby="providers-heading"
      className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
    >
      <div className="mb-4">
        <h2 id="providers-heading" className="text-base font-semibold">
          Providers
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every outbound destination METIS knows about. Flip the checkbox
          to block a provider at the SDK level; legacy providers are
          controlled by the setting linked in their row.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Per-provider network audit status
          </caption>
          <thead>
            <tr className="border-b border-border/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="py-2 pr-4">
                Provider
              </th>
              <th scope="col" className="py-2 pr-4">
                Category
              </th>
              <th scope="col" className="py-2 pr-4">
                Blocked?
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Events (7d)
              </th>
              <th scope="col" className="py-2 pr-4">
                Last call
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-sm text-muted-foreground"
                >
                  No providers reported.
                </td>
              </tr>
            ) : null}
            {rows.length === 0 && loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-sm text-muted-foreground"
                >
                  Loading providers…
                </td>
              </tr>
            ) : null}
            {rows.map((provider) => {
              const hasCalls = provider.events_7d > 0;
              const isLegacy = provider.kill_switch_setting_key !== null;
              // Blocked state prefers any in-flight local override so the
              // checkbox visibly reflects the user's click before the
              // /settings POST round-trips.
              const override = blockOverrides[provider.key];
              const blocked =
                override !== undefined ? override : provider.blocked;
              const pending = pendingKeys.has(provider.key);
              const errForRow = rowError[provider.key] ?? null;
              const toggleId = `provider-block-${provider.key}`;
              return (
                <tr
                  key={provider.key}
                  className="border-b border-border/20 last:border-b-0"
                >
                  <td className="py-2 pr-4 font-medium">
                    {provider.display_name}
                  </td>
                  <td className="py-2 pr-4">
                    <CategoryBadge category={provider.category} />
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={toggleId}
                        className="inline-flex items-center gap-2"
                      >
                        <input
                          id={toggleId}
                          type="checkbox"
                          checked={blocked}
                          disabled={isLegacy || pending}
                          aria-label={`Block ${provider.display_name}`}
                          onChange={(e) =>
                            onToggleProvider(provider, e.target.checked)
                          }
                          className={cn(
                            "size-3.5 rounded border-border/60 bg-card/40 accent-destructive",
                            isLegacy || pending
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer",
                          )}
                        />
                        <Badge
                          variant={blocked ? "destructive" : "secondary"}
                          className="font-normal"
                        >
                          {blocked ? "blocked" : "allowed"}
                        </Badge>
                      </label>
                      {isLegacy ? (
                        <p className="text-[10px] text-muted-foreground">
                          Controlled by{" "}
                          <code className="font-mono">
                            {provider.kill_switch_setting_key}
                          </code>{" "}
                          in other settings
                        </p>
                      ) : null}
                      {errForRow ? (
                        <p
                          role="alert"
                          className="text-[10px] text-destructive"
                        >
                          {errForRow}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={cn(
                      "py-2 pr-4 text-right tabular-nums",
                      hasCalls ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {provider.events_7d}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {formatRelativeTime(provider.last_call_at, now)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Live event feed
// ---------------------------------------------------------------------------

type StreamStatus = "connecting" | "live" | "reconnecting" | "no_store";

interface EventFeedSectionProps {
  events: NetworkAuditEvent[];
  status: StreamStatus;
  error: string | null;
  showSynthetic: boolean;
  onToggleShowSynthetic: (next: boolean) => void;
  onRunSyntheticPass: () => void;
  syntheticPending: boolean;
  syntheticError: string | null;
}

function EventFeedSection({
  events,
  status,
  error,
  showSynthetic,
  onToggleShowSynthetic,
  onRunSyntheticPass,
  syntheticPending,
  syntheticError,
}: EventFeedSectionProps) {
  const visibleEvents = useMemo(
    () =>
      showSynthetic
        ? events
        : events.filter(
            (ev) => ev.trigger_feature !== SYNTHETIC_TRIGGER_FEATURE,
          ),
    [events, showSynthetic],
  );

  return (
    <section
      aria-labelledby="events-heading"
      className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="events-heading" className="text-base font-semibold">
            Live event feed
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every recorded outbound call, newest at the bottom. Capped at
            100 rows; probe events from &quot;prove offline&quot; are hidden by
            default.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRunSyntheticPass}
            disabled={syntheticPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-medium",
              syntheticPending
                ? "cursor-not-allowed opacity-70"
                : "hover:bg-background/80",
            )}
          >
            <span aria-hidden>{syntheticPending ? "⏳" : "✈︎"}</span>
            <span>
              {syntheticPending ? "Probing…" : "Prove offline"}
            </span>
          </button>
          <StreamStatusBadge status={status} />
        </div>
      </div>

      <label className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={showSynthetic}
          onChange={(e) => onToggleShowSynthetic(e.target.checked)}
          className="size-3.5 rounded border-border/60 bg-card/40 accent-primary"
        />
        Show synthetic probes
      </label>

      {syntheticError ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {syntheticError}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {error}
        </div>
      ) : null}

      {status === "no_store" ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400"
        >
          Audit store unavailable. New events will not appear until the
          backend reconnects; the rows below are the last batch you saw.
        </div>
      ) : null}

      <Separator className="mb-3" />

      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-border/30 bg-background/40">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">
            Live network audit event log
          </caption>
          <thead className="sticky top-0 z-10 bg-background/90 backdrop-blur">
            <tr className="text-left uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">
                Time
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Provider
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Host
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Feature
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Size (out/in)
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                User?
              </th>
            </tr>
          </thead>
          <tbody aria-live="polite">
            {visibleEvents.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-muted-foreground"
                >
                  No events recorded yet.
                </td>
              </tr>
            ) : (
              visibleEvents.map((event) => {
                const isSynthetic =
                  event.trigger_feature === SYNTHETIC_TRIGGER_FEATURE;
                return (
                  <tr
                    key={event.id}
                    className={cn(
                      "border-t border-border/20",
                      isSynthetic && "bg-muted/40 italic text-muted-foreground",
                    )}
                  >
                    <td className="px-3 py-1.5 font-mono tabular-nums text-muted-foreground">
                      {formatClockTime(event.timestamp)}
                    </td>
                    <td className="px-3 py-1.5">{event.provider_key}</td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">
                      {event.url_host}
                    </td>
                    <td className="px-3 py-1.5">{event.trigger_feature}</td>
                    <td className="px-3 py-1.5 font-mono tabular-nums text-muted-foreground">
                      {formatBytes(event.size_bytes_in, event.size_bytes_out)}
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusCell code={event.status_code} />
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {event.user_initiated ? "yes" : "no"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StreamStatusBadge({ status }: { status: StreamStatus }): ReactNode {
  switch (status) {
    case "connecting":
      return (
        <Badge variant="outline" className="font-normal">
          Connecting…
        </Badge>
      );
    case "live":
      return (
        <Badge variant="secondary" className="font-normal">
          <span className="mr-1.5 size-1.5 rounded-full bg-emerald-500/80" aria-hidden />
          Live
        </Badge>
      );
    case "reconnecting":
      return (
        <Badge variant="outline" className="font-normal">
          Reconnecting…
        </Badge>
      );
    case "no_store":
      return (
        <Badge variant="outline" className="font-normal">
          Store unavailable
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Synthetic-pass modal
// ---------------------------------------------------------------------------

interface SyntheticPassModalProps {
  result: SyntheticPassResponse | null;
  onClose: () => void;
}

function SyntheticPassModal({ result, onClose }: SyntheticPassModalProps) {
  // Focus the close button so keyboard users can dismiss immediately
  // and screen readers get a sensible landing spot for the modal.
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!result) return;
    closeRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [result, onClose]);

  if (!result) return null;

  const rows: SyntheticProviderResult[] = [...result.providers].sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );

  const airplaneOn = result.airplane_mode;
  const airplaneLabel = airplaneOn ? "On" : "Off";
  const headline = `Synthetic pass completed in ${result.duration_ms}ms. Airplane mode: ${airplaneLabel}`;

  const anomalous = rows.some(
    (row) => row.error !== null || row.actual_calls !== 1,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="synthetic-pass-heading"
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    >
      {/* Backdrop — click closes the modal. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-border/40 bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="synthetic-pass-heading"
              className="text-base font-semibold"
            >
              {headline}
            </h3>
            {airplaneOn ? (
              <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                <span aria-hidden>✓ </span>
                0 outbound calls across all providers.
              </p>
            ) : anomalous ? (
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                Rows with unexpected counts or errors are highlighted
                below. Airplane mode is OFF.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Airplane mode is OFF. Every allowed provider accrued exactly
                one probe event, as expected.
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md border border-border/50 bg-background/60 px-3 py-1 text-xs font-medium hover:bg-background/80"
          >
            Close
          </button>
        </div>

        <Separator className="my-4" />

        <div className="max-h-[24rem] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Per-provider synthetic-pass result
            </caption>
            <thead>
              <tr className="border-b border-border/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4">
                  Provider
                </th>
                <th scope="col" className="py-2 pr-4">
                  Category
                </th>
                <th scope="col" className="py-2 pr-4">
                  Blocked
                </th>
                <th scope="col" className="py-2 pr-4 text-right">
                  Actual calls
                </th>
                <th scope="col" className="py-2 pr-4">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-sm text-muted-foreground"
                  >
                    No providers reported. Audit store may be unavailable.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => {
                const highlight =
                  !airplaneOn &&
                  (row.error !== null || row.actual_calls !== 1);
                return (
                  <tr
                    key={row.provider_key}
                    className={cn(
                      "border-b border-border/20 last:border-b-0",
                      highlight &&
                        "bg-amber-500/10 text-amber-900 dark:text-amber-200",
                    )}
                  >
                    <td className="py-2 pr-4 font-medium">{row.display_name}</td>
                    <td className="py-2 pr-4">
                      <CategoryBadge category={row.category} />
                    </td>
                    <td className="py-2 pr-4">
                      <Badge
                        variant={row.blocked ? "destructive" : "secondary"}
                        className="font-normal"
                      >
                        {row.blocked ? "blocked" : "allowed"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono tabular-nums">
                      {row.actual_calls}
                    </td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {row.error
                        ? row.error
                        : !row.attempted
                          ? "Kill switch blocked probe."
                          : airplaneOn
                            ? "Probe suppressed by airplane mode."
                            : row.actual_calls === 1
                              ? "Expected."
                              : `Unexpected count (${row.actual_calls}).`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PrivacySettingsPage() {
  // Section 1 state
  const [recentCount, setRecentCount] = useState<number>(0);
  const [recentWindow, setRecentWindow] = useState<number>(
    RECENT_COUNT_WINDOW_SECONDS,
  );
  const [recentLoading, setRecentLoading] = useState<boolean>(true);

  // Airplane-mode + provider-block settings state.
  const [airplaneMode, setAirplaneMode] = useState<boolean>(false);
  const [airplanePending, setAirplanePending] = useState<boolean>(false);
  const [airplaneError, setAirplaneError] = useState<string | null>(null);
  const [providerBlock, setProviderBlock] = useState<Record<string, boolean>>(
    {},
  );
  // Local per-row optimistic override. Merged into the wire map on write
  // so rapid-fire flips don't lose the earlier change.
  const [blockOverrides, setBlockOverrides] = useState<
    Record<string, boolean>
  >({});
  const [pendingProviderKeys, setPendingProviderKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [providerRowError, setProviderRowError] = useState<
    Record<string, string | null>
  >({});

  // Section 2 state
  const [providers, setProviders] = useState<NetworkAuditProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState<boolean>(true);
  const [providersError, setProvidersError] = useState<string | null>(null);

  // Section 3 state
  const [events, setEvents] = useState<NetworkAuditEvent[]>([]);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [showSynthetic, setShowSynthetic] = useState<boolean>(false);

  // Synthetic-pass / modal state.
  const [syntheticPending, setSyntheticPending] = useState<boolean>(false);
  const [syntheticError, setSyntheticError] = useState<string | null>(null);
  const [syntheticResult, setSyntheticResult] =
    useState<SyntheticPassResponse | null>(null);

  // "now" ticks every 10 s to keep relative timestamps fresh without
  // causing per-second re-renders.
  const [now, setNow] = useState<number>(() => Date.now());

  // Stable accessors so subscribeNetworkAuditStream's closures see the
  // latest state setters without being torn down on every render.
  const appendEvent = useCallback((event: NetworkAuditEvent) => {
    setEvents((prev) => {
      const next = [...prev, event];
      if (next.length > EVENT_BUFFER_CAP) {
        return next.slice(next.length - EVENT_BUFFER_CAP);
      }
      return next;
    });
  }, []);

  // Initial settings hydrate — pulls airplane_mode and provider_block_llm
  // so the toggles render with the correct state on first paint.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const settings = await fetchSettings();
        if (cancelled) return;
        const airplane = settings.network_audit_airplane_mode;
        if (typeof airplane === "boolean") {
          setAirplaneMode(airplane);
        }
        const blockMap = toProviderBlockMap(settings.provider_block_llm);
        setProviderBlock(blockMap);
      } catch {
        // Non-fatal: leave defaults. The panel still renders everything
        // else and the user can re-flip the toggles once the settings
        // endpoint recovers.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Airplane-mode toggle with optimistic UI + rollback.
  const handleToggleAirplane = useCallback(
    (next: boolean) => {
      // Optimistic update.
      const previous = airplaneMode;
      setAirplaneMode(next);
      setAirplaneError(null);
      setAirplanePending(true);
      void (async () => {
        try {
          await updateSettings({ network_audit_airplane_mode: next });
        } catch (err) {
          setAirplaneMode(previous);
          setAirplaneError(
            err instanceof Error
              ? err.message
              : "Failed to update airplane mode.",
          );
        } finally {
          setAirplanePending(false);
        }
      })();
    },
    [airplaneMode],
  );

  // Provider kill-switch toggle with optimistic UI + rollback. The wire
  // map must always reflect *all* currently-blocked providers so rapid-
  // fire flips don't lose earlier changes.
  const handleToggleProvider = useCallback(
    (provider: NetworkAuditProvider, next: boolean) => {
      setBlockOverrides((prev) => ({ ...prev, [provider.key]: next }));
      setProviderRowError((prev) => ({ ...prev, [provider.key]: null }));
      setPendingProviderKeys((prev) => {
        const copy = new Set(prev);
        copy.add(provider.key);
        return copy;
      });

      // Build the full map: persisted provider_block_llm + any local
      // overrides + this new flip. Omit keys with a ``false`` value so
      // the settings file stays small.
      const merged: Record<string, boolean> = { ...providerBlock };
      for (const [k, v] of Object.entries(blockOverrides)) {
        if (v) merged[k] = true;
        else delete merged[k];
      }
      if (next) merged[provider.key] = true;
      else delete merged[provider.key];

      void (async () => {
        try {
          await updateSettings({ provider_block_llm: merged });
          setProviderBlock(merged);
          // Clear the override for this key now that the wire map is
          // authoritative.
          setBlockOverrides((prev) => {
            const copy = { ...prev };
            delete copy[provider.key];
            return copy;
          });
        } catch (err) {
          // Roll back this row.
          setBlockOverrides((prev) => {
            const copy = { ...prev };
            delete copy[provider.key];
            return copy;
          });
          setProviderRowError((prev) => ({
            ...prev,
            [provider.key]:
              err instanceof Error ? err.message : "Failed to update block.",
          }));
        } finally {
          setPendingProviderKeys((prev) => {
            const copy = new Set(prev);
            copy.delete(provider.key);
            return copy;
          });
        }
      })();
    },
    [providerBlock, blockOverrides],
  );

  // Synthetic-pass handler.
  const handleRunSyntheticPass = useCallback(() => {
    setSyntheticPending(true);
    setSyntheticError(null);
    void (async () => {
      try {
        const result = await runNetworkAuditSyntheticPass();
        setSyntheticResult(result);
      } catch (err) {
        setSyntheticError(
          err instanceof Error
            ? `Synthetic pass failed: ${err.message}`
            : "Synthetic pass failed.",
        );
      } finally {
        setSyntheticPending(false);
      }
    })();
  }, []);

  // Section 1 — recent count refresh loop.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const res = await fetchNetworkAuditRecentCount(
          RECENT_COUNT_WINDOW_SECONDS,
          { signal: controller.signal },
        );
        if (cancelled) return;
        setRecentCount(res.count);
        setRecentWindow(res.window_seconds);
      } catch (err) {
        if (cancelled) return;
        if (
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        ) {
          return;
        }
        // Degrade silently — a transient fetch failure shouldn't spam the
        // trust panel with errors. The indicator just stays where it was.
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    };

    void poll();
    const timer = setInterval(poll, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  // Section 2 — providers refresh loop.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const rows = await fetchNetworkAuditProviders({
          signal: controller.signal,
        });
        if (cancelled) return;
        setProviders(rows);
        setProvidersError(null);
      } catch (err) {
        if (cancelled) return;
        if (
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        ) {
          return;
        }
        setProvidersError(
          err instanceof Error ? err.message : "Failed to fetch providers.",
        );
      } finally {
        if (!cancelled) setProvidersLoading(false);
      }
    };

    void poll();
    const timer = setInterval(poll, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  // Section 3 — initial event hydrate + SSE subscription.
  const initialHydratedRef = useRef<boolean>(false);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const hydrate = async (): Promise<void> => {
      try {
        const rows = await fetchNetworkAuditEvents(
          { limit: INITIAL_EVENT_FETCH_LIMIT },
          { signal: controller.signal },
        );
        if (cancelled) return;
        // Backend returns newest-first; the feed renders newest-at-the-bottom,
        // so reverse into chronological order before seeding.
        const chronological = [...rows].reverse();
        // Merge-and-dedupe rather than replace. The SSE subscribe effect
        // fires alongside this hydrate; if audit_event frames arrive
        // before the snapshot resolves, appendEvent() has already added
        // them to the buffer. A replace-style assignment here would
        // silently drop those — an active outbound call disappearing
        // from the live audit log is exactly the kind of silent
        // dishonesty this panel exists to prevent. Dedupe by event.id,
        // prefer the streamed copy on conflict (both should be
        // identical; the safety is cheap), sort by timestamp, cap.
        setEvents((prev) => {
          const byId = new Map<string, NetworkAuditEvent>();
          for (const ev of chronological) byId.set(ev.id, ev);
          for (const ev of prev) byId.set(ev.id, ev);
          const merged = Array.from(byId.values()).sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp),
          );
          return merged.slice(-EVENT_BUFFER_CAP);
        });
        initialHydratedRef.current = true;
      } catch (err) {
        if (cancelled) return;
        if (
          typeof err === "object" &&
          err !== null &&
          "name" in err &&
          (err as { name: string }).name === "AbortError"
        ) {
          return;
        }
        setFeedError(
          err instanceof Error
            ? `Failed to load initial events: ${err.message}`
            : "Failed to load initial events.",
        );
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setStreamStatus("connecting");
    // Latch: once the backend tells us the store is unavailable we stick
    // there — downstream transport flaps shouldn't overwrite that truth.
    let noStoreLatched = false;
    const unsubscribe = subscribeNetworkAuditStream(
      (frame) => {
        if (frame.type === "no_store") {
          noStoreLatched = true;
          setStreamStatus("no_store");
          return;
        }
        setStreamStatus("live");
        appendEvent(frame.event);
      },
      {
        onStatusChange: (status) => {
          if (noStoreLatched) return;
          if (status === "reconnecting") {
            setStreamStatus("reconnecting");
          } else if (status === "connecting") {
            // Only flip back to "connecting" from the initial state —
            // after the stream has been "live" once, "connecting" just
            // means we're re-establishing, which "reconnecting" already
            // covers.
            setStreamStatus((prev) =>
              prev === "live" || prev === "reconnecting" ? prev : "connecting",
            );
          }
          // "open" transitions to "live" only after a frame arrives; we
          // intentionally don't flip to "live" here to avoid showing the
          // pill before any data has been received.
        },
      },
    );

    return () => {
      unsubscribe();
    };
  }, [appendEvent]);

  // Clock tick for relative-time labels.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <PageChrome
      title="Privacy & network audit"
      description="Every outbound call METIS makes is recorded here. Flip the airplane toggle to block every outbound call; use per-provider toggles to silence specific LLM, embedding, or model-hub destinations."
      eyebrow="PRIVACY"
    >
      <div className="space-y-4 sm:space-y-5">
        <AirplaneSection
          recentCount={recentCount}
          recentWindowSeconds={recentWindow}
          recentLoading={recentLoading}
          airplaneMode={airplaneMode}
          airplanePending={airplanePending}
          airplaneError={airplaneError}
          onToggleAirplane={handleToggleAirplane}
        />
        <ProviderSection
          providers={providers}
          loading={providersLoading}
          error={providersError}
          now={now}
          blockOverrides={blockOverrides}
          pendingKeys={pendingProviderKeys}
          rowError={providerRowError}
          onToggleProvider={handleToggleProvider}
        />
        <EventFeedSection
          events={events}
          status={streamStatus}
          error={feedError}
          showSynthetic={showSynthetic}
          onToggleShowSynthetic={setShowSynthetic}
          onRunSyntheticPass={handleRunSyntheticPass}
          syntheticPending={syntheticPending}
          syntheticError={syntheticError}
        />
        <p className="px-1 text-xs text-muted-foreground">
          <Link
            href="/settings"
            className="underline-offset-2 hover:underline"
          >
            ← Back to settings
          </Link>
        </p>
      </div>
      <SyntheticPassModal
        result={syntheticResult}
        onClose={() => setSyntheticResult(null)}
      />
    </PageChrome>
  );
}
