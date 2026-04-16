"use client";

import { useFinancienDashboard } from "@/hooks/queries/use-financien-dashboard";
import { TrendingUp, TrendingDown, Scale, Receipt, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// Pure SVG sparkline component (no external lib)
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return null;

  const width = 120;
  const height = 30;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-2 opacity-60"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export function StatusZone() {
  const { data, isLoading } = useFinancienDashboard();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 xl:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("h-28 xl:h-32 bg-autronis-card border border-autronis-border rounded-2xl animate-pulse", i === 4 && "col-span-2 md:col-span-1")} />
        ))}
      </div>
    );
  }

  const inkomstenPositief = (data.inkomstenDelta ?? 0) >= 0;
  const uitgavenGestegen = (data.uitgavenDelta ?? 0) > 0;
  const nettoPositief = data.netto >= 0;
  const nettoUp = (data.nettoDelta ?? 0) >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 xl:gap-4">
      {/* Card 1: Inkomsten */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 xl:p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-[10px] xl:text-xs text-autronis-text-secondary uppercase tracking-wide truncate">Inkomsten</span>
        </div>
        <p className="text-xl xl:text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.inkomstenMaand)}</p>
        {data.inkomstenDelta !== null && (
          <p className={cn("text-xs mt-1", inkomstenPositief ? "text-emerald-400" : "text-red-400")}>
            {inkomstenPositief ? "+" : ""}{data.inkomstenDelta}% vs vorige maand
          </p>
        )}
        <Sparkline data={data.inkomstenSparkline} color="#10b981" />
      </div>

      {/* Card 2: Uitgaven */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 xl:p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-[10px] xl:text-xs text-autronis-text-secondary uppercase tracking-wide truncate">Uitgaven</span>
        </div>
        <p className="text-xl xl:text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.uitgavenMaand)}</p>
        {data.uitgavenDelta !== null && (
          <p className={cn("text-xs mt-1", uitgavenGestegen ? "text-red-400" : "text-emerald-400")}>
            {uitgavenGestegen ? "+" : ""}{data.uitgavenDelta}% vs vorige maand
          </p>
        )}
        <Sparkline data={data.uitgavenSparkline} color="#fb923c" />
      </div>

      {/* Card 3: Netto */}
      <div
        className={cn(
          "border rounded-2xl p-4 xl:p-5 card-glow",
          nettoPositief
            ? "bg-emerald-500/5 border-emerald-500/20"
            : "bg-red-500/5 border-red-500/20"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Scale className={cn("w-4 h-4 flex-shrink-0", nettoPositief ? "text-emerald-400" : "text-red-400")} />
          <span className="text-[10px] xl:text-xs text-autronis-text-secondary uppercase tracking-wide truncate">Netto</span>
        </div>
        <p className={cn("text-xl xl:text-3xl font-bold tabular-nums", nettoPositief ? "text-emerald-400" : "text-red-400")}>
          {formatEuro(data.netto)}
        </p>
        {data.nettoDelta !== null && (
          <p className={cn("text-xs mt-1", nettoUp ? "text-emerald-400" : "text-red-400")}>
            {nettoUp ? "+" : ""}{data.nettoDelta}% vs vorige maand
          </p>
        )}
      </div>

      {/* Card 4: BTW terug te vragen */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-4 xl:p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="w-4 h-4 text-autronis-accent flex-shrink-0" />
          <span className="text-[10px] xl:text-xs text-autronis-text-secondary uppercase tracking-wide truncate">BTW terug</span>
        </div>
        <p className="text-xl xl:text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.btwTerugTeVragen)}</p>
        <p className="text-xs text-autronis-text-secondary mt-1">{data.huidigKwartaal} accumulerend</p>
      </div>

      {/* Card 5: BTW af te dragen */}
      <div className="col-span-2 md:col-span-1 bg-autronis-card border border-autronis-border rounded-2xl p-4 xl:p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-[10px] xl:text-xs text-autronis-text-secondary uppercase tracking-wide truncate">BTW af te dragen</span>
        </div>
        <p className="text-xl xl:text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.btwAfTeDragen)}</p>
        <p className="text-xs text-autronis-text-secondary mt-1">{data.huidigKwartaal} accumulerend</p>
      </div>
    </div>
  );
}
