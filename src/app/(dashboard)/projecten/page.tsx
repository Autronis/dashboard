"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderKanban,
  Search,
  CheckCircle2,
  Circle,
  Pause,
  Loader2,
  ListTodo,
  Clock,
  RefreshCw,
  Play,
  ExternalLink,
  Code2,
  Database,
  Globe,
  Zap,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  AlertCircle,
  List,
  LayoutGrid,
  TrendingDown,
  Minus,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { useProjectenMetKpis } from "@/hooks/queries/use-projecten";
import type { Project } from "@/hooks/queries/use-projecten";
import { MiniEigenaarPicker } from "@/components/projecten/eigenaar-picker";

import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { openProjectInVSCode } from "@/lib/desktop-agent";

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to === 0) { setVal(0); return; }
    let current = 0;
    const step = Math.max(1, Math.ceil(to / 25));
    const id = setInterval(() => {
      current = Math.min(current + step, to);
      setVal(current);
      if (current >= to) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [to]);
  return <>{val}{suffix}</>;
}

// Auto-detect icon based on project name or tech stack
function getProjectIcon(project: Project) {
  const naam = project.naam.toLowerCase();
  const desc = (project.omschrijving || "").toLowerCase();

  if (naam.includes("dashboard") || naam.includes("analytics")) return BarChart3;
  if (naam.includes("api") || naam.includes("engine")) return Zap;
  if (naam.includes("website") || naam.includes("web")) return Globe;
  if (desc.includes("sqlite") || desc.includes("database") || desc.includes("drizzle")) return Database;
  if (desc.includes("next.js") || desc.includes("react") || desc.includes("typescript")) return Code2;
  return FolderKanban;
}

// Icon color based on status
function getIconColor(status: string) {
  if (status === "actief") return "text-blue-400 bg-blue-500/10";
  if (status === "afgerond") return "text-emerald-400 bg-emerald-500/10";
  return "text-amber-400 bg-amber-500/10";
}

const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string; label: string }> = {
  actief: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/15", label: "Actief" },
  afgerond: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15", label: "Afgerond" },
  "on-hold": { icon: Pause, color: "text-amber-400", bg: "bg-amber-500/15", label: "On Hold" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.actief;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// Health status intelligence
type HealthStatus = "on-track" | "risico" | "achter";

function getProjectHealth(project: Project): { status: HealthStatus; reden: string } {
  const now = new Date();
  const openTaken = project.takenTotaal - project.takenAfgerond;

  // Check deadline proximity
  if (project.deadline) {
    const deadline = new Date(project.deadline);
    const dagenTotDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (dagenTotDeadline < 0 && openTaken > 0) {
      return { status: "achter", reden: `Deadline ${Math.abs(dagenTotDeadline)}d geleden verlopen` };
    }
    if (dagenTotDeadline <= 7 && openTaken > 3) {
      return { status: "risico", reden: `${openTaken} taken open, deadline over ${dagenTotDeadline}d` };
    }
  }

  // Check inactivity
  if (project.laatsteActiviteit && project.status === "actief") {
    const laatste = new Date(project.laatsteActiviteit.includes("T") ? project.laatsteActiviteit : project.laatsteActiviteit.replace(" ", "T") + "Z");
    const dagenInactief = Math.floor((now.getTime() - laatste.getTime()) / (1000 * 60 * 60 * 24));
    if (dagenInactief >= 7) {
      return { status: "risico", reden: `${dagenInactief} dagen geen activiteit` };
    }
  }

  // Check progress vs expected
  if (project.takenVoortgang < 20 && openTaken > 10 && project.status === "actief") {
    return { status: "risico", reden: `${openTaken} taken open, ${project.takenVoortgang}% af` };
  }

  return { status: "on-track", reden: project.takenDezeWeek > 0 ? `${project.takenDezeWeek} taken deze week` : "Op schema" };
}

const healthConfig: Record<HealthStatus, { color: string; bg: string; label: string; icon: typeof CheckCircle2 }> = {
  "on-track": { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "On track", icon: CheckCircle2 },
  "risico": { color: "text-amber-400", bg: "bg-amber-500/10", label: "Risico", icon: AlertTriangle },
  "achter": { color: "text-red-400", bg: "bg-red-500/10", label: "Achter", icon: AlertCircle },
};

function HealthBadge({ project }: { project: Project }) {
  const health = getProjectHealth(project);
  const cfg = healthConfig[health.status];
  const Icon = cfg.icon;
  const pulseClass = health.status === "risico" ? "health-pulse-risico" : health.status === "achter" ? "health-pulse-achter" : "";

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cfg.bg, cfg.color, pulseClass)} title={health.reden}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </div>
  );
}

