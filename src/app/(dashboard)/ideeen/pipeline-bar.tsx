"use client";

import { cn } from "@/lib/utils";
import type { Idee } from "@/hooks/queries/use-ideeen";

interface PipelineBarProps {
  ideeen: Idee[];
}

export function PipelineBar({ ideeen }: PipelineBarProps) {
  const counts = {
    idee: ideeen.filter(i => i.status === "idee" && i.categorie !== "inzicht").length,
    uitgewerkt: ideeen.filter(i => i.status === "uitgewerkt").length,
    actief: ideeen.filter(i => i.status === "actief").length,
    gebouwd: ideeen.filter(i => i.status === "gebouwd").length,
  };

  const stages = [
    { label: "Idee", count: counts.idee, color: "bg-blue-400" },
    { label: "Uitgewerkt", count: counts.uitgewerkt, color: "bg-amber-400" },
    { label: "Actief", count: counts.actief, color: "bg-autronis-accent" },
    { label: "Gebouwd", count: counts.gebouwd, color: "bg-emerald-400" },
  ];

  return (
    <div className="flex items-center gap-1 text-xs text-autronis-text-secondary">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center gap-1">
          <div className={cn("w-2 h-2 rounded-full", stage.color)} />
          <span className="tabular-nums">{stage.count}</span>
          <span className="opacity-60">{stage.label}</span>
          {i < stages.length - 1 && <span className="opacity-30 mx-0.5">→</span>}
        </div>
      ))}
    </div>
  );
}
