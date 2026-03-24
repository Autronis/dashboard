"use client";

import { useEffect, useState } from "react";
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
  Receipt,
  Landmark,
  TrendingUp,
  Bell,
  RefreshCw,
  Clock,
  CreditCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { SkeletonFacturen } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UitgavenTab } from "./uitgaven-tab";
import { BankImportTab } from "./bank-import-tab";
import { LiquiditeitTab } from "./liquiditeit-tab";
import { AbonnementenTab } from "./abonnementen-tab";
import {
  useFacturen,
  useOuderdomsanalyse,
  useVerstuurHerinneringen,
  useGenereerPeriodiek,
  type Factuur,
} from "@/hooks/queries/use-facturen";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  betaald: { bg: "bg-green-500/15", text: "text-green-400", label: "Betaald" },
  te_laat: { bg: "bg-red-500/15", text: "text-red-400", label: "Te laat" },
};

type Tab = "facturen" | "uitgaven" | "abonnementen" | "bank" | "liquiditeit";

const TABS: { key: Tab; label: string; icon: typeof Euro }[] = [
  { key: "facturen", label: "Facturen", icon: FileText },
  { key: "uitgaven", label: "Uitgaven", icon: Receipt },
  { key: "abonnementen", label: "Abonnementen", icon: CreditCard },
  { key: "bank", label: "Bank Import", icon: Landmark },
  { key: "liquiditeit", label: "Liquiditeit", icon: TrendingUp },
];

