"use client";

import { Target, Clock, Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useFocusSessies, useFocusStatistieken } from "@/hooks/queries/use-focus";
import { useFocus } from "@/hooks/use-focus";

const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function formatDuur(minuten: number): string {
  if (minuten < 60) return `${minuten} min`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest > 0 ? `${uren}u ${rest}m` : `${uren}u`;
}

export default function FocusPage() {
  const focus = useFocus();
  const { data: stats, isLoading: statsLoading } = useFocusStatistieken();

  // Get today's sessions
  const vandaag = new Date();
  const van = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate()).toISOString();
  const tot = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate(), 23, 59, 59).toISOString();
  const { data: sessiesData, isLoading: sessiesLoading } = useFocusSessies(van, tot);

  const isLoading = statsLoading || sessiesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  const sessies = sessiesData?.sessies || [];
  const maxDuurWeek = stats ? Math.max(...stats.week.map((d) => d.duurMinuten), 1) : 1;
  const weekTotaal = stats ? stats.week.reduce((sum, d) => sum + d.duurMinuten, 0) : 0;
  const vorigeWeekTotaal = stats?.vorigeWeek.totaleDuurMinuten || 0;
  const delta = vorigeWeekTotaal > 0
    ? Math.round(((weekTotaal - vorigeWeekTotaal) / vorigeWeekTotaal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary">Focus</h1>
          <p className="text-autronis-text-secondary">Deep work sessies & statistieken</p>
        </div>
        <button
          onClick={() => focus.openSetup()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors"
        >
          <Target className="w-4 h-4" />
          Nieuwe sessie
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm text-autronis-text-secondary">Vandaag</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatDuur(stats?.vandaag.totaleDuurMinuten || 0)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">
            {stats?.vandaag.sessies || 0} sessies
          </p>
        </div>

        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm text-autronis-text-secondary">Deze week</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatDuur(weekTotaal)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {delta > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-400" />
            ) : delta < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-autronis-text-secondary" />
            )}
            <span className={`text-xs ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-autronis-text-secondary"}`}>
              {delta > 0 ? "+" : ""}{delta}% vs vorige week
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-autronis-text-secondary">Streak</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {stats?.streak || 0} dagen
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">Opeenvolgend</p>
        </div>

        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm text-autronis-text-secondary">Vorige week</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatDuur(vorigeWeekTotaal)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">Totaal</p>
        </div>
      </div>

      {/* Week overzicht bar chart */}
      <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Weekoverzicht</h2>
        <div className="flex items-end gap-3 h-40">
          {stats?.week.map((dag, i) => {
            const hoogte = maxDuurWeek > 0 ? (dag.duurMinuten / maxDuurWeek) * 100 : 0;
            const isVandaag = dag.dag === new Date().toISOString().substring(0, 10);
            return (
              <div key={dag.dag} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-autronis-text-secondary tabular-nums">
                  {dag.duurMinuten > 0 ? formatDuur(dag.duurMinuten) : ""}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isVandaag ? "bg-autronis-accent" : "bg-autronis-accent/30"
                  }`}
                  style={{ height: `${Math.max(hoogte, 2)}%` }}
                />
                <span className={`text-xs ${isVandaag ? "text-autronis-accent font-medium" : "text-autronis-text-secondary"}`}>
                  {DAGEN_KORT[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vandaag sessies */}
        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">Sessies vandaag</h2>
          {sessies.length === 0 ? (
            <p className="text-sm text-autronis-text-secondary">Nog geen sessies vandaag.</p>
          ) : (
            <div className="space-y-3">
              {sessies.map((sessie) => (
                <div
                  key={sessie.id}
                  className="flex items-start justify-between p-3 rounded-xl bg-autronis-bg/50 border border-autronis-border/50"
                >
                  <div>
                    <p className="text-sm font-medium text-autronis-text-primary">
                      {sessie.projectNaam}
                    </p>
                    {sessie.taakTitel && (
                      <p className="text-xs text-autronis-text-secondary">{sessie.taakTitel}</p>
                    )}
                    {sessie.reflectie && (
                      <p className="text-xs text-autronis-text-secondary mt-1 italic">
                        &ldquo;{sessie.reflectie}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sessie.status === "voltooid"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-orange-500/10 text-orange-400"
                    }`}>
                      {sessie.status === "voltooid" ? "Voltooid" : "Afgebroken"}
                    </span>
                    <p className="text-sm font-medium text-autronis-text-primary mt-1 tabular-nums">
                      {formatDuur(sessie.werkelijkeDuurMinuten || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per project breakdown */}
        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">Per project (deze week)</h2>
          {!stats?.perProject.length ? (
            <p className="text-sm text-autronis-text-secondary">Nog geen focus data deze week.</p>
          ) : (
            <div className="space-y-3">
              {stats.perProject.map((project) => {
                const maxProjectDuur = Math.max(...stats.perProject.map((p) => p.duurMinuten), 1);
                const breedte = (project.duurMinuten / maxProjectDuur) * 100;
                return (
                  <div key={project.projectId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-autronis-text-primary">{project.projectNaam}</span>
                      <span className="text-xs text-autronis-text-secondary tabular-nums">
                        {formatDuur(project.duurMinuten)} &middot; {project.sessies} sessies
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-autronis-border">
                      <div
                        className="h-full rounded-full bg-autronis-accent transition-all"
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
  );
}
