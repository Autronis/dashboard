"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoSync } from "@/hooks/use-auto-sync";
import {
  Euro,
  Clock,
  FolderKanban,
  AlertTriangle,
  Play,
  Square,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  ListTodo,
  Lightbulb,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Calendar,
  Zap,
  RefreshCw,
  Loader2,
  Radar,
  ExternalLink,
  Brain,
  FileText,
  Link2,
  Image as ImageIcon,
  FileDown,
  Code,
  Eye,
  Bookmark,
  ListChecks,
} from "lucide-react";
import { cn, formatUren, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { useDashboard } from "@/hooks/queries/use-dashboard";
import { useInzichten, type Inzicht } from "@/hooks/queries/use-inzichten";
import { useBriefing, useGenereerBriefing, type Briefing } from "@/hooks/queries/use-briefing";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonDashboard } from "@/components/ui/skeleton";

import { KPICard } from "@/components/ui/kpi-card";

import { CheckBurst } from "@/components/ui/confetti";
import type { TijdCategorie } from "@/types";
import { DocumentWidget } from "@/components/documenten/document-widget";
import { HabitWidget } from "@/components/gewoontes/habit-widget";
import { FocusWidget } from "@/components/focus/focus-widget";
import { ProjectVoortgangWidget } from "@/components/taken/project-voortgang-widget";
import { useIdeeen, useGenereerIdeeen, type Idee } from "@/hooks/queries/use-ideeen";
import { useRadarItems, type RadarItem } from "@/hooks/queries/use-radar";
import { useRecentSecondBrain } from "@/hooks/queries/use-second-brain";

function getBegroeting(): string {
  const uur = new Date().getHours();
  if (uur < 12) return "Goedemorgen";
  if (uur < 18) return "Goedemiddag";
  return "Goedenavond";
}

