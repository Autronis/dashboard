"use client";

import Link from "next/link";
import { FolderOpen, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ProjectVoortgang {
  projectId: number;
  projectNaam: string;
  totaal: number;
  afgerond: number;
}

function ProgressBar({ afgerond, totaal }: { afgerond: number; totaal: number }) {
  const pct = totaal > 0 ? Math.round((afgerond / totaal) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-autronis-border/50">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${pct === 100 ? "bg-emerald-400" : "bg-autronis-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-autronis-text-secondary tabular-nums w-12 text-right">
        {pct}%
      </span>
    </div>
  );
}

export function ProjectVoortgangWidget() {
  const { data } = useQuery({
    queryKey: ["taken", { status: "alle" }],
    queryFn: async () => {
      const res = await fetch("/api/taken");
      if (!res.ok) throw new Error();
      return res.json();
    },
    staleTime: 60_000,
  });

  const projecten: ProjectVoortgang[] = data?.projecten ?? [];

  if (projecten.length === 0) return null;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-autronis-accent" />
          <h3 className="text-base font-semibold text-autronis-text-primary">Projecten</h3>
        </div>
        <Link href="/taken" className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors flex items-center gap-1">
          Alle taken <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-4">
        {projecten.map((p) => (
          <div key={p.projectId}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-autronis-text-primary">{p.projectNaam}</span>
              <span className="text-xs text-autronis-text-secondary tabular-nums">
                {p.afgerond}/{p.totaal}
              </span>
            </div>
            <ProgressBar afgerond={p.afgerond} totaal={p.totaal} />
          </div>
        ))}
      </div>
    </div>
  );
}
