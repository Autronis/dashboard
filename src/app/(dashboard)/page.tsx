"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { cn, formatUren, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { useDashboard } from "@/hooks/queries/use-dashboard";
import { useInzichten, type Inzicht } from "@/hooks/queries/use-inzichten";
import { useBriefing, useGenereerBriefing, type Briefing } from "@/hooks/queries/use-briefing";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonDashboard } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/ui/sparkline";
import { CheckBurst } from "@/components/ui/confetti";
import type { TijdCategorie } from "@/types";
import { DocumentWidget } from "@/components/documenten/document-widget";
import { useIdeeen, useGenereerIdeeen, type Idee } from "@/hooks/queries/use-ideeen";
import { useRadarItems, type RadarItem } from "@/hooks/queries/use-radar";

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
          className="inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
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
    <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6 lg:p-7 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-autronis-accent" />
            <h2 className="text-lg font-semibold text-autronis-text-primary">Dagbriefing</h2>
          </div>
          {briefing.samenvatting && (
            <p className="text-base text-autronis-text-secondary leading-relaxed">
              {briefing.samenvatting}
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          {/* Agenda vandaag */}
          <div className="bg-autronis-bg/50 rounded-xl p-5 card-glow">
            <h3 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
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
          <div className="bg-autronis-bg/50 rounded-xl p-5 card-glow">
            <h3 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-autronis-accent" />
              Prioriteit taken
            </h3>
            {briefing.takenPrioriteit.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen openstaande taken</p>
            ) : (
              <div className="space-y-2">
                {briefing.takenPrioriteit.map((taak) => {
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
                      <span className="text-sm text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">
                        {taak.titel}
                      </span>
                      {taak.projectNaam && (
                        <span className="text-xs text-autronis-text-secondary flex-shrink-0 hidden sm:inline">
                          {taak.projectNaam}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Project updates */}
          <div className="bg-autronis-bg/50 rounded-xl p-5 card-glow">
            <h3 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-autronis-accent" />
              Project updates
            </h3>
            {briefing.projectUpdates.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen actieve projecten</p>
            ) : (
              <div className="space-y-3">
                {briefing.projectUpdates.map((project, i) => (
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
              </div>
            )}
          </div>

          {/* Quick wins */}
          <div className="bg-autronis-bg/50 rounded-xl p-5 card-glow">
            <h3 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-autronis-accent" />
              Quick wins
            </h3>
            {briefing.quickWins.length === 0 ? (
              <p className="text-sm text-autronis-text-secondary">Geen quick wins gevonden</p>
            ) : (
              <div className="space-y-2">
                {briefing.quickWins.map((qw) => (
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
  const beste = aiIdeeenVandaag.length > 0
    ? aiIdeeenVandaag.reduce((a: Idee, b: Idee) => ((a.aiScore ?? 0) >= (b.aiScore ?? 0) ? a : b))
    : null;

  const handleGenereer = () => {
    genereer.mutate(undefined, {
      onSuccess: () => addToast("Nieuwe ideeën gegenereerd", "succes"),
      onError: () => addToast("Kon ideeën niet genereren", "fout"),
    });
  };

  if (!beste) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow flex items-center justify-between gap-4">
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
          className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {genereer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Genereer nieuwe ideeën
        </button>
      </div>
    );
  }

  return (
    <div className="bg-autronis-card border border-amber-500/20 rounded-2xl p-5 card-glow">
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
  const topItems = items.slice(0, 5);

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-autronis-accent/10 rounded-xl">
            <Radar className="w-5 h-5 text-autronis-accent" />
          </div>
          <h2 className="text-lg font-semibold text-autronis-text-primary">Learning Radar</h2>
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
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-autronis-accent/10 rounded-xl">
            <Radar className="w-5 h-5 text-autronis-accent" />
          </div>
          <h2 className="text-lg font-semibold text-autronis-text-primary">Learning Radar</h2>
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
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-autronis-bg/50 rounded-xl p-4 flex items-start gap-3 hover:bg-autronis-bg/80 transition-colors block group"
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
              <div className="flex-1 min-w-0">
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
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { addToast } = useToast();
  const timer = useTimer();
  const queryClient = useQueryClient();
  const { data, isLoading: loading } = useDashboard();
  const { data: inzichtenData } = useInzichten();
  const inzichten = inzichtenData?.inzichten ?? [];

  // Timer form state
  const [timerProjectId, setTimerProjectId] = useState<string>("");
  const [timerOmschrijving, setTimerOmschrijving] = useState("");
  const [timerCategorie, setTimerCategorie] = useState<TijdCategorie>("development");

  // CheckBurst animation state
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);

  // Belasting deadline alerts
  const [urgentDeadlines, setUrgentDeadlines] = useState<Array<{omschrijving: string; datum: string; dagenOver: number}>>([]);

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

  const { gebruiker, kpis, mijnTaken, deadlines, teamgenoot, projecten } = data;
  const maxUrenDag = teamgenoot ? Math.max(...teamgenoot.urenPerDag, 1) : 1;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Begroeting */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">
            {getBegroeting()}, {gebruiker.naam.split(" ")[0]}
          </h1>
          <p className="text-base text-autronis-text-secondary mt-1 capitalize">
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

        {/* Dagbriefing */}
        <DailyBriefing />

        {/* Idee van de dag */}
        <IdeeVanDeDag />

        {/* KPI balk */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-omzet relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <Euro className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-accent">
              <AnimatedNumber value={kpis.omzetDezeMaand} format={(n) => formatBedrag(n)} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Omzet deze maand
            </p>
            <div className="absolute bottom-2 right-2 opacity-60">
              <Sparkline data={[3, 5, 2, 8, 4, 7, 6]} />
            </div>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-uren relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <Clock className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-text-primary">
              <AnimatedNumber value={kpis.urenDezeWeek.totaal} format={(n) => formatUren(Math.round(n))} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Uren deze week
            </p>
            <p className="text-sm text-autronis-text-secondary mt-0.5">
              {gebruiker.naam.split(" ")[0]} {formatUren(kpis.urenDezeWeek.eigen)} · {teamgenoot?.naam.split(" ")[0] || "Team"} {formatUren(kpis.urenDezeWeek.teamgenoot)}
            </p>
            <div className="absolute bottom-2 right-2 opacity-60">
              <Sparkline data={[120, 90, 150, 180, 140, 160, 200]} />
            </div>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-projecten relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <FolderKanban className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-text-primary">
              <AnimatedNumber value={kpis.actieveProjecten} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Actieve projecten
            </p>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow kpi-gradient-deadlines relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "p-2.5 rounded-xl",
                kpis.deadlinesDezeWeek > 0 ? "bg-red-500/10" : "bg-autronis-accent/10"
              )}>
                <AlertTriangle className={cn(
                  "w-5 h-5",
                  kpis.deadlinesDezeWeek > 0 ? "text-red-400" : "text-autronis-accent"
                )} />
              </div>
            </div>
            <p className={cn(
              "text-3xl font-bold",
              kpis.deadlinesDezeWeek > 0 ? "text-red-400" : "text-autronis-text-primary"
            )}>
              <AnimatedNumber value={kpis.deadlinesDezeWeek} />
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Deadlines deze week
            </p>
          </div>
        </div>

        {/* Slimme inzichten */}
        {inzichten.length > 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <h2 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-autronis-accent" />
              Slimme inzichten
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inzichten.map((inzicht) => {
                const config = inzichtConfig[inzicht.type];
                const Icon = config.icon;
                return (
                  <div
                    key={inzicht.id}
                    className={cn(
                      "rounded-xl p-4 border flex gap-3",
                      config.bg,
                      config.border
                    )}
                  >
                    <div className={cn("mt-0.5 flex-shrink-0", config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", config.color)}>
                        {inzicht.titel}
                      </p>
                      <p className="text-sm text-autronis-text-secondary mt-1 leading-relaxed">
                        {inzicht.omschrijving}
                      </p>
                      {inzicht.actie && (
                        <Link
                          href={inzicht.actie.link}
                          className={cn(
                            "inline-flex items-center gap-1 text-sm font-medium mt-2 transition-colors hover:underline",
                            config.color
                          )}
                        >
                          {inzicht.actie.label}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Twee-kolom layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
          {/* Links: Mijn werkplek */}
          <div className="space-y-8">
            {/* Snel starten / Actieve timer */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
              {timer.isRunning ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <h2 className="text-lg font-semibold text-autronis-text-primary">
                        Timer loopt
                      </h2>
                    </div>
                    <span className="text-3xl font-bold text-autronis-accent font-mono tabular-nums">
                      {formatElapsed(timer.elapsed)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-autronis-bg/50 rounded-xl p-4">
                    <div>
                      <p className="text-base font-medium text-autronis-text-primary">
                        {timer.omschrijving || "Geen omschrijving"}
                      </p>
                      <p className="text-sm text-autronis-text-secondary mt-1">
                        {projecten.find((p) => p.id === timer.projectId)?.naam || "Project"} — {projecten.find((p) => p.id === timer.projectId)?.klantNaam || ""}
                      </p>
                    </div>
                    <button
                      onClick={handleStopTimer}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-autronis-accent" />
                    Snel starten
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={timerProjectId}
                      onChange={(e) => setTimerProjectId(e.target.value)}
                      className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:flex-1"
                    >
                      <option value="">Selecteer project...</option>
                      {projecten.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.naam} — {p.klantNaam}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={timerOmschrijving}
                      onChange={(e) => setTimerOmschrijving(e.target.value)}
                      placeholder="Waar werk je aan?"
                      className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:flex-[1.5]"
                      onKeyDown={(e) => e.key === "Enter" && handleStartTimer()}
                    />
                    <select
                      value={timerCategorie}
                      onChange={(e) => setTimerCategorie(e.target.value as TijdCategorie)}
                      className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:w-40"
                    >
                      <option value="development">Development</option>
                      <option value="meeting">Meeting</option>
                      <option value="administratie">Administratie</option>
                      <option value="overig">Overig</option>
                    </select>
                    <button
                      onClick={handleStartTimer}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 whitespace-nowrap"
                    >
                      <Play className="w-4 h-4" />
                      Start
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mijn Taken */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-autronis-text-primary flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-autronis-accent" />
                  Mijn taken
                </h2>
                <span className="text-sm text-autronis-accent font-medium">
                  {mijnTaken.length} open
                </span>
              </div>
              {mijnTaken.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Geen openstaande taken — lekker bezig!
                </p>
              ) : (
                <div className="space-y-3">
                  {mijnTaken.map((taak) => {
                    const prio = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                    return (
                      <div
                        key={taak.id}
                        className="bg-autronis-bg/50 rounded-xl p-4 flex items-center gap-4 group relative"
                      >
                        <button
                          onClick={() => handleTaakAfvinken(taak.id)}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors hover:bg-green-500/20",
                            prio.border
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium text-autronis-text-primary truncate">
                            {taak.titel}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {taak.projectNaam && (
                              <span className="text-sm text-autronis-text-secondary">
                                {taak.projectNaam}
                              </span>
                            )}
                            {taak.deadline && (
                              <span className={cn("text-sm flex items-center gap-1", deadlineKleur(taak.deadline))}>
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
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              <h2 className="text-lg font-semibold text-autronis-text-primary mb-5 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-autronis-accent" />
                Aankomende deadlines
              </h2>
              {deadlines.length === 0 ? (
                <p className="text-base text-autronis-text-secondary">
                  Geen projecten met deadlines.
                </p>
              ) : (
                <div className="space-y-3">
                  {deadlines.map((dl) => (
                    <Link
                      key={dl.projectId}
                      href={`/klanten/${dl.klantId}/projecten/${dl.projectId}`}
                      className="bg-autronis-bg/50 rounded-xl p-4 flex items-center justify-between gap-4 hover:bg-autronis-bg/80 transition-colors block"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-medium text-autronis-text-primary truncate">
                          {dl.projectNaam}
                        </p>
                        <p className="text-sm text-autronis-text-secondary mt-0.5">
                          {dl.klantNaam}
                        </p>
                      </div>
                      <span className={cn("text-sm font-semibold flex-shrink-0", deadlineKleur(dl.deadline))}>
                        {deadlineLabel(dl.deadline)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rechts: Teamgenoot status */}
          <div className="space-y-8">
            {teamgenoot ? (
              <>
                {/* Live status */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-autronis-accent flex items-center justify-center text-sm font-bold text-autronis-bg">
                      {teamgenoot.naam.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-autronis-text-primary">
                        {teamgenoot.naam}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          teamgenoot.actieveTimer ? "bg-green-500 status-pulse" : "bg-slate-500"
                        )} />
                        <span className={cn(
                          "text-sm",
                          teamgenoot.actieveTimer ? "text-green-400" : "text-autronis-text-secondary"
                        )}>
                          {teamgenoot.actieveTimer ? "Aan het werk" : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {teamgenoot.actieveTimer && (
                    <div className="bg-autronis-bg/50 rounded-xl p-4 border-l-3 border-autronis-accent" style={{ borderLeftWidth: "3px" }}>
                      <p className="text-xs text-autronis-text-secondary">Bezig met</p>
                      <p className="text-base font-medium text-autronis-text-primary mt-1">
                        {teamgenoot.actieveTimer.omschrijving || "Geen omschrijving"}
                      </p>
                      <p className="text-sm text-autronis-text-secondary mt-1">
                        {teamgenoot.actieveTimer.projectNaam}
                      </p>
                    </div>
                  )}
                </div>

                {/* Week overzicht */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <h3 className="text-base font-semibold text-autronis-text-primary mb-4">
                    {teamgenoot.naam.split(" ")[0]}&apos;s week
                  </h3>
                  <div className="flex items-end gap-2 h-20 mb-2">
                    {["Ma", "Di", "Wo", "Do", "Vr"].map((dag, i) => {
                      const minuten = teamgenoot.urenPerDag[i] || 0;
                      const hoogte = maxUrenDag > 0 ? (minuten / maxUrenDag) * 100 : 0;
                      return (
                        <div key={dag} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full relative" style={{ height: "80px" }}>
                            <motion.div
                              className={cn(
                                "absolute bottom-0 w-full rounded-t-md",
                                minuten > 0 ? "bg-autronis-accent" : "bg-autronis-border"
                              )}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(hoogte, 4)}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between px-1">
                    {["Ma", "Di", "Wo", "Do", "Vr"].map((dag) => (
                      <span key={dag} className="text-xs text-autronis-text-secondary flex-1 text-center">
                        {dag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold text-autronis-text-primary">
                      {formatUren(teamgenoot.urenTotaal)}
                    </p>
                    <p className="text-sm text-autronis-text-secondary">uren deze week</p>
                  </div>
                </div>

                {/* Taken */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-autronis-text-primary">
                      {teamgenoot.naam.split(" ")[0]}&apos;s taken
                    </h3>
                    <span className="text-xs text-autronis-text-secondary">
                      {teamgenoot.taken.length} open
                    </span>
                  </div>
                  {teamgenoot.taken.length === 0 ? (
                    <p className="text-sm text-autronis-text-secondary">Geen open taken.</p>
                  ) : (
                    <div className="space-y-2">
                      {teamgenoot.taken.map((taak) => (
                        <div
                          key={taak.id}
                          className="bg-autronis-bg/50 rounded-lg p-3"
                        >
                          <p className="text-sm font-medium text-autronis-text-primary truncate">
                            {taak.titel}
                          </p>
                          {taak.projectNaam && (
                            <p className="text-xs text-autronis-text-secondary mt-1">
                              {taak.projectNaam}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
                <p className="text-base text-autronis-text-secondary">
                  Geen teamgenoten gevonden.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Learning Radar widget */}
        <RadarWidget />

        {/* Documenten widget */}
        <DocumentWidget />

      </div>
    </PageTransition>
  );
}
