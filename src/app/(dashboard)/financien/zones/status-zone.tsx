"use client";

import { useFinancienDashboard } from "@/hooks/queries/use-financien-dashboard";
import { TrendingUp, TrendingDown, Receipt, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function StatusZone() {
  const { data, isLoading } = useFinancienDashboard();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-autronis-card border border-autronis-border rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const inkomstenPositief = (data.inkomstenDelta ?? 0) >= 0;
  const uitgavenGestegen = (data.uitgavenDelta ?? 0) > 0;
  const btwReady = data.btwTeVerwerken === 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Inkomsten deze maand */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-autronis-text-secondary uppercase tracking-wide">Inkomsten</span>
        </div>
        <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.inkomstenMaand)}</p>
        {data.inkomstenDelta !== null && (
          <p className={cn("text-xs mt-1", inkomstenPositief ? "text-emerald-400" : "text-red-400")}>
            {inkomstenPositief ? "+" : ""}{data.inkomstenDelta}% vs vorige maand
          </p>
        )}
      </div>

      {/* Card 2: Uitgaven deze maand */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-orange-400" />
          <span className="text-xs text-autronis-text-secondary uppercase tracking-wide">Uitgaven</span>
        </div>
        <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.uitgavenMaand)}</p>
        {data.uitgavenDelta !== null && (
          <p className={cn("text-xs mt-1", uitgavenGestegen ? "text-red-400" : "text-emerald-400")}>
            {uitgavenGestegen ? "+" : ""}{data.uitgavenDelta}% vs vorige maand
          </p>
        )}
      </div>

      {/* Card 3: BTW terug te vragen */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="w-4 h-4 text-autronis-accent" />
          <span className="text-xs text-autronis-text-secondary uppercase tracking-wide">BTW terug</span>
        </div>
        <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{formatEuro(data.btwTerugTeVragen)}</p>
        <p className="text-xs text-autronis-text-secondary mt-1">{data.huidigKwartaal} accumulerend</p>
      </div>

      {/* Card 4: BTW status */}
      <div
        className={cn(
          "border rounded-2xl p-5 card-glow",
          btwReady ? "bg-emerald-500/10 border-emerald-500/30" : "bg-orange-500/10 border-orange-500/30"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {btwReady ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange-400" />
          )}
          <span className="text-xs text-autronis-text-secondary uppercase tracking-wide">BTW status</span>
        </div>
        {btwReady ? (
          <>
            <p className="text-2xl font-bold text-emerald-400">Klaar</p>
            <p className="text-xs text-autronis-text-secondary mt-1">{data.huidigKwartaal} compleet</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-orange-400 tabular-nums">{data.btwTeVerwerken}</p>
            <p className="text-xs text-autronis-text-secondary mt-1">items te verwerken</p>
          </>
        )}
      </div>
    </div>
  );
}
