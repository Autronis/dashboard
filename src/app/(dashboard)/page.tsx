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
  Layers,
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

import { CheckBurst } from "@/components/ui/confetti-dynamic";
import type { TijdCategorie } from "@/types";
import { DocumentWidget } from "@/components/documenten/document-widget";
import { TeamLiveWidget } from "@/components/team/team-live-widget";
import { FinancieleSnapshotWidget } from "@/components/dashboard/financiele-snapshot-widget";
import { ProspectRadarWidget } from "@/components/dashboard/prospect-radar-widget";
import { OpenIntakesWidget } from "@/components/dashboard/open-intakes-widget";
import { RemoteCommitsBanner } from "@/components/dashboard/remote-commits-banner";
import { SnelleActiesWidget } from "@/components/dashboard/snelle-acties-widget";
import { SalesPipelineWidget } from "@/components/dashboard/sales-pipeline-widget";

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

// Alle inzichten hebben dezelfde neutrale pill-look (card-bg + subtiele border),
// het type bepaalt enkel de icoon-kleur zodat je in één oogopslag ziet of het
// een waarschuwing/kans/tip/succes is. Voorheen had elk type een volledig
// gekleurde bg — dat vloekte met de rest van het dashboard.
const inzichtConfig: Record<Inzicht["type"], { icon: typeof Lightbulb; iconColor: string }> = {
  waarschuwing: { icon: ShieldAlert, iconColor: "text-red-400" },
  kans: { icon: TrendingUp, iconColor: "text-autronis-accent" },
  tip: { icon: Lightbulb, iconColor: "text-amber-400" },
  succes: { icon: CheckCircle2, iconColor: "text-emerald-400" },
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
    { href: "/radar", label: "Learning", icon: "radar" },
    { href: "/second-brain", label: "Second Brain", icon: "brain" },
    { href: "/financien", label: "Financien", icon: "euro" },
    { href: "/analytics", label: "Analytics", icon: "trending" },
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

          {/* Input-shortcuts — kennis/idee/taak droppen vanaf hier.
              Past in de lege ruimte onder Agenda, houdt alle focus op 'dropping'. */}
          <SnelleActiesWidget compact variant="input" />
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

  // Timer collapsed state
  const [timerCollapsed, setTimerCollapsed] = useState(true);

  // Dynamic navigation
  const topNavLinks = useMemo(() => getTopNavLinks(), []);

  // Lower-priority data: only fetch on desktop (>= 768px) to reduce mobile load
  useEffect(() => {
    if (window.innerWidth < 768) return;

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
      .catch(() => addToast("Kon deadlines niet laden", "fout"));
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
      if (!res.ok) throw new Error("Timer starten mislukt");
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
      if (!res.ok) throw new Error("Timer stoppen mislukt");
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
      if (!res.ok) throw new Error("Taak bijwerken mislukt");
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

  const { gebruiker, kpis, mijnTaken, actielijsten, deadlines, teamgenoot, projecten } = data;

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
      <motion.div className="max-w-[1240px] mx-auto space-y-5" variants={pageVariants} initial="hidden" animate="visible">

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
            <KPICard label="Uren deze week" value={kpis.urenDezeWeek.eigen} format={(n) => n === 0 ? "\u2014" : formatUren(Math.round(n))} icon={<Clock className="w-5 h-5" />} color="blue" index={1} className={kpis.urenDezeWeek.eigen === 0 ? "opacity-50" : ""} trend={kpis.urenDezeWeek.eigen > 0 && kpis.urenVorigeWeek > 0 ? { value: urenTrend } : undefined} />
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
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 border border-autronis-border bg-autronis-card flex-shrink-0"
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", config.iconColor)} />
                  <span className="text-xs font-semibold text-autronis-text-primary whitespace-nowrap">{inzicht.titel}</span>
                  {inzicht.actie && (
                    <Link href={inzicht.actie.link} className="text-[11px] font-medium text-autronis-accent hover:text-autronis-accent-hover hover:underline whitespace-nowrap flex items-center gap-0.5">
                      {inzicht.actie.label} <ArrowRight className="w-2.5 h-2.5" />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Remote commits banner — alert voor ongepullde commits van team-projecten */}
        <motion.div variants={sectionVariants}>
          <RemoteCommitsBanner />
        </motion.div>

        {/* 3-kolom focus strip — Sales pipeline + Nu uitvoeren + Mijn taken.
            Sluit aan op go-to-market mindset: waar sta ik in de funnel,
            welke actie start ik nu, wat staat er op m'n lijst. */}
        <motion.div variants={sectionVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SalesPipelineWidget />

          {mijnTaken.length > 0 && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-autronis-accent" />
                Mijn taken
              </h3>
              <Link href="/taken" className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium flex items-center gap-1 transition-colors">
                Alles bekijken <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Focus taak */}
            {nextTask && (
              <div className="bg-gradient-to-r from-autronis-accent/10 to-autronis-accent/5 border border-autronis-accent/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={async () => {
                      await fetch(`/api/taken/${nextTask.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "afgerond" }),
                      });
                      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                      addToast("Taak afgerond", "succes");
                    }}
                    className="mt-0.5 w-5 h-5 rounded-full border-2 border-autronis-accent/50 hover:border-autronis-accent hover:bg-autronis-accent/20 transition-all flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-autronis-accent font-semibold">Volgende taak</span>
                      {nextTask.prioriteit === "hoog" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">Urgent</span>
                      )}
                    </div>
                    <p className="text-base font-medium text-autronis-text-primary">{nextTask.titel}</p>
                    {nextTask.omschrijving && (
                      <p className="text-xs text-autronis-text-secondary mt-1 line-clamp-1">{nextTask.omschrijving}</p>
                    )}
                  </div>
                  {nextTask.deadline && (
                    <span className={cn("text-[11px] font-medium tabular-nums flex-shrink-0", deadlineKleur(nextTask.deadline))}>
                      {deadlineLabel(nextTask.deadline)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Overige taken */}
            {visibleTasks.length > 0 && (
              <div className="space-y-1">
                {visibleTasks.map((taak) => {
                  const prioConfig: Record<string, { color: string; bg: string }> = {
                    hoog: { color: "text-red-400", bg: "bg-red-500/10" },
                    normaal: { color: "text-blue-400", bg: "bg-blue-500/10" },
                    laag: { color: "text-slate-400", bg: "bg-slate-500/10" },
                  };
                  const pc = prioConfig[taak.prioriteit] || prioConfig.normaal;
                  return (
                    <div key={taak.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-autronis-bg/50 transition-colors group">
                      <button
                        onClick={async () => {
                          await fetch(`/api/taken/${taak.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "afgerond" }),
                          });
                          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                          addToast("Taak afgerond", "succes");
                        }}
                        className="w-4 h-4 rounded-full border-2 border-autronis-border hover:border-autronis-accent hover:bg-autronis-accent/20 transition-all flex-shrink-0"
                      />
                      <span className="text-sm text-autronis-text-primary flex-1 truncate group-hover:text-autronis-accent transition-colors">{taak.titel}</span>
                      {taak.deadline && (
                        <span className={cn("text-[10px] font-medium tabular-nums flex-shrink-0", deadlineKleur(taak.deadline))}>
                          {deadlineLabel(taak.deadline)}
                        </span>
                      )}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0", pc.color, pc.bg)}>{taak.prioriteit}</span>
                    </div>
                  );
                })}
                {mijnTaken.length > 4 && !takenExpanded && (
                  <button
                    onClick={() => setTakenExpanded(true)}
                    className="w-full text-center text-xs text-autronis-text-secondary hover:text-autronis-accent py-1.5 transition-colors"
                  >
                    +{mijnTaken.length - 4} meer
                  </button>
                )}
                {takenExpanded && mijnTaken.length > 4 && (
                  <button
                    onClick={() => setTakenExpanded(false)}
                    className="w-full text-center text-xs text-autronis-text-secondary hover:text-autronis-accent py-1.5 transition-colors"
                  >
                    Inklappen
                  </button>
                )}
              </div>
            )}
          </div>
          )}
        </motion.div>

        {/* Daily briefing — direct na taken zodat je je dag start kan zien */}
        <motion.div variants={sectionVariants}>
          <DailyBriefing />
        </motion.div>

        {/* Business health — financieel + team live + prospect radar.
            Vervangt lege Doelen/TeamVergelijking/Efficiency widgets met
            actie-gerichte info per kolom: geld binnen, wie werkt aan wat,
            welke leads vragen aandacht. */}
        <motion.div variants={sectionVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FinancieleSnapshotWidget />
          <TeamLiveWidget />
          <ProspectRadarWidget />
        </motion.div>

        <motion.div variants={sectionVariants} className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-5 min-w-0">
          {/* Left column */}
          <div className="space-y-5 min-w-0 overflow-hidden">
            {/* Open intakes — projecten in de pijplijn */}
            <OpenIntakesWidget />
          </div>

          {/* Right column */}
          <div className="space-y-4 min-w-0">
            {/* Actie shortcuts verplaatst naar 3-kolom focus strip bovenaan —
                was dubbel. */}

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

            {/* Actielijsten — projectloze taken gegroepeerd op fase */}
            {actielijsten.length > 0 && (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-3.5 card-glow">
                <h3 className="text-sm font-semibold text-autronis-text-primary mb-2.5 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-autronis-accent" />
                  Actielijsten
                </h3>
                <div className="space-y-2.5">
                  {actielijsten.filter((a) => a.fase).map((a) => {
                    const pct = a.totaal > 0 ? Math.round((a.afgerond / a.totaal) * 100) : 0;
                    return (
                      <Link key={a.fase} href="/taken" className="block group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-medium text-autronis-text-primary group-hover:text-autronis-accent transition-colors truncate">{a.fase}</span>
                            {a.hoog > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold flex-shrink-0">{a.hoog} urgent</span>
                            )}
                          </div>
                          <span className="text-[11px] text-autronis-text-secondary tabular-nums flex-shrink-0">{a.afgerond}/{a.totaal}</span>
                        </div>
                        <div className="h-1.5 bg-autronis-border rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-autronis-accent")} style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Documenten */}
            <DocumentWidget />
          </div>
        </motion.div>

        {/* Spacer for timer bar */}
        {timer.isRunning && <div className="h-4 md:h-20 transition-all" />}
      </motion.div>

      {/* Fixed timer bar — only visible when timer is running */}
      {timer.isRunning && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-autronis-card/95 backdrop-blur-md border-t border-autronis-border shadow-2xl shadow-black/40 hidden md:block">
          <div className="max-w-[1400px] mx-auto">
            <div className="p-2.5">
              <div className="bg-autronis-card border border-autronis-border rounded-xl p-2.5 card-glow">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
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
          </div>
        </div>
      )}
    </PageTransition>
  );
}
