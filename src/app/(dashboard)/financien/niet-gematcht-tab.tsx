"use client";

import { useEffect, useState, useCallback } from "react";
import { Link2, Check, AlertCircle, ArrowRight, Loader2, Inbox } from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface Transactie {
  id: number;
  datum: string;
  omschrijving: string;
  bedrag: number;
  bank: string | null;
  revolutTransactieId: string | null;
  status: string;
}

interface OpenFactuur {
  id: number;
  factuurnummer: string;
  bedragInclBtw: number | null;
  bedragExclBtw: number;
  klantNaam: string;
  factuurdatum: string | null;
  vervaldatum: string | null;
}

export function NietGematchtTab() {
  const { addToast } = useToast();
  const [transacties, setTransacties] = useState<Transactie[]>([]);
  const [openFacturen, setOpenFacturen] = useState<OpenFactuur[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const [selectedFactuur, setSelectedFactuur] = useState<Record<number, number>>({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/financien/niet-gematcht");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTransacties(json.transacties);
      setOpenFacturen(json.openFacturen);
    } catch {
      addToast("Kon niet-gematchte betalingen niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMatch = async (transactieId: number) => {
    const factuurId = selectedFactuur[transactieId];
    if (!factuurId) {
      addToast("Selecteer eerst een factuur", "fout");
      return;
    }

    setMatchingId(transactieId);
    try {
      const res = await fetch("/api/financien/niet-gematcht", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactieId, factuurId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.fout || "Koppelen mislukt");

      addToast("Betaling gekoppeld aan factuur", "succes");
      await fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon niet koppelen", "fout");
    } finally {
      setMatchingId(null);
    }
  };

  // Find suggested match (same amount)
  const getSuggestie = (transactie: Transactie): OpenFactuur | null => {
    return openFacturen.find((f) => {
      const bedragIncl = f.bedragInclBtw ?? 0;
      const bedragExcl = f.bedragExclBtw ?? 0;
      return Math.abs(bedragIncl - transactie.bedrag) < 0.02
        || Math.abs(bedragExcl - transactie.bedrag) < 0.02;
    }) ?? null;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (transacties.length === 0) {
    return (
      <EmptyState
        icoon={<Check className="w-6 h-6" />}
        titel="Alles gematcht"
        beschrijving="Er zijn geen inkomende betalingen die nog aan een factuur gekoppeld moeten worden."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-autronis-text-primary">
              Niet-gematchte betalingen
            </h2>
            <p className="text-sm text-autronis-text-secondary">
              {transacties.length} betaling{transacties.length !== 1 ? "en" : ""} wacht{transacties.length === 1 ? "" : "en"} op koppeling
            </p>
          </div>
        </div>
        {openFacturen.length > 0 && (
          <span className="text-xs text-autronis-text-tertiary">
            {openFacturen.length} open factuur{openFacturen.length !== 1 ? "en" : ""}
          </span>
        )}
      </div>

      {/* Transacties lijst */}
      <div className="space-y-3">
        {transacties.map((tx) => {
          const suggestie = getSuggestie(tx);
          const isMatching = matchingId === tx.id;

          return (
            <div
              key={tx.id}
              className="rounded-xl border border-autronis-border bg-autronis-card p-5 space-y-4"
            >
              {/* Transactie info */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-400">
                      + {formatBedrag(tx.bedrag)}
                    </span>
                    {tx.bank && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-autronis-bg text-autronis-text-tertiary font-medium uppercase">
                        {tx.bank}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-autronis-text-secondary mt-1 truncate">
                    {tx.omschrijving}
                  </p>
                  <p className="text-xs text-autronis-text-tertiary mt-0.5">
                    {formatDatumKort(tx.datum)}
                  </p>
                </div>

                {suggestie && !selectedFactuur[tx.id] && (
                  <button
                    onClick={() => setSelectedFactuur((prev) => ({ ...prev, [tx.id]: suggestie.id }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors shrink-0"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Suggestie: {suggestie.factuurnummer}
                  </button>
                )}
              </div>

              {/* Match controls */}
              <div className="flex items-center gap-3">
                <ArrowRight className="w-4 h-4 text-autronis-text-tertiary shrink-0" />
                <select
                  value={selectedFactuur[tx.id] || ""}
                  onChange={(e) => setSelectedFactuur((prev) => ({
                    ...prev,
                    [tx.id]: Number(e.target.value),
                  }))}
                  className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent"
                >
                  <option value="">Selecteer factuur...</option>
                  {openFacturen.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.factuurnummer} — {f.klantNaam} — {formatBedrag(f.bedragInclBtw ?? f.bedragExclBtw)}
                      {f.bedragInclBtw && Math.abs(f.bedragInclBtw - tx.bedrag) < 0.02 ? " ✓" : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleMatch(tx.id)}
                  disabled={!selectedFactuur[tx.id] || isMatching}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0",
                    selectedFactuur[tx.id]
                      ? "bg-autronis-accent text-autronis-bg hover:bg-autronis-accent-hover"
                      : "bg-autronis-border text-autronis-text-tertiary cursor-not-allowed"
                  )}
                >
                  {isMatching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Koppel
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
