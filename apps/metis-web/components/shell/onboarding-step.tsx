"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface OnboardingStepProps {
  index: number;
  total: number;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}

export function OnboardingStep({
  index,
  title,
  description,
  children,
  className,
}: OnboardingStepProps) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.52, ease: "easeOut" }}
      className={cn("glass-panel-strong rounded-[1.8rem] p-5 sm:p-7", className)}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-primary/16 font-display text-sm font-semibold text-primary">
              {index + 1}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-foreground">
              {title}
            </h2>
            <p className="max-w-2xl text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>
        </div>
        {children}
      </div>
    </motion.section>
  );
}
