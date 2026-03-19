"use client";

import { useMemo } from "react";
import {
  Target, Clock, Flame, TrendingUp, TrendingDown, Minus,
  Play, CheckCircle2, Zap, Trophy, BarChart3, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusSessies, useFocusStatistieken } from "@/hooks/queries/use-focus";
import { useFocus } from "@/hooks/use-focus";
import { PageTransition } from "@/components/ui/page-transition";

const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const SESSIE_DOEL = 4; // Doel per dag

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
      "flex items-center gap-2 px-4 py-2 rounded-full border",
      isOnFire ? "bg-orange-500/15 border-orange-500/30" : isHot ? "bg-orange-500/10 border-orange-500/20" : "bg-autronis-accent/10 border-autronis-accent/20"
    )}>
      <Flame className={cn("w-5 h-5", isOnFire ? "text-orange-400 animate-pulse" : isHot ? "text-orange-400" : "text-autronis-accent")} />
      <span className={cn("text-sm font-bold tabular-nums", isOnFire ? "text-orange-400" : isHot ? "text-orange-400" : "text-autronis-accent")}>
        {streak} {streak === 1 ? "dag" : "dagen"} streak
      </span>
    </div>
  );
}

// ─── Week Heatmap ───
function WeekHeatmap({ week, vorigeWeekTotaal }: { week: Array<{ dag: string; duurMinuten: number }>; vorigeWeekTotaal: number }) {
  const maxDuur = Math.max(...week.map((d) => d.duurMinuten), 1);
  const weekTotaal = week.reduce((sum, d) => sum + d.duurMinuten, 0);
  const delta = vorigeWeekTotaal > 0 ? Math.round(((weekTotaal - vorigeWeekTotaal) / vorigeWeekTotaal) * 100) : 0;
  const vandaag = new Date().toISOString().substring(0, 10);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-autronis-accent" />
          <h2 className="text-lg font-semibold text-autronis-text-primary">Weekoverzicht</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-autronis-text-secondary">
            Totaal: <span className="text-autronis-text-primary font-bold">{formatDuur(weekTotaal)}</span>
          </span>
          {vorigeWeekTotaal > 0 && (
            <div className="flex items-center gap-1">
              {delta > 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : delta < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-autronis-text-secondary" />}
              <span className={cn("text-xs font-medium", delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-autronis-text-secondary")}>
                {delta > 0 ? "+" : ""}{delta}%
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-end gap-3 h-44">
        {week.map((dag, i) => {
          const hoogte = maxDuur > 0 ? (dag.duurMinuten / maxDuur) * 100 : 0;
          const isVandaagDag = dag.dag === vandaag;
          return (
            <div key={dag.dag} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-autronis-text-secondary tabular-nums h-4">
                {dag.duurMinuten > 0 ? formatDuur(dag.duurMinuten) : ""}
              </span>
              <div className="w-full flex items-end" style={{ height: 120 }}>
                <div
                  className={cn(
                    "w-full rounded-t-lg transition-all duration-500",
                    isVandaagDag ? "bg-autronis-accent shadow-lg shadow-autronis-accent/20" : "bg-autronis-accent/30 hover:bg-autronis-accent/50"
                  )}
                  style={{ height: `${Math.max(hoogte, 3)}%`, minHeight: dag.duurMinuten > 0 ? 8 : 3 }}
                />
              </div>
              <span className={cn("text-xs font-medium", isVandaagDag ? "text-autronis-accent" : "text-autronis-text-secondary")}>
                {DAGEN_KORT[i]}
              </span>
            </div>
          );
        })}
      </div>

      {vorigeWeekTotaal > 0 && (
        <div className="mt-4 pt-4 border-t border-autronis-border/50 flex items-center gap-2 text-xs text-autronis-text-secondary">
          <Calendar className="w-3.5 h-3.5" />
          <span>Vorige week: {formatDuur(vorigeWeekTotaal)}</span>
        </div>
      )}
    </div>
  );
}

export default function FocusPage() {
  const focus = useFocus();
  const { data: stats, isLoading: statsLoading } = useFocusStatistieken();

  const vandaag = new Date();
  const van = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate()).toISOString();
  const tot = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate(), 23, 59, 59).toISOString();
  const { data: sessiesData, isLoading: sessiesLoading } = useFocusSessies(van, tot);

  const isLoading = statsLoading || sessiesLoading;
  const sessies = sessiesData?.sessies || [];
  const vandaagSessies = stats?.vandaag.sessies || 0;
  const vandaagMinuten = stats?.vandaag.totaleDuurMinuten || 0;
  const streak = stats?.streak || 0;
  const weekTotaal = stats ? stats.week.reduce((sum, d) => sum + d.duurMinuten, 0) : 0;
  const vorigeWeekTotaal = stats?.vorigeWeek.totaleDuurMinuten || 0;

  // Gemiddelde sessieduur
  const gemiddeldeDuur = useMemo(() => {
    if (!sessies.length) return 0;
    const totaal = sessies.reduce((s, ses) => s + (ses.werkelijkeDuurMinuten || 0), 0);
    return Math.round(totaal / sessies.length);
  }, [sessies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* ─── Hero: Start Focus ─── */}
        {!focus.isActive && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-autronis-accent/10 via-autronis-card to-autronis-card border border-autronis-accent/20">
            {/* Decorative circles */}
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-autronis-accent/5" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-autronis-accent/5" />

            <div className="relative flex flex-col lg:flex-row items-center gap-8 p-8 lg:p-10">
              <div className="flex-1 text-center lg:text-left">
                <h1 className="text-3xl lg:text-4xl font-bold text-autronis-text-primary mb-2">Focus Mode</h1>
                <p className="text-base text-autronis-text-secondary mb-6 max-w-md">
                  Start een deep work sessie. Kies je project, stel een timer in, en werk ongestoord.
                </p>

                <button
                  onClick={() => focus.openSetup()}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-autronis-accent text-white font-bold text-lg hover:bg-autronis-accent-hover transition-all shadow-xl shadow-autronis-accent/25 hover:shadow-2xl hover:shadow-autronis-accent/30 hover:-translate-y-0.5"
                >
                  <Target className="w-6 h-6" />
                  Start Focus Sessie
                </button>

                <div className="flex items-center gap-4 mt-5">
                  {[
                    { label: "25 min", sub: "Pomodoro" },
                    { label: "45 min", sub: "Deep work" },
                    { label: "60 min", sub: "Marathon" },
                  ].map((s) => (
                    <button
                      key={s.label}
                      onClick={() => focus.openSetup()}
                      className="px-3 py-1.5 rounded-lg bg-autronis-bg/50 border border-autronis-border/50 text-xs text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-colors"
                    >
                      <span className="font-medium text-autronis-text-primary">{s.label}</span>
                      <span className="ml-1">{s.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Goal ring rechts */}
              <div className="flex flex-col items-center gap-3">
                <GoalRing huidig={vandaagSessies} doel={SESSIE_DOEL} size={140} />
                <div className="text-center">
                  <p className="text-sm font-medium text-autronis-text-primary">Dagdoel</p>
                  <p className="text-xs text-autronis-text-secondary">{SESSIE_DOEL} sessies per dag</p>
                </div>
                <StreakBadge streak={streak} />
              </div>
            </div>
          </div>
        )}

        {/* Active session indicator when overlay is hidden */}
        {focus.isActive && !focus.showOverlay && (
          <button
            onClick={() => focus.openOverlay()}
            className="w-full bg-autronis-accent/10 border border-autronis-accent/30 rounded-2xl p-5 flex items-center gap-4 hover:bg-autronis-accent/15 transition-colors"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-autronis-accent flex items-center justify-center">
                <Play className="w-5 h-5 text-autronis-accent ml-0.5" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-autronis-accent animate-pulse" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-autronis-text-primary">Focus sessie actief</p>
              <p className="text-xs text-autronis-text-secondary">{focus.projectNaam}{focus.taakTitel ? ` — ${focus.taakTitel}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-autronis-accent tabular-nums">
                {Math.floor(focus.resterend / 60)}:{String(focus.resterend % 60).padStart(2, "0")}
              </p>
              <p className="text-[10px] text-autronis-text-secondary uppercase">Klik om terug te gaan</p>
            </div>
          </button>
        )}

        {/* ─── KPI Row ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-autronis-accent/10"><Clock className="w-4 h-4 text-autronis-accent" /></div>
            </div>
            <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatDuur(vandaagMinuten)}</p>
            <p className="text-xs text-autronis-text-secondary mt-1">{vandaagSessies} sessies vandaag</p>
          </div>

          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-blue-500/10"><Target className="w-4 h-4 text-blue-400" /></div>
            </div>
            <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatDuur(weekTotaal)}</p>
            <div className="flex items-center gap-1 mt-1">
              {vorigeWeekTotaal > 0 ? (
                <>
                  {weekTotaal > vorigeWeekTotaal ? <TrendingUp className="w-3 h-3 text-green-400" /> : weekTotaal < vorigeWeekTotaal ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-autronis-text-secondary" />}
                  <span className={cn("text-xs", weekTotaal > vorigeWeekTotaal ? "text-green-400" : weekTotaal < vorigeWeekTotaal ? "text-red-400" : "text-autronis-text-secondary")}>
                    vs {formatDuur(vorigeWeekTotaal)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-autronis-text-secondary">Deze week</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-orange-500/10"><Flame className="w-4 h-4 text-orange-400" /></div>
            </div>
            <p className={cn("text-2xl font-bold tabular-nums", streak >= 7 ? "text-orange-400" : "text-autronis-text-primary")}>
              {streak} {streak === 1 ? "dag" : "dagen"}
            </p>
            <p className="text-xs text-autronis-text-secondary mt-1">
              {streak >= 14 ? "On fire!" : streak >= 7 ? "Sterke streak!" : streak > 0 ? "Opeenvolgend" : "Start je streak!"}
            </p>
          </div>

          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-purple-500/10"><Zap className="w-4 h-4 text-purple-400" /></div>
            </div>
            <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">{formatDuur(gemiddeldeDuur)}</p>
            <p className="text-xs text-autronis-text-secondary mt-1">Gem. sessieduur</p>
          </div>
        </div>

        {/* ─── Week Heatmap ─── */}
        {stats && (
          <WeekHeatmap week={stats.week} vorigeWeekTotaal={vorigeWeekTotaal} />
        )}

        {/* ─── Two column: Sessies + Per Project ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessies vandaag */}
          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-autronis-accent" />
              <h2 className="text-lg font-semibold text-autronis-text-primary">Sessies vandaag</h2>
              <span className="text-xs text-autronis-text-secondary ml-auto">{sessies.length} sessies</span>
            </div>
            {sessies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Target className="w-8 h-8 text-autronis-text-secondary/30 mb-3" />
                <p className="text-sm text-autronis-text-secondary">Nog geen sessies vandaag</p>
                <button
                  onClick={() => focus.openSetup()}
                  className="mt-3 text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                >
                  Start je eerste sessie &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sessies.map((sessie) => (
                  <div key={sessie.id} className="flex items-start gap-3 p-3 rounded-xl bg-autronis-bg/50 border border-autronis-border/30">
                    <div className={cn(
                      "mt-0.5 p-1 rounded-lg flex-shrink-0",
                      sessie.status === "voltooid" ? "bg-green-500/10" : "bg-orange-500/10"
                    )}>
                      {sessie.status === "voltooid" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-autronis-text-primary truncate">{sessie.projectNaam}</p>
                      {sessie.taakTitel && <p className="text-xs text-autronis-text-secondary truncate">{sessie.taakTitel}</p>}
                      {sessie.reflectie && <p className="text-xs text-autronis-text-secondary/80 mt-1 italic">&ldquo;{sessie.reflectie}&rdquo;</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-autronis-text-primary tabular-nums">
                        {formatDuur(sessie.werkelijkeDuurMinuten || 0)}
                      </p>
                      <span className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
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
          <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-autronis-accent" />
              <h2 className="text-lg font-semibold text-autronis-text-primary">Per project</h2>
              <span className="text-xs text-autronis-text-secondary ml-auto">deze week</span>
            </div>
            {!stats?.perProject.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart3 className="w-8 h-8 text-autronis-text-secondary/30 mb-3" />
                <p className="text-sm text-autronis-text-secondary">Nog geen focus data deze week</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.perProject
                  .sort((a, b) => b.duurMinuten - a.duurMinuten)
                  .map((project, i) => {
                    const maxProjectDuur = Math.max(...stats.perProject.map((p) => p.duurMinuten), 1);
                    const breedte = (project.duurMinuten / maxProjectDuur) * 100;
                    return (
                      <div key={project.projectId}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {i === 0 && <Trophy className="w-3.5 h-3.5 text-yellow-400" />}
                            <span className="text-sm font-medium text-autronis-text-primary">{project.projectNaam}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-autronis-text-secondary">
                            <span className="tabular-nums">{formatDuurLang(project.duurMinuten)}</span>
                            <span className="text-autronis-text-secondary/50">&middot;</span>
                            <span>{project.sessies} sessies</span>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full bg-autronis-border/50">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              i === 0 ? "bg-autronis-accent" : "bg-autronis-accent/50"
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
