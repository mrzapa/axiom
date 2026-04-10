"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchSessions } from "@/lib/api";
import type { AssistantSnapshot, CompanionActivityEvent, SessionSummary } from "@/lib/api";
import { HUD_THEMES, DEFAULT_HUD_THEME_ID, type HudTheme } from "./hud-themes";
import { HudTopBar, type HudTabId } from "./HudTopBar";
import { IdentityPanel } from "./panels/IdentityPanel";
import { MemoryPanel } from "./panels/MemoryPanel";
import { SkillsPanel } from "./panels/SkillsPanel";
import { SessionsPanel as HudSessionsPanel } from "./panels/SessionsPanel";
import { HealthPanel } from "./panels/HealthPanel";

interface HermesHudProps {
  snapshot: AssistantSnapshot | null;
  thoughtLog: CompanionActivityEvent[];
  sessionId?: string | null;
  onClose: () => void;
}

const STORAGE_THEME_KEY = "metis:hud-theme";
const STORAGE_BOOTED_KEY = "hud-booted";

export function HermesHud({ snapshot, thoughtLog, sessionId, onClose }: HermesHudProps) {
  const [themeId, setThemeId] = useState<string>(
    () => (typeof localStorage !== "undefined" ? (localStorage.getItem(STORAGE_THEME_KEY) ?? DEFAULT_HUD_THEME_ID) : DEFAULT_HUD_THEME_ID),
  );
  const [activeTab, setActiveTab] = useState<HudTabId>("identity");
  const [scanlines, setScanlines] = useState(false);
  const [booted, setBooted] = useState(() => {
    if (typeof sessionStorage === "undefined") return true;
    return sessionStorage.getItem(STORAGE_BOOTED_KEY) === "true";
  });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const theme: HudTheme = HUD_THEMES.find((t) => t.id === themeId) ?? HUD_THEMES[0];

  // Boot animation
  useEffect(() => {
    if (!booted) {
      const t = setTimeout(() => {
        setBooted(true);
        sessionStorage.setItem(STORAGE_BOOTED_KEY, "true");
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [booted]);

  // Load sessions
  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [refreshTick]);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const tabKeys: Record<string, HudTabId> = {
        "1": "identity",
        "2": "memory",
        "3": "skills",
        "4": "sessions",
        "5": "health",
      };
      if (tabKeys[e.key]) {
        setActiveTab(tabKeys[e.key]);
        return;
      }
      if (e.key === "r" || e.key === "R") {
        setRefreshTick((n: number) => n + 1);
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleThemeChange = useCallback((id: string) => {
    setThemeId(id);
    localStorage.setItem(STORAGE_THEME_KEY, id);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshTick((n: number) => n + 1);
  }, []);

  // Apply CSS vars to root
  const cssVars = Object.entries(theme.vars).reduce<Record<string, string>>(
    (acc, [k, v]) => {
      acc[k] = v;
      return acc;
    },
    {},
  );

  const overlay = (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[9998] flex flex-col font-mono"
      style={{
        ...(cssVars as Record<string, string>),
        background: "var(--hud-bg-deep)",
        color: "var(--hud-text)",
      }}
    >
      {/* CRT Scanlines overlay */}
      {scanlines && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(transparent 0px, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)",
          }}
        />
      )}

      {!booted ? (
        <BootScreen theme={theme} />
      ) : (
        <>
          <HudTopBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            activeTheme={theme}
            onThemeChange={handleThemeChange}
            scanlines={scanlines}
            onScanlines={setScanlines}
            onRefresh={handleRefresh}
            onClose={onClose}
          />

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <TabContent
              tab={activeTab}
              snapshot={snapshot}
              thoughtLog={thoughtLog}
              sessions={sessions}
              sessionId={sessionId}
              refreshTick={refreshTick}
            />
          </div>
        </>
      )}
    </div>
  );

  // Portal to document.body so it sits above everything
  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

// ── Boot screen ──────────────────────────────────────────────────────────────

function BootScreen({ theme }: { theme: HudTheme }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => setDots((d: string) => (d.length >= 3 ? "" : d + ".")), 300);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p
          className="font-mono text-[40px] font-bold tracking-[0.3em]"
          style={{
            background: `linear-gradient(90deg, ${theme.vars["--hud-primary"]}, ${theme.vars["--hud-accent"]})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          METIS HUD
        </p>
        <p
          className="mt-2 font-mono text-[14px] tracking-[0.2em]"
          style={{ color: theme.vars["--hud-text-dim"] }}
        >
          INITIALISING{dots}
        </p>
      </div>

      <div
        className="h-[2px] w-48 overflow-hidden rounded-full"
        style={{ background: theme.vars["--hud-bg-hover"] }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: theme.vars["--hud-primary"],
            animation: "hud-boot-bar 1.3s ease-in-out forwards",
          }}
        />
      </div>

      <style>{`
        @keyframes hud-boot-bar {
          from { width: 0% }
          to   { width: 100% }
        }
      `}</style>
    </div>
  );
}

// ── Tab content router ────────────────────────────────────────────────────────

interface TabContentProps {
  tab: HudTabId;
  snapshot: AssistantSnapshot | null;
  thoughtLog: CompanionActivityEvent[];
  sessions: SessionSummary[];
  sessionId?: string | null;
  refreshTick: number;
}

function TabContent({ tab, snapshot, thoughtLog, sessions, sessionId }: TabContentProps) {
  switch (tab) {
    case "identity":
      return (
        <IdentityPanel
          snapshot={snapshot}
          sessions={sessions}
          thoughtLog={thoughtLog}
          sessionId={sessionId}
        />
      );
    case "memory":
      return <MemoryPanel snapshot={snapshot} />;
    case "skills":
      return <SkillsPanel snapshot={snapshot} />;
    case "sessions":
      return <HudSessionsPanel sessions={sessions} currentSessionId={sessionId} />;
    case "health":
      return <HealthPanel snapshot={snapshot} />;
    default:
      return null;
  }
}
