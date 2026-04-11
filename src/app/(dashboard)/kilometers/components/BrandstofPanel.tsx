"use client";

import { Fuel, TrendingDown, TrendingUp, Droplets } from "lucide-react";
import { JaaroverzichtData } from "@/hooks/queries/use-kilometers";

interface BrandstofPanelProps {
  data: JaaroverzichtData;
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="border border-autronis-border rounded-xl p-4 bg-autronis-card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider">{label}</span>
        <div className="p-1.5 rounded-lg bg-white/5">
          <Icon className="w-3.5 h-3.5 text-autronis-accent" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-bold text-autronis-text-primary">{value}</span>
        {trend && trend !== "neutral" && (
          <span className={trend === "down" ? "text-emerald-400" : "text-red-400"}>
            {trend === "down" ? (
              <TrendingDown className="w-4 h-4" />
            ) : (
              <TrendingUp className="w-4 h-4" />
            )}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-autronis-text-secondary">{sub}</span>}
    </div>
  );
}

function formatBedrag(amount: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function BrandstofPanel({ data }: BrandstofPanelProps) {
  const brandstof = data.brandstof;

  if (!brandstof || brandstof.totaalBedrag <= 0) {
    return null;
  }

  // Km per liter
  const kmPerLiter =
    brandstof.totaalLiters > 0 && data.totaalKm > 0
      ? data.totaalKm / brandstof.totaalLiters
      : null;

  // Trend: compare current month's fuel with previous month
  const huidigeMaand = new Date().getMonth() + 1;
  const huidigeMaandData = brandstof.perMaand.find((m) => m.maand === huidigeMaand);
  const vorigeMaandData = brandstof.perMaand.find((m) => m.maand === huidigeMaand - 1);

  let trendLabel = "—";
  let trendDirection: "up" | "down" | "neutral" = "neutral";

  if (huidigeMaandData && vorigeMaandData && vorigeMaandData.bedrag > 0) {
    const diff = huidigeMaandData.bedrag - vorigeMaandData.bedrag;
    const pct = Math.round((diff / vorigeMaandData.bedrag) * 100);
    trendLabel = `${pct > 0 ? "+" : ""}${pct}% vs vorige maand`;
    trendDirection = diff > 0 ? "up" : "down";
  } else if (huidigeMaandData) {
    trendLabel = formatBedrag(huidigeMaandData.bedrag) + " deze maand";
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-1">
        Brandstof
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Totaal brandstof"
          value={formatBedrag(brandstof.totaalBedrag)}
          sub={`${brandstof.aantalTankbeurten} tankbeurt${brandstof.aantalTankbeurten !== 1 ? "en" : ""}`}
          icon={Fuel}
        />
        <KpiCard
          label="Kosten per km"
          value={brandstof.kostenPerKm > 0 ? `€ ${brandstof.kostenPerKm.toFixed(2)}` : "—"}
          sub={data.totaalKm > 0 ? `${Math.round(data.totaalKm).toLocaleString("nl-NL")} km gereden` : undefined}
          icon={TrendingDown}
        />
        <KpiCard
          label="Km per liter"
          value={kmPerLiter !== null ? kmPerLiter.toFixed(1) : "—"}
          sub={
            brandstof.totaalLiters > 0
              ? `${brandstof.totaalLiters.toFixed(0)} liter totaal`
              : "Geen liters geregistreerd"
          }
          icon={Droplets}
        />
        <KpiCard
          label="Trend"
          value={trendLabel}
          icon={TrendingUp}
          trend={trendDirection}
        />
      </div>
    </div>
  );
}
