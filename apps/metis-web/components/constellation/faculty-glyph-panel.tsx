"use client";

import Image from "next/image";
import { Orbit, Sparkles } from "lucide-react";
import { getFacultyColor, type ConstellationFacultyMetadata } from "@/lib/constellation-home";
import { getFacultyArtDefinition } from "@/lib/constellation-faculty-art";

interface FacultyGlyphPanelProps {
  faculty: ConstellationFacultyMetadata | null;
}

export function FacultyGlyphPanel({ faculty }: FacultyGlyphPanelProps) {
  if (!faculty) {
    return null;
  }

  const art = getFacultyArtDefinition(faculty.id);
  if (!art) {
    return null;
  }

  const [r, g, b] = getFacultyColor(faculty.id);

  return (
    <div
      className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-[linear-gradient(160deg,rgba(13,19,33,0.92),rgba(8,11,20,0.94))] px-5 py-5 shadow-[0_20px_70px_rgba(3,8,19,0.55)]"
      style={{
        boxShadow: `0 24px 80px rgba(${r}, ${g}, ${b}, 0.12)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(circle at 18% 22%, rgba(${r}, ${g}, ${b}, 0.2), transparent 42%),
            radial-gradient(circle at 82% 18%, rgba(247, 196, 108, 0.16), transparent 30%),
            radial-gradient(circle at 50% 100%, rgba(${r}, ${g}, ${b}, 0.11), transparent 38%)`,
        }}
      />
      <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
      <div className="absolute inset-x-8 bottom-6 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div
        className="absolute -left-10 top-8 size-36 rounded-full blur-3xl"
        style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)` }}
      />
      <div className="absolute -right-12 bottom-2 size-32 rounded-full bg-[#f1c46a]/10 blur-3xl" />

      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(220px,0.85fr)] lg:items-center">
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#d6b361]"
            title="The category symbol for this star (Knowledge / Memory / Reasoning…)"
          >
            <Sparkles className="size-3.5" />
            Faculty sigil
          </div>
          <div>
            <h3 className="font-display text-[1.65rem] font-semibold tracking-[-0.05em] text-white">
              {faculty.label}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-300">
              {faculty.description}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-400">
            <Orbit className="size-3.5" />
            Celestial faculty imprint
          </div>
        </div>

        <div className="relative h-[240px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_45%,rgba(255,255,255,0.02)_100%)]">
          <div className="absolute inset-5 rounded-[1.35rem] border border-white/8" />
          <div className="absolute inset-x-10 top-7 bottom-7 rounded-full border border-white/8 opacity-70" />
          <div
            className="absolute left-1/2 top-1/2 h-[78%] w-[78%] rounded-full blur-3xl"
            style={{
              background: `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.22), transparent 72%)`,
              transform: "translate(-50%, -50%)",
            }}
          />
          <Image
            src={art.src}
            alt=""
            aria-hidden="true"
            width={2048}
            height={2048}
            className="absolute left-1/2 top-1/2 h-[90%] w-auto max-w-[84%] object-contain opacity-[0.94] drop-shadow-[0_0_32px_rgba(162,223,255,0.24)]"
            style={{
              top: `${50 + art.dialogOffsetY * 100}%`,
              transform: `translate(-50%, -50%) scale(${art.dialogScale})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
