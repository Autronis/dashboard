"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Euro,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  Download,
  Eye,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonFacturen } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Factuur {
  id: number;
  factuurnummer: string;
  klantId: number;
  klantNaam: string;
  status: string;
  bedragExclBtw: number;
  btwBedrag: number | null;
  bedragInclBtw: number | null;
  factuurdatum: string | null;
  vervaldatum: string | null;
  betaaldOp: string | null;
}

interface KPIs {
  openstaand: number;
  betaaldDezeMaand: number;
  teLaat: number;
  totaal: number;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  betaald: { bg: "bg-green-500/15", text: "text-green-400", label: "Betaald" },
  te_laat: { bg: "bg-red-500/15", text: "text-red-400", label: "Te laat" },
};

export default function FinancienPage() {
  const { addToast } = useToast();
  const [facturen, setFacturen] = useState<Factuur[]>([]);
  const [kpis, setKpis] = useState<KPIs>({ openstaand: 0, betaaldDezeMaand: 0, teLaat: 0, totaal: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActie, setBulkActie] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      if (zoek) params.set("zoek", zoek);

      const res = await fetch(`/api/facturen?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setFacturen(json.facturen);
      setKpis(json.kpis);
    } catch {
      addToast("Kon facturen niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, zoek, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, zoek]);

  // Mark overdue invoices visually
  const getEffectiveStatus = (f: Factuur): string => {
    if (f.status === "verzonden" && f.vervaldatum && f.vervaldatum < new Date().toISOString().slice(0, 10)) {
      return "te_laat";
    }
    return f.status;
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === facturen.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(facturen.map((f) => f.id)));
    }
  };

  const selectedFacturen = facturen.filter((f) => selectedIds.has(f.id));
  const allSelectedAreConcept = selectedFacturen.length > 0 && selectedFacturen.every((f) => f.status === "concept");
  const allSelectedAreVerzonden = selectedFacturen.length > 0 && selectedFacturen.every((f) => f.status === "verzonden");

  const handleBulkVerzonden = async () => {
    if (!allSelectedAreConcept) return;
    setBulkActie(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/facturen/${id}/verstuur`, { method: "POST" });
      }
      addToast(`${selectedIds.size} facturen gemarkeerd als verzonden`, "succes");
      setSelectedIds(new Set());
      await fetchData();
    } catch {
      addToast("Kon niet alle facturen bijwerken", "fout");
    } finally {
      setBulkActie(false);
    }
  };

  const handleBulkBetaald = async () => {
    if (!allSelectedAreVerzonden) return;
    setBulkActie(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/facturen/${id}/betaald`, { method: "PUT" });
      }
      addToast(`${selectedIds.size} facturen gemarkeerd als betaald`, "succes");
      setSelectedIds(new Set());
      await fetchData();
    } catch {
      addToast("Kon niet alle facturen bijwerken", "fout");
    } finally {
      setBulkActie(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!allSelectedAreConcept) return;
    setBulkActie(true);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/facturen/${id}`, { method: "DELETE" });
      }
      addToast(`${selectedIds.size} facturen verwijderd`, "succes");
      setSelectedIds(new Set());
      await fetchData();
    } catch {
      addToast("Kon niet alle facturen verwijderen", "fout");
    } finally {
      setBulkActie(false);
      setBulkDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <SkeletonFacturen />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Financiën</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              {kpis.totaal} facturen
            </p>
          </div>
          <Link
            href="/financien/nieuw"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-4 h-4" />
            Nieuwe factuur
          </Link>
        </div>

        {/* KPI balk */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="kpi-gradient-openstaand border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2.5 rounded-xl", kpis.openstaand > 0 ? "bg-red-500/10" : "bg-autronis-accent/10")}>
                <Euro className={cn("w-5 h-5", kpis.openstaand > 0 ? "text-red-400" : "text-autronis-accent")} />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.openstaand}
              format={formatBedrag}
              className={cn("text-3xl font-bold tabular-nums", kpis.openstaand > 0 ? "text-red-400" : "text-autronis-text-primary")}
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Openstaand</p>
          </div>

          <div className="kpi-gradient-betaald border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.betaaldDezeMaand}
              format={formatBedrag}
              className="text-3xl font-bold text-autronis-accent tabular-nums"
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Betaald deze maand</p>
          </div>

          <div className="kpi-gradient-deadlines border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn("p-2.5 rounded-xl", kpis.teLaat > 0 ? "bg-red-500/10" : "bg-autronis-accent/10")}>
                <AlertTriangle className={cn("w-5 h-5", kpis.teLaat > 0 ? "text-red-400" : "text-autronis-accent")} />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.teLaat}
              className={cn("text-3xl font-bold tabular-nums", kpis.teLaat > 0 ? "text-red-400" : "text-autronis-text-primary")}
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Te laat</p>
          </div>

          <div className="kpi-gradient-facturen border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <FileText className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.totaal}
              className="text-3xl font-bold text-autronis-text-primary tabular-nums"
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Totaal facturen</p>
          </div>
        </div>

        {/* Filters + tabel */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              {[
                { key: "alle", label: "Alle" },
                { key: "concept", label: "Concept" },
                { key: "verzonden", label: "Verzonden" },
                { key: "betaald", label: "Betaald" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    statusFilter === f.key
                      ? "bg-autronis-accent text-autronis-bg"
                      : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoeken op nummer of klant..."
              className="bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors sm:ml-auto sm:w-72"
            />
          </div>

          {/* Tabel */}
          {facturen.length === 0 ? (
            <EmptyState
              titel="Nog geen facturen"
              beschrijving="Maak je eerste factuur aan om te beginnen."
              actieLabel="Nieuwe factuur"
              actieHref="/financien/nieuw"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-autronis-border">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === facturen.length && facturen.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-autronis-border bg-autronis-bg text-autronis-accent focus:ring-autronis-accent/50 cursor-pointer accent-[#17B8A5]"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Nummer</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Klant</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Datum</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {facturen.map((factuur) => {
                    const effectiveStatus = getEffectiveStatus(factuur);
                    const sc = statusConfig[effectiveStatus] || statusConfig.concept;
                    return (
                      <tr
                        key={factuur.id}
                        className={cn(
                          "border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors",
                          selectedIds.has(factuur.id) && "bg-autronis-accent/5"
                        )}
                      >
                        <td className="py-4 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(factuur.id)}
                            onChange={() => toggleSelect(factuur.id)}
                            className="w-4 h-4 rounded border-autronis-border bg-autronis-bg text-autronis-accent focus:ring-autronis-accent/50 cursor-pointer accent-[#17B8A5]"
                          />
                        </td>
                        <td className="py-4 px-4">
                          <Link href={`/financien/${factuur.id}`} className="text-base font-medium text-autronis-accent hover:underline">
                            {factuur.factuurnummer}
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-base text-autronis-text-primary">{factuur.klantNaam}</td>
                        <td className="py-4 px-4 text-sm text-autronis-text-secondary">
                          {factuur.factuurdatum ? formatDatum(factuur.factuurdatum) : "\u2014"}
                        </td>
                        <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary text-right tabular-nums">
                          {formatBedrag(factuur.bedragInclBtw || 0)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/financien/${factuur.id}`}
                              className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <a
                              href={`/api/facturen/${factuur.id}/pdf`}
                              className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-autronis-card border border-autronis-border rounded-2xl shadow-2xl shadow-black/30 px-6 py-4 flex items-center gap-4 flex-wrap"
            >
              <span className="text-sm font-semibold text-autronis-text-primary whitespace-nowrap">
                {selectedIds.size} geselecteerd
              </span>

              <div className="h-6 w-px bg-autronis-border" />

              <button
                onClick={handleBulkVerzonden}
                disabled={!allSelectedAreConcept || bulkActie}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                Markeer als verzonden
              </button>

              <button
                onClick={handleBulkBetaald}
                disabled={!allSelectedAreVerzonden || bulkActie}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Markeer als betaald
              </button>

              <button
                onClick={() => setBulkDeleteDialogOpen(true)}
                disabled={!allSelectedAreConcept || bulkActie}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Verwijderen
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk delete confirm dialog */}
        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onClose={() => setBulkDeleteDialogOpen(false)}
          onBevestig={handleBulkDelete}
          titel="Facturen verwijderen?"
          bericht={`Weet je zeker dat je ${selectedIds.size} facturen wilt verwijderen?`}
          bevestigTekst="Verwijderen"
          variant="danger"
        />
      </div>
    </PageTransition>
  );
}
