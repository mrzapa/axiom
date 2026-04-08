"use client";

import { useEffect, useRef } from "react";

// ── canvas helpers ────────────────────────────────────────────────────────────

function drawOrb(
  ctx: CanvasRenderingContext2D,
  size: number,
  t: number
): void {
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.455; // sphere radius

  // ── 1. Base sphere ──────────────────────────────────────────────────────────
  const base = ctx.createRadialGradient(
    cx - R * 0.22,
    cy - R * 0.28,
    R * 0.04,
    cx,
    cy,
    R
  );
  base.addColorStop(0.0, "#233870");
  base.addColorStop(0.35, "#0e2048");
  base.addColorStop(0.72, "#07112a");
  base.addColorStop(1.0, "#030810");

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = base;
  ctx.fill();

  // ── clip all interior drawing to the sphere ─────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // ── 2. Deep volumetric nebula wash ─────────────────────────────────────────
  const nebula = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  nebula.addColorStop(0.0, "rgba(80,160,255,0.18)");
  nebula.addColorStop(0.45, "rgba(40,100,220,0.10)");
  nebula.addColorStop(1.0, "rgba(10,40,140,0.0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, size, size);

  // ── 3. Plasma arcs (multiple rings at different radii, speeds, thickness) ───
  const arcDefs: Array<{
    phase: number;
    speed: number;
    orbitR: number; // orbit radius as fraction of R
    arcLen: number; // arc length in radians
    width: number;
    alpha: number;
    pulseFreq: number;
    colorA: string;
    colorB: string;
  }> = [
    {
      phase: 0.0,
      speed: 0.42,
      orbitR: 0.68,
      arcLen: 2.0,
      width: 2.8,
      alpha: 0.82,
      pulseFreq: 1.3,
      colorA: "rgba(60,170,255,0)",
      colorB: "rgba(160,230,255,1)",
    },
    {
      phase: 1.3,
      speed: -0.31,
      orbitR: 0.56,
      arcLen: 1.6,
      width: 2.0,
      alpha: 0.65,
      pulseFreq: 1.7,
      colorA: "rgba(80,190,255,0)",
      colorB: "rgba(200,245,255,1)",
    },
    {
      phase: 2.6,
      speed: 0.55,
      orbitR: 0.76,
      arcLen: 1.4,
      width: 2.4,
      alpha: 0.72,
      pulseFreq: 2.1,
      colorA: "rgba(100,200,255,0)",
      colorB: "rgba(180,240,255,1)",
    },
    {
      phase: 3.9,
      speed: -0.48,
      orbitR: 0.46,
      arcLen: 2.2,
      width: 1.6,
      alpha: 0.55,
      pulseFreq: 0.9,
      colorA: "rgba(40,140,220,0)",
      colorB: "rgba(140,220,255,1)",
    },
    {
      phase: 1.8,
      speed: 0.37,
      orbitR: 0.62,
      arcLen: 1.8,
      width: 1.4,
      alpha: 0.48,
      pulseFreq: 1.5,
      colorA: "rgba(60,160,240,0)",
      colorB: "rgba(160,235,255,1)",
    },
    {
      phase: 4.6,
      speed: -0.60,
      orbitR: 0.38,
      arcLen: 1.2,
      width: 1.0,
      alpha: 0.40,
      pulseFreq: 2.6,
      colorA: "rgba(30,120,200,0)",
      colorB: "rgba(120,210,255,1)",
    },
    {
      phase: 5.3,
      speed: 0.25,
      orbitR: 0.82,
      arcLen: 1.1,
      width: 1.8,
      alpha: 0.45,
      pulseFreq: 1.1,
      colorA: "rgba(50,150,240,0)",
      colorB: "rgba(190,240,255,1)",
    },
  ];

  ctx.globalCompositeOperation = "screen";

  for (const arc of arcDefs) {
    const angle = arc.phase + t * arc.speed;
    const pulse = arc.alpha * (0.6 + 0.4 * Math.sin(t * arc.pulseFreq + arc.phase));
    const r = R * arc.orbitR;

    // gradient along the arc from transparent → bright → transparent
    const startX = cx + Math.cos(angle) * r;
    const startY = cy + Math.sin(angle) * r;
    const midX = cx + Math.cos(angle + arc.arcLen * 0.5) * r;
    const midY = cy + Math.sin(angle + arc.arcLen * 0.5) * r;
    const endX = cx + Math.cos(angle + arc.arcLen) * r;
    const endY = cy + Math.sin(angle + arc.arcLen) * r;

    const grad = ctx.createLinearGradient(startX, startY, endX, endY);
    // fade in/out along the arc
    grad.addColorStop(0.0, arc.colorA);
    grad.addColorStop(0.35, arc.colorB.replace("1)", `${pulse})`));
    grad.addColorStop(0.65, arc.colorB.replace("1)", `${pulse * 0.85})`));
    grad.addColorStop(1.0, arc.colorA);

    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + arc.arcLen);
    ctx.strokeStyle = grad;
    ctx.lineWidth = arc.width;
    ctx.stroke();

    // secondary thinner brighter pass for the intensity peak
    if (pulse > 0.55) {
      const brightGrad = ctx.createLinearGradient(midX - 4, midY - 4, midX + 4, midY + 4);
      brightGrad.addColorStop(0, "rgba(240,250,255,0)");
      brightGrad.addColorStop(0.5, `rgba(255,255,255,${(pulse - 0.55) * 1.2})`);
      brightGrad.addColorStop(1, "rgba(240,250,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle + arc.arcLen * 0.3, angle + arc.arcLen * 0.7);
      ctx.strokeStyle = brightGrad;
      ctx.lineWidth = arc.width * 0.4;
      ctx.stroke();
    }
  }

  // ── 4. Inner core glow (pulsing) ───────────────────────────────────────────
  const corePulse = 0.82 + 0.18 * Math.sin(t * 2.4);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.52);
  core.addColorStop(0.0, `rgba(230,248,255,${corePulse})`);
  core.addColorStop(0.12, `rgba(160,220,255,${corePulse * 0.75})`);
  core.addColorStop(0.38, `rgba(80,160,255,${corePulse * 0.35})`);
  core.addColorStop(1.0, "rgba(30,80,220,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // ── 5. Crystal facet shimmer ───────────────────────────────────────────────
  const facets = [0.38, 1.05, 1.78, 2.55, 3.30, 4.08, 4.85, 5.60];
  for (let i = 0; i < facets.length; i++) {
    const fa = facets[i];
    const shimmer = Math.max(0, Math.sin(t * 0.75 + fa * 1.8 + i));
    if (shimmer < 0.1) continue;
    const x0 = cx + Math.cos(fa) * R * 0.1;
    const y0 = cy + Math.sin(fa) * R * 0.1;
    const x1 = cx + Math.cos(fa) * R * 0.9;
    const y1 = cy + Math.sin(fa) * R * 0.9;
    const fGrad = ctx.createLinearGradient(x0, y0, x1, y1);
    fGrad.addColorStop(0, "rgba(200,240,255,0)");
    fGrad.addColorStop(0.5, `rgba(220,248,255,${shimmer * 0.45})`);
    fGrad.addColorStop(1, "rgba(200,240,255,0)");
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = fGrad;
    ctx.lineWidth = 0.7;
    ctx.globalCompositeOperation = "screen";
    ctx.stroke();
  }

  // ── 6. Bright centre spark / white-hot point ───────────────────────────────
  const sparkR = R * (0.08 + 0.025 * Math.sin(t * 3.1));
  const spark = ctx.createRadialGradient(cx, cy, 0, cx, cy, sparkR);
  spark.addColorStop(0.0, "rgba(255,255,255,0.98)");
  spark.addColorStop(0.3, "rgba(230,248,255,0.90)");
  spark.addColorStop(0.7, "rgba(180,230,255,0.45)");
  spark.addColorStop(1.0, "rgba(140,210,255,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = spark;
  ctx.beginPath();
  ctx.arc(cx, cy, sparkR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end sphere clip

  // ── 7. Specular highlight (glass lens flare, top-left) ─────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const specX = cx - R * 0.30;
  const specY = cy - R * 0.32;
  const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, R * 0.42);
  spec.addColorStop(0.0, "rgba(255,255,255,0.82)");
  spec.addColorStop(0.25, "rgba(230,245,255,0.45)");
  spec.addColorStop(0.6, "rgba(200,235,255,0.15)");
  spec.addColorStop(1.0, "rgba(180,220,255,0)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = spec;
  ctx.fillRect(0, 0, size, size);

  // secondary smaller micro-spec
  const msX = cx - R * 0.14;
  const msY = cy - R * 0.20;
  const ms = ctx.createRadialGradient(msX, msY, 0, msX, msY, R * 0.12);
  ms.addColorStop(0, "rgba(255,255,255,0.9)");
  ms.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = ms;
  ctx.fill();
  ctx.restore();
}

// ── component ─────────────────────────────────────────────────────────────────

export default function MetisOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 72;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const t = (ts - startRef.current) / 1000;
      drawOrb(ctx, size, t);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", borderRadius: "50%" }}
      aria-hidden="true"
    />
  );
}
