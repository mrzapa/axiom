"use client";

import { X, RefreshCw } from "lucide-react";

export type HudTabId = "identity" | "memory" | "skills" | "sessions" | "health";

const TABS: { id: HudTabId; label: string; key: string }[] = [
  { id: "identity", label: "Identity", key: "1" },
  { id: "memory",   label: "Memory",   key: "2" },
  { id: "skills",   label: "Skills",   key: "3" },
  { id: "sessions", label: "Sessions", key: "4" },
  { id: "health",   label: "Health",   key: "5" },
];

interface HudTopBarProps {
  activeTab: HudTabId;
  onTabChange: (tab: HudTabId) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function HudTopBar({ activeTab, onTabChange, onRefresh, onClose }: HudTopBarProps) {
  return (
    <div
      className="shrink-0 border-b"
      style={{ background: "var(--hud-bg-surface)", borderColor: "var(--hud-border)" }}
    >
      {/* Main bar */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Wordmark */}
        <span
          className="shrink-0 font-mono text-[12px] font-bold uppercase tracking-[0.3em]"
          style={{
            background: "linear-gradient(90deg, var(--hud-primary), var(--hud-accent))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          METIS HUD
        </span>

        {/* Tabs */}
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto pl-2">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className="shrink-0 rounded px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-all"
                style={{
                  background: active ? "var(--hud-primary)" : "transparent",
                  color: active ? "var(--hud-bg-deep)" : "var(--hud-text-dim)",
                  boxShadow: active ? "0 0 10px var(--hud-primary-glow)" : "none",
                }}
              >
                <span style={{ opacity: 0.55 }}>{tab.key} </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh (R)"
            className="flex size-7 items-center justify-center rounded transition-opacity hover:opacity-80"
            style={{ color: "var(--hud-text-dim)" }}
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="flex size-7 items-center justify-center rounded transition-opacity hover:opacity-80"
            style={{ color: "var(--hud-text-dim)" }}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Keyboard hint strip */}
      <div
        className="border-t px-4 py-1"
        style={{ borderColor: "var(--hud-border)", background: "var(--hud-bg-deep)" }}
      >
        <p className="font-mono text-[10px]" style={{ color: "var(--hud-text-dim)" }}>
          1–5 tabs · R refresh · Esc close
        </p>
      </div>
    </div>
  );
}

export { TABS };
