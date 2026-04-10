"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Car, ArrowRight } from "lucide-react";
import Link from "next/link";

interface KilometerWidgetData {
  km: number;
  aftrekbaar: number;
  ritten: number;
  perWeek: number[];
  trendVsVorigeMaand: number;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: "easeOut" as const } },
};

async function fetchKilometerWidget(): Promise<KilometerWidgetData> {
  const res = await fetch("/api/kilometers/widget");
  if (!res.ok) throw new Error("Kon kilometer data niet ophalen");
  return res.json() as Promise<KilometerWidgetData>;
}

export function KilometerWidget() {
  const nu = new Date();
  const maandNaam = nu.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  const { data, isLoading } = useQuery({
    queryKey: ["kilometer-widget"],
    queryFn: fetchKilometerWidget,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <motion.div variants={sectionVariants} className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-6 card-glow animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded bg-[var(--autronis-border)]" />
          <div className="h-4 w-24 rounded bg-[var(--autronis-border)]" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-6 w-16 rounded bg-[var(--autronis-border)]" />
              <div className="h-3 w-12 rounded bg-[var(--autronis-border)]" />
            </div>
          ))}
        </div>
        <div className="flex items-end gap-1 h-10">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 rounded-t bg-[var(--autronis-border)]" style={{ height: `${20 + i * 8}px` }} />
          ))}
        </div>
      </motion.div>
    );
  }

  const km = data?.km ?? 0;
  const aftrekbaar = data?.aftrekbaar ?? 0;
  const ritten = data?.ritten ?? 0;
  const perWeek = data?.perWeek ?? [0, 0, 0, 0, 0];
  const trend = data?.trendVsVorigeMaand ?? 0;

  const maxWeek = Math.max(...perWeek, 1);

  return (
    <motion.div variants={sectionVariants} className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-6 card-glow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-[var(--autronis-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--autronis-text-primary)]">Kilometers</h2>
          <span className="text-xs text-[var(--autronis-text-muted)] capitalize">{maandNaam}</span>
        </div>
        <Link href="/kilometers" className="text-xs text-[var(--autronis-accent)] hover:text-[var(--autronis-accent-hover)] transition-colors flex items-center gap-1">
          Bekijk <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* KPI values */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xl font-bold text-[var(--autronis-text-primary)] tabular-nums">{km.toLocaleString("nl-NL")}</p>
          <p className="text-xs text-[var(--autronis-text-muted)] mt-0.5">km gereden</p>
        </div>
        <div>
          <p className="text-xl font-bold text-[var(--autronis-accent)] tabular-nums">€{aftrekbaar.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-[var(--autronis-text-muted)] mt-0.5">aftrekbaar</p>
        </div>
        <div>
          <p className="text-xl font-bold text-[var(--autronis-text-primary)] tabular-nums">{ritten}</p>
          <p className="text-xs text-[var(--autronis-text-muted)] mt-0.5">ritten</p>
        </div>
      </div>

      {/* Mini bar chart per week */}
      <div className="flex items-end gap-1.5 h-10 mb-3">
        {perWeek.map((weekKm, i) => {
          const hoogte = maxWeek > 0 ? Math.max(Math.round((weekKm / maxWeek) * 100), weekKm > 0 ? 8 : 2) : 2;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <div
                className="rounded-t bg-[var(--autronis-accent)] opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${hoogte}%` }}
                title={`Week ${i + 1}: ${weekKm} km`}
              />
            </div>
          );
        })}
      </div>

      {/* Week labels */}
      <div className="flex gap-1.5 mb-3">
        {perWeek.map((_, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-[var(--autronis-text-muted)]">W{i + 1}</div>
        ))}
      </div>

      {/* Trend indicator */}
      {trend !== 0 && (
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold ${trend > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
          <span className="text-xs text-[var(--autronis-text-muted)]">vs vorige maand</span>
        </div>
      )}
    </motion.div>
  );
}
