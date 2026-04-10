"use client";

import { useState } from "react";
import { X, RefreshCw } from "lucide-react";
import { HUD_THEMES, type HudTheme } from "./hud-themes";

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
  activeTheme: HudTheme;
  onThemeChange: (id: string) => void;
  scanlines: boolean;
  onScanlines: (v: boolean) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function HudTopBar({
  activeTab,
  onTabChange,
  activeTheme,
  onThemeChange,
  scanlines,
  onScanlines,
  onRefresh,
  onClose,
}: HudTopBarProps) {
  const [showThemePicker, setShowThemePicker] = useState(false);

  return (
    <div
      className="shrink-0 border-b"
      style={{ background: "var(--hud-bg-surface)", borderColor: "var(--hud-border)" }}
    >
      {/* Main bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Wordmark */}
        <span
          className="shrink-0 font-mono text-[13px] font-bold uppercase tracking-[0.25em]"
          style={{
            background: "linear-gradient(90deg, var(--hud-primary), var(--hud-accent))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          METIS HUD
        </span>

        {/* Tabs */}
        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto pl-4">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className="shrink-0 rounded px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.15em] transition-all"
                style={{
                  background: active ? "var(--hud-primary)" : "transparent",
                  color: active ? "var(--hud-bg-deep)" : "var(--hud-text-dim)",
                  boxShadow: active ? "0 0 8px var(--hud-primary-glow)" : "none",
                }}
              >
                <span style={{ color: active ? "var(--hud-bg-deep)" : "var(--hud-primary-dim)" }}>
                  {tab.key}
                </span>{" "}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {/* Theme picker trigger */}
          <button
            type="button"
            onClick={() => setShowThemePicker((v: boolean) => !v)}
            title="Theme picker (T)"
            className="flex size-7 items-center justify-center rounded transition-colors"
            style={{
              background: showThemePicker ? "var(--hud-bg-hover)" : "transparent",
              color: "var(--hud-primary)",
            }}
          >
            <span className="text-[14px]">◆</span>
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh (R)"
            className="flex size-7 items-center justify-center rounded transition-colors"
            style={{ color: "var(--hud-text-dim)" }}
          >
            <RefreshCw className="size-3.5" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="flex size-7 items-center justify-center rounded transition-colors"
            style={{ color: "var(--hud-text-dim)" }}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Theme picker dropdown */}
      {showThemePicker && (
        <div
          className="border-t px-3 py-2"
          style={{ borderColor: "var(--hud-border)", background: "var(--hud-bg-panel)" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--hud-text-dim)" }}>
              Theme
            </span>
            {HUD_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onThemeChange(theme.id);
                  setShowThemePicker(false);
                }}
                title={theme.label}
                className="flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[11px] transition-colors"
                style={{
                  background:
                    activeTheme.id === theme.id ? "var(--hud-bg-hover)" : "transparent",
                  color:
                    activeTheme.id === theme.id ? "var(--hud-primary)" : "var(--hud-text-dim)",
                  outline:
                    activeTheme.id === theme.id ? "1px solid var(--hud-primary)" : "none",
                }}
              >
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: theme.swatch }}
                />
                {theme.label}
              </button>
            ))}

            {/* Scanlines toggle */}
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--hud-text-dim)" }}>
                Scanlines
              </span>
              <button
                type="button"
                onClick={() => onScanlines(!scanlines)}
                className="h-4 w-8 rounded-full transition-colors"
                style={{
                  background: scanlines ? "var(--hud-primary)" : "var(--hud-bg-hover)",
                  boxShadow: scanlines ? "0 0 6px var(--hud-primary-glow)" : "none",
                }}
              >
                <span
                  className="block size-3 rounded-full transition-transform"
                  style={{
                    background: "var(--hud-text)",
                    transform: scanlines ? "translateX(18px)" : "translateX(2px)",
                    marginTop: "2px",
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div
        className="border-t px-3 py-1"
        style={{ borderColor: "var(--hud-border)", background: "var(--hud-bg-deep)" }}
      >
        <p className="font-mono text-[10px]" style={{ color: "var(--hud-text-dim)" }}>
          Ctrl+K command palette · 1–5 tabs · T theme · R refresh · Esc close
        </p>
      </div>
    </div>
  );
}

export { TABS };
