"use client";

import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { useFocusStatistieken } from "@/hooks/queries/use-focus";

const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export function FocusWidget() {
  const { data, isLoading } = useFocusStatistieken();

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-autronis-accent" />
          <h3 className="text-lg font-semibold text-autronis-text-primary">Focus vandaag</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const uren = (data.vandaag.totaleDuurMinuten / 60).toFixed(1).replace(".", ",");
  const maxDuur = Math.max(...data.week.map((d) => d.duurMinuten), 1);
  const weekTotaal = data.week.reduce((sum, d) => sum + d.duurMinuten, 0);
  const vorigeWeekTotaal = data.vorigeWeek.totaleDuurMinuten;
  const delta = vorigeWeekTotaal > 0
    ? Math.round(((weekTotaal - vorigeWeekTotaal) / vorigeWeekTotaal) * 100)
    : 0;

  return (
    <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-autronis-accent" />
          <h3 className="text-lg font-semibold text-autronis-text-primary">Focus vandaag</h3>
        </div>
        {data.streak > 0 && (
          <span className="text-xs font-medium text-autronis-accent bg-autronis-accent/10 px-2 py-1 rounded-full">
            {data.streak} dagen streak
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold text-autronis-text-primary tabular-nums">{uren}</span>
        <span className="text-sm text-autronis-text-secondary">uur</span>
      </div>
      <p className="text-sm text-autronis-text-secondary mb-5">
        {data.vandaag.sessies} {data.vandaag.sessies === 1 ? "sessie" : "sessies"}
      </p>

      {/* Week bar chart */}
      <div className="flex items-end gap-1.5 h-16 mb-2">
        {data.week.map((dag) => {
          const hoogte = maxDuur > 0 ? (dag.duurMinuten / maxDuur) * 100 : 0;
          const isVandaag = dag.dag === new Date().toISOString().substring(0, 10);
          return (
            <div key={dag.dag} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t transition-all ${
                  isVandaag ? "bg-autronis-accent" : "bg-autronis-accent/30"
                }`}
                style={{ height: `${Math.max(hoogte, 4)}%` }}
                title={`${dag.duurMinuten} min`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mb-4">
        {DAGEN_KORT.map((dag) => (
          <div key={dag} className="flex-1 text-center text-[10px] text-autronis-text-secondary">
            {dag}
          </div>
        ))}
      </div>

      {/* Week vergelijking */}
      {vorigeWeekTotaal > 0 && (
        <div className="flex items-center gap-1.5 mb-4 text-sm">
          {delta > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : delta < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-400" />
          ) : (
            <Minus className="w-4 h-4 text-autronis-text-secondary" />
          )}
          <span className={delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-autronis-text-secondary"}>
            {delta > 0 ? "+" : ""}{delta}% vs vorige week
          </span>
        </div>
      )}

      <Link
        href="/focus"
        className="text-sm text-autronis-accent hover:text-autronis-accent-hover transition-colors"
      >
        Bekijk details &rarr;
      </Link>
    </div>
  );
}
