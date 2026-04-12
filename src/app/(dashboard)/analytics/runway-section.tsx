"use client";

import { useEffect, useState, useCallback } from "react";
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Skeleton } from "@/components/ui/skeleton";

interface RunwayData {
  huidigSaldo: number;
  gemiddeldeKostenPerMaand: number;
  gemiddeldeInkomstenPerMaand: number;
  nettoPerMaand: number;
  runwayMaanden: number | null;
  projectie: {
    maand: string;
    saldo: number;
    inkomsten: number;
    kosten: number;
  }[];
}

export function RunwaySection() {
  const { addToast } = useToast();
  const [data, setData] = useState<RunwayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saldoInput, setSaldoInput] = useState("25000");
  const [scenarioPercentage, setScenarioPercentage] = useState(100);

  const fetchRunway = useCallback(async (saldo: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/runway?huidigSaldo=${saldo}`);
      if (!res.ok) throw new Error("Laden mislukt");
      const json = await res.json() as RunwayData;
      setData(json);
    } catch {
      addToast("Kon runway niet berekenen", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    const saldo = Number(saldoInput) || 0;
    fetchRunway(saldo);
  }, [fetchRunway, saldoInput]);

  // Calculate scenario-adjusted data
  const scenarioData = data ? {
    ...data,
    nettoPerMaand: data.gemiddeldeInkomstenPerMaand * (scenarioPercentage / 100) - data.gemiddeldeKostenPerMaand,
    projectie: data.projectie.map((p, i) => {
      const adjustedInkomsten = data.gemiddeldeInkomstenPerMaand * (scenarioPercentage / 100);
      const adjustedNetto = adjustedInkomsten - data.gemiddeldeKostenPerMaand;
      return {
        ...p,
        saldo: (Number(saldoInput) || 0) + adjustedNetto * (i + 1),
      };
    }),
  } : null;

  const maxSaldo = scenarioData
    ? Math.max(...scenarioData.projectie.map((p) => Math.abs(p.saldo)), 1)
    : 1;

  const inputClasses =
    "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors";

  function runwayKleur(maanden: number | null): string {
    if (maanden === null) return "text-emerald-400";
    if (maanden >= 12) return "text-emerald-400";
    if (maanden >= 6) return "text-yellow-400";
    return "text-red-400";
  }

  function runwayIcon(maanden: number | null) {
    if (maanden === null) return <Shield className="w-6 h-6 text-emerald-400" />;
    if (maanden >= 6) return <TrendingUp className="w-6 h-6 text-yellow-400" />;
    return <AlertTriangle className="w-6 h-6 text-red-400" />;
  }

  const scenarioRunway = scenarioData
    ? scenarioData.nettoPerMaand >= 0
      ? null
      : Math.floor((Number(saldoInput) || 0) / Math.abs(scenarioData.nettoPerMaand))
    : null;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="w-5 h-5 text-autronis-accent" />
        <h2 className="text-lg font-semibold text-autronis-text-primary">Runway Calculator</h2>
      </div>

      {/* Saldo input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-autronis-text-secondary mb-1.5">
          Huidig banksaldo
        </label>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-autronis-text-secondary">
            &euro;
          </span>
          <input
            type="number"
            value={saldoInput}
            onChange={(e) => setSaldoInput(e.target.value)}
            className={cn(inputClasses, "pl-8 max-w-xs")}
            placeholder="25000"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : scenarioData ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-autronis-bg/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-autronis-text-secondary">Gem. kosten/mnd</span>
              </div>
              <p className="text-lg font-bold text-red-400 tabular-nums">
                <AnimatedNumber value={scenarioData.gemiddeldeKostenPerMaand} format={formatBedrag} />
              </p>
            </div>
            <div className="bg-autronis-bg/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-autronis-text-secondary">Gem. inkomsten/mnd</span>
              </div>
              <p className="text-lg font-bold text-emerald-400 tabular-nums">
                <AnimatedNumber value={scenarioData.gemiddeldeInkomstenPerMaand * (scenarioPercentage / 100)} format={formatBedrag} />
              </p>
            </div>
            <div className="bg-autronis-bg/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-autronis-accent" />
                <span className="text-xs text-autronis-text-secondary">Netto/mnd</span>
              </div>
              <p className={cn("text-lg font-bold tabular-nums", scenarioData.nettoPerMaand >= 0 ? "text-emerald-400" : "text-red-400")}>
                <AnimatedNumber
                  value={scenarioData.nettoPerMaand}
                  format={(n) => `${n >= 0 ? "+" : ""}${formatBedrag(n)}`}
                />
              </p>
            </div>
            <div className="bg-autronis-bg/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {runwayIcon(scenarioRunway)}
                <span className="text-xs text-autronis-text-secondary">Runway</span>
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", runwayKleur(scenarioRunway))}>
                {scenarioRunway === null ? (
                  <span className="flex items-center gap-1">
                    <span className="text-lg">&#8734;</span>
                    <span className="text-sm font-normal">maanden</span>
                  </span>
                ) : (
                  <>
                    <AnimatedNumber value={scenarioRunway} />
                    <span className="text-sm font-normal text-autronis-text-secondary ml-1">mnd</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Scenario slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-autronis-text-secondary">
                Wat als je <span className="font-semibold text-autronis-text-primary">{scenarioPercentage}%</span> van je gemiddelde omzet hebt?
              </label>
              <button
                onClick={() => setScenarioPercentage(100)}
                className="text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors"
              >
                Reset
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              step={5}
              value={scenarioPercentage}
              onChange={(e) => setScenarioPercentage(Number(e.target.value))}
              className="w-full accent-autronis-accent h-2 rounded-full appearance-none bg-autronis-border cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-autronis-text-secondary mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>

          {/* 12-month projection chart */}
          <div>
            <h3 className="text-sm font-medium text-autronis-text-secondary mb-4">
              Kasspositie komende 12 maanden
            </h3>
            <div className="flex items-end gap-1.5 h-48">
              {scenarioData.projectie.map((p, i) => {
                const isPositive = p.saldo >= 0;
                const barHeight = (Math.abs(p.saldo) / maxSaldo) * 100;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="relative w-full flex justify-center h-full items-end">
                      <div className="absolute -top-8 text-[10px] text-autronis-text-secondary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums z-10">
                        {formatBedrag(p.saldo)}
                      </div>
                      <motion.div
                        className={cn(
                          "w-full max-w-[32px] rounded-t-lg transition-colors",
                          isPositive
                            ? "bg-green-500/40 group-hover:bg-green-400"
                            : "bg-red-500/40 group-hover:bg-red-400"
                        )}
                        initial={{ height: "0%" }}
                        animate={{ height: `${Math.max(barHeight, 2)}%` }}
                        transition={{ duration: 0.5, delay: i * 0.04, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-[9px] text-autronis-text-secondary whitespace-nowrap">
                      {p.maand.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