function getProgressGradient(pct: number): string {
  if (pct >= 100) return "#22c55e";
  if (pct >= 75) return `linear-gradient(90deg, #17B8A5, #22c55e)`;
  if (pct >= 40) return `linear-gradient(90deg, #3b82f6, #17B8A5)`;
  return `linear-gradient(90deg, #3b82f6 0%, #17B8A5 ${pct * 1.5}%)`;
}

function ProgressBar({ percentage }: { percentage: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div className="w-full h-1.5 bg-autronis-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: mounted ? `${Math.min(100, percentage)}%` : "0%",
          background: getProgressGradient(percentage),
        }}
      />
    </div>
  );
}

// Mini sparkline as SVG with self-draw + per-day tooltip
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1);
  const width = 64;
  const height = 22;
  const padding = 2;
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const pts = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (v / max) * (height - padding * 2);
    return { x, y, v };
  });

  const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const hasActivity = data.some((v) => v > 0);

  // Convert polyline to path for pathLength animation
  const d = pts.length > 0
    ? "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ")
    : "";

  const dayLabels = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  return (
    <div className={cn("relative", className)}>
      <svg width={width} height={height} className="overflow-visible">
        {hasActivity ? (
          <motion.path
            d={d}
            fill="none"
            stroke="#17B8A5"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ) : (
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#2A3538" strokeWidth="1" strokeDasharray="3,3" />
        )}
        {/* Hover dots */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredDay === i ? 3 : 0}
            fill="#17B8A5"
            className="transition-all duration-100"
          />
        ))}
        {/* Invisible hit areas */}
        {pts.map((p, i) => (
          <rect
            key={`hit-${i}`}
            x={p.x - 5}
            y={0}
            width={10}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoveredDay(i)}
            onMouseLeave={() => setHoveredDay(null)}
          />
        ))}
      </svg>
      {/* Tooltip */}
      <AnimatePresence>
        {hoveredDay !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-full mb-1.5 pointer-events-none z-20 whitespace-nowrap"
            style={{ left: pts[hoveredDay]?.x ?? 0, transform: "translateX(-50%)" }}
          >
            <div className="bg-autronis-card border border-autronis-border rounded-lg px-2 py-1 text-[10px] text-autronis-text-primary shadow-lg">
              <span className="text-autronis-text-secondary mr-1">{dayLabels[hoveredDay]}</span>
              <span className="font-semibold text-autronis-accent">{data[hoveredDay]}</span>
              <span className="text-autronis-text-secondary ml-0.5">taken</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Velocity: vergelijk laatste 3 dagen met de 3 daarvoor
function getVelocity(sparkline: number[]): { label: string; icon: typeof TrendingUp; color: string } {
  if (sparkline.length < 6) return { label: "geen data", icon: Minus, color: "text-autronis-text-secondary/50" };
  const recent = sparkline.slice(4).reduce((a, b) => a + b, 0);
  const previous = sparkline.slice(1, 4).reduce((a, b) => a + b, 0);
  if (recent === 0 && previous === 0) return { label: "geen activiteit", icon: Minus, color: "text-autronis-text-secondary/50" };
  if (recent > previous) return { label: "sneller dan vorige periode", icon: TrendingUp, color: "text-emerald-400" };
  if (recent < previous) return { label: "minder actief", icon: TrendingDown, color: "text-amber-400" };
  return { label: "stabiel tempo", icon: Minus, color: "text-autronis-text-secondary" };
}

// Geschatte einddatum op basis van velocity
function getEinddatumSchatting(sparkline: number[], openTaken: number): string | null {
  const tasksPerDay = sparkline.reduce((a, b) => a + b, 0) / 7;
  if (tasksPerDay < 0.1 || openTaken === 0) return null;
  const dagen = Math.round(openTaken / tasksPerDay);
  if (dagen > 180) return null;
  if (dagen <= 1) return "morgen klaar";
  if (dagen < 7) return `~${dagen} dagen`;
  if (dagen < 30) return `~${Math.round(dagen / 7)} weken`;
  return `~${Math.round(dagen / 30)} maanden`;
}

// Activity indicator dot
function getActivityDot(laatsteActiviteit: string | null): { color: string; pulse: boolean; label: string } {
  if (!laatsteActiviteit) return { color: "bg-slate-500/40", pulse: false, label: "Geen activiteit" };
  const d = new Date(laatsteActiviteit.includes("T") ? laatsteActiviteit : laatsteActiviteit.replace(" ", "T") + "Z");
  const dagen = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dagen <= 1) return { color: "bg-emerald-400", pulse: true, label: "Vandaag actief" };
  if (dagen <= 3) return { color: "bg-emerald-400/70", pulse: false, label: `${dagen}d geleden` };
  if (dagen <= 7) return { color: "bg-amber-400", pulse: false, label: `${dagen}d geleden` };
  return { color: "bg-red-400", pulse: false, label: `${dagen}d geleden` };
}

