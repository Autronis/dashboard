"use client";

import { Linkedin, MapPin, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type LeadSource = "linkedin" | "google_maps" | "google maps" | "website" | string | null;

function normalizeSource(source: LeadSource): "linkedin" | "google_maps" | "website" | "other" {
  if (!source) return "other";
  if (source === "google_maps" || source === "google maps") return "google_maps";
  if (source === "linkedin") return "linkedin";
  if (source === "website") return "website";
  return "other";
}

interface SourceBadgeProps {
  source: LeadSource;
  compact?: boolean;
  className?: string;
}

export function SourceBadge({ source, compact = false, className }: SourceBadgeProps) {
  const kind = normalizeSource(source);

  const CONFIG = {
    linkedin:    { label: compact ? "LI"   : "LinkedIn",  icon: Linkedin, cls: "bg-blue-500/15 text-blue-300 ring-blue-500/20" },
    google_maps: { label: compact ? "Maps" : "Maps",      icon: MapPin,   cls: "bg-autronis-accent/15 text-autronis-accent ring-autronis-accent/20" },
    website:     { label: compact ? "Web"  : "Website",   icon: Globe,    cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20" },
    other:       { label: compact ? "?"    : source ?? "onbekend", icon: Globe, cls: "bg-autronis-border/50 text-autronis-text-secondary ring-autronis-border" },
  } as const;

  const c = CONFIG[kind];
  const Icon = c.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider rounded-full ring-1 ring-inset",
        compact ? "text-[9px] px-2 py-0.5" : "text-[10px] px-2.5 py-1",
        c.cls,
        className
      )}
    >
      <Icon className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {c.label}
    </span>
  );
}
