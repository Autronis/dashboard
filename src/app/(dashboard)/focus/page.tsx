"use client";

import { useMemo } from "react";
import {
  Target, Clock, Flame, TrendingUp, TrendingDown, Minus,
  Play, CheckCircle2, Zap, Trophy, BarChart3, Calendar, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusSessies, useFocusStatistieken } from "@/hooks/queries/use-focus";
import { useFocus } from "@/hooks/use-focus";
import { PageTransition } from "@/components/ui/page-transition";
import { useQuery } from "@tanstack/react-query";
import type { Taak } from "@/hooks/queries/use-taken";

const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const SESSIE_DOEL = 4;
const DOEL_MINUTEN_PER_DAG = 4 * 45; // 3 uur target

function formatDuur(minuten: number): string {
  if (minuten < 60) return `${minuten}m`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest > 0 ? `${uren}u ${rest}m` : `${uren}u`;
}

function formatDuurLang(minuten: number): string {
  if (minuten < 60) return `${minuten} minuten`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest > 0 ? `${uren} uur ${rest} min` : `${uren} uur`;
}

// ─── Goal Ring ───
function GoalRing({ huidig, doel, size = 120 }: { huidig: number; doel: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(huidig / doel, 1);
  const offset = circumference - progress * circumference;
  const isCompleet = huidig >= doel;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2A3538" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={isCompleet ? "#4ade80" : "#17B8A5"}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-bold tabular-nums", isCompleet ? "text-green-400" : "text-autronis-text-primary")}>
          {huidig}
        </span>
        <span className="text-[10px] text-autronis-text-secondary">/ {doel}</span>
      </div>
    </div>
  );
}

// ─── Streak Flame ───
function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null;
  const isHot = streak >= 7;
  const isOnFire = streak >= 14;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold",
      isOnFire ? "bg-orange-500/15 border-orange-500/30 text-orange-400" : isHot ? "bg-orange-500/10 border-orange-500/20 text-orange-400" : "bg-autronis-accent/10 border-autronis-accent/20 text-autronis-accent"
    )}>
      <Flame className={cn("w-3.5 h-3.5", isOnFire && "animate-pulse")} />
      {streak} {streak === 1 ? "dag" : "dagen"}
    </div>
  );
}

