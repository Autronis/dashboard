"use client";

import Link from "next/link";
import { Euro, ArrowRight, TrendingUp, TrendingDown, FileText } from "lucide-react";
import { useFinancienDashboard } from "@/hooks/queries/use-financien-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

const formatBedrag = (n: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * FinancieleSnapshotWidget
 * Vervangt de DoelenWidget (leeg) met: inkomsten deze maand vs vorige,
 * netto cashflow, en openstaande BTW. Actie-knoppen gaan direct naar
 * factuur-maken en financien overzicht.
 */
export function FinancieleSnapshotWidget() {
  const { data, isLoading } = useFinancienDashboard();

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Euro className="w-4 h-4 text-emerald-400" />
          Financieel deze maand
        </h3>
        <Link
          href="/financien"
          className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium inline-flex items-center gap-1"
        >
          Details <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-autronis-bg/60 rounded-xl p-4">
            <div className="text-[11px] uppercase tracking-wider text-autronis-text-secondary mb-1">
              Inkomsten
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-autronis-text-primary tabular-nums">
                {formatBedrag(data.inkomstenMaand)}
              </span>
              {data.inkomstenDelta !== null && data.inkomstenDelta !== 0 && (
                <span
                  className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                    data.inkomstenDelta > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {data.inkomstenDelta > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {data.inkomstenDelta > 0 ? "+" : ""}
                  {Math.round(data.inkomstenDelta)}%
                </span>
              )}
            </div>
            <div className="text-[11px] text-autronis-text-secondary mt-1">
              Netto:{" "}
              <span
                className={
                  data.netto >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {formatBedrag(data.netto)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-autronis-bg/40 rounded-lg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-autronis-text-secondary">
                BTW af
              </div>
              <div className="text-sm font-semibold text-autronis-text-primary tabular-nums">
                {formatBedrag(data.btwAfTeDragen)}
              </div>
            </div>
            <div className="bg-autronis-bg/40 rounded-lg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-autronis-text-secondary">
                BTW terug
              </div>
              <div className="text-sm font-semibold text-autronis-text-primary tabular-nums">
                {formatBedrag(data.btwTerugTeVragen)}
              </div>
            </div>
          </div>

          <Link
            href="/financien/nieuw"
            className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-autronis-accent/10 border border-autronis-accent/30 text-autronis-accent text-xs font-semibold hover:bg-autronis-accent/20 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Nieuwe factuur
          </Link>
        </div>
      )}
    </div>
  );
}
