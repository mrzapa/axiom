"use client";

/**
 * SeedlingPulseWidget — ambient visual replacement for the noisy
 * "Seedling heartbeat" text log in the METIS companion overlay.
 *
 * Renders a small (~80x80px) SVG widget driven by GSAP that visualises:
 *   - the seedling tick rate (breathing pulse ring)
 *   - the lifecycle stage (outer arc fill + center glyph)
 *   - the queue depth (orbiting dots)
 *   - one-shot activity events (comet streak)
 *
 * Honours `prefers-reduced-motion` by snapping animations to static states.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import {
  Sprout,
  Leaf,
  Flower2,
  TreePine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  subscribeCompanionActivity,
  type CompanionActivityEvent,
  type SeedlingStatus,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIDGET_SIZE = 80; // px – matches the design spec
const CENTER = WIDGET_SIZE / 2;
const RING_RADIUS = 26;
const ARC_RADIUS = 34;
const ORBIT_RADIUS = 36;
const QUEUE_DOT_CAP = 5;
const DEFAULT_TICK_PERIOD_MS = 60_000; // 1 min — matches default seedling cadence
const MIN_TICK_PERIOD_MS = 1_500; // floor so the ring never thrashes

const STAGE_FRACTION: Record<SeedlingStatus["current_stage"], number> = {
  seedling: 0.25,
  sapling: 0.5,
  bloom: 0.75,
  elder: 1,
};

const STAGE_GLYPH: Record<SeedlingStatus["current_stage"], LucideIcon> = {
  seedling: Sprout,
  sapling: Leaf,
  bloom: Flower2,
  elder: TreePine,
};

const STAGE_LABEL: Record<SeedlingStatus["current_stage"], string> = {
  seedling: "Seedling",
  sapling: "Sapling",
  bloom: "Bloom",
  elder: "Elder",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTimeFrom(target: number, now: number): string {
  const deltaSec = Math.round((target - now) / 1000);
  const abs = Math.abs(deltaSec);
  // Pick a sensible unit so we don't say "in 90 seconds"
  if (abs < 60) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      deltaSec,
      "second",
    );
  }
  if (abs < 3600) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      Math.round(deltaSec / 60),
      "minute",
    );
  }
  if (abs < 86_400) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      Math.round(deltaSec / 3600),
      "hour",
    );
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round(deltaSec / 86_400),
    "day",
  );
}

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function tickPeriodFromStatus(status: SeedlingStatus | null): number {
  if (!status) return DEFAULT_TICK_PERIOD_MS;
  const last = parseIso(status.last_tick_at);
  const next = parseIso(status.next_action_at);
  if (last === null || next === null) return DEFAULT_TICK_PERIOD_MS;
  const period = next - last;
  if (!Number.isFinite(period) || period <= 0) return DEFAULT_TICK_PERIOD_MS;
  return Math.max(period, MIN_TICK_PERIOD_MS);
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  fraction: number,
): string {
  // Render a stage-fill arc starting at 12 o'clock and sweeping clockwise.
  const clamped = Math.max(0, Math.min(1, fraction));
  if (clamped <= 0) return "";
  if (clamped >= 1) {
    // Full circle — emit two semicircles so SVG renders the whole loop.
    return [
      `M ${cx} ${cy - radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}`,
      `A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}`,
    ].join(" ");
  }
  const angle = clamped * Math.PI * 2;
  const endX = cx + Math.sin(angle) * radius;
  const endY = cy - Math.cos(angle) * radius;
  const largeArc = clamped > 0.5 ? 1 : 0;
  return [
    `M ${cx} ${cy - radius}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SeedlingPulseWidgetProps {
  status: SeedlingStatus | null;
  onActivate?: () => void;
  className?: string;
}

export function SeedlingPulseWidget({
  status,
  onActivate,
  className,
}: SeedlingPulseWidgetProps) {
  const prefersReducedMotion = useReducedMotion();

  const ringRef = useRef<SVGCircleElement | null>(null);
  const orbitRef = useRef<SVGGElement | null>(null);
  const arcRef = useRef<SVGPathElement | null>(null);
  const cometRef = useRef<SVGCircleElement | null>(null);
  const glyphRef = useRef<SVGGElement | null>(null);
  const previousStageFractionRef = useRef<number>(
    status ? STAGE_FRACTION[status.current_stage] : 0,
  );

  const tickPeriodMs = tickPeriodFromStatus(status);
  const running = status?.running === true;
  const stage = status?.current_stage ?? "seedling";
  const queueDepth = status?.queue_depth ?? 0;
  const visibleQueueDots = Math.min(queueDepth, QUEUE_DOT_CAP);

  // Re-render the relative-time tooltip every 15s so "Last check 2 min ago"
  // stays fresh without requiring a parent re-render.
  const [tooltipNow, setTooltipNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTooltipNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const tooltip = useMemo(() => {
    if (!status) return "Seedling status loading";
    const last = parseIso(status.last_tick_at);
    const next = parseIso(status.next_action_at);
    const lastLabel = last !== null ? relativeTimeFrom(last, tooltipNow) : "—";
    const nextLabel = next !== null ? relativeTimeFrom(next, tooltipNow) : "—";
    const queueLabel =
      queueDepth === 1 ? "1 in queue" : `${queueDepth} in queue`;
    return `${STAGE_LABEL[stage]} · Last check ${lastLabel} · Next ${nextLabel} · ${queueLabel}`;
  }, [status, stage, queueDepth, tooltipNow]);

  // ── Pulse ring (infinite) ────────────────────────────────────────────────
  useEffect(() => {
    const el = ringRef.current;
    if (!el) return;
    if (prefersReducedMotion || !running) {
      gsap.set(el, {
        scale: 1,
        opacity: prefersReducedMotion ? 0.5 : 0.6,
        transformOrigin: "50% 50%",
      });
      return;
    }
    gsap.set(el, { scale: 1, opacity: 0.85, transformOrigin: "50% 50%" });
    const tween = gsap.to(el, {
      scale: 1.18,
      opacity: 0,
      duration: tickPeriodMs / 1000,
      ease: "power2.out",
      repeat: -1,
      transformOrigin: "50% 50%",
    });
    return () => {
      tween.kill();
    };
  }, [running, tickPeriodMs, prefersReducedMotion]);

  // ── Orbiting queue dots (infinite) ───────────────────────────────────────
  useEffect(() => {
    const el = orbitRef.current;
    if (!el) return;
    if (prefersReducedMotion) {
      gsap.set(el, { rotation: 0, transformOrigin: `${CENTER}px ${CENTER}px` });
      return;
    }
    const tween = gsap.to(el, {
      rotation: 360,
      duration: 8,
      ease: "none",
      repeat: -1,
      transformOrigin: `${CENTER}px ${CENTER}px`,
    });
    return () => {
      tween.kill();
    };
  }, [prefersReducedMotion]);

  // ── Stage arc (one-shot on stage change) ─────────────────────────────────
  useEffect(() => {
    const el = arcRef.current;
    if (!el) return;
    const target = STAGE_FRACTION[stage];
    const previous = previousStageFractionRef.current;
    if (prefersReducedMotion || target === previous) {
      el.setAttribute("d", describeArc(CENTER, CENTER, ARC_RADIUS, target));
      previousStageFractionRef.current = target;
      return;
    }
    const proxy = { f: previous };
    const tween = gsap.to(proxy, {
      f: target,
      duration: 0.9,
      ease: "power2.inOut",
      onUpdate: () => {
        el.setAttribute(
          "d",
          describeArc(CENTER, CENTER, ARC_RADIUS, proxy.f),
        );
      },
      onComplete: () => {
        previousStageFractionRef.current = target;
      },
    });
    return () => {
      tween.kill();
    };
  }, [stage, prefersReducedMotion]);

  // ── Activity-event comet streak (one-shot) ───────────────────────────────
  useEffect(() => {
    return subscribeCompanionActivity((event: CompanionActivityEvent) => {
      // Only react to "completed" events from sources we care about — running
      // events fire too often for an attention-grabbing flash.
      if (event.state !== "completed") return;
      const comet = cometRef.current;
      const glyph = glyphRef.current;
      if (prefersReducedMotion) {
        if (glyph) {
          gsap.fromTo(
            glyph,
            { opacity: 0.5 },
            { opacity: 1, duration: 0.25, ease: "power1.out" },
          );
        }
        return;
      }
      if (!comet) return;
      // Reset and run: enter from upper-right edge, glide to center, vanish.
      gsap.set(comet, {
        attr: { cx: CENTER + 30, cy: CENTER - 30, r: 0 },
        opacity: 1,
      });
      const tl = gsap.timeline();
      tl.to(comet, {
        attr: { cx: CENTER, cy: CENTER, r: 3 },
        duration: 0.55,
        ease: "power2.in",
      })
        .to(
          comet,
          {
            opacity: 0,
            attr: { r: 6 },
            duration: 0.25,
            ease: "power2.out",
          },
          ">-0.05",
        );
      if (glyph) {
        gsap.fromTo(
          glyph,
          { scale: 1 },
          {
            scale: 1.18,
            duration: 0.25,
            ease: "power2.out",
            yoyo: true,
            repeat: 1,
            transformOrigin: `${CENTER}px ${CENTER}px`,
          },
        );
      }
    });
  }, [prefersReducedMotion]);

  // ── Render ───────────────────────────────────────────────────────────────
  const StageGlyph = STAGE_GLYPH[stage];
  const queueAngles = Array.from({ length: visibleQueueDots }, (_, i) =>
    (i / Math.max(visibleQueueDots, 1)) * Math.PI * 2,
  );
  const initialArcD = describeArc(
    CENTER,
    CENTER,
    ARC_RADIUS,
    STAGE_FRACTION[stage],
  );

  return (
    <button
      type="button"
      onClick={onActivate}
      title={tooltip}
      aria-label={tooltip}
      data-testid="seedling-pulse-widget"
      data-stage={stage}
      data-running={running ? "true" : "false"}
      className={cn(
        "group relative inline-flex shrink-0 items-center justify-center rounded-full",
        "bg-transparent p-0 outline-none transition-transform",
        "focus-visible:ring-2 focus-visible:ring-amber-300/60",
        "hover:scale-[1.03]",
        className,
      )}
      style={{ width: WIDGET_SIZE, height: WIDGET_SIZE }}
    >
      <svg
        width={WIDGET_SIZE}
        height={WIDGET_SIZE}
        viewBox={`0 0 ${WIDGET_SIZE} ${WIDGET_SIZE}`}
        aria-hidden="true"
        role="img"
      >
        <defs>
          <radialGradient id="seedling-pulse-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252, 211, 77, 0.55)" />
            <stop offset="60%" stopColor="rgba(252, 211, 77, 0.18)" />
            <stop offset="100%" stopColor="rgba(252, 211, 77, 0)" />
          </radialGradient>
          <linearGradient id="seedling-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Soft static glow behind everything */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS + 8}
          fill="url(#seedling-pulse-glow)"
        />

        {/* Stage arc (one-shot tween on advance) */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={ARC_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={2}
        />
        <path
          ref={arcRef}
          d={initialArcD}
          fill="none"
          stroke="url(#seedling-arc)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Pulse ring (infinite breathing tween) */}
        <circle
          ref={ringRef}
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(252, 211, 77, 0.85)"
          strokeWidth={1.5}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />

        {/* Queue depth orbit (rotating group of dots) */}
        <g ref={orbitRef}>
          {queueAngles.map((angle, i) => {
            const x = CENTER + Math.sin(angle) * ORBIT_RADIUS;
            const y = CENTER - Math.cos(angle) * ORBIT_RADIUS;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2.5}
                fill="rgba(125, 211, 252, 0.85)"
              />
            );
          })}
        </g>

        {/* Comet streak (hidden until an event fires) */}
        <circle
          ref={cometRef}
          cx={CENTER}
          cy={CENTER}
          r={0}
          fill="rgba(253, 224, 71, 0.95)"
          opacity={0}
        />

        {/* Center glyph (Lucide icon) — wrapped in <g> for GSAP scale */}
        <g
          ref={glyphRef}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        >
          <foreignObject
            x={CENTER - 10}
            y={CENTER - 10}
            width={20}
            height={20}
          >
            <span
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "rgb(253, 230, 138)",
              }}
            >
              <StageGlyph size={18} aria-hidden="true" />
            </span>
          </foreignObject>
        </g>
      </svg>
    </button>
  );
}

export default SeedlingPulseWidget;
