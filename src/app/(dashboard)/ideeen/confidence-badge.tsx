"use client";

import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ConfidenceBadge({ score, size = "md", showLabel = false }: ConfidenceBadgeProps) {
  if (score === null) return null;

  const kleur = score >= 60 ? "text-emerald-400 bg-emerald-400/15 border-emerald-400/30"
    : score >= 30 ? "text-amber-400 bg-amber-400/15 border-amber-400/30"
    : "text-red-400 bg-red-400/15 border-red-400/30";

  const sizes = {
    sm: "text-xs px-1.5 py-0.5 min-w-[28px]",
    md: "text-sm px-2 py-1 min-w-[36px]",
    lg: "text-lg px-3 py-1.5 min-w-[44px] font-bold",
  };

  return (
    <span className={cn("inline-flex items-center justify-center rounded-lg border font-semibold tabular-nums", kleur, sizes[size])}>
      {score}
      {showLabel && <span className="ml-1 font-normal opacity-70 text-[0.75em]">confidence</span>}
    </span>
  );
}
