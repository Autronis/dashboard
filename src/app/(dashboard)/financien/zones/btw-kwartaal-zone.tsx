"use client";

import { useState } from "react";
import { useBtwKwartaal, type BtwKwartaal } from "@/hooks/queries/use-btw-kwartaal";
import { CheckCircle2, AlertCircle, Circle, Download, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
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
          return (
            <div key={k.kwartaal} className="border-b border-autronis-border/30 last:border-0">
              <button
                onClick={() => !isLeeg && setOpenKwartaal(isOpen ? null : k.kwartaal)}
                disabled={isLeeg}
                className={cn(
                  "w-full p-4 flex items-center justify-between transition",
                  !isLeeg && "hover:bg-autronis-bg/40 cursor-pointer",
                  isLeeg && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  {statusIcon(k.status)}
                  <span className="text-sm font-semibold text-autronis-text-primary">{k.label}</span>
                  <span className="text-xs text-autronis-text-secondary">{statusLabel(k)}</span>
                </div>
                <div className="flex items-center gap-3">
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
                    <div className="px-4 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-autronis-bg rounded-lg p-3">
                        <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Inkomsten</p>
                        <p className="text-lg font-semibold text-autronis-text-primary tabular-nums">{formatEuro(k.inkomsten)}</p>
                      </div>
                      <div className="bg-autronis-bg rounded-lg p-3">
                        <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Uitgaven</p>
                        <p className="text-lg font-semibold text-autronis-text-primary tabular-nums">{formatEuro(k.uitgaven)}</p>
                      </div>
                      <div className="bg-autronis-bg rounded-lg p-3">
                        <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">BTW afgedragen</p>
                        <p className="text-lg font-semibold text-autronis-text-primary tabular-nums">{formatEuro(k.btwAfgedragen)}</p>
                      </div>
                      <div className="bg-autronis-bg rounded-lg p-3">
                        <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">BTW terug</p>
                        <p className="text-lg font-semibold text-autronis-text-primary tabular-nums">{formatEuro(k.btwTerug)}</p>
                      </div>
                      <div className="col-span-2 lg:col-span-4 flex justify-end">
                        <button className="flex items-center gap-2 px-4 py-2 bg-autronis-accent/10 text-autronis-accent rounded-lg text-sm font-medium hover:bg-autronis-accent/20 transition">
                          <Download className="w-4 h-4" />
                          Exporteer voor aangifte
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
