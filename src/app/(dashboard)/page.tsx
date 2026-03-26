"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAutoSync } from "@/hooks/use-auto-sync";
import {
  Euro,
  Clock,
  FolderKanban,
  AlertTriangle,
  Flame,
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
  ChevronDown,
  Target,
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
import { AnimatedNumber } from "@/components/ui/animated-number";

import { CheckBurst } from "@/components/ui/confetti";
import type { TijdCategorie } from "@/types";
import { DocumentWidget } from "@/components/documenten/document-widget";
import { HabitWidget } from "@/components/gewoontes/habit-widget";
import { FocusWidget } from "@/components/focus/focus-widget";
import { useIdeeen, useGenereerIdeeen, type Idee } from "@/hooks/queries/use-ideeen";
import { useRadarItems, type RadarItem } from "@/hooks/queries/use-radar";
import { useRecentSecondBrain } from "@/hooks/queries/use-second-brain";

// ============ HELPERS ============

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

function trendPercentage(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const pageVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" as const } },
};

// ============ NAV TRACKING ============

const NAV_STORAGE_KEY = "autronis_nav_counts";

function trackNavVisit(path: string) {
  try {
    const counts = JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) ?? "{}") as Record<string, number>;
    counts[path] = (counts[path] ?? 0) + 1;
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Ignore
  }
}

function getTopNavLinks(): { href: string; label: string; icon: string }[] {
  const allLinks = [
    { href: "/gewoontes", label: "Gewoontes", icon: "flame" },
    { href: "/focus", label: "Focus", icon: "clock" },
    { href: "/radar", label: "Learning", icon: "radar" },
    { href: "/second-brain", label: "Second Brain", icon: "brain" },
    { href: "/financien", label: "Financien", icon: "euro" },
    { href: "/analytics", label: "Analytics", icon: "trending" },
    { href: "/leads", label: "Leads", icon: "trending" },
    { href: "/klanten", label: "Klanten", icon: "folder" },
    { href: "/sales-engine", label: "Sales Engine", icon: "zap" },
    { href: "/content", label: "Content", icon: "sparkles" },
    { href: "/belasting", label: "Belasting", icon: "euro" },
    { href: "/kilometers", label: "Kilometers", icon: "trending" },
  ];

  try {
    const counts = JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) ?? "{}") as Record<string, number>;
    return allLinks
      .sort((a, b) => (counts[b.href] ?? 0) - (counts[a.href] ?? 0))
      .slice(0, 6);
  } catch {
    return allLinks.slice(0, 6);
  }
}

const navIcons: Record<string, typeof Flame> = {
  flame: Flame,
  clock: Clock,
  radar: Radar,
  brain: Brain,
  euro: Euro,
  trending: TrendingUp,
  folder: FolderKanban,
  zap: Zap,
  sparkles: Sparkles,
};

// ============ TYPEWRITER HOOK ============