// Highlight matched text in a string
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-autronis-accent/30 text-autronis-accent rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// Format relative time
function formatRelatief(datum: string | null): string {
  if (!datum) return "";
  const now = new Date();
  const d = new Date(datum.includes("T") ? datum : datum.replace(" ", "T") + "Z");
  const diffMs = now.getTime() - d.getTime();
  const diffDagen = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDagen === 0) return "Vandaag";
  if (diffDagen === 1) return "Gisteren";
  if (diffDagen < 7) return `${diffDagen} dagen geleden`;
  if (diffDagen < 30) return `${Math.floor(diffDagen / 7)} weken geleden`;
  return formatDatum(datum);
}

function ProjectCard({ project, onStartTimer, onOpenVSCode, onDelete, zoek }: { project: Project; onStartTimer: (p: Project) => void; onOpenVSCode: (p: Project) => void; onDelete: (p: Project) => void; zoek: string }) {
  const ProjectIcon = getProjectIcon(project);
  const iconColor = getIconColor(project.status ?? "actief");
  const velocity = getVelocity(project.sparkline);
  const VelocityIcon = velocity.icon;
  const einddatum = getEinddatumSchatting(project.sparkline, project.takenTotaal - project.takenAfgerond);
  const activityDot = getActivityDot(project.laatsteActiviteit);

  return (
    <Link href={`/projecten/${project.id}`} className="block bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-3.5 card-glow transition-all duration-200 hover:border-autronis-accent/40 hover:shadow-[0_0_0_1px_rgba(23,184,165,0.15),0_4px_20px_rgba(0,0,0,0.2)] group relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("p-2 rounded-xl flex-shrink-0", iconColor)}>
            <ProjectIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-semibold text-autronis-text-primary truncate block group-hover:text-autronis-accent transition-colors">
              <HighlightText text={project.naam} query={zoek} />
            </span>
            <p className="text-xs text-autronis-text-secondary mt-0.5">
              <HighlightText text={project.klantNaam ?? ""} query={zoek} />
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkline data={project.sparkline} />
            <StatusBadge status={project.status ?? "actief"} />
          </div>
          {project.status === "actief" && <HealthBadge project={project} />}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-autronis-text-secondary">Voortgang</span>
          <span className="text-autronis-text-primary font-medium tabular-nums">{project.takenVoortgang}%</span>
        </div>
        <ProgressBar percentage={project.takenVoortgang} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-autronis-text-secondary flex-wrap">
        <span className="flex items-center gap-1">
          <ListTodo className="w-3.5 h-3.5" />
          {project.takenAfgerond}/{project.takenTotaal} taken
        </span>
        {project.totaalMinuten > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {Math.round(project.totaalMinuten / 60)}u
          </span>
        )}
        {einddatum && (
          <span className="flex items-center gap-1 text-autronis-accent/80">
            <Zap className="w-3 h-3" />
            {einddatum}
          </span>
        )}
        {project.deadline && (
          <span className="ml-auto text-autronis-text-secondary/70">
            {formatDatum(project.deadline)}
          </span>
        )}
      </div>

      {/* Activity + velocity + eigenaar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", activityDot.color, activityDot.pulse && "activity-dot-active")} title={activityDot.label} />
          <p className="text-[10px] text-autronis-text-secondary/70">{activityDot.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.status === "actief" && (
            <div className={cn("flex items-center gap-0.5 text-[10px]", velocity.color)}>
              <VelocityIcon className="w-3 h-3" />
              <span>{velocity.label}</span>
            </div>
          )}
          {/* Eigenaar mini-picker — onClick stopt navigatie naar detail */}
          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="flex-shrink-0">
            <MiniEigenaarPicker projectId={project.id} current={project.eigenaar ?? null} />
          </div>
        </div>
      </div>

      {/* Quick actions - visible on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => { e.preventDefault(); onStartTimer(project); }}
          title="Start timer"
          className="p-1.5 rounded-lg bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/40 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onOpenVSCode(project); }}
          title="Kopieer Claude prompt"
          className="p-1.5 rounded-lg bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-purple-400 hover:border-purple-400/40 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <Link
          href={`/projecten/${project.id}`}
          className="p-1.5 rounded-lg bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/40 transition-colors"
          title="Details"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={(e) => { e.preventDefault(); onDelete(project); }}
          title="Verwijder project"
          className="p-1.5 rounded-lg bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-red-400 hover:border-red-400/40 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Link>
  );
}

// Compacte lijstrij voor list-weergave
function ProjectRow({ project, onStartTimer, onOpenVSCode, zoek }: { project: Project; onStartTimer: (p: Project) => void; onOpenVSCode: (p: Project) => void; zoek: string }) {
  const health = getProjectHealth(project);
  const activityDot = getActivityDot(project.laatsteActiviteit);
  const cfg = healthConfig[health.status];
  const HealthIcon = cfg.icon;
  const pulseClass = health.status === "risico" ? "health-pulse-risico" : health.status === "achter" ? "health-pulse-achter" : "";

  return (
    <Link href={`/projecten/${project.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-autronis-bg/40 transition-colors group border-b border-autronis-border/30 last:border-b-0">
      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", activityDot.color, activityDot.pulse && "activity-dot-active")} title={activityDot.label} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-autronis-text-primary truncate group-hover:text-autronis-accent transition-colors">
          <HighlightText text={project.naam} query={zoek} />
        </p>
        <p className="text-[11px] text-autronis-text-secondary truncate">
          <HighlightText text={project.klantNaam ?? ""} query={zoek} />
        </p>
      </div>
      <div className="w-24 flex-shrink-0">
        <ProgressBar percentage={project.takenVoortgang} />
        <p className="text-[10px] text-autronis-text-secondary/70 mt-0.5 tabular-nums">{project.takenVoortgang}%</p>
      </div>
      <span className="text-[11px] text-autronis-text-secondary tabular-nums flex-shrink-0 hidden sm:block">{project.takenAfgerond}/{project.takenTotaal}</span>
      {project.status === "actief" && (
        <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0", cfg.bg, cfg.color, pulseClass)}>
          <HealthIcon className="w-2.5 h-2.5" />{cfg.label}
        </div>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={(e) => { e.preventDefault(); onStartTimer(project); }} className="p-1 text-autronis-text-secondary hover:text-autronis-accent transition-colors"><Play className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.preventDefault(); onOpenVSCode(project); }} className="p-1 text-autronis-text-secondary hover:text-purple-400 transition-colors" title="Kopieer Claude prompt"><Copy className="w-3.5 h-3.5" /></button>
      </div>
    </Link>
  );
}

const TABS = [
  { key: "actief", label: "Actief", icon: Loader2 },
  { key: "afgerond", label: "Afgerond", icon: CheckCircle2 },
  { key: "on-hold", label: "On Hold", icon: Pause },
  { key: "alle", label: "Alle", icon: FolderKanban },
] as const;

export default function ProjectenPage() {
  const { data, isLoading, refetch } = useProjectenMetKpis();
  const [zoek, setZoek] = useState("");
  const [activeTab, setActiveTab] = useState<string>("actief");
  const [syncing, setSyncing] = useState(false);
  const [weergave, setWeergave] = useState<"grid" | "lijst">("grid");
  const [showNieuwProject, setShowNieuwProject] = useState(false);
  const [nieuwProjectNaam, setNieuwProjectNaam] = useState("");
  const [nieuwProjectOmschrijving, setNieuwProjectOmschrijving] = useState("");
  const [nieuwProjectEigenaar, setNieuwProjectEigenaar] = useState<"sem" | "syb" | "team" | "vrij" | "">("");
  const [nieuwProjectBezig, setNieuwProjectBezig] = useState(false);
  const { addToast } = useToast();
  const timer = useTimer();

  const syncProjecten = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/projecten/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout || "Sync mislukt");
      const totaalNieuw = json.resultaten.reduce((s: number, r: { takenToegevoegd: number }) => s + r.takenToegevoegd, 0);
      const totaalUpdated = json.resultaten.reduce((s: number, r: { takenBijgewerkt: number }) => s + r.takenBijgewerkt, 0);
      addToast(
        `${json.totaalProjecten} projecten gesynced — ${totaalNieuw} nieuwe taken, ${totaalUpdated} bijgewerkt`,
        "succes"
      );
      refetch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Sync mislukt", "fout");
    } finally {
      setSyncing(false);
    }
  }, [addToast, refetch]);

  const handleNieuwProject = useCallback(async () => {
    if (!nieuwProjectNaam.trim()) {
      addToast("Projectnaam is verplicht", "fout");
      return;
    }
    if (!nieuwProjectEigenaar) {
      addToast("Kies een eigenaar voor het project", "fout");
      return;
    }
    setNieuwProjectBezig(true);
    try {
      const res = await fetch("/api/projecten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: nieuwProjectNaam.trim(),
          omschrijving: nieuwProjectOmschrijving.trim() || undefined,
          eigenaar: nieuwProjectEigenaar,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.fout || "Aanmaken mislukt");
      if (json.bestaand) {
        addToast(`Project "${json.project.naam}" bestaat al`, "fout");
      } else {
        addToast(`Project "${json.project.naam}" aangemaakt`, "succes");
        refetch();
      }
      setShowNieuwProject(false);
      setNieuwProjectNaam("");
      setNieuwProjectOmschrijving("");
      setNieuwProjectEigenaar("");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Aanmaken mislukt", "fout");
    } finally {
      setNieuwProjectBezig(false);
    }
  }, [nieuwProjectNaam, nieuwProjectOmschrijving, nieuwProjectEigenaar, addToast, refetch]);

  const handleOpenVSCode = useCallback(async (project: Project) => {
    const prompt = `Werk aan ${project.naam}, pak de openstaande taken op en begin met de hoogste prioriteit`;
    await navigator.clipboard.writeText(prompt);
    addToast(`Prompt gekopieerd — plak in Claude Code`, "succes");
  }, [addToast]);

  const handleDelete = useCallback(async (project: Project) => {
    const bevestiging = confirm(
      `Weet je zeker dat je "${project.naam}" wil verwijderen?\n\n` +
      `Dit deactiveert het project (soft delete).\n` +
      `Taken en tijdregistraties blijven behouden.`
    );
    if (!bevestiging) return;
    try {
      const res = await fetch(`/api/projecten/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout ?? "Onbekende fout");
      }
      addToast(`Project "${project.naam}" verwijderd`, "succes");
      refetch();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon project niet verwijderen", "fout");
    }
  }, [addToast, refetch]);

  const handleStartTimer = useCallback(async (project: Project) => {
    if (timer.isRunning) {
      addToast("Stop eerst de huidige timer", "fout");
      return;
    }
    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          omschrijving: project.naam,
          startTijd: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout);
      timer.start(project.id, project.naam, "development", data.registratie.id);
      addToast(`Timer gestart voor ${project.naam}`, "succes");
    } catch {
      addToast("Kon timer niet starten", "fout");
    }
  }, [timer, addToast]);

  const projecten = data?.projecten ?? [];
  const serverKpis = data?.kpis ?? { totaal: 0, actief: 0, afgerond: 0, onHold: 0, takenOpen: 0, totaleUren: 0 };

  const matchesZoek = useCallback((p: Project, q: string): boolean => {
    return (
      p.naam.toLowerCase().includes(q) ||
      (p.klantNaam ?? "").toLowerCase().includes(q) ||
      (p.omschrijving ?? "").toLowerCase().includes(q) ||
      (p.taakTitels ?? "").toLowerCase().includes(q)
    );
  }, []);

  const filtered = useMemo(() => {
    return projecten.filter((p) => {
      if (activeTab !== "alle" && p.status !== activeTab) return false;
      if (zoek) return matchesZoek(p, zoek.toLowerCase());
      return true;
    });
  }, [projecten, activeTab, zoek, matchesZoek]);

  // Sort: health urgency first, then deadline, then activity
  const sorted = useMemo(() => {
    const healthWeight: Record<HealthStatus, number> = { "achter": 0, "risico": 1, "on-track": 2 };
    return [...filtered].sort((a, b) => {
      // Health status first (achter > risico > on-track)
      const ha = healthWeight[getProjectHealth(a).status];
      const hb = healthWeight[getProjectHealth(b).status];
      if (ha !== hb) return ha - hb;
      // Then by deadline urgency (soonest first, no deadline last)
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (da !== db) return da - db;
      // Then by weekly activity
      if (a.takenDezeWeek !== b.takenDezeWeek) return b.takenDezeWeek - a.takenDezeWeek;
      // Then by name
      return a.naam.localeCompare(b.naam);
    });
  }, [filtered]);

  // Split in "verdient aandacht" (achter/risico) en "gezond" groepen — zo kan de
  // gebruiker in één oogopslag de zwakke plekken pakken zonder dat de sortering
  // subtiel is. Pas split tonen als er *beide* categorieen zijn (1 groep = geen
  // divider nodig).
  const { aandachtProjecten, gezondeProjecten } = useMemo(() => {
    const aandacht: Project[] = [];
    const gezond: Project[] = [];
    for (const p of sorted) {
      const h = getProjectHealth(p).status;
      if (h === "achter" || h === "risico") aandacht.push(p);
      else gezond.push(p);
    }
    return { aandachtProjecten: aandacht, gezondeProjecten: gezond };
  }, [sorted]);
  const toonGroepen = aandachtProjecten.length > 0 && gezondeProjecten.length > 0;

  const tabCounts = useMemo(() => {
    const base = zoek
      ? projecten.filter((p) => matchesZoek(p, zoek.toLowerCase()))
      : projecten;
    return {
      actief: base.filter((p) => p.status === "actief").length,
      afgerond: base.filter((p) => p.status === "afgerond").length,
      "on-hold": base.filter((p) => p.status === "on-hold").length,
      alle: base.length,
    };
  }, [projecten, zoek, matchesZoek]);

  // Contextual KPIs based on current tab + search
  const kpis = useMemo(() => {
    const isFiltered = activeTab !== "alle" || zoek;
    if (!isFiltered) return serverKpis;
    return {
      totaal: filtered.length,
      actief: filtered.filter((p) => p.status === "actief").length,
      afgerond: filtered.filter((p) => p.status === "afgerond").length,
      onHold: filtered.filter((p) => p.status === "on-hold").length,
      takenOpen: filtered.reduce((sum, p) => sum + (p.takenTotaal - p.takenAfgerond), 0),
      totaleUren: filtered.reduce((sum, p) => sum + p.totaalMinuten, 0),
    };
  }, [filtered, activeTab, zoek, serverKpis]);

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <PageHeader
          title="Projecten"
          description={`${kpis.actief} actief · ${kpis.takenOpen} open taken · ${Math.round(kpis.totaleUren / 60)}u totaal`}
          actions={
            <>
              <Link
                href="/projecten/intake"
                className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent/15 border border-autronis-accent/30 hover:bg-autronis-accent/25 text-autronis-accent text-sm font-medium rounded-xl transition-colors"
              >
                <Zap className="w-4 h-4" />
                Start intake
              </Link>
              <button
                onClick={() => setShowNieuwProject(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-autronis-card border border-autronis-border hover:border-autronis-accent/40 text-autronis-text-primary text-sm font-medium rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nieuw project
              </button>
              <button
                onClick={syncProjecten}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Sync projecten"}
              </button>
            </>
          }
        />

        {/* KPIs — "Totaal" weggehaald omdat die vaak gelijk is aan "Actief" en
            dus geen extra info gaf. 3 KPIs passen beter in de balk. */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Actief", to: kpis.actief, suffix: "", icon: Loader2, color: "text-blue-400", iconBg: "bg-blue-500/10 text-blue-400" },
            { label: "Taken open", to: kpis.takenOpen, suffix: "", icon: ListTodo, color: "text-amber-400", iconBg: "bg-amber-500/10 text-amber-400" },
            { label: "Totale uren", to: Math.round(kpis.totaleUren / 60), suffix: "u", icon: Clock, color: "text-autronis-accent", iconBg: "bg-autronis-accent/10 text-autronis-accent" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-2 rounded-xl", kpi.iconBg)}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", kpi.color)}><CountUp to={kpi.to} suffix={kpi.suffix} /></p>
              <p className="text-xs text-autronis-text-secondary mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                  activeTab === tab.key
                    ? "bg-autronis-accent text-white"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary"
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                <motion.span
                  key={tabCounts[tab.key as keyof typeof tabCounts]}
                  initial={{ scale: 1.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className={cn("text-[10px] px-1.5 py-0.5 rounded-full tabular-nums inline-block", activeTab === tab.key ? "bg-white/20" : "bg-autronis-border")}
                >
                  {tabCounts[tab.key as keyof typeof tabCounts]}
                </motion.span>
              </button>
            ))}
          </div>

          {/* Search + weergave toggle */}
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
              <input
                type="text"
                placeholder="Zoek project, klant of taak..."
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
              />
            </div>
            <div className="flex items-center bg-autronis-card border border-autronis-border rounded-lg p-0.5 flex-shrink-0">
              {([{ key: "grid" as const, Icon: LayoutGrid }, { key: "lijst" as const, Icon: List }]).map(({ key, Icon }) => (
                <button key={key} onClick={() => setWeergave(key)}
                  className={cn("p-1.5 rounded-md transition-colors", weergave === key ? "bg-autronis-accent text-white" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Project grid / lijst */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
            <FolderKanban className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
            <p className="text-autronis-text-secondary text-sm">
              {zoek || activeTab !== "alle" ? "Geen projecten gevonden met deze filters" : "Nog geen projecten"}
            </p>
          </div>
        ) : weergave === "lijst" ? (
          <motion.div
            key={`lijst-${activeTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden"
          >
            {sorted.map((project) => (
              <ProjectRow key={project.id} project={project} onStartTimer={handleStartTimer} onOpenVSCode={handleOpenVSCode} zoek={zoek} />
            ))}
          </motion.div>
        ) : toonGroepen ? (
          <motion.div
            key={`grid-groepen-${activeTab}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-autronis-text-primary">Verdient aandacht</h2>
                <span className="text-xs text-autronis-text-secondary">({aandachtProjecten.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {aandachtProjecten.map((project, i) => (
                    <motion.div
                      key={project.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.4), layout: { duration: 0.22 } }}
                    >
                      <ProjectCard project={project} onStartTimer={handleStartTimer} onOpenVSCode={handleOpenVSCode} onDelete={handleDelete} zoek={zoek} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-autronis-text-primary">Op schema</h2>
                <span className="text-xs text-autronis-text-secondary">({gezondeProjecten.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {gezondeProjecten.map((project, i) => (
                    <motion.div
                      key={project.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.4), layout: { duration: 0.22 } }}
                    >
                      <ProjectCard project={project} onStartTimer={handleStartTimer} onOpenVSCode={handleOpenVSCode} onDelete={handleDelete} zoek={zoek} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`grid-${activeTab}`}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {sorted.map((project, i) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.4), layout: { duration: 0.22 } }}
                >
                  <ProjectCard project={project} onStartTimer={handleStartTimer} onOpenVSCode={handleOpenVSCode} onDelete={handleDelete} zoek={zoek} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}


        {/* Nieuw project modal */}
        <AnimatePresence>
          {showNieuwProject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowNieuwProject(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-autronis-text-primary mb-1">Nieuw project</h2>
                <p className="text-xs text-autronis-text-secondary mb-4">Klant later koppelen via project detail.</p>

                <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Naam *</label>
                <input
                  type="text"
                  placeholder="Bijv. Klantnaam Automation"
                  value={nieuwProjectNaam}
                  onChange={(e) => setNieuwProjectNaam(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nieuwProjectEigenaar && handleNieuwProject()}
                  autoFocus
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent mb-4"
                />

                <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Omschrijving</label>
                <textarea
                  placeholder="Korte beschrijving van wat het project inhoudt..."
                  value={nieuwProjectOmschrijving}
                  onChange={(e) => setNieuwProjectOmschrijving(e.target.value)}
                  rows={3}
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent mb-4 resize-none"
                />

                <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">Eigenaar *</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {([
                    { code: "sem", label: "Sem", desc: "Alleen ik" },
                    { code: "syb", label: "Syb", desc: "Alleen Syb" },
                    { code: "team", label: "Team", desc: "Beiden samen" },
                    { code: "vrij", label: "Vrij", desc: "Niet toegewezen" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setNieuwProjectEigenaar(opt.code)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all",
                        nieuwProjectEigenaar === opt.code
                          ? "border-autronis-accent bg-autronis-accent/10 text-autronis-text-primary"
                          : "border-autronis-border bg-autronis-bg text-autronis-text-secondary hover:border-autronis-accent/50 hover:text-autronis-text-primary"
                      )}
                    >
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-[10px] opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-autronis-text-secondary/70 mb-4">
                  Eigenaar bepaalt wie het project ziet in zijn dashboard. <strong>Team</strong> en <strong>Vrij</strong> zijn voor beide zichtbaar.
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowNieuwProject(false);
                      setNieuwProjectNaam("");
                      setNieuwProjectOmschrijving("");
                      setNieuwProjectEigenaar("");
                    }}
                    className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleNieuwProject}
                    disabled={nieuwProjectBezig || !nieuwProjectNaam.trim() || !nieuwProjectEigenaar}
                    className="flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {nieuwProjectBezig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Aanmaken
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
