"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ListTodo,
  Loader2,
  Pause,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Play,
  Square,
  Zap,
} from "lucide-react";
import { cn, formatDatum, formatUren } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";
import { useTimer } from "@/hooks/use-timer";
import { openProjectInVSCode } from "@/lib/desktop-agent";

// ============ Types ============

interface FaseTaak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
  deadline: string | null;
  uitvoerder: string | null;
  bijgewerktOp: string | null;
}

interface Fase {
  naam: string;
  taken: FaseTaak[];
  totaal: number;
  afgerond: number;
}

interface ProjectDetail {
  id: number;
  naam: string;
  omschrijving: string | null;
  klantId: number | null;
  klantNaam: string | null;
  status: string;
  voortgangPercentage: number;
  deadline: string | null;
  geschatteUren: number | null;
  werkelijkeUren: number | null;
  aangemaaktOp: string | null;
  bijgewerktOp: string | null;
  totaalTaken: number;
  afgerondTaken: number;
  voortgang: number;
  totaalMinuten: number;
}

// ============ Sub-components ============

const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string; label: string }> = {
  actief: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/15", label: "Actief" },
  afgerond: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15", label: "Afgerond" },
  "on-hold": { icon: Pause, color: "text-amber-400", bg: "bg-amber-500/15", label: "On Hold" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? statusConfig.actief;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium", cfg.bg, cfg.color)}>
      <cfg.icon className="w-4 h-4" />
      {cfg.label}
    </span>
  );
}

