"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, CheckCircle, AlertTriangle, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";

interface ForecastMaand {
  maand: string;
  label: string;
  bestCase: number;
  verwacht: number;
  worstCase: number;
}

interface ForecastData {
  zekereOmzet: number;
  verwachteOmzetPerMaand: number;
  gemiddeldUurtarief: number;
  restUren: number;
  omzetTotNu: number;
  jaardoel: number;
  benodigdPerMaand: number;
  opKoers: boolean;
  maanden: ForecastMaand[];
}

export function ForecastSection() {
  const { addToast } = useToast();
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/forecast");
      if (!res.ok) throw new Error("Laden mislukt");
      const json = await res.json() as ForecastData;
      setData(json);
    } catch {
      addToast("Kon forecast niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  if (loading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
        <Skeleton className="h-5 w-40 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxBar = Math.max(
    ...data.maanden.flatMap((m) => [m.bestCase, m.verwacht, m.worstCase]),
    1
  );

  const jaardoelPercentage = data.jaardoel > 0
    ? Math.min((data.omzetTotNu / data.jaardoel) * 100, 100)
    : 0;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Compass className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">Forecast</h2>
      </div>

      {/* Op koers indicator */}
      <div className={cn(
        "rounded-xl p-4 mb-6 flex items-center gap-4",
        data.opKoers
          ? "bg-emerald-500/10 border border-emerald-500/20"
          : "bg-red-500/10 border border-red-500/20"
      )}>
        {data.opKoers ? (
          <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold", data.opKoers ? "text-emerald-400" : "text-red-400")}>
            {data.opKoers ? "Op koers voor jaardoel" : "Niet op koers voor jaardoel"}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-0.5">
            {formatBedrag(data.omzetTotNu)} van {formatBedrag(data.jaardoel)} ({Math.round(jaardoelPercentage)}%)
            {!data.opKoers && data.benodigdPerMaand > 0 && (
              <span> — {formatBedrag(data.benodigdPerMaand)}/mnd nodig</span>
            )}
          </p>
        </div>
      </div>

      {/* Jaardoel progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-autronis-text-secondary">Voortgang jaardoel</span>
          <span className="text-xs text-autronis-text-primary font-semibold tabular-nums">
            {Math.round(jaardoelPercentage)}%
          </span>
        </div>
        <div className="w-full h-3 bg-autronis-bg rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              data.opKoers ? "bg-green-400" : "bg-red-400"
            )}
            initial={{ width: "0%" }}
            animate={{ width: `${jaardoelPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-autronis-bg/50 rounded-xl p-3">
          <p className="text-[11px] text-autronis-text-secondary mb-1">Zekere pijplijn</p>
          <p className="text-sm font-bold text-autronis-accent tabular-nums">
            <AnimatedNumber value={data.zekereOmzet} format={formatBedrag} />
          </p>
        </div>
        <div className="bg-autronis-bg/50 rounded-xl p-3">
          <p className="text-[11px] text-autronis-text-secondary mb-1">Gem. omzet/mnd</p>
          <p className="text-sm font-bold text-autronis-text-primary tabular-nums">
            <AnimatedNumber value={data.verwachteOmzetPerMaand} format={formatBedrag} />
          </p>
        </div>
        <div className="bg-autronis-bg/50 rounded-xl p-3">
          <p className="text-[11px] text-autronis-text-secondary mb-1">Rest uren pipeline</p>
          <p className="text-sm font-bold text-blue-400 tabular-nums">
            <AnimatedNumber value={data.restUren} format={(n) => `${Math.round(n)}u`} />
          </p>
        </div>
        <div className="bg-autronis-bg/50 rounded-xl p-3">
          <p className="text-[11px] text-autronis-text-secondary mb-1">Gem. uurtarief</p>
          <p className="text-sm font-bold text-yellow-400 tabular-nums">
            <AnimatedNumber value={data.gemiddeldUurtarief} format={(n) => `${formatBedrag(n)}/u`} />
          </p>
        </div>
      </div>

      {/* 3-month forecast bars */}
      <div>
        <h3 className="text-sm font-medium text-autronis-text-secondary mb-4">
          Verwachte omzet komende 3 maanden
        </h3>
        <div className="space-y-4">
          {data.maanden.map((m, i) => (
            <div key={m.maand}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-autronis-text-primary capitalize">
                  {m.label}
                </span>
              </div>
              <div className="space-y-1.5">
                {/* Best case */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-autronis-text-secondary w-16 text-right">Best</span>
                  <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-emerald-500/50"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(m.bestCase / maxBar) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[11px] text-emerald-400 tabular-nums w-24 text-right">
                    {formatBedrag(m.bestCase)}
                  </span>
                </div>
                {/* Expected */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-autronis-text-secondary w-16 text-right">Verwacht</span>
                  <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-autronis-accent/60"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(m.verwacht / maxBar) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 + 0.05, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[11px] text-autronis-accent tabular-nums w-24 text-right">
                    {formatBedrag(m.verwacht)}
                  </span>
                </div>
                {/* Worst case */}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-autronis-text-secondary w-16 text-right">Worst</span>
                  <div className="flex-1 h-3 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-red-500/40"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(m.worstCase / maxBar) * 100}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 + 0.1, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[11px] text-red-400 tabular-nums w-24 text-right">
                    {formatBedrag(m.worstCase)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-autronis-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
            <span className="text-[11px] text-autronis-text-secondary">Best case (zeker + 120%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-autronis-accent/60" />
            <span className="text-[11px] text-autronis-text-secondary">Verwacht (zeker + 80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/40" />
            <span className="text-[11px] text-autronis-text-secondary">Worst case (60% zeker)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
