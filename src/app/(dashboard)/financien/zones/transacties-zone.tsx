"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter } from "lucide-react";
import { useFinancienTransacties, useFinancienCategorieen, type FinancienTransactie } from "@/hooks/queries/use-financien-transacties";
import { DonutChart } from "./donut-chart";
import { TransactieDetail } from "./transactie-detail";
import { cn } from "@/lib/utils";

type Type = "bij" | "af";
type Periode = "maand" | "kwartaal" | "jaar" | "alles";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function formatDatumKort(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

const PERIODE_LABELS: Record<Periode, string> = {
  maand: "Deze maand",
  kwartaal: "Dit kwartaal",
  jaar: "Dit jaar",
  alles: "Alles",
};

export function TransactiesZone() {
  const [type, setType] = useState<Type>("af");
  const [periode, setPeriode] = useState<Periode>("maand");
  const [categorieFilter, setCategorieFilter] = useState<string | null>(null);
  const [hoveredCategorie, setHoveredCategorie] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [selectedTrans, setSelectedTrans] = useState<FinancienTransactie | null>(null);

  const { data: transData, isLoading } = useFinancienTransacties({
    type,
    periode,
    categorie: categorieFilter ?? undefined,
    zoek: zoek || undefined,
  });
  const { data: catData } = useFinancienCategorieen(type, periode);

  const transacties = transData?.transacties ?? [];
  const totaal = useMemo(
    () => transacties.reduce((s, t) => s + Math.abs(t.bedrag), 0),
    [transacties]
  );

  return (
    <div className="space-y-4">
      {/* Header: toggle + periode */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center bg-autronis-card border border-autronis-border rounded-xl p-1 relative">
          <button
            onClick={() => { setType("af"); setCategorieFilter(null); }}
            className={cn(
              "relative px-5 py-2 rounded-lg text-sm font-medium transition-colors z-10",
              type === "af" ? "text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            Uitgaven
          </button>
          <button
            onClick={() => { setType("bij"); setCategorieFilter(null); }}
            className={cn(
              "relative px-5 py-2 rounded-lg text-sm font-medium transition-colors z-10",
              type === "bij" ? "text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            Inkomsten
          </button>
          <motion.div
            layout
            className="absolute inset-y-1 bg-autronis-accent rounded-lg"
            style={{
              width: "calc(50% - 4px)",
              left: type === "af" ? "4px" : "calc(50% + 0px)",
            }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          />
        </div>

        {/* Periode */}
        <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
          {(Object.keys(PERIODE_LABELS) as Periode[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition",
                periode === p
                  ? "bg-autronis-bg text-autronis-text-primary"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {PERIODE_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Filter row: search + active category + totaal */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-autronis-text-secondary/50" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek in transacties..."
            className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-9 pr-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
          />
        </div>
        {categorieFilter && (
          <button
            onClick={() => setCategorieFilter(null)}
            className="flex items-center gap-1.5 px-3 py-2 bg-autronis-accent/10 text-autronis-accent rounded-xl text-xs font-medium hover:bg-autronis-accent/20 transition"
          >
            <Filter className="w-3 h-3" />
            {categorieFilter}
            <span className="ml-1 text-autronis-accent/70">×</span>
          </button>
        )}
        <div className="text-sm text-autronis-text-secondary tabular-nums">
          <span className="text-autronis-text-primary font-semibold">{formatEuro(totaal)}</span>
          <span className="ml-1">· {transacties.length} {transacties.length === 1 ? "transactie" : "transacties"}</span>
        </div>
      </div>

      {/* Main: list + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* List (2 cols) */}
        <div className="lg:col-span-2 bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-autronis-text-secondary text-sm">Laden...</div>
          ) : transacties.length === 0 ? (
            <div className="p-12 text-center text-autronis-text-secondary text-sm">Geen transacties in deze periode</div>
          ) : (
            <div className="divide-y divide-autronis-border/30">
              {transacties.map((t) => {
                const isHighlighted = hoveredCategorie && t.categorie === hoveredCategorie;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTrans(t)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-autronis-bg/40 transition-colors",
                      isHighlighted && "bg-autronis-accent/5"
                    )}
                  >
                    <span className="text-xs text-autronis-text-secondary tabular-nums w-14 shrink-0">{formatDatumKort(t.datum)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-autronis-text-primary truncate">{t.merchantNaam ?? t.omschrijving}</p>
                      {t.categorie && (
                        <p className="text-[10px] text-autronis-text-secondary capitalize mt-0.5">{t.categorie}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums shrink-0",
                        t.type === "bij" ? "text-emerald-400" : "text-autronis-text-primary"
                      )}
                    >
                      {t.type === "bij" ? "+" : "−"}{formatEuro(Math.abs(t.bedrag))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Donut chart (1 col) */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
          <h3 className="text-xs uppercase text-autronis-text-secondary tracking-wide mb-4">
            {type === "af" ? "Uitgaven per categorie" : "Inkomsten per bron"}
          </h3>
          <DonutChart
            data={catData?.categorieen ?? []}
            totaal={catData?.totaal ?? 0}
            onCategorieClick={(c) => setCategorieFilter(c === categorieFilter ? null : c)}
            onCategorieHover={setHoveredCategorie}
            activeCategorie={categorieFilter}
          />
        </div>
      </div>

      {/* Detail panel */}
      <TransactieDetail transactie={selectedTrans} onClose={() => setSelectedTrans(null)} />
    </div>
  );
}
