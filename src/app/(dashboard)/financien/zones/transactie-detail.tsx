"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Receipt, Calendar, Building2, Tag, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { FinancienTransactie } from "@/hooks/queries/use-financien-transacties";
import { cn } from "@/lib/utils";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function statusKleur(status: string | null): { text: string; classes: string; icon: typeof CheckCircle2 } {
  if (status === "gematcht") return { text: "Gematcht", classes: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 };
  if (status === "gecategoriseerd") return { text: "Gecategoriseerd", classes: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Circle };
  return { text: "Onbekend", classes: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: AlertCircle };
}

interface Props {
  transactie: FinancienTransactie | null;
  onClose: () => void;
}

export function TransactieDetail({ transactie, onClose }: Props) {
  return (
    <AnimatePresence>
      {transactie && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-autronis-card border-l border-autronis-border z-50 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-autronis-text-primary">Transactie details</h3>
                <button onClick={onClose} className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Amount */}
              <div className="text-center py-6 bg-autronis-bg rounded-xl">
                <p className={cn("text-4xl font-bold tabular-nums", transactie.type === "bij" ? "text-emerald-400" : "text-autronis-text-primary")}>
                  {transactie.type === "bij" ? "+" : "−"}{formatEuro(Math.abs(transactie.bedrag))}
                </p>
                {transactie.btwBedrag != null && transactie.btwBedrag > 0 && (
                  <p className="text-xs text-autronis-text-secondary mt-2">
                    BTW: {formatEuro(transactie.btwBedrag)}
                  </p>
                )}
              </div>

              {/* Main info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Omschrijving</p>
                    <p className="text-sm text-autronis-text-primary">{transactie.merchantNaam ?? transactie.omschrijving}</p>
                    {transactie.merchantNaam && transactie.omschrijving && transactie.merchantNaam !== transactie.omschrijving && (
                      <p className="text-xs text-autronis-text-secondary mt-0.5">{transactie.omschrijving}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Datum</p>
                    <p className="text-sm text-autronis-text-primary">{formatDatum(transactie.datum)}</p>
                  </div>
                </div>

                {transactie.categorie && (
                  <div className="flex items-start gap-3">
                    <Tag className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Categorie</p>
                      <p className="text-sm text-autronis-text-primary capitalize">{transactie.categorie}</p>
                    </div>
                  </div>
                )}

                {transactie.bank && (
                  <div className="flex items-start gap-3">
                    <Receipt className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Bank</p>
                      <p className="text-sm text-autronis-text-primary capitalize">{transactie.bank}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI description */}
              {transactie.aiBeschrijving && (
                <div className="bg-autronis-bg rounded-xl p-4">
                  <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1">AI analyse</p>
                  <p className="text-sm text-autronis-text-primary">{transactie.aiBeschrijving}</p>
                </div>
              )}

              {/* Status + tags */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const s = statusKleur(transactie.status);
                  const Icon = s.icon;
                  return (
                    <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium", s.classes)}>
                      <Icon className="w-3 h-3" />
                      {s.text}
                    </span>
                  );
                })()}
                {transactie.isAbonnement === 1 && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                    Abonnement
                  </span>
                )}
                {transactie.fiscaalType && (
                  <span className="px-2.5 py-1 rounded-lg bg-autronis-bg border border-autronis-border text-autronis-text-secondary text-xs font-medium capitalize">
                    {transactie.fiscaalType}
                  </span>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
