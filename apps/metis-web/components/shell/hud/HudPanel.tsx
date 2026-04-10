"use client";

import type { ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface HudPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
  /** Stretch to fill the remaining column space */
  fullHeight?: boolean;
}

export function HudPanel({ title, children, className, fullHeight }: HudPanelProps) {
  return (
    <div
      className={cn(
        "rounded-sm border-l-2 p-3 transition-shadow",
        fullHeight && "flex flex-col",
        className,
      )}
      style={{
        background: "var(--hud-bg-panel)",
        borderColor: "var(--hud-primary)",
        boxShadow: "0 0 0 1px var(--hud-border)",
      }}
      onMouseEnter={(e: MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow =
          "0 0 12px var(--hud-primary-glow), 0 0 0 1px var(--hud-border-hover)";
      }}
      onMouseLeave={(e: MouseEvent<HTMLDivElement>) => {
        e.currentTarget.style.boxShadow = "0 0 0 1px var(--hud-border)";
      }}
    >
      <p
        className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em]"
        style={{ color: "var(--hud-primary)" }}
      >
        {title}
      </p>
      <div className={cn(fullHeight && "flex-1 overflow-auto")}>{children}</div>
    </div>
  );
}

/** A single stat displayed as a large number with a small label */
export function HudStat({
  value,
  label,
  accent,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[22px] font-bold leading-none tabular-nums"
        style={{ color: accent ? "var(--hud-accent)" : "var(--hud-primary)" }}
      >
        {value}
      </span>
      <span
        className="text-[11px] uppercase tracking-[0.15em]"
        style={{ color: "var(--hud-text-dim)" }}
      >
        {label}
      </span>
    </div>
  );
}

/** A horizontal progress bar */
export function HudBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color =
    pct >= 90
      ? "var(--hud-error)"
      : pct >= 70
        ? "var(--hud-warning)"
        : "var(--hud-success)";

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--hud-text-dim)" }}>
            {label}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--hud-text-dim)" }}>
            {value} / {max}
          </span>
        </div>
      )}
      <div className="h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--hud-bg-hover)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