function getDatumString(): string {
  return new Date().toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function trunceerNaarZinnen(tekst: string, max: number): string {
  const zinnen = tekst.match(/[^.!?]+[.!?]+/g);
  if (!zinnen || zinnen.length <= max) return tekst;
  return zinnen.slice(0, max).join("").trim() + "...";
}

function deadlineKleur(deadline: string): string {
  const nu = new Date();
  nu.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "text-red-400";
  if (diff <= 1) return "text-red-400";
  if (diff <= 7) return "text-amber-400";
  return "text-autronis-text-secondary";
}

function deadlineLabel(deadline: string): string {
  const nu = new Date();
  nu.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - nu.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Verlopen";
  if (diff === 0) return "Vandaag";
  if (diff === 1) return "Morgen";
  return formatDatum(deadline);
}

const inzichtConfig: Record<Inzicht["type"], { icon: typeof Lightbulb; color: string; bg: string; border: string }> = {
  waarschuwing: { icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  kans: { icon: TrendingUp, color: "text-autronis-accent", bg: "bg-autronis-accent/10", border: "border-autronis-accent/20" },
  tip: { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  succes: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
};

const prioriteitConfig: Record<string, { color: string; border: string }> = {
  hoog: { color: "text-red-400", border: "border-red-500" },
  normaal: { color: "text-amber-400", border: "border-amber-500" },
  laag: { color: "text-slate-400", border: "border-slate-500" },
};

const agendaTypeConfig: Record<string, { color: string; bg: string }> = {
  afspraak: { color: "text-blue-400", bg: "bg-blue-500/10" },
  deadline: { color: "text-red-400", bg: "bg-red-500/10" },
  belasting: { color: "text-orange-400", bg: "bg-orange-500/10" },
  herinnering: { color: "text-purple-400", bg: "bg-purple-500/10" },
};

const briefingPrioConfig: Record<string, { color: string; bg: string }> = {
  hoog: { color: "text-red-400", bg: "bg-red-500/10" },
  normaal: { color: "text-amber-400", bg: "bg-amber-500/10" },
  laag: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

function voortgangKleur(pct: number): string {
  if (pct > 66) return "bg-emerald-500";
  if (pct > 33) return "bg-amber-500";
  return "bg-red-500";
}

function formatTijd(datum: string): string {
  return new Date(datum).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function DailyBriefing() {
  const vandaag = new Date().toISOString().slice(0, 10);
  const { data: briefing, isLoading } = useBriefing(vandaag);
  const genereer = useGenereerBriefing();
  const { addToast } = useToast();

  // Auto-generate once per session
  useEffect(() => {
    const key = `autronis-briefing-auto-${vandaag}`;
    if (!briefing && !isLoading && !genereer.isPending && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      genereer.mutate(vandaag, {
        onError: () => addToast("Kon briefing niet genereren", "fout"),
      });
    }
  }, [briefing, isLoading, vandaag, genereer, addToast]);

  const handleGenereer = () => {
    genereer.mutate(vandaag, {
      onError: () => addToast("Kon briefing niet genereren", "fout"),
    });
  };

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6 lg:p-7">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-autronis-accent animate-spin" />
          <span className="text-autronis-text-secondary">Briefing laden...</span>
        </div>
      </div>
    );
  }

  if (!briefing && !genereer.isPending) {
    return (
      <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-8 text-center">
        <div className="inline-flex p-3 bg-autronis-accent/10 rounded-2xl mb-4">
          <Sparkles className="w-8 h-8 text-autronis-accent" />
        </div>
        <h2 className="text-xl font-bold text-autronis-text-primary mb-2">Dagbriefing</h2>
        <p className="text-autronis-text-secondary mb-5">Start je dag met een overzicht van je agenda, taken en projecten.</p>
        <button
          onClick={handleGenereer}
          className="inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press"
        >
          <Sparkles className="w-4 h-4" />
          Genereer je dagbriefing
        </button>
      </div>
    );
  }

  if (genereer.isPending && !briefing) {
    return (
      <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin mx-auto mb-3" />
        <p className="text-autronis-text-secondary">Briefing wordt gegenereerd...</p>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-4 lg:p-5 space-y-3 card-gradient">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-autronis-accent" />
            <h2 className="text-base font-semibold text-autronis-text-primary">Dagbriefing</h2>
          </div>
          {briefing.samenvatting && (
            <p className="text-sm text-autronis-text-secondary leading-relaxed">
              {trunceerNaarZinnen(briefing.samenvatting, 2)}
            </p>
          )}
        </div>
        <button
          onClick={handleGenereer}
          disabled={genereer.isPending}
          className="flex-shrink-0 p-2 rounded-xl text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors disabled:opacity-50"
          title="Vernieuwen"
        >
          <RefreshCw className={cn("w-4 h-4", genereer.isPending && "animate-spin")} />
        </button>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-3">
          {/* Agenda vandaag */}
          <div className="bg-autronis-bg/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-autronis-text-primary mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-autronis-accent" />
              Agenda vandaag
            </h3>
            {briefing.agendaItems.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen afspraken vandaag</p>
            ) : (
              <div className="space-y-2">
                {briefing.agendaItems.map((item, i) => {
                  const cfg = agendaTypeConfig[item.type] || agendaTypeConfig.herinnering;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-autronis-text-secondary tabular-nums w-12 flex-shrink-0">
                        {item.heleDag ? "Hele dag" : formatTijd(item.startDatum)}
                      </span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.color, cfg.bg)}>
                        {item.type}
                      </span>
                      <span className="text-sm text-autronis-text-primary truncate">{item.titel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prioriteit taken */}
          <div className="bg-autronis-bg/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-autronis-text-primary mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-autronis-accent" />
              Prioriteit taken
            </h3>
            {briefing.takenPrioriteit.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen openstaande taken</p>
            ) : (
              <div className="space-y-2">
                {briefing.takenPrioriteit.slice(0, 3).map((taak) => {
                  const cfg = briefingPrioConfig[taak.prioriteit] || briefingPrioConfig.normaal;
                  return (
                    <Link
                      key={taak.id}
                      href="/taken"
                      className="flex items-center gap-3 group hover:bg-autronis-bg/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                    >
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", cfg.color, cfg.bg)}>
                        {taak.prioriteit}
                      </span>
                      <span className="text-base text-autronis-text-primary truncate min-w-0 flex-1 group-hover:text-autronis-accent transition-colors">
                        {taak.titel}
                      </span>
                      {taak.projectNaam && (
                        <span className="text-xs text-autronis-text-secondary flex-shrink-0 hidden lg:inline max-w-[120px] truncate">
                          {taak.projectNaam}
                        </span>
                      )}
                    </Link>
                  );
                })}
                {briefing.takenPrioriteit.length > 3 && (
                  <Link href="/taken" className="text-xs text-autronis-accent hover:underline">
                    +{briefing.takenPrioriteit.length - 3} meer taken →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {/* Project updates */}
          <div className="bg-autronis-bg/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-autronis-text-primary mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-autronis-accent" />
              Project updates
            </h3>
            {(() => {
              const activeUpdates = briefing.projectUpdates.filter((p) => p.voortgang > 0);
              return activeUpdates.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen actieve projecten</p>
            ) : (
              <div className="space-y-3">
                {activeUpdates.slice(0, 4).map((project, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-autronis-text-primary font-medium truncate">{project.naam}</span>
                      <span className="text-xs text-autronis-text-secondary tabular-nums flex-shrink-0 ml-2">{project.voortgang}%</span>
                    </div>
                    <div className="h-1.5 bg-autronis-border rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", voortgangKleur(project.voortgang))}
                        style={{ width: `${project.voortgang}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-autronis-text-secondary">{project.klantNaam}</span>
                      {project.deadline && (
                        <span className={cn("text-xs", deadlineKleur(project.deadline))}>
                          {deadlineLabel(project.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {activeUpdates.length > 4 && (
                  <Link href="/projecten" className="text-xs text-autronis-accent hover:underline">
                    +{activeUpdates.length - 4} meer →
                  </Link>
                )}
              </div>
            );
            })()}
          </div>

          {/* Quick wins */}
          <div className="bg-autronis-bg/50 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-autronis-text-primary mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-autronis-accent" />
              Quick wins
            </h3>
            {briefing.quickWins.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen quick wins gevonden</p>
            ) : (
              <div className="space-y-2">
                {briefing.quickWins.slice(0, 2).map((qw) => (
                  <Link
                    key={qw.id}
                    href="/taken"
                    className="flex items-center gap-3 group hover:bg-autronis-bg/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="w-4 h-4 rounded border border-autronis-border flex-shrink-0 group-hover:border-autronis-accent transition-colors" />
                    <span className="text-sm text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">
                      {qw.titel}
                    </span>
                    {qw.projectNaam && (
                      <span className="text-xs text-autronis-text-secondary flex-shrink-0 hidden sm:inline">
                        {qw.projectNaam}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdeeVanDeDag() {
  const { data: ideeen = [] } = useIdeeen();
  const genereer = useGenereerIdeeen();
  const { addToast } = useToast();

  const vandaag = new Date().toISOString().slice(0, 10);
  const aiIdeeenVandaag = ideeen.filter(
    (i: Idee) => i.isAiSuggestie === 1 && i.aangemaaktOp?.slice(0, 10) === vandaag
  );
  // Pick best AI idea of today, or a stable "random" idea from backlog based on day-of-year
  const dagIndex = Math.floor(Date.now() / 86400000);
  const beste = aiIdeeenVandaag.length > 0
    ? aiIdeeenVandaag.reduce((a: Idee, b: Idee) => ((a.aiScore ?? 0) >= (b.aiScore ?? 0) ? a : b))
    : ideeen.length > 0
      ? ideeen[dagIndex % ideeen.length]
      : null;

  const handleGenereer = () => {
    genereer.mutate(undefined, {
      onSuccess: () => addToast("Nieuwe ideeën gegenereerd", "succes"),
      onError: () => addToast("Kon ideeën niet genereren", "fout"),
    });
  };

  if (!beste) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow card-gradient flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-autronis-text-primary">Idee van de dag</p>
            <p className="text-xs text-autronis-text-secondary">Nog geen AI-ideeën vandaag</p>
          </div>
        </div>
        <button
          onClick={handleGenereer}
          disabled={genereer.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 btn-press"
        >
          {genereer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Genereer nieuwe ideeën
        </button>
      </div>
    );
  }

  return (
    <div className="bg-autronis-card border border-amber-500/20 rounded-2xl p-5 card-glow card-gradient">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-amber-500/10 rounded-xl flex-shrink-0 mt-0.5">
            <Lightbulb className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide mb-1">Idee van de dag</p>
            <p className="text-base font-semibold text-autronis-text-primary truncate">{beste.naam}</p>
            {beste.omschrijving && (
              <p className="text-sm text-autronis-text-secondary mt-1 line-clamp-2">{beste.omschrijving}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {beste.aiScore != null && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 tabular-nums">
                  Score: {beste.aiScore}/10
                </span>
              )}
              {beste.doelgroep && (
                <span className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  beste.doelgroep === "klant" ? "bg-blue-500/15 text-blue-400" : "bg-autronis-accent/15 text-autronis-accent"
                )}>
                  {beste.doelgroep === "klant" ? "Klant" : "Persoonlijk"}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href="/ideeen"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-autronis-accent hover:text-autronis-accent-hover transition-colors flex-shrink-0"
        >
          Bekijken
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ============ LEARNING RADAR WIDGET ============

const categorieBadgeKleur: Record<string, string> = {
  tools: "bg-blue-500/15 text-blue-400",
  api_updates: "bg-purple-500/15 text-purple-400",
  trends: "bg-orange-500/15 text-orange-400",
  kansen: "bg-green-500/15 text-green-400",
  must_reads: "bg-red-500/15 text-red-400",
};

const categorieLabels: Record<string, string> = {
  tools: "Tools",
  api_updates: "API Updates",
  trends: "Trends",
  kansen: "Kansen",
  must_reads: "Must-reads",
};

function RadarWidget() {
  const { data: items = [], isLoading } = useRadarItems({ minScore: 7 });
  const topItems = items.slice(0, 3);

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-autronis-accent/10 rounded-xl">
            <Radar className="w-5 h-5 text-autronis-accent" />
          </div>
          <h2 className="text-xl font-semibold text-autronis-text-primary">Learning Radar</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-autronis-bg/50 rounded-xl p-4 animate-pulse h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow card-gradient">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-autronis-accent/10 rounded-xl">
            <Radar className="w-5 h-5 text-autronis-accent" />
          </div>
          <h2 className="text-xl font-semibold text-autronis-text-primary">Learning Radar</h2>
          <span className="text-sm text-autronis-text-secondary">({items.length} items)</span>
        </div>
        <Link
          href="/radar"
          className="text-sm text-autronis-accent hover:text-autronis-accent-hover transition-colors flex items-center gap-1"
        >
          Bekijk alles
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {topItems.length === 0 ? (
        <p className="text-base text-autronis-text-secondary">
          Nog geen items. Ga naar de Radar pagina om items op te halen.
        </p>
      ) : (
        <div className="space-y-3">
          {topItems.map((item) => (
            <div
              key={item.id}
              className="bg-autronis-bg/50 rounded-xl p-4 flex items-start gap-3 hover:bg-autronis-bg/80 transition-colors group"
            >
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tabular-nums flex-shrink-0 mt-0.5",
                  item.score != null && item.score >= 8
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-yellow-500/15 text-yellow-400"
                )}
              >
                {item.score}/10
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-autronis-text-primary group-hover:text-autronis-accent transition-colors line-clamp-1">
                  {item.titel}
                  <ExternalLink className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                {item.aiSamenvatting && (
                  <p className="text-xs text-autronis-text-secondary mt-1 line-clamp-1">
                    {item.aiSamenvatting}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {item.categorie && (
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      categorieBadgeKleur[item.categorie] ?? "bg-autronis-border text-autronis-text-secondary"
                    )}>
                      {categorieLabels[item.categorie] ?? item.categorie}
                    </span>
                  )}
                  {item.bronNaam && (
                    <span className="text-xs text-autronis-text-secondary/60">{item.bronNaam}</span>
                  )}
                </div>
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(item.url);
                }}
                className="flex-shrink-0 p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Bewaar"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  useAutoSync();
  const { addToast } = useToast();
  const timer = useTimer();
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useDashboard();
  const { data: inzichtenData } = useInzichten();
  const inzichten = inzichtenData?.inzichten ?? [];
  const { data: recentBrainItems } = useRecentSecondBrain(5);

  // Timer form state
  const [timerProjectId, setTimerProjectId] = useState<string>("");
  const [timerOmschrijving, setTimerOmschrijving] = useState("");
  const [timerCategorie, setTimerCategorie] = useState<TijdCategorie>("development");

  // CheckBurst animation state
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);

  // Belasting deadline alerts
  const [urgentDeadlines, setUrgentDeadlines] = useState<Array<{omschrijving: string; datum: string; dagenOver: number}>>([]);

  // Concurrent updates
  const [concurrentData, setConcurrentData] = useState<{
    wijzigingenDezeWeek: number;
    highlights: Array<{ concurrentNaam: string; tekst: string; type: string }>;
    laatsteScan: string | null;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/belasting/deadlines?jaar=${new Date().getFullYear()}`)
      .then(r => r.json())
      .then(data => {
        const nu = new Date();
        const urgent = (data.deadlines || [])
          .filter((d: {afgerond: number; datum: string}) => !d.afgerond)
          .map((d: {omschrijving: string; datum: string}) => {
            const dagen = Math.ceil((new Date(d.datum).getTime() - nu.getTime()) / 86400000);
            return { ...d, dagenOver: dagen };
          })
          .filter((d: {dagenOver: number}) => d.dagenOver <= 7 && d.dagenOver >= -30);
        setUrgentDeadlines(urgent);
      })
      .catch(() => {});

    fetch("/api/dashboard/concurrenten").then((r) => r.json()).then(setConcurrentData).catch(() => {});
  }, []);

  // Timer tick
  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = setInterval(() => timer.tick(), 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning, timer]);

  // Timer in browser tab
  useEffect(() => {
    if (!timer.isRunning) {
      document.title = "Dashboard | Autronis";
      return;
    }

    const projectNaam = data?.projecten.find((p) => p.id === timer.projectId)?.naam || "Project";

    const updateTitle = () => {
      const elapsed = timer.elapsed;
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const formatted = `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      document.title = `⏱ ${formatted} — ${projectNaam} | Autronis`;
    };

    updateTitle();
    const interval = setInterval(updateTitle, 1000);
    return () => {
      clearInterval(interval);
      document.title = "Dashboard | Autronis";
    };
  }, [timer.isRunning, timer.elapsed, timer.projectId, data?.projecten]);

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(timerProjectId),
          omschrijving: timerOmschrijving || null,
          categorie: timerCategorie,
        }),
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: ({ registratie }) => {
      timer.start(Number(timerProjectId), timerOmschrijving, timerCategorie, registratie.id);
      addToast("Timer gestart", "succes");
      setTimerOmschrijving("");
    },
    onError: () => addToast("Kon timer niet starten", "fout"),
  });

  const stopTimerMutation = useMutation({
    mutationFn: async () => {
      const eindTijd = new Date().toISOString();
      const startMs = new Date(timer.startTijd!).getTime();
      const duurMinuten = Math.round((Date.now() - startMs) / 60000);
      const res = await fetch(`/api/tijdregistraties/${timer.registratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eindTijd, duurMinuten }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      timer.stop();
      addToast("Timer gestopt", "succes");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => addToast("Kon timer niet stoppen", "fout"),
  });

  const completeTaakMutation = useMutation({
    mutationFn: async (taakId: number) => {
      const res = await fetch(`/api/taken/${taakId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "afgerond" }),
      });
      if (!res.ok) throw new Error();
      return taakId;
    },
    onSuccess: (taakId) => {
      setCompletedTaskId(taakId);
      setTimeout(() => setCompletedTaskId(null), 500);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => addToast("Kon taak niet bijwerken", "fout"),
  });

  const handleStartTimer = () => {
    if (!timerProjectId) {
      addToast("Selecteer een project", "fout");
      return;
    }
    startTimerMutation.mutate();
  };

  const handleStopTimer = () => {
    if (!timer.registratieId) return;
    stopTimerMutation.mutate();
  };

  const handleTaakAfvinken = (taakId: number) => {
    completeTaakMutation.mutate(taakId);
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <SkeletonDashboard />
      </div>
    );
  }

  if (!data) return null;

  const secondBrainTypeIcons: Record<string, typeof FileText> = {
    tekst: FileText, url: Link2, afbeelding: ImageIcon, pdf: FileDown, code: Code,
  };

  const { gebruiker, kpis, mijnTaken, deadlines, teamgenoot, projecten } = data;


  return (
    <PageTransition>
      <div className="max-w-[1400px] mx-auto space-y-3">
        {/* Begroeting */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-autronis-text-primary tracking-tight">
            {getBegroeting()}, {gebruiker.naam.split(" ")[0]}
          </h1>
          <p className="text-sm text-autronis-text-secondary capitalize">
            {getDatumString()}
          </p>
        </div>

        {/* Belasting deadline alert */}
        {urgentDeadlines.length > 0 && (
          <Link href="/belasting" className="block">
            <div className="bg-gradient-to-r from-red-500/15 via-orange-500/15 to-red-500/15 border border-red-500/30 rounded-2xl p-4 lg:p-5 hover:border-red-500/50 transition-colors">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  {urgentDeadlines.map((d) => (
                    <div key={d.omschrijving} className="flex items-center justify-between text-sm">
                      <span className="text-autronis-text-primary font-medium">{d.omschrijving}</span>
                      <span className={cn(
                        "tabular-nums font-medium",
                        d.dagenOver < 0 ? "text-red-400" : d.dagenOver <= 3 ? "text-red-400" : "text-orange-400"
                      )}>
                        {d.dagenOver < 0 ? `${Math.abs(d.dagenOver)} dagen te laat` : d.dagenOver === 0 ? "Vandaag!" : `${d.dagenOver} dagen`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Row 1: KPI's */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          <Link href="/financien" className="block">
            <KPICard
              label="Omzet deze maand"
              value={kpis.omzetDezeMaand}
              format={(n) => n === 0 ? "—" : formatBedrag(n)}
              icon={<Euro className="w-5 h-5" />}
              color="emerald"
              index={0}
              className={kpis.omzetDezeMaand === 0 ? "opacity-50" : ""}
            />
          </Link>
          <Link href="/tijdregistratie" className="block">
            <KPICard
              label="Uren deze week"
              value={kpis.urenDezeWeek.totaal}
              format={(n) => n === 0 ? "—" : formatUren(Math.round(n))}
              icon={<Clock className="w-5 h-5" />}
              color="blue"
              index={1}
              className={kpis.urenDezeWeek.totaal === 0 ? "opacity-50" : ""}
            />
          </Link>
          <Link href="/projecten" className="block">
            <KPICard
              label="Actieve projecten"
              value={kpis.actieveProjecten}
              format={(n) => n === 0 ? "—" : String(n)}
              icon={<FolderKanban className="w-5 h-5" />}
              color="purple"
              index={2}
              className={kpis.actieveProjecten === 0 ? "opacity-50" : ""}
            />
          </Link>
          <Link href="/taken" className="block">
            <KPICard
              label="Taken vandaag"
              value={mijnTaken.length}
              format={(n) => n === 0 ? "—" : String(n)}
              icon={<ListChecks className="w-5 h-5" />}
              color="accent"
              index={3}
              className={mijnTaken.length === 0 ? "opacity-50" : ""}
            />
          </Link>
          <Link href="/agenda" className="block">
            <KPICard
              label="Deadlines deze week"
              value={kpis.deadlinesDezeWeek}
              format={(n) => n === 0 ? "—" : String(n)}
              icon={<AlertTriangle className="w-5 h-5" />}
              color={kpis.deadlinesDezeWeek > 0 ? "red" : "accent"}
              index={4}
              className={kpis.deadlinesDezeWeek === 0 ? "opacity-50" : ""}
            />
          </Link>
        </div>

        {/* Focus Card — Wat moet je nu doen? */}
        {mijnTaken.length > 0 && (
          <div className="bg-gradient-to-r from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/20 rounded-2xl p-4 lg:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-autronis-accent" />
              <h2 className="text-base font-bold text-autronis-text-primary">Wat moet je nu doen?</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(() => {
                const critical = mijnTaken.filter((t) => t.prioriteit === "hoog");
                const normal = mijnTaken.filter((t) => t.prioriteit !== "hoog");
                return (<>
                  <div className="bg-autronis-bg/60 rounded-xl p-3 text-center">
                    <p className={cn("text-xl font-bold tabular-nums", critical.length > 0 ? "text-red-400" : "text-autronis-text-secondary")}>{critical.length}</p>
                    <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Urgent</p>
                  </div>
                  <div className="bg-autronis-bg/60 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-amber-400 tabular-nums">{normal.length}</p>
                    <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Overig open</p>
                  </div>
                  <div className="bg-autronis-bg/60 rounded-xl p-3 text-center">
                    <p className={cn("text-xl font-bold tabular-nums", kpis.deadlinesDezeWeek > 0 ? "text-red-400" : "text-autronis-text-secondary")}>{kpis.deadlinesDezeWeek}</p>
                    <p className="text-[10px] text-autronis-text-secondary uppercase tracking-wide">Deadlines</p>
                  </div>
                </>);
              })()}
            </div>
            {/* Top 3 taken met actie */}
            <div className="space-y-1.5">
              {mijnTaken.slice(0, 3).map((taak) => {
                const prio = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                return (
                  <div key={taak.id} className="flex items-center gap-3 bg-autronis-bg/40 rounded-lg px-3 py-2">
                    <button
                      onClick={() => handleTaakAfvinken(taak.id)}
                      className={cn("w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors hover:bg-green-500/20", prio.border)}
                    />
                    <span className="text-sm text-autronis-text-primary truncate flex-1">{taak.titel}</span>
                    {taak.projectNaam && <span className="text-xs text-autronis-text-secondary hidden sm:block">{taak.projectNaam}</span>}
                    <Link href="/taken" className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium shrink-0">Start</Link>
                  </div>
                );
              })}
              {mijnTaken.length > 3 && (
                <Link href="/taken" className="flex items-center gap-1 text-xs text-autronis-accent font-medium pt-1 hover:text-autronis-accent-hover">
                  +{mijnTaken.length - 3} meer taken <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Row 2: Briefing full width */}
        <DailyBriefing />

        {/* Idee van de dag */}
        <IdeeVanDeDag />

        {/* Slimme inzichten */}
        {inzichten.length > 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 lg:p-5 card-glow">
            <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-autronis-accent" />
              Slimme inzichten
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {inzichten.map((inzicht) => {
                const config = inzichtConfig[inzicht.type];
                const Icon = config.icon;
                return (
                  <div
                    key={inzicht.id}
                    className={cn(
                      "rounded-lg p-3 border flex gap-2",
                      config.bg,
                      config.border
                    )}
                  >
                    <div className={cn("mt-0.5 flex-shrink-0", config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold", config.color)}>
                        {inzicht.titel}
                      </p>
                      <p className="text-xs text-autronis-text-secondary mt-0.5 leading-relaxed line-clamp-2">
                        {inzicht.omschrijving}
                      </p>
                      {inzicht.actie && (
                        <Link
                          href={inzicht.actie.link}
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium mt-1 transition-colors hover:underline",
                            config.color
                          )}
                        >
                          {inzicht.actie.label}
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Main 2-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
          {/* Left column: Taken + Projecten + Documenten */}
          <div className="space-y-3">
            {/* Mijn Taken */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 lg:p-5 card-glow">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-autronis-text-primary flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-autronis-accent" />
                  Mijn taken
                </h2>
                <span className="text-xs text-autronis-accent font-medium">
                  {mijnTaken.length} open
                </span>
              </div>
              {mijnTaken.length === 0 ? (
                <p className="text-sm text-autronis-text-secondary">
                  Geen openstaande taken — lekker bezig!
                </p>
              ) : (
                <div className="space-y-2">
                  {mijnTaken.map((taak) => {
                    const prio = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                    return (
                      <div
                        key={taak.id}
                        className="bg-autronis-bg/50 rounded-lg p-3 flex items-center gap-3 group relative"
                      >
                        <button
                          onClick={() => handleTaakAfvinken(taak.id)}
                          className={cn(
                            "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors hover:bg-green-500/20",
                            prio.border
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-autronis-text-primary truncate">
                            {taak.titel}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {taak.projectNaam && (
                              <span className="text-xs text-autronis-text-secondary">
                                {taak.projectNaam}
                              </span>
                            )}
                            {taak.deadline && (
                              <span className={cn("text-xs flex items-center gap-1", deadlineKleur(taak.deadline))}>
                                · {deadlineLabel(taak.deadline)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={cn("text-xs font-semibold flex-shrink-0", prio.color)}>
                          {taak.prioriteit === "hoog" && <AlertCircle className="w-4 h-4" />}
                        </span>
                        <CheckBurst active={completedTaskId === taak.id} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aankomende Deadlines */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 lg:p-5 card-glow">
              <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-autronis-accent" />
                Deadlines
              </h2>
              {deadlines.length === 0 ? (
                <p className="text-sm text-autronis-text-secondary">
                  Geen projecten met deadlines.
                </p>
              ) : (
                <div className="space-y-2">
                  {deadlines.map((dl) => (
                    <Link
                      key={dl.projectId}
                      href={`/klanten/${dl.klantId}/projecten/${dl.projectId}`}
                      className="bg-autronis-bg/50 rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-autronis-bg/80 transition-colors block"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-autronis-text-primary truncate">
                          {dl.projectNaam}
                        </p>
                        <p className="text-xs text-autronis-text-secondary">
                          {dl.klantNaam}
                        </p>
                      </div>
                      <span className={cn("text-xs font-semibold flex-shrink-0", deadlineKleur(dl.deadline))}>
                        {deadlineLabel(dl.deadline)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Project voortgang widget - filter 100% */}
            <ProjectVoortgangWidget />

            {/* Documenten widget */}
            <DocumentWidget />
          </div>

          {/* Right column: Alerts + Team + Focus + Gewoontes + Learning + Second Brain */}
          <div className="space-y-3">
            {/* Teamgenoot status - compact when offline */}
            {teamgenoot ? (
              teamgenoot.actieveTimer ? (
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 lg:p-5 card-glow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-autronis-accent flex items-center justify-center text-xs font-bold text-autronis-bg">
                      {teamgenoot.naam.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-autronis-text-primary">
                        {teamgenoot.naam}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 status-pulse" />
                        <span className="text-xs text-green-400">Aan het werk</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-autronis-bg/50 rounded-xl p-3 border-l-3 border-autronis-accent" style={{ borderLeftWidth: "3px" }}>
                    <p className="text-xs text-autronis-text-secondary">Bezig met</p>
                    <p className="text-sm font-medium text-autronis-text-primary mt-0.5">
                      {teamgenoot.actieveTimer.omschrijving || "Geen omschrijving"}
                    </p>
                    <p className="text-xs text-autronis-text-secondary mt-0.5">
                      {teamgenoot.actieveTimer.projectNaam}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-autronis-card border border-autronis-border rounded-2xl px-4 py-3 flex items-center gap-3 card-glow">
                  <div className="w-6 h-6 rounded-full bg-autronis-border flex items-center justify-center text-[10px] font-bold text-autronis-text-secondary">
                    {teamgenoot.naam.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-autronis-text-secondary">
                    {teamgenoot.naam.split(" ")[0]}: Offline
                  </span>
                </div>
              )
            ) : null}

            {/* Learning Radar */}
            <RadarWidget />

            {/* Second Brain Widget */}
            <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-5 card-glow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-autronis-accent" />
                  <h3 className="text-autronis-text-primary font-semibold">Second Brain</h3>
                </div>
                <Link href="/second-brain" className="text-autronis-accent text-sm hover:text-autronis-accent-hover transition-colors">
                  Bekijk alles →
                </Link>
              </div>
              {recentBrainItems && recentBrainItems.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    const seen = new Set<string>();
                    return recentBrainItems.filter((item) => {
                      const key = item.titel || item.id.toString();
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    }).map((item) => {
                      const TypeIcon = secondBrainTypeIcons[item.type] ?? FileText;
                      return (
                        <Link key={item.id} href="/second-brain" className="flex items-center gap-3 group">
                          <TypeIcon className="w-4 h-4 text-autronis-text-secondary" />
                          <span className="text-sm text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate flex-1">
                            {item.titel || "Zonder titel"}
                          </span>
                          <span className="text-xs text-autronis-text-secondary tabular-nums">
                            {new Date(item.aangemaaktOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                          </span>
                        </Link>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Brain className="w-8 h-8 text-autronis-accent/30 mx-auto mb-2" />
                  <p className="text-sm text-autronis-text-secondary mb-2">Nog geen items opgeslagen</p>
                  <Link
                    href="/second-brain"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-autronis-accent/10 hover:bg-autronis-accent/20 text-autronis-accent rounded-lg text-sm font-medium transition-colors"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    Begin hier
                  </Link>
                </div>
              )}
            </div>

            <FocusWidget />
            <HabitWidget />

            {/* Concurrent updates widget */}
            {concurrentData && concurrentData.highlights.length > 0 && (
              <section className="rounded-2xl border border-autronis-border bg-autronis-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                    <Eye className="h-4 w-4 text-autronis-accent" />
                    Concurrent updates
                  </h3>
                  <span className="rounded-full bg-autronis-accent/15 px-2.5 py-0.5 text-xs font-semibold text-autronis-accent">
                    {concurrentData.wijzigingenDezeWeek} nieuw
                  </span>
                </div>
                <div className="space-y-2">
                  {concurrentData.highlights.map((h, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <span className={cn("mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        h.type === "kans" ? "bg-green-400" : "bg-autronis-accent")} />
                      <span className="text-autronis-text-secondary">
                        <strong className="text-autronis-text-primary">{h.concurrentNaam}</strong>{" "}
                        {h.tekst}
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/concurrenten" className="mt-3 block text-xs text-autronis-accent hover:underline">
                  Bekijk alle concurrenten →
                </Link>
              </section>
            )}
          </div>
        </div>

        {/* Spacer for sticky timer bar (desktop) / bottom nav (mobile) */}
        <div className="h-4 md:h-16" />
      </div>

      {/* Fixed timer bar — hidden on mobile (use bottom nav Timer link instead) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-autronis-card/95 backdrop-blur-md border-t border-autronis-border shadow-2xl shadow-black/40 p-2 sm:p-3 hidden md:block">
        <div className="max-w-[1400px] mx-auto">
        <div className="bg-autronis-card border border-autronis-border rounded-xl p-2 sm:p-3 card-glow">
          {timer.isRunning ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-autronis-text-primary font-medium truncate block">{timer.omschrijving || "Timer"}</span>
                <span className="text-xs text-autronis-text-secondary hidden sm:inline">{projecten.find((p) => p.id === timer.projectId)?.naam || ""}</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-autronis-accent font-mono tabular-nums">{formatElapsed(timer.elapsed)}</span>
              <button onClick={handleStopTimer} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-autronis-text-primary rounded-lg text-xs font-semibold transition-colors btn-press flex-shrink-0">
                <Square className="w-3 h-3" /> Stop
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Clock className="w-4 h-4 text-autronis-accent flex-shrink-0 hidden sm:block" />
                <select value={timerProjectId} onChange={(e) => setTimerProjectId(e.target.value)} className="appearance-none bg-autronis-bg border border-autronis-border rounded-lg px-3 pr-7 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent flex-1 min-w-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238A9BA0%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat">
                  <option value="">Project...</option>
                  {projecten.map((p) => <option key={p.id} value={p.id}>{p.naam} — {p.klantNaam}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <input type="text" value={timerOmschrijving} onChange={(e) => setTimerOmschrijving(e.target.value)} placeholder="Waar werk je aan?" className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent flex-1 min-w-0" onKeyDown={(e) => e.key === "Enter" && handleStartTimer()} />
                <select value={timerCategorie} onChange={(e) => setTimerCategorie(e.target.value as TijdCategorie)} className="appearance-none bg-autronis-bg border border-autronis-border rounded-lg px-2 pr-6 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent w-auto hidden sm:block bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238A9BA0%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat">
                  <option value="development">Development</option>
                  <option value="meeting">Meeting</option>
                  <option value="administratie">Administratie</option>
                  <option value="overig">Overig</option>
                </select>
                <button onClick={handleStartTimer} className="inline-flex items-center gap-1.5 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-sm font-semibold transition-colors btn-press flex-shrink-0">
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </PageTransition>
  );
}