// ─── Week Heatmap ───
function WeekHeatmap({ week, vorigeWeekTotaal }: { week: Array<{ dag: string; duurMinuten: number }>; vorigeWeekTotaal: number }) {
  const weekTotaal = week.reduce((sum, d) => sum + d.duurMinuten, 0);
  const delta = vorigeWeekTotaal > 0 ? Math.round(((weekTotaal - vorigeWeekTotaal) / vorigeWeekTotaal) * 100) : 0;
  const vandaag = new Date().toISOString().substring(0, 10);
  const doelPerDag = DOEL_MINUTEN_PER_DAG;
  // Use target or max actual, whichever is higher, for bar scaling
  const maxDuur = Math.max(...week.map((d) => d.duurMinuten), doelPerDag);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Weekoverzicht</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-autronis-text-secondary">
            <span className="text-autronis-text-primary font-bold">{formatDuur(weekTotaal)}</span> deze week
          </span>
          {vorigeWeekTotaal > 0 && (
            <div className="flex items-center gap-1">
              {delta > 0 ? <TrendingUp className="w-3 h-3 text-green-400" /> : delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-autronis-text-secondary" />}
              <span className={cn("text-[11px] font-medium", delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-autronis-text-secondary")}>
                {delta > 0 ? "+" : ""}{delta}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2 h-36 relative">
        {/* Target line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-autronis-accent/20 pointer-events-none"
          style={{ bottom: `${(doelPerDag / maxDuur) * 100}%` }}
        >
          <span className="absolute -top-3 right-0 text-[9px] text-autronis-accent/40 font-medium">doel</span>
        </div>

        {week.map((dag, i) => {
          const hoogte = maxDuur > 0 ? (dag.duurMinuten / maxDuur) * 100 : 0;
          const isVandaagDag = dag.dag === vandaag;
          const haaldDoel = dag.duurMinuten >= doelPerDag;
          return (
            <div key={dag.dag} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-autronis-text-secondary tabular-nums h-3">
                {dag.duurMinuten > 0 ? formatDuur(dag.duurMinuten) : ""}
              </span>
              <div className="w-full flex items-end" style={{ height: 100 }}>
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-500",
                    dag.duurMinuten === 0
                      ? "bg-autronis-border/20"
                      : haaldDoel
                        ? "bg-green-400/70"
                        : isVandaagDag
                          ? "bg-autronis-accent shadow-sm shadow-autronis-accent/20"
                          : "bg-autronis-accent/30"
                  )}
                  style={{ height: `${Math.max(hoogte, dag.duurMinuten === 0 ? 3 : 6)}%` }}
                />
              </div>
              <span className={cn("text-[10px] font-medium", isVandaagDag ? "text-autronis-accent" : "text-autronis-text-secondary/70")}>
                {DAGEN_KORT[i]}
              </span>
            </div>
          );
        })}
      </div>

      {vorigeWeekTotaal > 0 && (
        <div className="mt-3 pt-3 border-t border-autronis-border/50 flex items-center gap-2 text-[11px] text-autronis-text-secondary">
          <Calendar className="w-3 h-3" />
          Vorige week: {formatDuur(vorigeWeekTotaal)}
        </div>
      )}
    </div>
  );
}

// ─── Prioritized task helper ───
const prioriteitSortOrder: Record<string, number> = { hoog: 0, normaal: 1, laag: 2 };

function getVolgendeTaak(taken: Taak[]): Taak | null {
  const vandaag = new Date().toISOString().slice(0, 10);
  return taken
    .filter((t) => t.status !== "afgerond")
    .sort((a, b) => {
      const aV = a.deadline && a.deadline <= vandaag ? -1 : 0;
      const bV = b.deadline && b.deadline <= vandaag ? -1 : 0;
      if (aV !== bV) return aV - bV;
      const pa = prioriteitSortOrder[a.prioriteit] ?? 1;
      const pb = prioriteitSortOrder[b.prioriteit] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.status === "bezig" && b.status !== "bezig") return -1;
      if (b.status === "bezig" && a.status !== "bezig") return 1;
      return 0;
    })[0] ?? null;
}

export default function FocusPage() {
  const focus = useFocus();
  const { data: stats, isLoading: statsLoading } = useFocusStatistieken();

  const vandaag = new Date();
  const van = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate()).toISOString();
  const tot = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate(), 23, 59, 59).toISOString();
  const { data: sessiesData, isLoading: sessiesLoading } = useFocusSessies(van, tot);

  // Fetch volgende taak
  const { data: takenData } = useQuery({
    queryKey: ["taken", { status: "alle" }],
    queryFn: async () => {
      const res = await fetch("/api/taken");
      if (!res.ok) throw new Error();
      return res.json() as Promise<{ taken: Taak[] }>;
    },
    staleTime: 60_000,
  });

  const volgendeTaak = useMemo(() => getVolgendeTaak(takenData?.taken ?? []), [takenData]);

  const isLoading = statsLoading || sessiesLoading;
  const sessies = sessiesData?.sessies || [];
  const vandaagSessies = stats?.vandaag.sessies || 0;
  const vandaagMinuten = stats?.vandaag.totaleDuurMinuten || 0;
  const streak = stats?.streak || 0;
  const weekTotaal = stats ? stats.week.reduce((sum, d) => sum + d.duurMinuten, 0) : 0;
  const vorigeWeekTotaal = stats?.vorigeWeek.totaleDuurMinuten || 0;

  const gemiddeldeDuur = useMemo(() => {
    if (!sessies.length) return 0;
    const totaal = sessies.reduce((s, ses) => s + (ses.werkelijkeDuurMinuten || 0), 0);
    return Math.round(totaal / sessies.length);
  }, [sessies]);

  // Dynamic CTA text
  const ctaText = useMemo(() => {
    if (vandaagSessies === 0) return "Start je eerste focus sessie";
    const nodig = SESSIE_DOEL - vandaagSessies;
    if (nodig <= 0) return "Nog een sessie? Je zit al op je doel!";
    return `Nog ${nodig} ${nodig === 1 ? "sessie" : "sessies"} nodig vandaag`;
  }, [vandaagSessies]);

  // Deep work progress (% of daily goal)
  const deepWorkPct = Math.min(Math.round((vandaagMinuten / DOEL_MINUTEN_PER_DAG) * 100), 100);

  const handleStartMetTaak = () => {
    if (volgendeTaak) {
      focus.start({
        projectId: volgendeTaak.projectId ?? 0,
        projectNaam: volgendeTaak.projectNaam ?? "Onbekend",
        taakId: volgendeTaak.id,
        taakTitel: volgendeTaak.titel,
        duurMinuten: 45,
      });
    } else {
      focus.openSetup();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* ─── Hero: Start Focus ─── */}
        {!focus.isActive && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/20">
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-autronis-accent/5" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-autronis-accent/5" />

            <div className="relative flex flex-col lg:flex-row items-center gap-6 p-6 lg:p-8">
              <div className="flex-1 text-center lg:text-left">
                <p className="text-xs font-medium text-autronis-accent uppercase tracking-wider mb-1">Focus Mode</p>

                {/* Volgende taak connectie */}
                {volgendeTaak ? (
                  <div className="mb-4">
                    <p className="text-sm text-autronis-text-secondary mb-1">Je volgende taak:</p>
                    <h1 className="text-2xl lg:text-3xl font-bold text-autronis-text-primary leading-tight">{volgendeTaak.titel}</h1>
                    <p className="text-sm text-autronis-text-secondary mt-1">
                      {volgendeTaak.projectNaam}{volgendeTaak.fase ? ` · ${volgendeTaak.fase}` : ""}
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <h1 className="text-2xl lg:text-3xl font-bold text-autronis-text-primary">Deep Work</h1>
                    <p className="text-sm text-autronis-text-secondary mt-1">Kies een project en start een focus sessie</p>
                  </div>
                )}

                {/* CTA — dynamisch */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={handleStartMetTaak}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-autronis-accent text-white font-bold text-base hover:bg-autronis-accent-hover transition-all shadow-lg shadow-autronis-accent/25 hover:shadow-xl hover:shadow-autronis-accent/30 hover:-translate-y-0.5"
                  >
                    <Play className="w-5 h-5" />
                    {volgendeTaak ? "Start focus sessie" : "Kies project"}
                  </button>
                  {volgendeTaak && (
                    <button
                      onClick={() => focus.openSetup()}
                      className="px-4 py-3 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-colors"
                    >
                      Ander project kiezen
                    </button>
                  )}
                </div>

                {/* Dynamic sub-CTA text */}
                <p className="text-xs text-autronis-text-secondary mt-3">{ctaText}</p>

                {/* Presets compact */}
                <div className="flex items-center gap-2 mt-3">
                  {[
                    { min: 25, label: "Pomodoro" },
                    { min: 45, label: "Deep work" },
                    { min: 60, label: "Marathon" },
                  ].map((s) => (
                    <button
                      key={s.min}
                      onClick={() => {
                        if (volgendeTaak) {
                          focus.start({
                            projectId: volgendeTaak.projectId ?? 0,
                            projectNaam: volgendeTaak.projectNaam ?? "Onbekend",
                            taakId: volgendeTaak.id,
                            taakTitel: volgendeTaak.titel,
                            duurMinuten: s.min,
                          });
                        } else {
                          focus.openSetup();
                        }
                      }}
                      className="px-2.5 py-1 rounded-md bg-autronis-bg/40 border border-autronis-border/40 text-[11px] text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-colors"
                    >
                      <span className="font-semibold text-autronis-text-primary">{s.min}m</span>
                      <span className="ml-1 hidden sm:inline">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal ring + streak rechts, dichter bij CTA */}
              <div className="flex flex-col items-center gap-2">
                <GoalRing huidig={vandaagSessies} doel={SESSIE_DOEL} size={120} />
                <p className="text-[11px] text-autronis-text-secondary">{SESSIE_DOEL} sessies per dag</p>
                <StreakBadge streak={streak} />
              </div>
            </div>
          </div>
        )}

        {/* Active session indicator when overlay is hidden */}
        {focus.isActive && !focus.showOverlay && (
          <button
            onClick={() => focus.openOverlay()}
            className="w-full bg-autronis-accent/10 border border-autronis-accent/30 rounded-2xl p-4 flex items-center gap-4 hover:bg-autronis-accent/15 transition-colors"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-[3px] border-autronis-accent flex items-center justify-center">
                <Play className="w-4 h-4 text-autronis-accent ml-0.5" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-autronis-accent animate-pulse" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-autronis-text-primary">Focus sessie actief</p>
              <p className="text-xs text-autronis-text-secondary">{focus.projectNaam}{focus.taakTitel ? ` — ${focus.taakTitel}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-autronis-accent tabular-nums">
                {Math.floor(focus.resterend / 60)}:{String(focus.resterend % 60).padStart(2, "0")}
              </p>
              <p className="text-[10px] text-autronis-text-secondary">Klik om terug te gaan</p>
            </div>
          </button>
        )}

        {/* ─── KPI Row — primair boven, secundair eronder ─── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Deep work vandaag */}
          <div className="rounded-xl bg-autronis-card border border-autronis-border p-4 card-glow">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-autronis-accent/10"><Clock className="w-3.5 h-3.5 text-autronis-accent" /></div>
              <span className="text-xs text-autronis-text-secondary">Vandaag</span>
            </div>
            <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatDuur(vandaagMinuten)}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-autronis-border/30 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", deepWorkPct >= 100 ? "bg-green-400" : "bg-autronis-accent")} style={{ width: `${deepWorkPct}%` }} />
              </div>
              <span className="text-[10px] text-autronis-text-secondary tabular-nums">{deepWorkPct}%</span>
            </div>
            <p className="text-[10px] text-autronis-text-secondary mt-1">{vandaagSessies} sessies · doel {formatDuur(DOEL_MINUTEN_PER_DAG)}</p>
          </div>

          {/* Week */}
          <div className="rounded-xl bg-autronis-card border border-autronis-border p-4 card-glow">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10"><Target className="w-3.5 h-3.5 text-blue-400" /></div>
              <span className="text-xs text-autronis-text-secondary">Deze week</span>
            </div>
            <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatDuur(weekTotaal)}</p>
            <div className="flex items-center gap-1.5 mt-2">
              {vorigeWeekTotaal > 0 ? (
                <>
                  {weekTotaal > vorigeWeekTotaal ? <TrendingUp className="w-3 h-3 text-green-400" /> : weekTotaal < vorigeWeekTotaal ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-autronis-text-secondary" />}
                  <span className={cn("text-xs", weekTotaal > vorigeWeekTotaal ? "text-green-400" : weekTotaal < vorigeWeekTotaal ? "text-red-400" : "text-autronis-text-secondary")}>
                    vs {formatDuur(vorigeWeekTotaal)} vorige week
                  </span>
                </>
              ) : (
                <span className="text-xs text-autronis-text-secondary">Eerste week!</span>
              )}
            </div>
          </div>
        </div>

        {/* Secundaire stats — compact inline */}
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5">
            <Flame className={cn("w-3.5 h-3.5", streak >= 7 ? "text-orange-400" : "text-autronis-text-secondary")} />
            <span className={cn("text-xs font-medium", streak >= 7 ? "text-orange-400" : "text-autronis-text-secondary")}>
              {streak} {streak === 1 ? "dag" : "dagen"} streak
            </span>
          </div>
          <div className="w-px h-3 bg-autronis-border/50" />
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-autronis-text-secondary" />
            <span className="text-xs text-autronis-text-secondary">
              Gem. sessie: <span className="font-medium text-autronis-text-primary">{formatDuur(gemiddeldeDuur)}</span>
            </span>
          </div>
        </div>

        {/* ─── Week Heatmap ─── */}
        {stats && (
          <WeekHeatmap week={stats.week} vorigeWeekTotaal={vorigeWeekTotaal} />
        )}

        {/* ─── Two column: Sessies + Per Project ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Sessies vandaag */}
          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-autronis-accent" />
              <h2 className="text-sm font-semibold text-autronis-text-primary">Sessies vandaag</h2>
              <span className="text-[11px] text-autronis-text-secondary ml-auto">{sessies.length} sessies</span>
            </div>
            {sessies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Target className="w-7 h-7 text-autronis-text-secondary/20 mb-2" />
                <p className="text-sm text-autronis-text-secondary mb-2">Nog geen sessies vandaag</p>
                <button
                  onClick={handleStartMetTaak}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent/10 text-autronis-accent text-xs font-semibold hover:bg-autronis-accent/20 transition-colors"
                >
                  <Play className="w-3 h-3" /> Start je eerste focus blok
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sessies.map((sessie) => (
                  <div key={sessie.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-autronis-bg/50 border border-autronis-border/30">
                    <div className={cn(
                      "mt-0.5 p-1 rounded-md flex-shrink-0",
                      sessie.status === "voltooid" ? "bg-green-500/10" : "bg-orange-500/10"
                    )}>
                      {sessie.status === "voltooid" ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-autronis-text-primary truncate">{sessie.projectNaam}</p>
                      {sessie.taakTitel && <p className="text-[11px] text-autronis-text-secondary truncate">{sessie.taakTitel}</p>}
                      {sessie.reflectie && <p className="text-[11px] text-autronis-text-secondary/70 mt-0.5 italic truncate">&ldquo;{sessie.reflectie}&rdquo;</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-autronis-text-primary tabular-nums">
                        {formatDuur(sessie.werkelijkeDuurMinuten || 0)}
                      </p>
                      <span className={cn(
                        "text-[9px] font-medium px-1.5 py-0.5 rounded-full",
                        sessie.status === "voltooid" ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"
                      )}>
                        {sessie.status === "voltooid" ? "Voltooid" : "Afgebroken"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per project */}
          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-autronis-accent" />
              <h2 className="text-sm font-semibold text-autronis-text-primary">Per project</h2>
              <span className="text-[11px] text-autronis-text-secondary ml-auto">deze week</span>
            </div>
            {!stats?.perProject.length ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <BarChart3 className="w-7 h-7 text-autronis-text-secondary/20 mb-2" />
                <p className="text-sm text-autronis-text-secondary">Nog geen focus data deze week</p>
                <p className="text-xs text-autronis-text-secondary/70 mt-1">Start een sessie om hier je voortgang te zien</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {stats.perProject
                  .sort((a, b) => b.duurMinuten - a.duurMinuten)
                  .map((project, i) => {
                    const maxProjectDuur = Math.max(...stats.perProject.map((p) => p.duurMinuten), 1);
                    const breedte = (project.duurMinuten / maxProjectDuur) * 100;
                    return (
                      <div key={project.projectId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            {i === 0 && <Trophy className="w-3 h-3 text-yellow-400" />}
                            <span className="text-xs font-medium text-autronis-text-primary">{project.projectNaam}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-autronis-text-secondary">
                            <span className="tabular-nums font-medium">{formatDuurLang(project.duurMinuten)}</span>
                            <span className="text-autronis-text-secondary/40">&middot;</span>
                            <span>{project.sessies}x</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-autronis-border/30">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              i === 0 ? "bg-autronis-accent" : "bg-autronis-accent/40"
                            )}
                            style={{ width: `${breedte}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
