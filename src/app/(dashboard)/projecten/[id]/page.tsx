"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { cn, formatDatum, formatUren } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";
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
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 100 ? "#22c55e" : percentage >= 50 ? "#17B8A5" : "#3b82f6";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2A3538"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-autronis-text-primary tabular-nums">
        {percentage}%
      </span>
    </div>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full h-2 bg-autronis-border rounded-full overflow-hidden">
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

function TaakStatusIcon({ status }: { status: string }) {
  if (status === "afgerond") return <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />;
  if (status === "bezig") return <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  return <Circle className="w-4 h-4 text-autronis-text-secondary/40 flex-shrink-0" />;
}

function FaseSection({ fase }: { fase: Fase }) {
  const [open, setOpen] = useState(fase.afgerond < fase.totaal);
  const percentage = fase.totaal > 0 ? Math.round((fase.afgerond / fase.totaal) * 100) : 0;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden card-glow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-autronis-border/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="w-5 h-5 text-autronis-text-secondary" />
          ) : (
            <ChevronRight className="w-5 h-5 text-autronis-text-secondary" />
          )}
          <div>
            <h3 className="text-base font-semibold text-autronis-text-primary">{fase.naam}</h3>
            <p className="text-xs text-autronis-text-secondary mt-0.5">
              {fase.afgerond}/{fase.totaal} taken afgerond
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={cn(
            "text-sm font-bold tabular-nums",
            percentage >= 100 ? "text-green-400" : "text-autronis-text-primary"
          )}>
            {percentage}%
          </span>
          <div className="w-24">
            <ProgressBar percentage={percentage} />
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-autronis-border">
          {fase.taken.map((taak) => (
            <div
              key={taak.id}
              className={cn(
                "flex items-center gap-3 px-5 py-3 border-b border-autronis-border/50 last:border-b-0 transition-colors",
                taak.status === "afgerond" ? "opacity-60" : "hover:bg-autronis-border/10"
              )}
            >
              <TaakStatusIcon status={taak.status} />
              <span className={cn(
                "flex-1 text-sm",
                taak.status === "afgerond"
                  ? "text-autronis-text-secondary line-through"
                  : "text-autronis-text-primary"
              )}>
                {taak.titel}
              </span>
              {taak.uitvoerder === "claude" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">
                  Claude
                </span>
              )}
              {taak.prioriteit === "hoog" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                  Hoog
                </span>
              )}
              {taak.deadline && (
                <span className="text-[10px] text-autronis-text-secondary/60">
                  {formatDatum(taak.deadline)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
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

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [fases, setFases] = useState<Fase[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [openingVSCode, setOpeningVSCode] = useState(false);

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
                <h1 className="text-3xl font-bold text-white tracking-tight">{project.naam}</h1>
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
            </div>

            <VoortgangRing percentage={project.voortgang} size={90} />
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
          <h2 className="text-lg font-semibold text-white">
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
                <FaseSection key={fase.naam} fase={fase} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenVSCode}
            disabled={openingVSCode}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            <Code2 className={cn("w-4 h-4", openingVSCode && "animate-spin")} />
            {openingVSCode ? "Openen..." : "Open in VS Code + Claude"}
          </button>
          <button
            onClick={syncTaken}
            disabled={syncing}
            className="flex items-center gap-2 px-5 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync taken"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
