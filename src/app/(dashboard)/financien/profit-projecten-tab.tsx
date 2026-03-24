"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Clock, Euro, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useProfitPerProject, type ProfitProject } from "@/hooks/queries/use-profit-projecten";
import { AnimatedNumber } from "@/components/ui/animated-number";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  actief: { label: "Actief", color: "text-green-400", bg: "bg-green-500/15" },
  afgerond: { label: "Afgerond", color: "text-blue-400", bg: "bg-blue-500/15" },
  "on-hold": { label: "On hold", color: "text-orange-400", bg: "bg-orange-500/15" },
};

function MargeBar({ marge }: { marge: number | null }) {
  if (marge === null) return <span className="text-xs text-autronis-text-secondary/50">—</span>;
  const clamped = Math.max(-100, Math.min(100, marge));
  const isPositief = clamped >= 0;
  const breedte = Math.abs(clamped);

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isPositief ? "bg-green-400" : "bg-red-400")}
          style={{ width: `${breedte}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium tabular-nums w-10 text-right", isPositief ? "text-green-400" : "text-red-400")}>
        {marge > 0 ? "+" : ""}{marge.toFixed(0)}%
      </span>
    </div>
  );
}

function ProjectRij({ project }: { project: ProfitProject }) {
  const [open, setOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[project.status ?? "actief"] ?? STATUS_CONFIG.actief;
  const isPositief = project.profit >= 0;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-xl overflow-hidden transition-colors hover:border-autronis-accent/30">
      {/* Hoofd rij */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left"
      >
        {/* Profit indicator */}
        <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", isPositief ? "bg-green-400" : "bg-red-400")} />

        {/* Naam + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-autronis-text-primary truncate">{project.naam}</p>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", statusCfg.bg, statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
          {project.klantNaam && (
            <p className="text-xs text-autronis-text-secondary mt-0.5">{project.klantNaam}</p>
          )}
        </div>

        {/* Marge bar */}
        <div className="hidden md:flex items-center w-36">
          <MargeBar marge={project.marge} />
        </div>

        {/* Omzet */}
        <div className="text-right flex-shrink-0 w-24 hidden sm:block">
          <p className="text-xs text-autronis-text-secondary">Omzet</p>
          <p className="text-sm font-medium text-autronis-text-primary tabular-nums">{formatBedrag(project.omzet)}</p>
        </div>

        {/* Kosten */}
        <div className="text-right flex-shrink-0 w-24 hidden lg:block">
          <p className="text-xs text-autronis-text-secondary">Kosten</p>
          <p className="text-sm font-medium text-autronis-text-primary tabular-nums">{formatBedrag(project.kostenUren)}</p>
        </div>

        {/* Profit */}
        <div className="text-right flex-shrink-0 w-24">
          <p className="text-xs text-autronis-text-secondary">Profit</p>
          <p className={cn("text-sm font-bold tabular-nums", isPositief ? "text-green-400" : "text-red-400")}>
            {project.profit > 0 ? "+" : ""}{formatBedrag(project.profit)}
          </p>
        </div>

        {/* Expand */}
        <div className="flex-shrink-0 text-autronis-text-secondary">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Detail */}
      {open && (
        <div className="border-t border-autronis-border/50 px-4 py-3 bg-autronis-bg/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-autronis-text-secondary">Omzet (betaald)</p>
              <p className="text-sm font-semibold text-autronis-text-primary mt-0.5">{formatBedrag(project.omzet)}</p>
            </div>
            <div>
              <p className="text-xs text-autronis-text-secondary">Uren gewerkt</p>
              <p className="text-sm font-semibold text-autronis-text-primary mt-0.5">
                {project.uren}u
                {project.geschatteUren && (
                  <span className="text-xs text-autronis-text-secondary ml-1">/ {project.geschatteUren}u gepland</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-autronis-text-secondary">Uurtarief</p>
              <p className="text-sm font-semibold text-autronis-text-primary mt-0.5">€{project.uurtarief}/u</p>
            </div>
            <div>
              <p className="text-xs text-autronis-text-secondary">Winstmarge</p>
              <p className={cn("text-sm font-semibold mt-0.5", isPositief ? "text-green-400" : "text-red-400")}>
                {project.marge !== null ? `${project.marge}%` : "Geen omzet"}
              </p>
            </div>
          </div>
          {project.voortgang !== null && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-autronis-text-secondary">Voortgang</p>
                <p className="text-xs text-autronis-text-secondary">{project.voortgang}%</p>
              </div>
              <div className="h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-autronis-accent rounded-full"
                  style={{ width: `${project.voortgang}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProfitProjectenTab() {
  const { data, isLoading } = useProfitPerProject();
  const [sorteer, setSorteer] = useState<"profit" | "omzet" | "marge">("profit");

  const projecten = data?.projecten ?? [];
  const totalen = data?.totalen;

  const gesorteerd = [...projecten].sort((a, b) => {
    if (sorteer === "omzet") return b.omzet - a.omzet;
    if (sorteer === "marge") return (b.marge ?? -999) - (a.marge ?? -999);
    return b.profit - a.profit;
  });

  const totaleMarge = totalen && totalen.omzet > 0
    ? Math.round((totalen.profit / totalen.omzet) * 1000) / 10
    : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <div className="flex items-center gap-2 mb-1">
            <Euro className="w-3.5 h-3.5 text-autronis-text-secondary" />
            <p className="text-xs text-autronis-text-secondary">Totale omzet</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary">
            <AnimatedNumber value={totalen?.omzet ?? 0} format={(n) => `€${Math.round(n).toLocaleString("nl-NL")}`} />
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-autronis-text-secondary" />
            <p className="text-xs text-autronis-text-secondary">Totale kosten</p>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary">
            <AnimatedNumber value={totalen?.kostenUren ?? 0} format={(n) => `€${Math.round(n).toLocaleString("nl-NL")}`} />
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <div className="flex items-center gap-2 mb-1">
            {(totalen?.profit ?? 0) >= 0
              ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
            <p className="text-xs text-autronis-text-secondary">Totale profit</p>
          </div>
          <p className={cn("text-2xl font-bold", (totalen?.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>
            <AnimatedNumber
              value={totalen?.profit ?? 0}
              format={(n) => `${n >= 0 ? "+" : ""}€${Math.round(n).toLocaleString("nl-NL")}`}
            />
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 card-glow">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-3.5 h-3.5 text-autronis-text-secondary" />
            <p className="text-xs text-autronis-text-secondary">Gem. marge</p>
          </div>
          <p className={cn("text-2xl font-bold", totaleMarge !== null && totaleMarge >= 0 ? "text-green-400" : "text-red-400")}>
            {totaleMarge !== null
              ? <AnimatedNumber value={totaleMarge} format={(n) => `${n.toFixed(1)}%`} />
              : <span className="text-autronis-text-secondary">—</span>}
          </p>
        </div>
      </div>

      {/* Sortering + header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-autronis-text-primary">
          Projecten
          <span className="text-sm font-normal text-autronis-text-secondary ml-2">({projecten.length})</span>
        </h3>
        <div className="flex items-center gap-1 bg-autronis-bg border border-autronis-border rounded-xl p-1">
          {(["profit", "omzet", "marge"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSorteer(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                sorteer === s
                  ? "bg-autronis-accent/15 text-autronis-accent"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Lijst */}
      {gesorteerd.length === 0 ? (
        <EmptyState
          icoon={<TrendingUp className="w-8 h-8" />}
          titel="Nog geen projectdata"
          beschrijving="Voeg projecten toe met facturen en tijdregistraties om je profit te zien."
        />
      ) : (
        <div className="space-y-2">
          {gesorteerd.map((p) => (
            <ProjectRij key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