function VoortgangRing({ percentage, size = 80 }: { percentage: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const [displayed, setDisplayed] = useState(0);
  const color = percentage >= 100 ? "#22c55e" : percentage >= 50 ? "#17B8A5" : "#3b82f6";

  useEffect(() => {
    const t = setTimeout(() => setDisplayed(percentage), 80);
    return () => clearTimeout(t);
  }, [percentage]);

  const offset = circumference - (displayed / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2A3538" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-autronis-text-primary tabular-nums">
        {percentage}%
      </span>
    </div>
  );
}

function getProgressGradient(pct: number): string {
  if (pct >= 100) return "#22c55e";
  if (pct >= 75) return "linear-gradient(90deg, #17B8A5, #22c55e)";
  if (pct >= 40) return "linear-gradient(90deg, #3b82f6, #17B8A5)";
  return "linear-gradient(90deg, #3b82f6 0%, #17B8A5 150%)";
}

function ProgressBar({ percentage }: { percentage: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);
  return (
    <div className="w-full h-2 bg-autronis-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: mounted ? `${Math.min(100, percentage)}%` : "0%",
          background: getProgressGradient(percentage),
          transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </div>
  );
}

function TaakStatusIcon({ status }: { status: string }) {
  if (status === "afgerond") return <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />;
  if (status === "bezig") return <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  return <Circle className="w-4 h-4 text-autronis-text-secondary/40 flex-shrink-0" />;
}

function FaseSection({ fase, onStatusToggle }: { fase: Fase; onStatusToggle?: (taakId: number, huidigStatus: string) => void }) {
  const [open, setOpen] = useState(fase.afgerond < fase.totaal);
  const percentage = fase.totaal > 0 ? Math.round((fase.afgerond / fase.totaal) * 100) : 0;
  const isComplete = percentage >= 100;
  const isNotStarted = fase.afgerond === 0 && fase.totaal > 0;
  const hogePrio = fase.taken.filter((t) => t.prioriteit === "hoog" && t.status !== "afgerond").length;

  return (
    <div className={cn("bg-autronis-card border rounded-2xl overflow-hidden card-glow", isComplete ? "border-green-500/20" : isNotStarted ? "border-autronis-border/50 opacity-80" : "border-autronis-border")}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-autronis-border/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <motion.div animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-autronis-text-secondary" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn("text-sm font-semibold", isComplete ? "text-green-400" : "text-autronis-text-primary")}>{fase.naam}</h3>
              {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />}
              {isNotStarted && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-autronis-border text-autronis-text-secondary font-medium">Niet gestart</span>}
              {hogePrio > 0 && !isComplete && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">{hogePrio} hoog</span>}
            </div>
            <p className="text-xs text-autronis-text-secondary mt-0.5">{fase.afgerond}/{fase.totaal} taken</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-bold tabular-nums", isComplete ? "text-green-400" : "text-autronis-text-primary")}>{percentage}%</span>
          <div className="w-20"><ProgressBar percentage={percentage} /></div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-autronis-border">
              {fase.taken.map((taak, idx) => {
                const prioColor = taak.prioriteit === "hoog" ? "border-l-red-500" : taak.prioriteit === "normaal" ? "border-l-yellow-500/30" : "border-l-transparent";
                const isVerlopen = taak.deadline && taak.deadline < new Date().toISOString().slice(0, 10) && taak.status !== "afgerond";
                const nextStatus = taak.status === "open" ? "bezig" : taak.status === "bezig" ? "afgerond" : "open";
                return (
                  <motion.div
                    key={taak.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: idx * 0.03 }}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 border-b border-autronis-border/30 last:border-b-0 border-l-[3px] transition-colors group",
                      prioColor,
                      taak.status === "afgerond" ? "opacity-50" : "hover:bg-autronis-border/10"
                    )}
                  >
                    <button
                      onClick={() => onStatusToggle?.(taak.id, taak.status)}
                      title={`Zet naar: ${nextStatus}`}
                      className="flex-shrink-0 hover:scale-110 transition-transform"
                    >
                      <TaakStatusIcon status={taak.status} />
                    </button>
                    <span className={cn("flex-1 text-xs", taak.status === "afgerond" ? "text-autronis-text-secondary line-through" : "text-autronis-text-primary")}>
                      {taak.titel}
                    </span>
                    {/* Sync-origin indicator */}
                    <span title={taak.uitvoerder === "claude" ? "Claude taak (TODO.md)" : "Handmatige taak"} className="flex-shrink-0">
                      {taak.uitvoerder === "claude"
                        ? <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">Claude</span>
                        : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400/70 font-medium">Handmatig</span>
                      }
                    </span>
                    {taak.prioriteit === "hoog" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium flex-shrink-0">Hoog</span>
                    )}
                    {taak.deadline && (
                      <span className={cn("text-[10px] tabular-nums flex-shrink-0", isVerlopen ? "text-red-400 font-medium" : "text-autronis-text-secondary/60")}>
                        {isVerlopen && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}
                        {formatDatum(taak.deadline)}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ AI Summary Generator ============

function generateSamenvatting(project: ProjectDetail, fases: Fase[]): string {
  const parts: string[] = [];

  parts.push(`Dit project is ${project.voortgang}% af met ${project.afgerondTaken} van ${project.totaalTaken} taken voltooid.`);

  const completeFases = fases.filter((f) => f.afgerond === f.totaal && f.totaal > 0);
  const activeFases = fases.filter((f) => f.afgerond > 0 && f.afgerond < f.totaal);
  const openFases = fases.filter((f) => f.afgerond === 0 && f.totaal > 0);

  if (completeFases.length > 0) {
    const namen = completeFases.map((f) => f.naam).join(", ");
    parts.push(`${namen} ${completeFases.length === 1 ? "is" : "zijn"} volledig afgerond.`);
  }

  if (activeFases.length > 0) {
    const details = activeFases
      .map((f) => `${f.naam} heeft ${f.afgerond}/${f.totaal} taken af`)
      .join(", ");
    parts.push(details + ".");
  }

  if (openFases.length > 0) {
    const namen = openFases.map((f) => f.naam).join(", ");
    parts.push(`${namen} ${openFases.length === 1 ? "moet" : "moeten"} nog beginnen.`);
  }

  if (project.totaalMinuten > 0) {
    parts.push(`Er is ${formatUren(project.totaalMinuten)} uur aan gewerkt.`);
  }

  return parts.join(" ");
}

// ============ Project Health ============

type HealthStatus = "on-track" | "risico" | "achter";

function getDetailHealth(project: ProjectDetail, fases: Fase[]): { status: HealthStatus; reden: string; acties: string[] } {
  const openTaken = project.totaalTaken - project.afgerondTaken;
  const acties: string[] = [];

  // Deadline check
  let deadlineStatus: HealthStatus = "on-track";
  if (project.deadline) {
    const deadline = new Date(project.deadline);
    const now = new Date();
    const dagenTot = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (dagenTot < 0 && openTaken > 0) {
      deadlineStatus = "achter";
      acties.push(`Deadline ${Math.abs(dagenTot)} dagen geleden verlopen`);
    } else if (dagenTot <= 7 && openTaken > 3) {
      deadlineStatus = "risico";
      acties.push(`Deadline over ${dagenTot} dagen, ${openTaken} taken open`);
    }
  }

  // Fases check
  const nietGestarteFases = fases.filter((f) => f.afgerond === 0 && f.totaal > 0);
  const activeFases = fases.filter((f) => f.afgerond > 0 && f.afgerond < f.totaal);

  if (nietGestarteFases.length > 0) {
    acties.push(`${nietGestarteFases.map((f) => f.naam).join(", ")} nog niet gestart`);
  }

  // High priority tasks
  const hogePrioriteitOpen = fases.flatMap((f) => f.taken).filter((t) => t.prioriteit === "hoog" && t.status !== "afgerond");
  if (hogePrioriteitOpen.length > 0) {
    acties.push(`${hogePrioriteitOpen.length} hoge prioriteit ${hogePrioriteitOpen.length === 1 ? "taak" : "taken"} open`);
  }

  // Inactivity
  if (project.bijgewerktOp) {
    const laatste = new Date(project.bijgewerktOp.includes("T") ? project.bijgewerktOp : project.bijgewerktOp.replace(" ", "T") + "Z");
    const dagenInactief = Math.floor((new Date().getTime() - laatste.getTime()) / (1000 * 60 * 60 * 24));
    if (dagenInactief >= 7 && project.status === "actief") {
      acties.push(`${dagenInactief} dagen geen activiteit`);
      if (deadlineStatus === "on-track") deadlineStatus = "risico";
    }
  }

  const status = deadlineStatus;
  const reden = status === "on-track"
    ? `${project.voortgang}% af · ${activeFases.length > 0 ? activeFases[0].naam + " bezig" : "Op schema"}`
    : acties[0] || "Aandacht nodig";

  return { status, reden, acties };
}

function StatusIntelligence({ project, fases }: { project: ProjectDetail; fases: Fase[] }) {
  const health = getDetailHealth(project, fases);
  const cfg = {
    "on-track": { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", label: "On track", icon: CheckCircle2 },
    "risico": { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Risico", icon: AlertTriangle },
    "achter": { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Achter", icon: AlertCircle },
  }[health.status];
  const Icon = cfg.icon;

  const pulseClass = health.status === "risico" ? "health-pulse-risico" : health.status === "achter" ? "health-pulse-achter" : "";
  return (
    <div className={cn("rounded-xl border p-4", cfg.border, cfg.bg, pulseClass)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-4 h-4", cfg.color)} />
        <span className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</span>
        <span className="text-xs text-autronis-text-secondary ml-1">{health.reden}</span>
      </div>
      {health.acties.length > 0 && health.status !== "on-track" && (
        <ul className="mt-2 space-y-1">
          {health.acties.map((actie, i) => (
            <li key={i} className="text-xs text-autronis-text-secondary flex items-center gap-1.5">
              <span className={cn("w-1 h-1 rounded-full flex-shrink-0", cfg.color.replace("text-", "bg-"))} />
              {actie}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WatNuBlok({ fases, onStatusToggle }: { fases: Fase[]; onStatusToggle?: (taakId: number, huidigStatus: string) => void }) {
  // Get top open tasks sorted by priority
  const alleTaken = fases.flatMap((f) => f.taken.map((t) => ({ ...t, fase: f.naam })));
  const openTaken = alleTaken
    .filter((t) => t.status !== "afgerond")
    .sort((a, b) => {
      const prio: Record<string, number> = { hoog: 0, normaal: 1, laag: 2 };
      const pa = prio[a.prioriteit] ?? 1;
      const pb = prio[b.prioriteit] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.status === "bezig" && b.status !== "bezig") return -1;
      if (b.status === "bezig" && a.status !== "bezig") return 1;
      return 0;
    })
    .slice(0, 5);

  const bezigTaken = openTaken.filter((t) => t.status === "bezig");
  const nietGestarteFases = fases.filter((f) => f.afgerond === 0 && f.totaal > 0);

  if (openTaken.length === 0) return null;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-autronis-accent" />
        <h2 className="text-sm font-semibold text-autronis-text-primary">Wat nu?</h2>
        <span className="text-[11px] text-autronis-text-secondary ml-auto">{openTaken.length} acties</span>
      </div>

      <div className="space-y-1.5">
        {openTaken.map((taak) => {
          const prioColor = taak.prioriteit === "hoog" ? "border-l-red-500" : taak.prioriteit === "normaal" ? "border-l-yellow-500/50" : "border-l-slate-500/30";
          return (
            <div key={taak.id} className={cn("flex items-center gap-2.5 px-3 py-2 bg-autronis-bg/40 rounded-lg border-l-[3px] group/watnu", prioColor)}>
              <button
                onClick={() => onStatusToggle?.(taak.id, taak.status)}
                className="flex-shrink-0 hover:scale-110 transition-transform"
                title={`Zet naar: ${taak.status === "open" ? "bezig" : taak.status === "bezig" ? "afgerond" : "open"}`}
              >
                <TaakStatusIcon status={taak.status} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-autronis-text-primary truncate">{taak.titel}</p>
                <p className="text-[10px] text-autronis-text-secondary">{taak.fase}</p>
              </div>
              {taak.uitvoerder === "claude" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">Claude</span>}
              {taak.prioriteit === "hoog" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">Hoog</span>}
              {taak.status === "bezig" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">Bezig</span>}
            </div>
          );
        })}
      </div>

      {nietGestarteFases.length > 0 && (
        <div className="mt-3 pt-3 border-t border-autronis-border/50">
          <p className="text-[11px] text-amber-400 font-medium">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            Nog niet gestart: {nietGestarteFases.map((f) => f.naam).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ============ Extract tech stack from omschrijving ============

function extractTechStack(omschrijving: string | null): string[] {
  if (!omschrijving) return [];

  const techMatch = omschrijving.match(/Tech stack:\s*([^\n]+)/i);
  if (techMatch) {
    return techMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
  }

  const keywords = [
    "Next.js", "React", "TypeScript", "Tailwind", "SQLite", "Drizzle",
    "PostgreSQL", "Prisma", "Supabase", "Node.js", "Python", "Make.com",
    "n8n", "OpenAI", "Vercel", "Docker", "Redis",
  ];
  const lower = omschrijving.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}

// ============ Main Page ============

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const timer = useTimer();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [fases, setFases] = useState<Fase[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [openingVSCode, setOpeningVSCode] = useState(false);
  const pendingToggles = useRef<Set<number>>(new Set());

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projecten/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          addToast("Project niet gevonden", "fout");
          router.push("/projecten");
          return;
        }
        throw new Error("Kon project niet laden");
      }
      const data = await res.json();
      setProject(data.project);
      setFases(data.fases);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout bij laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [id, addToast, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const syncTaken = useCallback(async () => {
    if (!project) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/projecten/sync-taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectNaam: project.naam, voltooide_taken: [], nieuwe_taken: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Sync mislukt");
      addToast(`Sync voltooid: ${data.matched} afgerond, ${data.added} nieuw`, "succes");
      fetchProject();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Sync mislukt", "fout");
    } finally {
      setSyncing(false);
    }
  }, [project, addToast, fetchProject]);

  // Inline optimistic status toggle
  const handleTaakStatusToggle = useCallback(async (taakId: number, huidigStatus: string) => {
    if (pendingToggles.current.has(taakId)) return;
    const volgende = huidigStatus === "open" ? "bezig" : huidigStatus === "bezig" ? "afgerond" : "open";
    // Optimistic update
    setFases((prev) => prev.map((f) => ({
      ...f,
      taken: f.taken.map((t) => t.id === taakId ? { ...t, status: volgende } : t),
      afgerond: f.taken.some((t) => t.id === taakId)
        ? f.taken.filter((t) => t.id !== taakId || volgende === "afgerond").filter((t) => t.status === "afgerond").length +
          (volgende === "afgerond" ? 1 : 0)
        : f.afgerond,
    })));
    pendingToggles.current.add(taakId);
    try {
      await fetch(`/api/taken/${taakId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: volgende }) });
      fetchProject();
    } catch {
      addToast("Kon status niet bijwerken", "fout");
      fetchProject(); // revert by refetching
    } finally {
      pendingToggles.current.delete(taakId);
    }
  }, [fetchProject, addToast]);

  const techStack = useMemo(() => extractTechStack(project?.omschrijving ?? null), [project?.omschrijving]);
  const samenvatting = useMemo(() => {
    if (!project) return "";
    return generateSamenvatting(project, fases);
  }, [project, fases]);

  const beschrijving = useMemo(() => {
    if (!project?.omschrijving) return null;
    return project.omschrijving
      .replace(/Tech stack:\s*[^\n]+/i, "")
      .trim() || null;
  }, [project?.omschrijving]);

  const handleOpenVSCode = useCallback(async () => {
    if (!project) return;
    const dirName = project.naam.toLowerCase().replace(/\s+/g, "-");
    setOpeningVSCode(true);
    const result = await openProjectInVSCode(dirName);
    if (result.succes) {
      addToast(`VS Code + Claude geopend voor ${project.naam}`, "succes");
    } else {
      addToast(result.fout ?? "Kon project niet openen", "fout");
    }
    setOpeningVSCode(false);
  }, [project, addToast]);

  const handleStartTimer = useCallback(async () => {
    if (!project) return;
    if (timer.isRunning && timer.projectId === project.id) {
      timer.stop();
      addToast("Timer gestopt", "succes");
      return;
    }
    if (timer.isRunning) {
      addToast("Stop eerst de huidige timer", "fout");
      return;
    }
    try {
      const res = await fetch("/api/tijdregistraties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, omschrijving: project.naam, startTijd: new Date().toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout);
      timer.start(project.id, project.naam, "development", data.registratie.id);
      addToast(`Timer gestart voor ${project.naam}`, "succes");
    } catch {
      addToast("Kon timer niet starten", "fout");
    }
  }, [project, timer, addToast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-autronis-accent" />
      </div>
    );
  }

  if (!project) return null;

  const projectDirName = project.naam.toLowerCase().replace(/\s+/g, "-");

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Back link */}
        <Link
          href="/projecten"
          className="inline-flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar projecten
        </Link>

        {/* Project Header */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-7 card-glow">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight">{project.naam}</h1>
                <StatusBadge status={project.status ?? "actief"} />
              </div>
              {project.klantNaam && (
                <p className="text-sm text-autronis-text-secondary">
                  Klant: <span className="text-autronis-text-primary">{project.klantNaam}</span>
                </p>
              )}

              <div className="flex items-center gap-5 text-sm text-autronis-text-secondary flex-wrap">
                <span className="flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4" />
                  {project.afgerondTaken}/{project.totaalTaken} taken
                </span>
                {project.totaalMinuten > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatUren(project.totaalMinuten)} uur
                  </span>
                )}
                {project.aangemaaktOp && (
                  <span className="flex items-center gap-1.5">
                    Gestart: {formatDatum(project.aangemaaktOp)}
                  </span>
                )}
                {project.bijgewerktOp && (
                  <span className="flex items-center gap-1.5">
                    Laatste update: {formatDatum(project.bijgewerktOp)}
                  </span>
                )}
                {project.deadline && (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    Deadline: {formatDatum(project.deadline)}
                  </span>
                )}
              </div>

              {/* Action buttons — in header so always visible */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleStartTimer}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors",
                    timer.isRunning && timer.projectId === project.id
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25"
                      : "bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 border border-autronis-accent/20"
                  )}
                >
                  {timer.isRunning && timer.projectId === project.id
                    ? <><Square className="w-3.5 h-3.5" />Stop timer</>
                    : <><Play className="w-3.5 h-3.5" />Start timer</>
                  }
                </button>
                <button
                  onClick={handleOpenVSCode}
                  disabled={openingVSCode}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 border border-blue-500/20 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <Code2 className={cn("w-3.5 h-3.5", openingVSCode && "animate-spin")} />
                  {openingVSCode ? "Openen..." : "VS Code"}
                </button>
                <button
                  onClick={syncTaken}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 text-xs font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
                  {syncing ? "Syncing..." : "Sync taken"}
                </button>
              </div>
            </div>

            <VoortgangRing percentage={project.voortgang} size={90} />
          </div>
        </div>

        {/* Status Intelligence + Wat Nu */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <StatusIntelligence project={project} fases={fases} />
          </div>
          <div className="lg:col-span-2">
            <WatNuBlok fases={fases} onStatusToggle={handleTaakStatusToggle} />
          </div>
        </div>

        {/* Description + Tech Stack */}
        {(beschrijving || techStack.length > 0) && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4 card-glow">
            {beschrijving && (
              <div>
                <h2 className="text-sm font-medium text-autronis-text-secondary uppercase tracking-wider mb-2">
                  Beschrijving
                </h2>
                <p className="text-autronis-text-primary leading-relaxed">{beschrijving}</p>
              </div>
            )}
            {techStack.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-autronis-text-secondary uppercase tracking-wider mb-2">
                  Tech Stack
                </h2>
                <div className="flex flex-wrap gap-2">
                  {techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-3 py-1.5 rounded-full bg-autronis-accent/10 text-autronis-accent text-sm font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Samenvatting */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-medium text-autronis-text-secondary uppercase tracking-wider">
              Samenvatting
            </h2>
          </div>
          <p className="text-autronis-text-primary leading-relaxed">{samenvatting}</p>
        </div>

        {/* Fases overzicht */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-autronis-text-primary">
            Fases & Taken
            <span className="text-autronis-text-secondary font-normal text-sm ml-2">
              ({fases.length} {fases.length === 1 ? "fase" : "fases"})
            </span>
          </h2>

          {fases.length === 0 ? (
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-8 text-center">
              <FolderKanban className="w-8 h-8 text-autronis-text-secondary/30 mx-auto mb-2" />
              <p className="text-autronis-text-secondary text-sm">Nog geen taken voor dit project</p>
            </div>
          ) : (
            <div className="space-y-3">
              {fases.map((fase) => (
                <FaseSection key={fase.naam} fase={fase} onStatusToggle={handleTaakStatusToggle} />
              ))}
            </div>
          )}
        </div>

      </div>
    </PageTransition>
  );
}
