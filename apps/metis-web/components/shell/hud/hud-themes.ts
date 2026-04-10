export interface HudTheme {
  id: string;
  label: string;
  /** Hex color shown in the theme swatch picker */
  swatch: string;
  /** CSS custom properties applied to the HUD root element */
  vars: Record<string, string>;
}

export const HUD_THEMES: HudTheme[] = [
  {
    id: "neural",
    label: "Neural Awakening",
    swatch: "#00d4ff",
    vars: {
      "--hud-bg-deep": "#0a0a12",
      "--hud-bg-surface": "#0e1020",
      "--hud-bg-panel": "#141830",
      "--hud-bg-hover": "#1e2545",
      "--hud-primary": "#00d4ff",
      "--hud-primary-dim": "#007a99",
      "--hud-primary-glow": "rgba(0,212,255,0.25)",
      "--hud-secondary": "#7c3aed",
      "--hud-accent": "#ffd700",
      "--hud-text": "#e2e8f0",
      "--hud-text-dim": "#64748b",
      "--hud-border": "rgba(0,212,255,0.18)",
      "--hud-border-hover": "rgba(0,212,255,0.45)",
      "--hud-success": "#00ff88",
      "--hud-warning": "#ffaa00",
      "--hud-error": "#ff4444",
    },
  },
  {
    id: "bladerunner",
    label: "Blade Runner",
    swatch: "#ffaf00",
    vars: {
      "--hud-bg-deep": "#0d0800",
      "--hud-bg-surface": "#160f00",
      "--hud-bg-panel": "#1f1500",
      "--hud-bg-hover": "#2e1e00",
      "--hud-primary": "#ffaf00",
      "--hud-primary-dim": "#8a5f00",
      "--hud-primary-glow": "rgba(255,175,0,0.25)",
      "--hud-secondary": "#ff0087",
      "--hud-accent": "#ff6600",
      "--hud-text": "#f5e6c8",
      "--hud-text-dim": "#7a6040",
      "--hud-border": "rgba(255,175,0,0.18)",
      "--hud-border-hover": "rgba(255,175,0,0.45)",
      "--hud-success": "#80ff00",
      "--hud-warning": "#ff6600",
      "--hud-error": "#ff2200",
    },
  },
  {
    id: "fsociety",
    label: "fsociety",
    swatch: "#00ff00",
    vars: {
      "--hud-bg-deep": "#000000",
      "--hud-bg-surface": "#030303",
      "--hud-bg-panel": "#080808",
      "--hud-bg-hover": "#0f0f0f",
      "--hud-primary": "#00ff00",
      "--hud-primary-dim": "#008800",
      "--hud-primary-glow": "rgba(0,255,0,0.20)",
      "--hud-secondary": "#ffff00",
      "--hud-accent": "#00ffaa",
      "--hud-text": "#c0c0c0",
      "--hud-text-dim": "#555555",
      "--hud-border": "rgba(0,255,0,0.18)",
      "--hud-border-hover": "rgba(0,255,0,0.45)",
      "--hud-success": "#00ff00",
      "--hud-warning": "#ffff00",
      "--hud-error": "#ff0000",
    },
  },
  {
    id: "anime",
    label: "Anime",
    swatch: "#af5fff",
    vars: {
      "--hud-bg-deep": "#08001a",
      "--hud-bg-surface": "#10002e",
      "--hud-bg-panel": "#180042",
      "--hud-bg-hover": "#220060",
      "--hud-primary": "#af5fff",
      "--hud-primary-dim": "#6a1fa8",
      "--hud-primary-glow": "rgba(175,95,255,0.25)",
      "--hud-secondary": "#ff5fff",
      "--hud-accent": "#00d4ff",
      "--hud-text": "#e8d0ff",
      "--hud-text-dim": "#6b4d8a",
      "--hud-border": "rgba(175,95,255,0.18)",
      "--hud-border-hover": "rgba(175,95,255,0.45)",
      "--hud-success": "#00ff88",
      "--hud-warning": "#ffaa00",
      "--hud-error": "#ff4466",
    },
  },
];

export const DEFAULT_HUD_THEME_ID = "neural";
