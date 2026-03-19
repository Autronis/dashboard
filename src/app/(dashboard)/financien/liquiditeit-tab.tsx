"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";

interface ForecastEntry {
  datum: string;
  verwachtInkomsten: number;
  verwachtUitgaven: number;
  saldo: number;
}

interface OpenFactuur {
  factuurnummer: string;
  klant: string;
  bedrag: number | null;
  vervaldatum: string | null;
  status: string;
}

interface LiquiditeitData {
  huidigSaldo: number;
  forecast: ForecastEntry[];
  saldo30: number;
  saldo60: number;
  saldo90: number;
  totaalOpenstaand: number;
  maandelijkseUitgaven: number;
  projectRevenue: number;
  openFacturen: OpenFactuur[];
  waarschuwing: boolean;
}

export function LiquiditeitTab() {
  const { addToast } = useToast();
  const [data, setData] = useState<LiquiditeitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saldoInput, setSaldoInput] = useState("0");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (saldo: string) => {
    try {
      const res = await fetch(`/api/financien/liquiditeit?huidigSaldo=${saldo}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      addToast("Kon liquiditeitsoverzicht niet laden", "fout");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData(saldoInput);
  }, [fetchData, saldoInput]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(saldoInput);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-autronis-border rounded-2xl p-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Find max value for bar chart scaling
  const maxBarValue = Math.max(
    ...data.forecast.map((f) => Math.max(Math.abs(f.verwachtInkomsten), Math.abs(f.verwachtUitgaven), Math.abs(f.saldo))),
    1
  );

  return (
    <div className="space-y-8">
      {/* Warning banner */}
      {data.waarschuwing && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-base font-semibold text-red-400">
              Let op: negatief saldo verwacht
            </p>
            <p className="text-sm text-red-400/80 mt-1">
              Op basis van je huidige inkomsten en uitgaven wordt je saldo de komende 90 dagen negatief.
              Overweeg openstaande facturen op te volgen of uitgaven te beperken.
            </p>
          </div>
        </div>
      )}

      {/* Saldo input + refresh */}
      <div className="flex items-end gap-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Huidig banksaldo
          </label>
          <div className="flex items-center gap-2">
            <span className="text-autronis-text-secondary text-lg">&euro;</span>
            <input
              type="number"
              value={saldoInput}
              onChange={(e) => setSaldoInput(e.target.value)}
              className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-lg font-semibold text-autronis-text-primary tabular-nums w-48 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
            />
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors hover:bg-autronis-card disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Herberekenen
        </button>
      </div>

      {/* KPI cards - Predicted saldo at 30/60/90 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
              <Wallet className="w-5 h-5 text-autronis-accent" />
            </div>
          </div>
          <AnimatedNumber
            value={data.totaalOpenstaand}
            format={formatBedrag}
            className="text-2xl font-bold text-autronis-accent tabular-nums"
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            Openstaande facturen
          </p>
        </div>

        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("p-2.5 rounded-xl", data.saldo30 >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
              {data.saldo30 >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
          <AnimatedNumber
            value={data.saldo30}
            format={formatBedrag}
            className={cn("text-2xl font-bold tabular-nums", data.saldo30 >= 0 ? "text-green-400" : "text-red-400")}
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            Saldo over 30 dagen
          </p>
        </div>

        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("p-2.5 rounded-xl", data.saldo60 >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
              {data.saldo60 >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
          <AnimatedNumber
            value={data.saldo60}
            format={formatBedrag}
            className={cn("text-2xl font-bold tabular-nums", data.saldo60 >= 0 ? "text-green-400" : "text-red-400")}
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            Saldo over 60 dagen
          </p>
        </div>

        <div className="border border-autronis-border rounded-2xl p-6 card-glow bg-autronis-card">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("p-2.5 rounded-xl", data.saldo90 >= 0 ? "bg-green-500/10" : "bg-red-500/10")}>
              {data.saldo90 >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
          </div>
          <AnimatedNumber
            value={data.saldo90}
            format={formatBedrag}
            className={cn("text-2xl font-bold tabular-nums", data.saldo90 >= 0 ? "text-green-400" : "text-red-400")}
          />
          <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
            Saldo over 90 dagen
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">
            Gemiddelde maandelijkse uitgaven
          </h4>
          <p className="text-2xl font-bold text-red-400 tabular-nums">
            {formatBedrag(data.maandelijkseUitgaven)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">
            Gebaseerd op laatste 3 maanden
          </p>
        </div>
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
          <h4 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wide mb-2">
            Verwachte project-inkomsten
          </h4>
          <p className="text-2xl font-bold text-autronis-accent tabular-nums">
            {formatBedrag(data.projectRevenue)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">
            Resterende uren actieve projecten
          </p>
        </div>
      </div>

      {/* Bar chart - weekly forecast */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-autronis-text-primary mb-6">
          90-dagen voorspelling (per week)
        </h3>

        <div className="space-y-4">
          {data.forecast.map((week, idx) => {
            const saldoPercentage = Math.min(Math.abs(week.saldo) / maxBarValue * 100, 100);
            const inkomstenPercentage = Math.min(week.verwachtInkomsten / maxBarValue * 100, 100);
            const uitgavenPercentage = Math.min(week.verwachtUitgaven / maxBarValue * 100, 100);

            return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-autronis-text-secondary font-medium min-w-[80px]">
                    Week {idx + 1}
                  </span>
                  <div className="flex items-center gap-4 text-right">
                    <span className="text-green-400 tabular-nums">
                      +{formatBedrag(week.verwachtInkomsten)}
                    </span>
                    <span className="text-red-400 tabular-nums">
                      -{formatBedrag(week.verwachtUitgaven)}
                    </span>
                    <span className={cn(
                      "font-semibold tabular-nums min-w-[100px]",
                      week.saldo >= 0 ? "text-autronis-text-primary" : "text-red-400"
                    )}>
                      {formatBedrag(week.saldo)}
                    </span>
                  </div>
                </div>

                {/* Stacked bar */}
                <div className="flex gap-1 h-5">
                  {/* Income bar */}
                  {week.verwachtInkomsten > 0 && (
                    <div
                      className="bg-green-500/30 rounded-sm transition-all duration-500"
                      style={{ width: `${inkomstenPercentage}%` }}
                    />
                  )}
                  {/* Expense bar */}
                  {week.verwachtUitgaven > 0 && (
                    <div
                      className="bg-red-500/30 rounded-sm transition-all duration-500"
                      style={{ width: `${uitgavenPercentage}%` }}
                    />
                  )}
                  {/* Saldo indicator */}
                  <div
                    className={cn(
                      "rounded-sm transition-all duration-500",
                      week.saldo >= 0 ? "bg-autronis-accent/40" : "bg-red-500/60"
                    )}
                    style={{ width: `${saldoPercentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 mt-6 pt-4 border-t border-autronis-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-green-500/30" />
            <span className="text-xs text-autronis-text-secondary">Inkomsten</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-red-500/30" />
            <span className="text-xs text-autronis-text-secondary">Uitgaven</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-autronis-accent/40" />
            <span className="text-xs text-autronis-text-secondary">Saldo</span>
          </div>
        </div>
      </div>

      {/* Open invoices */}
      {data.openFacturen.length > 0 && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-autronis-text-primary mb-4">
            Openstaande facturen
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-autronis-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Nummer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Klant</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Vervaldatum</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.openFacturen.map((f, idx) => {
                  const isOverdue = f.vervaldatum && f.vervaldatum < new Date().toISOString().slice(0, 10);
                  return (
                    <tr
                      key={idx}
                      className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-medium text-autronis-accent">
                        {f.factuurnummer}
                      </td>
                      <td className="py-3 px-4 text-sm text-autronis-text-primary">
                        {f.klant || "\u2014"}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-autronis-text-primary text-right tabular-nums">
                        {formatBedrag(f.bedrag || 0)}
                      </td>
                      <td className={cn(
                        "py-3 px-4 text-sm",
                        isOverdue ? "text-red-400 font-semibold" : "text-autronis-text-secondary"
                      )}>
                        {f.vervaldatum ? formatDatumKort(f.vervaldatum) : "\u2014"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-semibold",
                          isOverdue ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
                        )}>
                          {isOverdue ? "Te laat" : "Verzonden"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
