"use client";

/**
 * First-run discoverability card for the M17 Network Audit panel.
 *
 * Phase 7 deliverable: one-shot card surfaced on the home page while
 * the user has never opened ``/settings/privacy``. Dismissible, not
 * gated, never re-shown. Persistence lives in a single settings flag
 * (``network_audit_discoverability_dismissed``) so the dismissal
 * survives reloads, reinstalls within the same settings file, and
 * cross-device sync (should that ever exist).
 *
 * The card is the feature's public face before the user knows it
 * exists. Keep the copy terse and honest — this is trust
 * infrastructure, not a marketing banner. Do not render while the
 * dismissed flag is unknown; a brief flash of nothing is better than
 * a flash of a banner that immediately disappears.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "@/lib/api";

/** Settings key flipped to ``true`` when the user dismisses the card. */
export const NETWORK_AUDIT_DISCOVERABILITY_DISMISSED_KEY =
  "network_audit_discoverability_dismissed";

/**
 * Lifecycle:
 *
 * 1. Mount → ``fetchSettings`` (tri-state: unknown | show | hide).
 * 2. ``dismissed === true`` (server) or user clicked Dismiss → hide.
 * 3. Dismiss click → optimistic hide + ``updateSettings`` write.
 *    Write failure rolls back so the user sees the card again next
 *    load rather than a silent swallow (we prefer "tried twice" over
 *    "thought I dismissed it but didn't"). The error is not surfaced
 *    visually — this is a best-effort discoverability nudge, not a
 *    load-bearing UI.
 */
export function NetworkAuditFirstRunCard(): React.JSX.Element | null {
  // tri-state: null while fetching, true hides, false shows.
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchSettings();
        if (cancelled) return;
        const raw = settings[NETWORK_AUDIT_DISCOVERABILITY_DISMISSED_KEY];
        // Defensive: any truthy value counts as dismissed. Treat unknown
        // or falsy as "not yet dismissed" so a corrupted settings file
        // fails open (card re-appears) rather than silently hidden.
        setDismissed(raw === true);
      } catch {
        // Fetch failure → don't show the card. Showing a discoverability
        // banner that can't tell whether the user has already dismissed
        // it is worse than staying quiet.
        if (!cancelled) setDismissed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = (): void => {
    // Optimistic hide. If the write fails we put the card back so the
    // user hasn't accidentally "consumed" their dismissal — they'll see
    // it next reload and can try again.
    setDismissed(true);
    void (async () => {
      try {
        await updateSettings({
          [NETWORK_AUDIT_DISCOVERABILITY_DISMISSED_KEY]: true,
        });
      } catch {
        setDismissed(false);
      }
    })();
  };

  if (dismissed !== false) return null;

  return (
    <aside
      data-testid="network-audit-first-run-card"
      aria-label="Network audit discoverability"
      className="metis-network-audit-first-run-card"
    >
      <div className="metis-network-audit-first-run-card-body">
        <p className="metis-network-audit-first-run-card-title">
          METIS shows you every outbound call.
        </p>
        <p className="metis-network-audit-first-run-card-subtitle">
          Open the network audit to see what&apos;s leaving your machine —
          and switch any provider off.
        </p>
      </div>
      <div className="metis-network-audit-first-run-card-actions">
        <Link
          href="/settings/privacy"
          className="metis-network-audit-first-run-card-primary"
          onClick={handleDismiss}
        >
          Open audit
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss network audit discoverability card"
          className="metis-network-audit-first-run-card-dismiss"
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