function useTypewriter(text: string, speed = 8): string {
  const [displayed, setDisplayed] = useState("");
  const hasRun = useRef(false);
  useEffect(() => {
    if (!text) { setDisplayed(""); return; }
    if (hasRun.current) { setDisplayed(text); return; }
    hasRun.current = true;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

// ============ DAG VOORTGANG RING ============

function DagVoortgang({ afgerond, totaal }: { afgerond: number; totaal: number }) {
  const pct = totaal === 0 ? 0 : Math.round((afgerond / (afgerond + totaal)) * 100);
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-11 h-11">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-autronis-border" />
          <motion.circle
            cx="22" cy="22" r="18" fill="none" strokeWidth="3" strokeLinecap="round"
            className="text-autronis-accent"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            style={{ strokeDasharray: circumference }}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-autronis-accent tabular-nums">
          {pct}%
        </span>
      </div>
      <div>
        <p className="text-xs text-autronis-text-secondary">Dagvoortgang</p>
        <p className="text-sm font-semibold text-autronis-text-primary tabular-nums">{afgerond}/{afgerond + totaal} taken</p>
      </div>
    </div>
  );
}

// ============ DAILY BRIEFING ============

function DailyBriefing() {
  const vandaag = new Date().toISOString().slice(0, 10);
  const { data: briefing, isLoading } = useBriefing(vandaag);
  const genereer = useGenereerBriefing();
  const { addToast } = useToast();
  const samenvattingTyped = useTypewriter(briefing?.samenvatting ?? "");

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
      <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6">
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
        <button onClick={handleGenereer} className="inline-flex items-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 btn-press">
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
        <div className="flex items-center justify-center gap-1">
          <span className="text-autronis-text-secondary text-sm">Claude genereert</span>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="w-1 h-1 rounded-full bg-autronis-accent inline-block" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-3.5 space-y-2 card-gradient">
      {/* Header met samenvatting */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-autronis-accent shrink-0" />
            <h2 className="text-sm font-semibold text-autronis-text-primary shrink-0">Dagbriefing</h2>
          </div>
          {samenvattingTyped && (
            <p className="text-xs text-autronis-text-secondary leading-relaxed line-clamp-2">
              {samenvattingTyped}
            </p>
          )}
        </div>
        <button onClick={handleGenereer} disabled={genereer.isPending} className="flex-shrink-0 p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent hover:bg-autronis-accent/10 transition-colors disabled:opacity-50 mt-0.5" title="Vernieuwen">
          <motion.div animate={genereer.isPending ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.6, repeat: genereer.isPending ? Infinity : 0, ease: "linear" }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </motion.div>
        </button>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left: Agenda + Taken */}
        <div className="space-y-3">
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
                    <Link key={taak.id} href="/taken" className="flex items-center gap-3 group hover:bg-autronis-bg/50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", cfg.color, cfg.bg)}>{taak.prioriteit}</span>
                      <span className="text-base text-autronis-text-primary truncate min-w-0 flex-1 group-hover:text-autronis-accent transition-colors">{taak.titel}</span>
                      {taak.projectNaam && <span className="text-xs text-autronis-text-secondary flex-shrink-0 hidden lg:inline max-w-[120px] truncate">{taak.projectNaam}</span>}
                    </Link>
                  );
                })}
                {briefing.takenPrioriteit.length > 3 && (
                  <Link href="/taken" className="text-xs text-autronis-accent hover:underline">+{briefing.takenPrioriteit.length - 3} meer taken &rarr;</Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Project updates + Quick wins */}
        <div className="space-y-3">
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
                        <div className={cn("h-full rounded-full transition-all", voortgangKleur(project.voortgang))} style={{ width: `${project.voortgang}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-autronis-text-secondary">{project.klantNaam}</span>
                        {project.deadline && <span className={cn("text-xs", deadlineKleur(project.deadline))}>{deadlineLabel(project.deadline)}</span>}
                      </div>
                    </div>
                  ))}
                  {activeUpdates.length > 4 && <Link href="/projecten" className="text-xs text-autronis-accent hover:underline">+{activeUpdates.length - 4} meer &rarr;</Link>}
                </div>
              );
            })()}
          </div>

          {/* Quick wins — alleen tonen als er data is */}
          {briefing.quickWins.length > 0 && (
            <div className="bg-autronis-bg/50 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-autronis-text-primary mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-autronis-accent" />
                Quick wins
              </h3>
              <div className="space-y-2">
                {briefing.quickWins.slice(0, 2).map((qw) => (
                  <Link key={qw.id} href="/taken" className="flex items-center gap-3 group hover:bg-autronis-bg/50 rounded-lg p-1.5 -mx-1.5 transition-colors">
                    <div className="w-4 h-4 rounded border border-autronis-border flex-shrink-0 group-hover:border-autronis-accent transition-colors" />
                    <span className="text-sm text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">{qw.titel}</span>
                    {qw.projectNaam && <span className="text-xs text-autronis-text-secondary flex-shrink-0 hidden sm:inline">{qw.projectNaam}</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ IDEE VAN DE DAG ============

function IdeeVanDeDag() {
  const { data: ideeen = [] } = useIdeeen();
  const genereer = useGenereerIdeeen();
  const { addToast } = useToast();

  const vandaag = new Date().toISOString().slice(0, 10);
  const aiIdeeenVandaag = ideeen.filter((i: Idee) => i.isAiSuggestie === 1 && i.aangemaaktOp?.slice(0, 10) === vandaag);
  const dagIndex = Math.floor(Date.now() / 86400000);
  const beste = aiIdeeenVandaag.length > 0
    ? aiIdeeenVandaag.reduce((a: Idee, b: Idee) => ((a.aiScore ?? 0) >= (b.aiScore ?? 0) ? a : b))
    : ideeen.length > 0 ? ideeen[dagIndex % ideeen.length] : null;

  const handleGenereer = () => {
    genereer.mutate(undefined, {
      onSuccess: () => addToast("Nieuwe ideeen gegenereerd", "succes"),
      onError: () => addToast("Kon ideeen niet genereren", "fout"),
    });
  };

  if (!beste) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow card-gradient flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl"><Lightbulb className="w-5 h-5 text-amber-400" /></div>
          <div>
            <p className="text-sm font-semibold text-autronis-text-primary">Idee van de dag</p>
            <p className="text-xs text-autronis-text-secondary">Nog geen AI-ideeen vandaag</p>
          </div>
        </div>
        <button onClick={handleGenereer} disabled={genereer.isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 btn-press">
          {genereer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Genereer
        </button>
      </div>
    );
  }

  return (
    <div className="bg-autronis-card border border-amber-500/20 rounded-2xl p-5 card-glow card-gradient">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-amber-500/10 rounded-xl flex-shrink-0 mt-0.5"><Lightbulb className="w-5 h-5 text-amber-400" /></div>
          <div className="min-w-0">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wide mb-1">Idee van de dag</p>
            <p className="text-base font-semibold text-autronis-text-primary truncate">{beste.naam}</p>
            {beste.omschrijving && <p className="text-sm text-autronis-text-secondary mt-1 line-clamp-2">{beste.omschrijving}</p>}
            <div className="flex items-center gap-2 mt-2">
              {beste.aiScore != null && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 tabular-nums">Score: {beste.aiScore}/10</span>
              )}
              {beste.doelgroep && (
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", beste.doelgroep === "klant" ? "bg-blue-500/15 text-blue-400" : "bg-autronis-accent/15 text-autronis-accent")}>
                  {beste.doelgroep === "klant" ? "Klant" : "Persoonlijk"}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link href="/ideeen" className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-autronis-accent hover:text-autronis-accent-hover transition-colors flex-shrink-0">
          Bekijken <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ============ LEARNING RADAR WIDGET ============

const categorieBadgeKleur: Record<string, string> = {
  tools: "bg-blue-500/15 text-blue-400",
  ai_tools: "bg-purple-500/15 text-purple-400",
  api_updates: "bg-purple-500/15 text-purple-400",
  trends: "bg-orange-500/15 text-orange-400",
  kansen: "bg-green-500/15 text-green-400",
  must_reads: "bg-red-500/15 text-red-400",
  automation: "bg-cyan-500/15 text-cyan-400",
};

const categorieLabels: Record<string, string> = {
  tools: "Tools",
  ai_tools: "AI Tools",
  api_updates: "API Updates",
  trends: "Trends",
  kansen: "Kansen",
  must_reads: "Must-reads",
  automation: "Automation",
};

function RadarWidget() {
  const { data: items = [], isLoading } = useRadarItems({ minScore: 7 });
  const topItems = items.slice(0, 3);

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Radar className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Learning Radar</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="bg-autronis-bg/50 rounded-xl p-3 animate-pulse h-12" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Learning Radar</h2>
          <span className="text-xs text-autronis-text-secondary">({items.length})</span>
        </div>
        <Link href="/radar" className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors flex items-center gap-1">
          Alles <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {topItems.length === 0 ? (
        <p className="text-sm text-autronis-text-secondary">Nog geen items met hoge score.</p>
      ) : (
        <div className="space-y-2">
          {topItems.map((item) => (
            <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 bg-autronis-bg/50 rounded-xl p-3 hover:bg-autronis-bg/80 transition-colors group">
              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums flex-shrink-0 mt-0.5", item.score != null && item.score >= 8 ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400")}>
                {item.score}/10
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-autronis-text-primary group-hover:text-autronis-accent transition-colors line-clamp-1">{item.titel}</p>
                {item.categorie && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-flex", categorieBadgeKleur[item.categorie] ?? "bg-autronis-border text-autronis-text-secondary")}>
                    {categorieLabels[item.categorie] ?? item.categorie}
                  </span>
                )}
              </div>
              <ExternalLink className="w-3 h-3 text-autronis-text-secondary/30 group-hover:text-autronis-accent transition-colors flex-shrink-0 mt-0.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ SECOND BRAIN WIDGET ============

function SecondBrainWidget() {
  const { data: items } = useRecentSecondBrain(4);
  const typeIcons: Record<string, typeof FileText> = {
    tekst: FileText, url: Link2, afbeelding: ImageIcon, pdf: FileDown, code: Code,
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Second Brain</h2>
        </div>
        <Link href="/second-brain" className="text-xs text-autronis-accent hover:text-autronis-accent-hover flex items-center gap-1">
          Alles <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const TypeIcon = typeIcons[item.type] ?? FileText;
          return (
            <Link key={item.id} href="/second-brain" className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-autronis-bg/50 transition-colors group">
              <TypeIcon className="w-3.5 h-3.5 text-autronis-text-secondary/60 flex-shrink-0" />
              <span className="text-xs text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">{item.titel}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============

export default function DashboardPage() {
  useAutoSync();
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

  // CheckBurst + task animation
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  // Focus card expanded
  const [takenExpanded, setTakenExpanded] = useState(false);

  // Belasting deadline alerts
  const [urgentDeadlines, setUrgentDeadlines] = useState<Array<{ omschrijving: string; datum: string; dagenOver: number }>>([]);

  // Concurrent updates
  const [concurrentData, setConcurrentData] = useState<{
    wijzigingenDezeWeek: number;
    highlights: Array<{ concurrentNaam: string; tekst: string; type: string }>;
    laatsteScan: string | null;
  } | null>(null);

  // Timer collapsed state
  const [timerCollapsed, setTimerCollapsed] = useState(true);

  // Dynamic navigation
  const topNavLinks = useMemo(() => getTopNavLinks(), []);

  useEffect(() => {
    fetch(`/api/belasting/deadlines?jaar=${new Date().getFullYear()}`)
      .then(r => r.json())
      .then(data => {
        const nu = new Date();
        const urgent = (data.deadlines || [])
          .filter((d: { afgerond: number; datum: string }) => !d.afgerond)
          .map((d: { omschrijving: string; datum: string }) => {
            const dagen = Math.ceil((new Date(d.datum).getTime() - nu.getTime()) / 86400000);
            return { ...d, dagenOver: dagen };
          })
          .filter((d: { dagenOver: number }) => d.dagenOver <= 7 && d.dagenOver >= -30);
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
      document.title = `\u23F1 ${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")} \u2014 ${projectNaam} | Autronis`;
    };
    updateTitle();
    const interval = setInterval(updateTitle, 1000);
    return () => { clearInterval(interval); document.title = "Dashboard | Autronis"; };
  }, [timer.isRunning, timer.elapsed, timer.projectId, data?.projecten]);

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: Number(timerProjectId), omschrijving: timerOmschrijving || null, categorie: timerCategorie }),
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
      setCompletingTaskId(null);
      setTimeout(() => setCompletedTaskId(null), 500);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => addToast("Kon taak niet bijwerken", "fout"),
  });

  const handleStartTimer = () => {
    if (!timerProjectId) { addToast("Selecteer een project", "fout"); return; }
    startTimerMutation.mutate();
  };

  const handleStopTimer = () => {
    if (!timer.registratieId) return;
    stopTimerMutation.mutate();
  };

  const handleTaakAfvinken = (taakId: number) => {
    setCompletingTaskId(taakId);
    setTimeout(() => completeTaakMutation.mutate(taakId), 300);
  };

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto p-4 lg:p-8"><SkeletonDashboard /></div>;
  }

  if (!data) return null;

  const { gebruiker, kpis, mijnTaken, deadlines, teamgenoot, projecten } = data;

  // KPI trends
  const omzetTrend = trendPercentage(kpis.omzetDezeMaand, kpis.omzetVorigeMaand);
  const urenTrend = trendPercentage(kpis.urenDezeWeek.eigen, kpis.urenVorigeWeek);

  // Visible tasks (for expanded/collapsed)
  const critical = mijnTaken.filter((t) => t.prioriteit === "hoog");
  const normal = mijnTaken.filter((t) => t.prioriteit !== "hoog");
  const nextTask = mijnTaken[0];
  const visibleTasks = takenExpanded ? mijnTaken.slice(1) : mijnTaken.slice(1, 4);

  return (
    <PageTransition>
      <motion.div className="max-w-[1240px] mx-auto space-y-2.5" variants={pageVariants} initial="hidden" animate="visible">

        {/* Begroeting + dag voortgang */}
        <motion.div variants={sectionVariants} className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-autronis-text-primary tracking-tight">
              {getBegroeting()}, {gebruiker.naam.split(" ")[0]}
            </h1>
            <p className="text-sm text-autronis-text-secondary capitalize">{getDatumString()}</p>
          </div>
          <DagVoortgang afgerond={kpis.takenAfgerondVandaag} totaal={mijnTaken.length} />
        </motion.div>

        {/* Belasting deadline alert */}
        {urgentDeadlines.length > 0 && (
          <Link href="/belasting" className="block">
            <div className="bg-gradient-to-r from-red-500/15 via-orange-500/15 to-red-500/15 border border-red-500/30 rounded-2xl p-4 hover:border-red-500/50 transition-colors">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  {urgentDeadlines.map((d) => (
                    <div key={d.omschrijving} className="flex items-center justify-between text-sm">
                      <span className="text-autronis-text-primary font-medium">{d.omschrijving}</span>
                      <span className={cn("tabular-nums font-medium", d.dagenOver < 0 ? "text-red-400" : d.dagenOver <= 3 ? "text-red-400" : "text-orange-400")}>
                        {d.dagenOver < 0 ? `${Math.abs(d.dagenOver)} dagen te laat` : d.dagenOver === 0 ? "Vandaag!" : `${d.dagenOver} dagen`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* KPI's met trends */}
        <motion.div variants={sectionVariants} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          <Link href="/financien" className="block">
            <KPICard label="Omzet deze maand" value={kpis.omzetDezeMaand} format={(n) => n === 0 ? "\u2014" : formatBedrag(n)} icon={<Euro className="w-5 h-5" />} color="emerald" index={0} className={kpis.omzetDezeMaand === 0 ? "opacity-50" : ""} trend={kpis.omzetVorigeMaand > 0 ? { value: omzetTrend } : undefined} />
          </Link>
          <Link href="/tijdregistratie" className="block">
            <KPICard label="Uren deze week" value={kpis.urenDezeWeek.totaal} format={(n) => n === 0 ? "\u2014" : formatUren(Math.round(n))} icon={<Clock className="w-5 h-5" />} color="blue" index={1} className={kpis.urenDezeWeek.totaal === 0 ? "opacity-50" : ""} trend={kpis.urenVorigeWeek > 0 ? { value: urenTrend } : undefined} />
          </Link>
          <Link href="/projecten" className="block">
            <KPICard label="Actieve projecten" value={kpis.actieveProjecten} format={(n) => n === 0 ? "\u2014" : String(n)} icon={<FolderKanban className="w-5 h-5" />} color="purple" index={2} className={kpis.actieveProjecten === 0 ? "opacity-50" : ""} />
          </Link>
          <Link href="/taken" className="block">
            <KPICard label="Taken vandaag" value={mijnTaken.length} format={(n) => String(n)} icon={<ListChecks className="w-5 h-5" />} color="accent" index={3} target={kpis.takenAfgerondVandaag > 0 ? { current: kpis.takenAfgerondVandaag, goal: kpis.takenAfgerondVandaag + mijnTaken.length } : undefined} />
          </Link>
          <Link href="/agenda" className="block">
            <KPICard label="Deadlines deze week" value={kpis.deadlinesDezeWeek} format={(n) => String(n)} icon={<AlertTriangle className="w-5 h-5" />} color={kpis.deadlinesDezeWeek > 0 ? "red" : "accent"} index={4} />
          </Link>
        </motion.div>

        {/* Inzichten alert bar — prominent under KPIs */}
        {inzichten.length > 0 && (
          <motion.div variants={sectionVariants} className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {inzichten.map((inzicht) => {
              const config = inzichtConfig[inzicht.type];
              const Icon = config.icon;
              return (
                <motion.div
                  key={inzicht.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn("flex items-center gap-2.5 rounded-xl px-4 py-2.5 border flex-shrink-0", config.bg, config.border)}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", config.color)} />
                  <span className={cn("text-xs font-semibold whitespace-nowrap", config.color)}>{inzicht.titel}</span>
                  {inzicht.actie && (
                    <Link href={inzicht.actie.link} className={cn("text-[11px] font-medium hover:underline whitespace-nowrap flex items-center gap-0.5", config.color)}>
                      {inzicht.actie.label} <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Focus Card — Wat moet je nu doen? (merged with Mijn taken) */}
        {mijnTaken.length > 0 && (
          <motion.div variants={sectionVariants} className="bg-gradient-to-r from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/20 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="w-4 h-4 text-autronis-accent shrink-0" />
              <h2 className="text-sm font-bold text-autronis-text-primary">Wat moet je nu doen?</h2>
              <div className="flex items-center gap-2 ml-auto">
                {critical.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-400 tabular-nums animate-pulse">{critical.length} urgent</span>
                )}
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-autronis-bg/60 text-autronis-text-secondary tabular-nums">{mijnTaken.length} open</span>
              </div>
            </div>

            {/* Hero task */}
            {nextTask && (
              <div className="flex items-center gap-3 bg-autronis-accent/10 border border-autronis-accent/20 rounded-xl px-4 py-3 mb-2.5">
                <Play className="w-4 h-4 text-autronis-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-autronis-text-primary truncate">{nextTask.titel}</p>
                  {nextTask.projectNaam && <p className="text-xs text-autronis-text-secondary">{nextTask.projectNaam}</p>}
                </div>
                <button onClick={() => handleTaakAfvinken(nextTask.id)} className="px-3 py-1.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-lg text-xs font-semibold transition-colors shrink-0">
                  Afvinken
                </button>
              </div>
            )}

            {/* Remaining tasks */}
            <AnimatePresence mode="popLayout">
              {visibleTasks.map((taak, idx) => {
                const prio = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                return (
                  <motion.div
                    key={taak.id}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
                    transition={{ duration: 0.18, delay: idx * 0.04 }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-autronis-bg/40 transition-all",
                      completingTaskId === taak.id && "opacity-40 line-through"
                    )}
                  >
                    <button onClick={() => handleTaakAfvinken(taak.id)} className={cn("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors hover:bg-green-500/20", prio.border)} />
                    <span className="text-sm text-autronis-text-primary truncate flex-1">{taak.titel}</span>
                    {taak.projectNaam && <span className="text-xs text-autronis-text-secondary hidden sm:inline truncate max-w-[120px]">{taak.projectNaam}</span>}
                    {taak.prioriteit === "hoog" && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                    {taak.deadline && <span className={cn("text-[11px] shrink-0 hidden md:inline", deadlineKleur(taak.deadline))}>{deadlineLabel(taak.deadline)}</span>}
                    <CheckBurst active={completedTaskId === taak.id} />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Expand/collapse */}
            {mijnTaken.length > 4 && (
              <button onClick={() => setTakenExpanded(!takenExpanded)} className="flex items-center gap-1 text-xs text-autronis-accent font-medium px-3 pt-1.5 hover:text-autronis-accent-hover transition-colors">
                <ChevronDown className={cn("w-3 h-3 transition-transform", takenExpanded && "rotate-180")} />
                {takenExpanded ? "Minder tonen" : `+${mijnTaken.length - 4} meer taken`}
              </button>
            )}
          </motion.div>
        )}

        {/* Main 2-column layout */}
        {/* Gewoontes — compact */}
        <motion.div variants={sectionVariants}>
          <HabitWidget compact />
        </motion.div>

        <motion.div variants={sectionVariants} className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-3 min-w-0">
          {/* Left column */}
          <div className="space-y-3 min-w-0 overflow-hidden">
            {/* Projecten */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow">
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-autronis-accent" />
                  Projecten
                </h2>
                <Link href="/projecten" className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium">
                  Alles <ArrowRight className="w-3 h-3 inline" />
                </Link>
              </div>
              <div className="space-y-1">
                {projecten.filter((p) => p.status === "actief").slice(0, 5).map((p) => {
                  const pct = p.voortgang ?? 0;
                  return (
                    <motion.div key={p.id} whileHover={{ x: 2 }} transition={{ duration: 0.15 }}>
                      <Link href={`/projecten/${p.id}`} className={cn(
                        "flex items-center gap-3 px-2.5 py-1.5 rounded-lg hover:bg-autronis-bg/50 transition-colors group",
                        pct >= 90 && "border-l-2 border-l-emerald-400/60 pl-2"
                      )}>
                        <span className="text-sm text-autronis-text-primary group-hover:text-autronis-accent truncate flex-1">{p.naam}</span>
                        {pct >= 90 && <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex-shrink-0">Bijna af!</span>}
                        <div className="w-16 h-1.5 bg-autronis-border rounded-full overflow-hidden shrink-0">
                          <motion.div
                            className={cn("h-full rounded-full", pct >= 80 ? "bg-emerald-400" : pct >= 40 ? "bg-autronis-accent" : "bg-amber-400")}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                          />
                        </div>
                        <span className="text-[11px] text-autronis-text-secondary tabular-nums w-8 text-right shrink-0">{pct}%</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Dagbriefing */}
            <DailyBriefing />
          </div>

          {/* Right column */}
          <div className="space-y-3 min-w-0">
            {/* Dynamic snelle navigatie */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-3.5 card-glow">
              <h3 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">Snelle navigatie</h3>
              <div className="grid grid-cols-2 gap-2">
                {topNavLinks.map(({ href, label, icon }) => {
                  const NavIcon = navIcons[icon] ?? Flame;
                  return (
                    <Link key={href} href={href} onClick={() => trackNavVisit(href)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-autronis-bg/50 hover:bg-autronis-bg transition-colors group">
                      <NavIcon className="w-3.5 h-3.5 text-autronis-text-secondary/70 group-hover:text-autronis-accent transition-colors" />
                      <span className="text-xs font-medium text-autronis-text-primary group-hover:text-autronis-accent">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Deadlines */}
            {deadlines.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-3.5 card-glow">
                <h3 className="text-sm font-semibold text-autronis-text-primary mb-2 flex items-center gap-2">
                  <CalendarDays className="w-3.5 h-3.5 text-autronis-accent" />
                  Deadlines
                </h3>
                <div className="space-y-1.5">
                  {deadlines.map((dl) => (
                    <Link key={dl.projectId} href={`/klanten/${dl.klantId}/projecten/${dl.projectId}`} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-autronis-bg/50 transition-colors">
                      <span className="text-xs text-autronis-text-primary truncate">{dl.projectNaam}</span>
                      <span className={cn("text-[11px] font-semibold shrink-0 ml-2", deadlineKleur(dl.deadline))}>{deadlineLabel(dl.deadline)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Documenten */}
            <DocumentWidget />

            {/* Teamgenoot — alleen als actief */}
            {teamgenoot?.actieveTimer && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-autronis-accent flex items-center justify-center text-xs font-bold text-autronis-bg">
                    {teamgenoot.naam.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-autronis-text-primary">{teamgenoot.naam}</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 status-pulse" />
                      <span className="text-xs text-green-400">Aan het werk</span>
                    </div>
                  </div>
                </div>
                <div className="bg-autronis-bg/50 rounded-xl p-3 border-l-3 border-autronis-accent" style={{ borderLeftWidth: "3px" }}>
                  <p className="text-xs text-autronis-text-secondary">Bezig met</p>
                  <p className="text-sm font-medium text-autronis-text-primary mt-0.5">{teamgenoot.actieveTimer.omschrijving || "Geen omschrijving"}</p>
                  <p className="text-xs text-autronis-text-secondary mt-0.5">{teamgenoot.actieveTimer.projectNaam}</p>
                </div>
              </div>
            )}

            {/* Idee van de dag */}
            <IdeeVanDeDag />

            {/* Learning Radar */}
            <RadarWidget />

            {/* Second Brain */}
            <SecondBrainWidget />

            {/* Concurrent updates */}
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
                      <span className={cn("mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full", h.type === "kans" ? "bg-green-400" : "bg-autronis-accent")} />
                      <span className="text-autronis-text-secondary">
                        <strong className="text-autronis-text-primary">{h.concurrentNaam}</strong>{" "}{h.tekst}
                      </span>
                    </div>
                  ))}
                </div>
                <Link href="/concurrenten" className="mt-3 block text-xs text-autronis-accent hover:underline">
                  Bekijk alle concurrenten &rarr;
                </Link>
              </section>
            )}
          </div>
        </motion.div>

        {/* Spacer for timer bar */}
        <div className={cn("transition-all", timer.isRunning ? "h-4 md:h-20" : "h-4 md:h-14")} />
      </motion.div>

      {/* Fixed timer bar — collapsible when idle */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-autronis-card/95 backdrop-blur-md border-t border-autronis-border shadow-2xl shadow-black/40 hidden md:block">
        <div className="max-w-[1400px] mx-auto">
          {timer.isRunning ? (
            <div className="p-2.5">
              <div className="bg-autronis-card border border-autronis-border rounded-xl p-2.5 card-glow">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-autronis-text-primary font-medium truncate block">{timer.omschrijving || "Timer"}</span>
                    <span className="text-xs text-autronis-text-secondary hidden sm:inline">{projecten.find((p) => p.id === timer.projectId)?.naam || ""}</span>
                  </div>
                  <span className="text-lg font-bold text-autronis-accent font-mono tabular-nums">{formatElapsed(timer.elapsed)}</span>
                  <button onClick={handleStopTimer} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-autronis-text-primary rounded-lg text-xs font-semibold transition-colors btn-press flex-shrink-0">
                    <Square className="w-3 h-3" /> Stop
                  </button>
                </div>
              </div>
            </div>
          ) : timerCollapsed ? (
            <button onClick={() => setTimerCollapsed(false)} className="w-full flex items-center justify-center gap-2 py-2 text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors">
              <Clock className="w-3.5 h-3.5" />
              <span>Timer starten</span>
            </button>
          ) : (
            <div className="p-2.5">
              <div className="bg-autronis-card border border-autronis-border rounded-xl p-2.5 card-glow">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-autronis-accent flex-shrink-0" />
                  <select value={timerProjectId} onChange={(e) => setTimerProjectId(e.target.value)} className="appearance-none bg-autronis-bg border border-autronis-border rounded-lg px-3 pr-7 py-2 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent flex-1 min-w-0 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%238A9BA0%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat">
                    <option value="">Project...</option>
                    {projecten.map((p) => <option key={p.id} value={p.id}>{p.naam} &mdash; {p.klantNaam}</option>)}
                  </select>
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
                  <button onClick={() => setTimerCollapsed(true)} className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors flex-shrink-0">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
