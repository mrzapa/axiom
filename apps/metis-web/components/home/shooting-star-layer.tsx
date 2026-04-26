"use client";

/**
 * ShootingStarLayer — ambient shooting stars across the cosmos backdrop.
 *
 * Self-contained 2D canvas mounted above the WebGL starfield and below
 * the user-content canvas. Spawns 0–3 simultaneous streaks at random
 * intervals, each streak a head + fading tail traversing the viewport
 * diagonal. Honours `prefers-reduced-motion` (renders nothing).
 *
 * Why this lives outside the page-level RAF:
 *   - Keeps page.tsx untouched. The mega-component is hard to evolve.
 *   - One canvas, ~150 LOC, easy to delete or replace later.
 *   - Lifecycle pauses with document visibility.
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface ShootingStar {
  /** Spawn timestamp (performance.now) */
  spawnedAt: number;
  /** Total flight duration in ms */
  durationMs: number;
  /** Start point (CSS px) */
  x0: number;
  y0: number;
  /** End point (CSS px) */
  x1: number;
  y1: number;
  /** Tail length in CSS px */
  tailLength: number;
  /** Peak brightness 0..1 */
  brightness: number;
  /** RGB colour (warm-white, palette varies subtly per spawn) */
  rgb: [number, number, number];
}

const MAX_ACTIVE = 3;
const MIN_GAP_MS = 7_000;
const MAX_GAP_MS = 26_000;
const MIN_FLIGHT_MS = 900;
const MAX_FLIGHT_MS = 1_700;

/** Smooth ease-in-out curve identical in shape to GSAP's `power3.inOut`. */
function easeInOutCubic(t: number): number {
  if (t < 0.5) return 4 * t * t * t;
  const f = 2 * t - 2;
  return 1 + (f * f * f) / 2;
}

/** Brightness envelope — quick rise, steady mid, slow fade. */
function envelope(progress: number): number {
  if (progress < 0.18) return progress / 0.18; // attack
  if (progress > 0.7) return Math.max(0, 1 - (progress - 0.7) / 0.3); // release
  return 1;
}

function pickWarmWhite(): [number, number, number] {
  const r = 235 + Math.floor(Math.random() * 20);
  const g = 220 + Math.floor(Math.random() * 25);
  const b = 200 + Math.floor(Math.random() * 35);
  return [r, g, b];
}

function spawnStar(width: number, height: number): ShootingStar {
  // Always cross the visible area. Pick a random angle that gives a
  // diagonal streak (not pure-horizontal or pure-vertical, which look
  // cheap). 25° to 75° from horizontal, randomly mirrored.
  const angleDeg = 25 + Math.random() * 50;
  const angleRad = (angleDeg * Math.PI) / 180;
  const flipX = Math.random() < 0.5 ? 1 : -1;
  const flipY = Math.random() < 0.5 ? 1 : -1;

  const span = Math.hypot(width, height) * 1.3;
  const cx = width * (0.2 + Math.random() * 0.6);
  const cy = height * (0.2 + Math.random() * 0.6);

  const dx = (Math.cos(angleRad) * span * flipX) / 2;
  const dy = (Math.sin(angleRad) * span * flipY) / 2;

  return {
    spawnedAt: performance.now(),
    durationMs: MIN_FLIGHT_MS + Math.random() * (MAX_FLIGHT_MS - MIN_FLIGHT_MS),
    x0: cx - dx,
    y0: cy - dy,
    x1: cx + dx,
    y1: cy + dy,
    tailLength: 60 + Math.random() * 90,
    brightness: 0.55 + Math.random() * 0.4,
    rgb: pickWarmWhite(),
  };
}

export interface ShootingStarLayerProps {
  className?: string;
}

export function ShootingStarLayer({ className }: ShootingStarLayerProps) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const stars: ShootingStar[] = [];
    let nextSpawnAt = performance.now() + MIN_GAP_MS + Math.random() * MAX_GAP_MS;

    // Resize the backing buffer to match the CSS box × DPR.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      // JSDOM's canvas mock lacks setTransform; guard so unit tests of
      // pages that mount this layer don't blow up.
      if (typeof ctx.setTransform === "function") {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : null;
    ro?.observe(canvas);

    const tick = (nowMs: number) => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        // Pause visually but keep the loop alive so we resume cleanly.
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        requestAnimationFrame(tick);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Spawn check.
      if (stars.length < MAX_ACTIVE && nowMs >= nextSpawnAt) {
        stars.push(spawnStar(rect.width, rect.height));
        nextSpawnAt =
          nowMs + MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
      }

      // Render + cull.
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        const progress = (nowMs - s.spawnedAt) / s.durationMs;
        if (progress >= 1) {
          stars.splice(i, 1);
          continue;
        }
        const eased = easeInOutCubic(progress);
        const env = envelope(progress) * s.brightness;
        const headX = s.x0 + (s.x1 - s.x0) * eased;
        const headY = s.y0 + (s.y1 - s.y0) * eased;
        const dx = s.x1 - s.x0;
        const dy = s.y1 - s.y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len;
        const ny = dy / len;
        const tailX = headX - nx * s.tailLength;
        const tailY = headY - ny * s.tailLength;

        // Tail gradient — head bright, tail transparent.
        const grad = ctx.createLinearGradient(headX, headY, tailX, tailY);
        const [r, g, b] = s.rgb;
        grad.addColorStop(0, `rgba(${r},${g},${b},${env * 0.95})`);
        grad.addColorStop(0.4, `rgba(${r},${g},${b},${env * 0.32})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(headX, headY);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Bright head.
        const headGrad = ctx.createRadialGradient(
          headX,
          headY,
          0,
          headX,
          headY,
          5,
        );
        headGrad.addColorStop(0, `rgba(255,255,255,${env})`);
        headGrad.addColorStop(0.5, `rgba(${r},${g},${b},${env * 0.55})`);
        headGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(headX, headY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="shooting-star-layer"
      // Canvas is a replaced element so `inset-0` alone won't stretch it.
      // Force the CSS box to the viewport explicitly.
      className={cn(
        "pointer-events-none fixed left-0 top-0 block h-screen w-screen",
        className,
      )}
      aria-hidden="true"
    />
  );
}
