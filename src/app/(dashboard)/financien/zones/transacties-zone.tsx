"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Repeat, TrendingUp, Sparkles, Paperclip, FileX } from "lucide-react";
import { useFinancienTransacties, useFinancienCategorieen, type FinancienTransactie } from "@/hooks/queries/use-financien-transacties";
import { DonutChart } from "./donut-chart";
import { TransactieDetail } from "./transactie-detail";
import { FISCAAL_STYLES, TYPE_STYLES, VERMOGEN_STYLE, categoriePill } from "./fiscaal-colors";
import { cn } from "@/lib/utils";

type Type = "bij" | "af";
type Periode = "maand" | "kwartaal" | "jaar" | "alles";
type QuickFilter = "alle" | "abonnementen" | "investeringen" | "eenmalig" | "zonder-bon";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function formatDatumGroep(iso: string): string {
  const datum = new Date(iso);
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  const gisteren = new Date(vandaag);
  gisteren.setDate(gisteren.getDate() - 1);
  const datumMidnight = new Date(iso);
  datumMidnight.setHours(0, 0, 0, 0);

  if (datumMidnight.getTime() === vandaag.getTime()) return "Vandaag";
  if (datumMidnight.getTime() === gisteren.getTime()) return "Gisteren";
  return datum.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function groupByDatum(transacties: FinancienTransactie[]): Array<{ datum: string; items: FinancienTransactie[]; totaal: number }> {
  const map = new Map<string, FinancienTransactie[]>();
  for (const t of transacties) {
    const existing = map.get(t.datum);
    if (existing) existing.push(t);
    else map.set(t.datum, [t]);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([datum, items]) => ({
      datum,
      items,
      totaal: items.reduce((s, t) => s + Math.abs(t.bedrag), 0),
    }));
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
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("alle");
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

  const alleTransacties = transData?.transacties ?? [];

  const transacties = useMemo(() => {
    switch (quickFilter) {
      case "abonnementen":
        return alleTransacties.filter((t) => t.isAbonnement === 1);
      case "investeringen":
        return alleTransacties.filter((t) => t.fiscaalType === "investering");
      case "eenmalig":
        return alleTransacties.filter((t) => t.isAbonnement !== 1);
      case "zonder-bon":
        return alleTransacties.filter((t) => !t.storageUrl && !t.bonPad);
      default:
        return alleTransacties;
    }
  }, [alleTransacties, quickFilter]);

  // Totaal telt vermogensstortingen NIET mee — die zijn eigen vermogen,
  // geen omzet. Ze krijgen wel een eigen pill in de lijst zodat je ze ziet.
  const totaal = useMemo(
    () =>
      transacties.reduce(
        (s, t) => (t.categorie === "vermogen" ? s : s + Math.abs(t.bedrag)),
        0
      ),
    [transacties]
  );

  const vermogenTotaal = useMemo(
    () =>
      transacties
        .filter((t) => t.categorie === "vermogen")
        .reduce((s, t) => s + Math.abs(t.bedrag), 0),
    [transacties]
  );

  const grouped = useMemo(() => groupByDatum(transacties), [transacties]);

  const quickCounts = useMemo(() => ({
    alle: alleTransacties.length,
    abonnementen: alleTransacties.filter((t) => t.isAbonnement === 1).length,
    investeringen: alleTransacties.filter((t) => t.fiscaalType === "investering").length,
    eenmalig: alleTransacties.filter((t) => t.isAbonnement !== 1).length,
    "zonder-bon": alleTransacties.filter((t) => !t.storageUrl && !t.bonPad).length,
  }), [alleTransacties]);

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
          {vermogenTotaal > 0 && (
            <span className="ml-2 text-violet-400">
              + {formatEuro(vermogenTotaal)} vermogen
            </span>
          )}
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: "alle", label: "Alles", icon: Sparkles },
          { key: "abonnementen", label: "Abonnementen", icon: Repeat },
          { key: "investeringen", label: "Investeringen", icon: TrendingUp },
          { key: "eenmalig", label: "Eenmalig", icon: Filter },
          { key: "zonder-bon", label: "Zonder bon", icon: FileX },
        ] as Array<{ key: QuickFilter; label: string; icon: typeof Sparkles }>).map((qf) => {
          const Icon = qf.icon;
          const isActive = quickFilter === qf.key;
          const count = quickCounts[qf.key];
          return (
            <button
              key={qf.key}
              onClick={() => setQuickFilter(qf.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition border",
                isActive
                  ? "bg-autronis-accent/15 text-autronis-accent border-autronis-accent/30"
                  : "bg-autronis-card text-autronis-text-secondary border-autronis-border hover:text-autronis-text-primary hover:border-autronis-accent/20"
              )}
            >
              <Icon className="w-3 h-3" />
              {qf.label}
              <span className="tabular-nums opacity-60">· {count}</span>
            </button>
          );
        })}
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
            <div>
              {grouped.map((groep) => (
                <div key={groep.datum}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-2 sticky top-0 bg-autronis-card/95 backdrop-blur-sm z-10">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                      {formatDatumGroep(groep.datum)}
                    </span>
                    <span className="text-[11px] text-autronis-text-secondary tabular-nums">
                      {formatEuro(groep.totaal)} · {groep.items.length}
                    </span>
                  </div>
                  <div className="divide-y divide-autronis-border/20">
                    {groep.items.map((t) => {
                      const isHighlighted = hoveredCategorie && t.categorie === hoveredCategorie;
                      const typeStyle = TYPE_STYLES[t.type];
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTrans(t)}
                          className={cn(
                            "w-full flex items-center gap-3 pl-4 pr-5 py-3.5 text-left hover:bg-autronis-bg/40 transition-colors relative",
                            isHighlighted && "bg-autronis-accent/5"
                          )}
                        >
                          {/* Colored accent bar on the left */}
                          <span
                            className={cn(
                              "absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm",
                              typeStyle.accent
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-autronis-text-primary truncate font-medium">
                                {t.merchantNaam ?? t.omschrijving}
                              </p>
                              {t.isAbonnement === 1 && (
                                <Repeat className="w-3 h-3 text-purple-400 shrink-0" />
                              )}
                              {(t.storageUrl || t.bonPad) && (
                                <Paperclip
                                  className="w-3 h-3 text-autronis-accent shrink-0"
                                  aria-label="Bon gekoppeld"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {t.categorie === "vermogen" ? (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                    VERMOGEN_STYLE.pill
                                  )}
                                  title="Vermogensstorting — niet meegeteld in omzet of BTW"
                                >
                                  {VERMOGEN_STYLE.label}
                                </span>
                              ) : (
                                t.categorie && (
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-medium border capitalize",
                                      categoriePill(t.categorie)
                                    )}
                                  >
                                    {t.categorie}
                                  </span>
                                )
                              )}
                              {t.fiscaalType && t.fiscaalType !== "kosten" && (
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                                    FISCAAL_STYLES[t.fiscaalType].pill
                                  )}
                                >
                                  {FISCAAL_STYLES[t.fiscaalType].label}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums shrink-0",
                              t.type === "bij" ? "text-emerald-400" : "text-rose-300"
                            )}
                          >
                            {t.type === "bij" ? "+" : "−"}{formatEuro(Math.abs(t.bedrag))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
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
