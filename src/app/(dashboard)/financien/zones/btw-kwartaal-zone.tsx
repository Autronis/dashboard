"use client";

import { useState } from "react";
import { useBtwKwartaal, type BtwKwartaal } from "@/hooks/queries/use-btw-kwartaal";
import { CheckCircle2, AlertCircle, Circle, Download, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const MONTHS_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

// "2026-04-01" + "2026-06-30" → "1 april — 30 juni 2026".
// If the years differ it shows both years explicitly.
function formatPeriode(start: string, eind: string): string {
  const s = new Date(start);
  const e = new Date(eind);
  const sDay = s.getDate();
  const sMonth = MONTHS_NL[s.getMonth()];
  const sYear = s.getFullYear();
  const eDay = e.getDate();
  const eMonth = MONTHS_NL[e.getMonth()];
  const eYear = e.getFullYear();

  if (sYear === eYear) {
    return `${sDay} ${sMonth} — ${eDay} ${eMonth} ${eYear}`;
  }
  return `${sDay} ${sMonth} ${sYear} — ${eDay} ${eMonth} ${eYear}`;
}

function statusIcon(status: BtwKwartaal["status"]) {
  if (status === "aangedaan") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "klaar") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "huidig") return <AlertCircle className="w-4 h-4 text-orange-400" />;
  return <Circle className="w-4 h-4 text-autronis-text-secondary/40" />;
}

function statusLabel(k: BtwKwartaal): string {
  if (k.status === "aangedaan") return "Aangifte gedaan";
  if (k.status === "klaar") return "Klaar voor aangifte";
  if (k.status === "huidig") return k.itemsTeVerwerken > 0 ? `${k.itemsTeVerwerken} items te verwerken` : "Loopt";
  return "Toekomst";
}

export function BtwKwartaalZone() {
  const jaar = new Date().getFullYear();
  const { data, isLoading } = useBtwKwartaal(jaar);
  const [openKwartaal, setOpenKwartaal] = useState<number | null>(null);

  function exporteer(kwartaal: number) {
    // Same-tab download via <a> element so the browser uses the session cookie
    const url = `/api/financien/btw-kwartaal/export?jaar=${jaar}&kwartaal=${kwartaal}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-autronis-text-primary">BTW {jaar}</h2>
        <div className="h-48 bg-autronis-card border border-autronis-border rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-autronis-text-primary">BTW {jaar}</h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
        {data.kwartalen.map((k) => {
          const isOpen = openKwartaal === k.kwartaal;
          const isLeeg = k.status === "leeg";
          const periode = formatPeriode(k.startDatum, k.eindDatum);
          return (
            <div key={k.kwartaal} className="border-b border-autronis-border/30 last:border-0">
              <button
                onClick={() => !isLeeg && setOpenKwartaal(isOpen ? null : k.kwartaal)}
                disabled={isLeeg}
                className={cn(
                  "w-full p-4 flex items-center justify-between transition gap-4",
                  !isLeeg && "hover:bg-autronis-bg/40 cursor-pointer",
                  isLeeg && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon(k.status)}
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-autronis-text-primary">{k.label}</span>
                      <span className="text-xs text-autronis-text-secondary">·</span>
                      <span className="text-xs text-autronis-text-secondary">{periode}</span>
                    </div>
                    <span className="text-[11px] text-autronis-text-secondary/80 mt-0.5">{statusLabel(k)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!isLeeg && (
                    <span className={cn("text-sm font-semibold tabular-nums", k.teBetalen >= 0 ? "text-orange-400" : "text-emerald-400")}>
                      {k.teBetalen >= 0 ? "−" : "+"}{formatEuro(Math.abs(k.teBetalen))}
                    </span>
                  )}
                  {!isLeeg && (
                    <ChevronDown className={cn("w-4 h-4 text-autronis-text-secondary transition-transform", isOpen && "rotate-180")} />
                  )}
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="px-4 pb-4 space-y-3">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-autronis-bg rounded-lg p-3">
                          <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">
                            Inkomsten {periode.split(" — ")[0]} – {periode.split(" — ")[1]}
                          </p>
                          <p className="text-lg font-semibold text-emerald-400 tabular-nums">{formatEuro(k.inkomsten)}</p>
                        </div>
                        <div className="bg-autronis-bg rounded-lg p-3">
                          <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">
                            Uitgaven {periode.split(" — ")[0]} – {periode.split(" — ")[1]}
                          </p>
                          <p className="text-lg font-semibold text-rose-300 tabular-nums">{formatEuro(k.uitgaven)}</p>
                        </div>
                        <div className="bg-autronis-bg rounded-lg p-3">
                          <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">BTW afgedragen</p>
                          <p className="text-lg font-semibold text-autronis-text-primary tabular-nums">{formatEuro(k.btwAfgedragen)}</p>
                        </div>
                        <div className="bg-autronis-bg rounded-lg p-3">
                          <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">BTW terug</p>
                          <p className="text-lg font-semibold text-autronis-text-primary tabular-nums">{formatEuro(k.btwTerug)}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => exporteer(k.kwartaal)}
                          className="flex items-center gap-2 px-4 py-2 bg-autronis-accent/10 text-autronis-accent rounded-lg text-sm font-medium hover:bg-autronis-accent/20 transition"
                        >
                          <Download className="w-4 h-4" />
                          Exporteer voor aangifte (CSV)
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