export default function FinancienPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("facturen");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const { data: facturenData, isLoading: loading } = useFacturen(statusFilter, zoek);
  const facturen = facturenData?.facturen ?? [];
  const kpis = facturenData?.kpis ?? { openstaand: 0, betaaldDezeMaand: 0, teLaat: 0, totaal: 0 };

  const { data: ouderdomData } = useOuderdomsanalyse();
  const herinneringenMutation = useVerstuurHerinneringen();
  const periodiekMutation = useGenereerPeriodiek();

  const invalidateFacturen = () => queryClient.invalidateQueries({ queryKey: ["facturen"] });

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

  const bulkVerzondenMutation = useMutation({
    mutationFn: async (ids: Set<number>) => {
      for (const id of ids) {
        await fetch(`/api/facturen/${id}/verstuur`, { method: "POST" });
      }
    },
    onSuccess: () => {
      addToast(`${selectedIds.size} facturen gemarkeerd als verzonden`, "succes");
      setSelectedIds(new Set());
      invalidateFacturen();
    },
    onError: () => {
      addToast("Kon niet alle facturen bijwerken", "fout");
    },
  });

  const bulkBetaaldMutation = useMutation({
    mutationFn: async (ids: Set<number>) => {
      for (const id of ids) {
        await fetch(`/api/facturen/${id}/betaald`, { method: "PUT" });
      }
    },
    onSuccess: () => {
      addToast(`${selectedIds.size} facturen gemarkeerd als betaald`, "succes");
      setSelectedIds(new Set());
      invalidateFacturen();
    },
    onError: () => {
      addToast("Kon niet alle facturen bijwerken", "fout");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: Set<number>) => {
      for (const id of ids) {
        await fetch(`/api/facturen/${id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => {
      addToast(`${selectedIds.size} facturen verwijderd`, "succes");
      setSelectedIds(new Set());
      invalidateFacturen();
      setBulkDeleteDialogOpen(false);
    },
    onError: () => {
      addToast("Kon niet alle facturen verwijderen", "fout");
      setBulkDeleteDialogOpen(false);
    },
  });

  const bulkActie = bulkVerzondenMutation.isPending || bulkBetaaldMutation.isPending || bulkDeleteMutation.isPending;

  const handleBulkVerzonden = () => {
    if (!allSelectedAreConcept) return;
    bulkVerzondenMutation.mutate(selectedIds);
  };

  const handleBulkBetaald = () => {
    if (!allSelectedAreVerzonden) return;
    bulkBetaaldMutation.mutate(selectedIds);
  };

  const handleBulkDelete = () => {
    if (!allSelectedAreConcept) return;
    bulkDeleteMutation.mutate(selectedIds);
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
              Facturen, uitgaven, bankimport en liquiditeit
            </p>
          </div>
          {activeTab === "facturen" && (
            <Link
              href="/financien/nieuw"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              Nieuwe factuur
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center",
                  activeTab === tab.key
                    ? "bg-autronis-accent text-autronis-bg shadow-lg shadow-autronis-accent/20"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "facturen" && (
          <>
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

            {/* Quick actions + Ouderdomsanalyse */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Quick actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    herinneringenMutation.mutate(undefined, {
                      onSuccess: (data) => {
                        addToast(
                          data.bijgewerkt > 0
                            ? `${data.bijgewerkt} herinnering(en) verstuurd`
                            : "Geen te late facturen gevonden",
                          data.bijgewerkt > 0 ? "succes" : "fout"
                        );
                      },
                      onError: (err) => {
                        addToast(err.message, "fout");
                      },
                    });
                  }}
                  disabled={herinneringenMutation.isPending}
                  className="inline-flex items-center gap-3 px-5 py-3.5 bg-autronis-card border border-autronis-border rounded-xl text-sm font-semibold text-autronis-text-primary hover:border-autronis-accent/50 hover:bg-autronis-accent/5 transition-colors disabled:opacity-50"
                >
                  <Bell className="w-4 h-4 text-orange-400" />
                  {herinneringenMutation.isPending ? "Bezig..." : "Herinneringen versturen"}
                </button>
                <button
                  onClick={() => {
                    periodiekMutation.mutate(undefined, {
                      onSuccess: (data) => {
                        addToast(
                          data.aangemaakt > 0
                            ? `${data.aangemaakt} periodieke factuur/facturen aangemaakt`
                            : "Geen periodieke facturen te genereren",
                          data.aangemaakt > 0 ? "succes" : "fout"
                        );
                      },
                      onError: (err) => {
                        addToast(err.message, "fout");
                      },
                    });
                  }}
                  disabled={periodiekMutation.isPending}
                  className="inline-flex items-center gap-3 px-5 py-3.5 bg-autronis-card border border-autronis-border rounded-xl text-sm font-semibold text-autronis-text-primary hover:border-autronis-accent/50 hover:bg-autronis-accent/5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  {periodiekMutation.isPending ? "Bezig..." : "Periodieke facturen genereren"}
                </button>
              </div>

              {/* Ouderdomsanalyse */}
              <div className="lg:col-span-2 bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-autronis-accent" />
                  <h3 className="text-sm font-semibold text-autronis-text-primary uppercase tracking-wide">
                    Ouderdomsanalyse
                  </h3>
                </div>
                {ouderdomData ? (
                  <div className="space-y-3">
                    {(["0-30", "31-60", "61-90", "90+"] as const).map((bucket) => {
                      const data = ouderdomData.ouderdom[bucket];
                      const totaal = ouderdomData.ouderdom.totaal.bedrag;
                      const pct = totaal > 0 ? (data.bedrag / totaal) * 100 : 0;
                      const kleuren: Record<string, string> = {
                        "0-30": "bg-green-500",
                        "31-60": "bg-yellow-500",
                        "61-90": "bg-orange-500",
                        "90+": "bg-red-500",
                      };
                      return (
                        <div key={bucket} className="flex items-center gap-3">
                          <span className="text-xs text-autronis-text-secondary w-12 text-right tabular-nums">
                            {bucket}d
                          </span>
                          <div className="flex-1 h-5 bg-autronis-bg rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", kleuren[bucket])}
                              style={{ width: `${Math.max(pct, data.aantal > 0 ? 2 : 0)}%` }}
                            />
                          </div>
                          <span className="text-xs text-autronis-text-secondary w-8 tabular-nums">
                            {data.aantal}
                          </span>
                          <span className="text-xs font-medium text-autronis-text-primary w-20 text-right tabular-nums">
                            {formatBedrag(data.bedrag)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-3 pt-2 border-t border-autronis-border">
                      <span className="text-xs font-semibold text-autronis-text-primary w-12 text-right">
                        Totaal
                      </span>
                      <div className="flex-1" />
                      <span className="text-xs font-semibold text-autronis-text-primary w-8 tabular-nums">
                        {ouderdomData.ouderdom.totaal.aantal}
                      </span>
                      <span className="text-xs font-bold text-autronis-accent w-20 text-right tabular-nums">
                        {formatBedrag(ouderdomData.ouderdom.totaal.bedrag)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24">
                    <div className="w-5 h-5 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
                  </div>
                )}
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
          </>
        )}

        {activeTab === "uitgaven" && <UitgavenTab />}
        {activeTab === "abonnementen" && <AbonnementenTab />}
        {activeTab === "bank" && <BankImportTab />}
        {activeTab === "liquiditeit" && <LiquiditeitTab />}
      </div>
    </PageTransition>
  );
}
