"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ListTodo,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonTaken } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SwipeableTask } from "@/components/ui/swipeable-task";
import { CheckBurst } from "@/components/ui/confetti";

interface Taak {
  id: number;
  titel: string;
  omschrijving: string | null;
  status: string;
  deadline: string | null;
  prioriteit: string;
  aangemaaktOp: string | null;
  projectId: number | null;
  projectNaam: string | null;
  klantNaam: string | null;
  toegewezenAanId: number | null;
  toegewezenAanNaam: string | null;
}

interface KPIs {
  totaal: number;
  open: number;
  bezig: number;
  afgerond: number;
  verlopen: number;
}

const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string; label: string }> = {
  open: { icon: Circle, color: "text-slate-400", bg: "bg-slate-500/15", label: "Open" },
  bezig: { icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/15", label: "Bezig" },
  afgerond: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15", label: "Afgerond" },
};

const prioriteitConfig: Record<string, { color: string; bg: string; label: string }> = {
  hoog: { color: "text-red-400", bg: "bg-red-500/15", label: "Hoog" },
  normaal: { color: "text-yellow-400", bg: "bg-yellow-500/15", label: "Normaal" },
  laag: { color: "text-slate-400", bg: "bg-slate-500/15", label: "Laag" },
};

export default function TakenPage() {
  const { addToast } = useToast();
  const [taken, setTaken] = useState<Taak[]>([]);
  const [kpis, setKpis] = useState<KPIs>({ totaal: 0, open: 0, bezig: 0, afgerond: 0, verlopen: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [zoek, setZoek] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [completedTaskId, setCompletedTaskId] = useState<number | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      if (zoek) params.set("zoek", zoek);

      const res = await fetch(`/api/taken?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTaken(json.taken);
      setKpis(json.kpis);
    } catch {
      addToast("Kon taken niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, zoek, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showCheckBurst = useCallback((taskId: number) => {
    setCompletedTaskId(taskId);
    if (completedTimerRef.current) clearTimeout(completedTimerRef.current);
    completedTimerRef.current = setTimeout(() => {
      setCompletedTaskId(null);
    }, 500);
  }, []);

  const handleStatusToggle = async (taak: Taak) => {
    const volgendeStatus =
      taak.status === "open" ? "bezig" : taak.status === "bezig" ? "afgerond" : "open";
    try {
      const res = await fetch(`/api/taken/${taak.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: volgendeStatus }),
      });
      if (!res.ok) throw new Error();
      if (volgendeStatus === "afgerond") {
        showCheckBurst(taak.id);
      }
      fetchData();
    } catch {
      addToast("Kon status niet bijwerken", "fout");
    }
  };

  const handleComplete = async (taak: Taak) => {
    try {
      const res = await fetch(`/api/taken/${taak.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "afgerond" }),
      });
      if (!res.ok) throw new Error();
      showCheckBurst(taak.id);
      fetchData();
    } catch {
      addToast("Kon taak niet afronden", "fout");
    }
  };

  const handleDelete = async (taakId: number) => {
    try {
      const res = await fetch(`/api/taken/${taakId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      addToast("Taak verwijderd", "succes");
      fetchData();
    } catch {
      addToast("Kon taak niet verwijderen", "fout");
    }
  };

  const vandaag = new Date().toISOString().slice(0, 10);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <SkeletonTaken />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Taken</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            {kpis.totaal} taken &middot; {kpis.open + kpis.bezig} actief
          </p>
        </div>

        {/* KPI balk */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <ListTodo className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-text-primary">{kpis.totaal}</p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal</p>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-slate-500/10 rounded-xl">
                <Circle className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-autronis-text-primary">{kpis.open}</p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Open</p>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-400">{kpis.bezig}</p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Bezig</p>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-green-500/10 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-green-400">{kpis.afgerond}</p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Afgerond</p>
          </div>

          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2.5 rounded-xl", kpis.verlopen > 0 ? "bg-red-500/10" : "bg-autronis-accent/10")}>
                <AlertTriangle className={cn("w-5 h-5", kpis.verlopen > 0 ? "text-red-400" : "text-autronis-accent")} />
              </div>
            </div>
            <p className={cn("text-3xl font-bold", kpis.verlopen > 0 ? "text-red-400" : "text-autronis-text-primary")}>
              {kpis.verlopen}
            </p>
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Verlopen</p>
          </div>
        </div>

        {/* Filters + lijst */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              {[
                { key: "alle", label: "Alle" },
                { key: "open", label: "Open" },
                { key: "bezig", label: "Bezig" },
                { key: "afgerond", label: "Afgerond" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    statusFilter === f.key
                      ? "bg-autronis-accent text-autronis-bg"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoeken op titel..."
              className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:ml-auto sm:w-72"
            />
          </div>

          {/* Taken lijst */}
          {taken.length === 0 ? (
            <EmptyState
              titel="Geen taken"
              beschrijving="Voeg je eerste taak toe om te beginnen."
              actieLabel="Nieuwe taak"
              onActie={() => {
                /* TODO: open new task modal or navigate */
              }}
            />
          ) : (
            <div className="space-y-2">
              {taken.map((taak) => {
                const sc = statusConfig[taak.status] || statusConfig.open;
                const pc = prioriteitConfig[taak.prioriteit] || prioriteitConfig.normaal;
                const StatusIcon = sc.icon;
                const isVerlopen = taak.deadline && taak.deadline < vandaag && taak.status !== "afgerond";
                const isExpanded = expandedId === taak.id;

                const taskContent = (
                  <div
                    className={cn(
                      "bg-autronis-bg/30 rounded-xl border border-autronis-border/50 transition-colors",
                      taak.status === "afgerond" && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Status toggle */}
                      <button
                        onClick={() => handleStatusToggle(taak)}
                        className={cn("flex-shrink-0 transition-colors hover:scale-110", sc.color)}
                        title={`Status: ${sc.label} → klik om te wijzigen`}
                      >
                        <StatusIcon className={cn("w-6 h-6", taak.status === "bezig" && "animate-spin")} />
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p
                            className={cn(
                              "text-base font-medium truncate",
                              taak.status === "afgerond"
                                ? "text-autronis-text-secondary line-through"
                                : "text-autronis-text-primary"
                            )}
                          >
                            {taak.titel}
                          </p>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0", pc.bg, pc.color)}>
                            {pc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-autronis-text-secondary">
                          {taak.projectNaam && (
                            <Link
                              href={`/klanten/${taak.projectId ? "" : ""}${taak.projectNaam ? "" : ""}`}
                              onClick={(e) => e.stopPropagation()}
                              className="hover:text-autronis-accent transition-colors truncate max-w-[200px]"
                            >
                              {taak.klantNaam && `${taak.klantNaam} / `}{taak.projectNaam}
                            </Link>
                          )}
                          {taak.toegewezenAanNaam && (
                            <span className="flex-shrink-0">{taak.toegewezenAanNaam}</span>
                          )}
                        </div>
                      </div>

                      {/* Deadline */}
                      {taak.deadline && (
                        <div className={cn(
                          "text-sm font-medium flex-shrink-0",
                          isVerlopen ? "text-red-400" : "text-autronis-text-secondary"
                        )}>
                          {isVerlopen && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
                          {formatDatum(taak.deadline)}
                        </div>
                      )}

                      {/* Expand */}
                      {taak.omschrijving && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : taak.id)}
                          className="flex-shrink-0 p-1 text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </button>
                      )}

                      {/* CheckBurst */}
                      <div className="relative">
                        <CheckBurst active={completedTaskId === taak.id} />
                      </div>
                    </div>

                    {/* Expanded description */}
                    {isExpanded && taak.omschrijving && (
                      <div className="px-5 pb-4 pl-16">
                        <p className="text-sm text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">
                          {taak.omschrijving}
                        </p>
                      </div>
                    )}
                  </div>
                );

                return isTouchDevice ? (
                  <SwipeableTask
                    key={taak.id}
                    onComplete={() => handleComplete(taak)}
                    onDelete={() => handleDelete(taak.id)}
                  >
                    {taskContent}
                  </SwipeableTask>
                ) : (
                  <div key={taak.id}>
                    {taskContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
