"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Link2Off, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FactuurInfo {
  id: number;
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  datum: string;
  factuurnummer: string | null;
  storageUrl: string;
  status: "gematcht" | "onbekoppeld" | "handmatig_gematcht";
}

interface Kandidaat {
  id: number;
  datum: string;
  merchantNaam: string | null;
  omschrijving: string;
  bedrag: number;
  bank: string | null;
  categorie: string | null;
  score: number;
  reasons: string[];
}

interface Props {
  factuurId: number | null;
  onClose: () => void;
  onLinked: () => void;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function KoppelModal({ factuurId, onClose, onLinked }: Props) {
  const { addToast } = useToast();
  const [factuur, setFactuur] = useState<FactuurInfo | null>(null);
  const [kandidaten, setKandidaten] = useState<Kandidaat[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    if (!factuurId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/administratie/koppel?factuurId=${factuurId}`);
      if (!res.ok) {
        const { fout } = (await res.json().catch(() => ({ fout: "Kon niet laden" }))) as { fout?: string };
        throw new Error(fout ?? "Kon niet laden");
      }
      const data = (await res.json()) as { factuur: FactuurInfo; kandidaten: Kandidaat[] };
      setFactuur(data.factuur);
      setKandidaten(data.kandidaten);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [factuurId, addToast]);

  useEffect(() => {
    if (factuurId) load();
  }, [factuurId, load]);

  const handleKoppel = useCallback(
    async (transactieId: number) => {
      if (!factuurId) return;
      setBusyId(transactieId);
      try {
        const res = await fetch("/api/administratie/koppel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factuurId, transactieId }),
        });
        if (!res.ok) {
          const { fout } = (await res.json().catch(() => ({ fout: "Koppelen mislukt" }))) as { fout?: string };
          throw new Error(fout ?? "Koppelen mislukt");
        }
        addToast("Factuur gekoppeld", "succes");
        onLinked();
        onClose();
      } catch (err) {
        addToast(err instanceof Error ? err.message : "Koppelen mislukt", "fout");
      } finally {
        setBusyId(null);
      }
    },
    [factuurId, addToast, onClose, onLinked]
  );

  const handleOntkoppel = useCallback(async () => {
    if (!factuurId) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/administratie/koppel?factuurId=${factuurId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const { fout } = (await res.json().catch(() => ({ fout: "Ontkoppelen mislukt" }))) as { fout?: string };
        throw new Error(fout ?? "Ontkoppelen mislukt");
      }
      addToast("Factuur ontkoppeld", "succes");
      onLinked();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Ontkoppelen mislukt", "fout");
    } finally {
      setUnlinking(false);
    }
  }, [factuurId, addToast, onClose, onLinked]);

  const handleBekijkPdf = useCallback(async () => {
    if (!factuur?.storageUrl) return;
    try {
      const res = await fetch(`/api/administratie/signed-url?path=${encodeURIComponent(factuur.storageUrl)}`);
      if (!res.ok) throw new Error("Kon link niet ophalen");
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon PDF niet openen", "fout");
    }
  }, [factuur, addToast]);

  return (
    <AnimatePresence>
      {factuurId !== null && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-2xl max-h-[85vh] bg-autronis-card border border-autronis-border rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-autronis-border">
                <div>
                  <h3 className="text-lg font-semibold text-autronis-text-primary">Factuur koppelen</h3>
                  <p className="text-xs text-autronis-text-secondary mt-0.5">
                    Selecteer een bank-transactie waar deze factuur bij hoort
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Factuur info */}
              {factuur && (
                <div className="px-6 py-4 bg-autronis-bg/40 border-b border-autronis-border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-autronis-text-primary truncate">
                          {factuur.leverancier}
                        </p>
                        {factuur.factuurnummer && (
                          <span className="text-xs text-autronis-text-secondary">· {factuur.factuurnummer}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-autronis-text-secondary">
                        <span className="tabular-nums">{formatDatum(factuur.datum)}</span>
                        <span className="font-semibold text-rose-300 tabular-nums">
                          {formatEuro(factuur.bedrag)}
                        </span>
                        {factuur.btwBedrag != null && factuur.btwBedrag > 0 && (
                          <span className="tabular-nums">BTW {formatEuro(factuur.btwBedrag)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleBekijkPdf}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent/10 text-autronis-accent text-xs font-semibold hover:bg-autronis-accent/20 transition-colors shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Bekijk PDF
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  {factuur.status !== "onbekoppeld" && (
                    <button
                      onClick={handleOntkoppel}
                      disabled={unlinking}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-xs font-semibold hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                    >
                      {unlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                      Huidige koppeling ontkoppelen
                    </button>
                  )}
                </div>
              )}

              {/* Kandidaten */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-autronis-text-secondary text-sm">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                    Kandidaten zoeken...
                  </div>
                ) : kandidaten.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-autronis-text-secondary mb-2">
                      Geen bank-transacties gevonden die hierop lijken.
                    </p>
                    <p className="text-xs text-autronis-text-secondary/70">
                      Zoekt binnen 45 dagen rondom de factuurdatum, ±30% bedrag. Mogelijk staat de
                      transactie op je ING en is die nog niet gesynced.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-autronis-border/30">
                    {kandidaten.map((k) => {
                      const isBusy = busyId === k.id;
                      return (
                        <button
                          key={k.id}
                          onClick={() => handleKoppel(k.id)}
                          disabled={busyId !== null}
                          className={cn(
                            "w-full flex items-center gap-3 px-6 py-3 text-left transition-colors disabled:opacity-50",
                            isBusy ? "bg-autronis-accent/10" : "hover:bg-autronis-bg/40"
                          )}
                        >
                          {/* Score badge */}
                          <div
                            className={cn(
                              "w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold tabular-nums",
                              k.score >= 70
                                ? "bg-emerald-500/15 text-emerald-400"
                                : k.score >= 40
                                  ? "bg-amber-500/15 text-amber-400"
                                  : "bg-autronis-bg text-autronis-text-secondary"
                            )}
                          >
                            {k.score}%
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-autronis-text-primary truncate">
                              {k.merchantNaam ?? k.omschrijving}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-autronis-text-secondary">
                              <span className="tabular-nums">{formatDatum(k.datum)}</span>
                              {k.bank && <span>· {k.bank}</span>}
                              {k.categorie && <span>· {k.categorie}</span>}
                            </div>
                            {k.reasons.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {k.reasons.map((r, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-autronis-bg text-autronis-text-secondary border border-autronis-border"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <span className="text-sm font-semibold tabular-nums shrink-0 text-rose-300">
                            {formatEuro(k.bedrag)}
                          </span>

                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin text-autronis-accent shrink-0" />
                          ) : (
                            <Link2 className="w-4 h-4 text-autronis-text-secondary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-autronis-border bg-autronis-bg/30">
                <p className="text-[11px] text-autronis-text-secondary">
                  Hoe hoger de score, hoe beter de match op naam + bedrag + datum. Klik op een
                  kandidaat om te koppelen.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
