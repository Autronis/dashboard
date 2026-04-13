"use client";

import { motion } from "framer-motion";
import { Gauge } from "lucide-react";
import { useDecisionEngine } from "@/hooks/queries/use-analytics";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const formatBedrag = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Efficiency widget — billable ratio + omzet per uur op de home page.
 * Compactere variant van de Analytics versie (geen verloren-omzet kaart).
 */
export function EfficiencyWidget() {
  const { data: decision, isLoading } = useDecisionEngine();

  if (isLoading) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Gauge className="w-4 h-4 text-autronis-accent" />
          <h2 className="text-sm font-semibold text-autronis-text-primary">Efficiency</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <Skeleton className="h-2 w-full mt-4" />
      </div>
    );
  }

  const eff = decision?.efficiency;
  if (!eff) return null;

  const billableUren = Math.round(eff.totaleUren - eff.nonBillableUren);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Gauge className="w-4 h-4 text-autronis-accent" />
        <h2 className="text-sm font-semibold text-autronis-text-primary">Efficiency</h2>
        <span className="text-[11px] text-autronis-text-secondary ml-auto">deze maand</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-[10px] text-autronis-text-secondary mb-0.5 uppercase tracking-wide">Omzet/uur</p>
          <p className="text-base font-bold text-autronis-accent tabular-nums">{formatBedrag(eff.revenuePerHour)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-autronis-text-secondary mb-0.5 uppercase tracking-wide">Billable</p>
          <p
            className={cn(
              "text-base font-bold tabular-nums",
              eff.billablePercent >= 75
                ? "text-emerald-400"
                : eff.billablePercent >= 60
                ? "text-yellow-400"
                : "text-red-400"
            )}
          >
            {eff.billablePercent.toFixed(0)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-autronis-text-secondary mb-0.5 uppercase tracking-wide">Non-billable</p>
          <p className="text-base font-bold text-orange-400 tabular-nums">{Math.round(eff.nonBillableUren)}u</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-autronis-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-autronis-text-secondary">Billable ratio</span>
          <span className="text-[11px] font-semibold text-autronis-text-primary tabular-nums">
            {billableUren}u / {Math.round(eff.totaleUren)}u
          </span>
        </div>
        <div className="w-full h-2 bg-autronis-bg rounded-full overflow-hidden flex">
          <motion.div
            className="h-full bg-autronis-accent rounded-l-full"
            initial={{ width: "0%" }}
            animate={{ width: `${eff.billablePercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <motion.div
            className="h-full bg-orange-400/30"
            initial={{ width: "0%" }}
            animate={{ width: `${100 - eff.billablePercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}
