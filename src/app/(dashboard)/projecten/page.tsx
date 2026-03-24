"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { useProjecten } from "@/hooks/queries/use-projecten";
import type { Project } from "@/hooks/queries/use-projecten";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { openProjectInVSCode } from "@/lib/desktop-agent";

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
  if (status === "afgerond") return "text-green-400 bg-green-500/10";
  return "text-amber-400 bg-amber-500/10";
}

const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string; label: string }> = {
  actief: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/15", label: "Actief" },
  afgerond: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15", label: "Afgerond" },
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
  "on-track": { color: "text-green-400", bg: "bg-green-500/10", label: "On track", icon: CheckCircle2 },
  "risico": { color: "text-amber-400", bg: "bg-amber-500/10", label: "Risico", icon: AlertTriangle },
  "achter": { color: "text-red-400", bg: "bg-red-500/10", label: "Achter", icon: AlertCircle },
};

function HealthBadge({ project }: { project: Project }) {
  const health = getProjectHealth(project);
  const cfg = healthConfig[health.status];
  const Icon = cfg.icon;

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", cfg.bg, cfg.color)} title={health.reden}>
      <Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </div>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full h-1.5 bg-autronis-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, percentage)}%`,
          background: percentage >= 100 ? "#22c55e" : percentage >= 50 ? "#17B8A5" : "#3b82f6",
        }}
      />
    </div>
  );
}

// Mini sparkline as SVG
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1);
  const width = 60;
  const height = 20;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (v / max) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  const hasActivity = data.some((v) => v > 0);

  return (
    <svg width={width} height={height} className={className}>
      {hasActivity ? (
        <polyline
          points={points}
          fill="none"
          stroke="#17B8A5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#2A3538" strokeWidth="1" strokeDasharray="3,3" />
      )}
    </svg>
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

function ProjectCard({ project, onStartTimer, onOpenVSCode }: { project: Project; onStartTimer: (p: Project) => void; onOpenVSCode: (p: Project) => void }) {
  const ProjectIcon = getProjectIcon(project);
  const iconColor = getIconColor(project.status ?? "actief");

  return (
    <Link href={`/projecten/${project.id}`} className="block bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-4 card-glow transition-colors hover:border-autronis-accent/30 group relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("p-2 rounded-xl flex-shrink-0", iconColor)}>
            <ProjectIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-semibold text-autronis-text-primary truncate block group-hover:text-autronis-accent transition-colors">
              {project.naam}
            </span>
            <p className="text-xs text-autronis-text-secondary mt-0.5">{project.klantNaam}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <Sparkline data={project.sparkline} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            <StatusBadge status={project.status ?? "actief"} />
          </div>
          {project.status === "actief" && <HealthBadge project={project} />}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-autronis-text-secondary">Voortgang</span>
          <span className="text-autronis-text-primary font-medium tabular-nums">{project.takenVoortgang}%</span>
        </div>
        <ProgressBar percentage={project.takenVoortgang} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-autronis-text-secondary">
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
        {project.deadline && (
          <span className="ml-auto text-autronis-text-secondary/70">
            {formatDatum(project.deadline)}
          </span>
        )}
      </div>

      {/* Activity + health hint */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-autronis-text-secondary/60">
          {project.takenDezeWeek > 0 ? (
            <span className="text-autronis-accent font-medium">
              {project.takenDezeWeek} taken deze week afgerond
            </span>
          ) : project.laatsteActiviteit ? (
            <>Laatste activiteit: {formatRelatief(project.laatsteActiviteit)}</>
          ) : (
            "Nog geen activiteit"
          )}
        </p>
        {(() => {
          const health = getProjectHealth(project);
          if (health.status !== "on-track") {
            return (
              <span className={cn("text-[10px] font-medium", health.status === "achter" ? "text-red-400" : "text-amber-400")}>
                {health.reden}
              </span>
            );
          }
          return null;
        })()}
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
          title="Open in VS Code + Claude"
          className="p-1.5 rounded-lg bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-blue-400 hover:border-blue-400/40 transition-colors"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>
        <Link
          href={`/projecten/${project.id}`}
          className="p-1.5 rounded-lg bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/40 transition-colors"
          title="Details"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
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
  const { data, isLoading, refetch } = useProjecten();
  const [zoek, setZoek] = useState("");
  const [activeTab, setActiveTab] = useState<string>("actief");
  const [syncing, setSyncing] = useState(false);
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

  const handleOpenVSCode = useCallback(async (project: Project) => {
    const dirName = project.naam.toLowerCase().replace(/\s+/g, "-");
    const result = await openProjectInVSCode(dirName);
    if (result.succes) {
      addToast(`VS Code + Claude geopend voor ${project.naam}`, "succes");
    } else {
      addToast(result.fout ?? "Kon project niet openen", "fout");
    }
  }, [addToast]);

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
  const kpis = data?.kpis ?? { totaal: 0, actief: 0, afgerond: 0, onHold: 0, takenOpen: 0, totaleUren: 0 };

  const filtered = useMemo(() => {
    return projecten.filter((p) => {
      if (activeTab !== "alle" && p.status !== activeTab) return false;
      if (zoek) {
        const q = zoek.toLowerCase();
        return (
          p.naam.toLowerCase().includes(q) ||
          (p.klantNaam ?? "").toLowerCase().includes(q) ||
          (p.omschrijving ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projecten, activeTab, zoek]);

  // Sort: most activity first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Active sessions with activity this week first
      if (a.takenDezeWeek !== b.takenDezeWeek) return b.takenDezeWeek - a.takenDezeWeek;
      // Then by total progress
      if (a.takenVoortgang !== b.takenVoortgang) return b.takenVoortgang - a.takenVoortgang;
      // Then by name
      return a.naam.localeCompare(b.naam);
    });
  }, [filtered]);

  const tabCounts = useMemo(() => ({
    actief: projecten.filter((p) => p.status === "actief").length,
    afgerond: projecten.filter((p) => p.status === "afgerond").length,
    "on-hold": projecten.filter((p) => p.status === "on-hold").length,
    alle: projecten.length,
  }), [projecten]);

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">Projecten</h1>
            <p className="text-autronis-text-secondary mt-1">
              {kpis.actief} actief &middot; {kpis.takenOpen} open taken &middot; {Math.round(kpis.totaleUren / 60)}u totaal
            </p>
          </div>
          <button
            onClick={syncProjecten}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync projecten"}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Totaal", value: kpis.totaal, icon: FolderKanban, color: "text-autronis-text-primary", iconBg: "bg-autronis-accent/10 text-autronis-accent" },
            { label: "Actief", value: kpis.actief, icon: Loader2, color: "text-blue-400", iconBg: "bg-blue-500/10 text-blue-400" },
            { label: "Taken open", value: kpis.takenOpen, icon: ListTodo, color: "text-amber-400", iconBg: "bg-amber-500/10 text-amber-400" },
            { label: "Totale uren", value: `${Math.round(kpis.totaleUren / 60)}u`, icon: Clock, color: "text-autronis-accent", iconBg: "bg-autronis-accent/10 text-autronis-accent" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("p-2 rounded-xl", kpi.iconBg)}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", kpi.color)}>{kpi.value}</p>
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
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full tabular-nums",
                  activeTab === tab.key ? "bg-white/20" : "bg-autronis-border"
                )}>
                  {tabCounts[tab.key as keyof typeof tabCounts]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
            <input
              type="text"
              placeholder="Zoek project of klant..."
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
            />
          </div>
        </div>

        {/* Project grid */}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onStartTimer={handleStartTimer}
                onOpenVSCode={handleOpenVSCode}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
