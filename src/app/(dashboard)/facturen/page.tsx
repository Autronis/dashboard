"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Euro, CheckCircle2, AlertTriangle, FileText, Plus, Download, Eye, Send,
  X, Bell, RefreshCw, Clock, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonFacturen } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useFacturen,
  useOuderdomsanalyse,
  useVerstuurHerinneringen,
  useGenereerPeriodiek,
  useHerinneringenPreview,
  usePeriodiekePreview,
  type Factuur,
} from "@/hooks/queries/use-facturen";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  betaald: { bg: "bg-green-500/15", text: "text-green-400", label: "Betaald" },
  te_laat: { bg: "bg-red-500/15", text: "text-red-400", label: "Te laat" },
};

type SortCol = "factuurnummer" | "klantNaam" | "factuurdatum" | "bedragInclBtw" | "status";
type SortDir = "asc" | "desc";

export default function FacturenPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>("factuurdatum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [betaaldFlashId, setBetaaldFlashId] = useState<number | null>(null);
  const [herinneringPreviewOpen, setHerinneringPreviewOpen] = useState(false);
  const [periodiekPreviewOpen, setPeriodiekPreviewOpen] = useState(false);

  const { data: facturenData, isLoading: loading } = useFacturen(statusFilter, zoek);
  const facturen = facturenData?.facturen ?? [];
  const kpis = facturenData?.kpis ?? { openstaand: 0, betaaldDezeMaand: 0, teLaat: 0, totaal: 0 };

  const { data: ouderdomData } = useOuderdomsanalyse();
  const { data: herinneringPreview } = useHerinneringenPreview();
  const { data: periodiekPreview } = usePeriodiekePreview();
  const herinneringenMutation = useVerstuurHerinneringen();
  const periodiekMutation = useGenereerPeriodiek();

  const verwachtBinnen14Dagen = facturen
    .filter((f) => {
      if (f.status !== "verzonden" || !f.vervaldatum) return false;
      const days = Math.ceil((new Date(f.vervaldatum).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 14;
    })
    .reduce((sum, f) => sum + (f.bedragInclBtw || 0), 0);

  const invalidateFacturen = () => queryClient.invalidateQueries({ queryKey: ["facturen"] });

  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter, zoek]);

  const getEffectiveStatus = (f: Factuur): string => {
    if (f.status === "verzonden" && f.vervaldatum && f.vervaldatum < new Date().toISOString().slice(0, 10)) {
      return "te_laat";
    }
    return f.status;
  };

  const handleSortCol = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "factuurdatum" || col === "bedragInclBtw" ? "desc" : "asc");
    }
  };

  const sortedFacturen = [...facturen].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortCol === "bedragInclBtw") return mul * ((a.bedragInclBtw ?? 0) - (b.bedragInclBtw ?? 0));
    if (sortCol === "factuurdatum") return mul * ((a.factuurdatum ?? "").localeCompare(b.factuurdatum ?? ""));
    if (sortCol === "klantNaam") return mul * a.klantNaam.localeCompare(b.klantNaam, "nl");
    if (sortCol === "status") return mul * (getEffectiveStatus(a).localeCompare(getEffectiveStatus(b)));
    return mul * a.factuurnummer.localeCompare(b.factuurnummer);
  });

  const inlineVerzondenMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/facturen/${id}/verstuur`, { method: "POST" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { invalidateFacturen(); addToast("Factuur gemarkeerd als verzonden", "succes"); },
    onError: () => addToast("Kon factuur niet bijwerken", "fout"),
  });

  const inlineBetaaldMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/facturen/${id}/betaald`, { method: "PUT" });
      if (!res.ok) throw new Error();
    },
    onMutate: (id) => setBetaaldFlashId(id),
    onSuccess: () => { setTimeout(() => setBetaaldFlashId(null), 800); invalidateFacturen(); },
    onError: () => { setBetaaldFlashId(null); addToast("Kon factuur niet bijwerken", "fout"); },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === facturen.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(facturen.map((f) => f.id)));
  };

  const selectedFacturen = facturen.filter((f) => selectedIds.has(f.id));
  const allSelectedAreConcept = selectedFacturen.length > 0 && selectedFacturen.every((f) => f.status === "concept");
  const allSelectedAreVerzonden = selectedFacturen.length > 0 && selectedFacturen.every((f) => f.status === "verzonden");

  const bulkVerzondenMutation = useMutation({
    mutationFn: async (ids: Set<number>) => { for (const id of ids) await fetch(`/api/facturen/${id}/verstuur`, { method: "POST" }); },
    onSuccess: () => { addToast(`${selectedIds.size} facturen gemarkeerd als verzonden`, "succes"); setSelectedIds(new Set()); invalidateFacturen(); },
    onError: () => addToast("Kon niet alle facturen bijwerken", "fout"),
  });

  const bulkBetaaldMutation = useMutation({
    mutationFn: async (ids: Set<number>) => { for (const id of ids) await fetch(`/api/facturen/${id}/betaald`, { method: "PUT" }); },
    onSuccess: () => { addToast(`${selectedIds.size} facturen gemarkeerd als betaald`, "succes"); setSelectedIds(new Set()); invalidateFacturen(); },
    onError: () => addToast("Kon niet alle facturen bijwerken", "fout"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: Set<number>) => { for (const id of ids) await fetch(`/api/facturen/${id}`, { method: "DELETE" }); },
    onSuccess: () => { addToast(`${selectedIds.size} facturen verwijderd`, "succes"); setSelectedIds(new Set()); invalidateFacturen(); setBulkDeleteDialogOpen(false); },
    onError: () => { addToast("Kon niet alle facturen verwijderen", "fout"); setBulkDeleteDialogOpen(false); },
  });

  const bulkActie = bulkVerzondenMutation.isPending || bulkBetaaldMutation.isPending || bulkDeleteMutation.isPending;

  if (loading) {
    return <div className="max-w-7xl mx-auto p-4 lg:p-8"><SkeletonFacturen /></div>;
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <PageHeader
          title="Facturen"
          description="Overzicht van al je facturen"
          actions={
            <Link
              href="/financien/nieuw"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              Nieuwe factuur
            </Link>
          }
        />

        {/* KPI balk */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="kpi-gradient-openstaand border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Openstaand</p>
              <div className={cn("p-2 rounded-lg", kpis.openstaand > 0 ? "bg-red-500/10" : "bg-autronis-accent/10")}>
                <Euro className={cn("w-4 h-4", kpis.openstaand > 0 ? "text-red-400" : "text-autronis-accent")} />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.openstaand}
              format={formatBedrag}
              className={cn("text-3xl font-bold tabular-nums", kpis.openstaand > 0 ? "text-red-400" : "text-autronis-text-primary")}
            />
            {verwachtBinnen14Dagen > 0 ? (
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                {formatBedrag(verwachtBinnen14Dagen)} binnen 14 dagen
              </p>
            ) : (
              <p className="text-xs text-autronis-text-secondary/40 mt-2">Geen openstaande facturen</p>
            )}
          </div>

          <div className="kpi-gradient-betaald border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Betaald deze maand</p>
              <div className="p-2 bg-autronis-accent/10 rounded-lg"><CheckCircle2 className="w-4 h-4 text-autronis-accent" /></div>
            </div>
            <AnimatedNumber value={kpis.betaaldDezeMaand} format={formatBedrag} className="text-3xl font-bold text-autronis-accent tabular-nums" />
            <p className="text-xs text-autronis-text-secondary/40 mt-2">{kpis.betaaldDezeMaand > 0 ? "Ontvangen deze maand" : "Nog niets ontvangen"}</p>
          </div>

          <div className={cn("kpi-gradient-deadlines border rounded-2xl p-6 lg:p-7 card-glow transition-all", kpis.teLaat > 0 ? "border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.12)]" : "border-autronis-border")}>
            <div className="flex items-center justify-between mb-4">
              <p className={cn("text-xs font-semibold uppercase tracking-wider", kpis.teLaat > 0 ? "text-red-400/70" : "text-autronis-text-secondary")}>Te laat</p>
              <div className={cn("p-2 rounded-lg", kpis.teLaat > 0 ? "bg-red-500/10" : "bg-autronis-accent/10")}>
                <AlertTriangle className={cn("w-4 h-4", kpis.teLaat > 0 ? "text-red-400 animate-pulse" : "text-autronis-accent")} />
              </div>
            </div>
            <AnimatedNumber value={kpis.teLaat} className={cn("text-3xl font-bold tabular-nums", kpis.teLaat > 0 ? "text-red-400" : "text-autronis-text-primary")} />
            <p className={cn("text-xs mt-2", kpis.teLaat > 0 ? "text-red-400/60" : "text-autronis-text-secondary/40")}>
              {kpis.teLaat > 0 ? `${kpis.teLaat} factuur${kpis.teLaat > 1 ? "en" : ""} verlopen` : "Alles op tijd"}
            </p>
          </div>

          <div className="kpi-gradient-facturen border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider">Totaal facturen</p>
              <div className="p-2 bg-autronis-accent/10 rounded-lg"><FileText className="w-4 h-4 text-autronis-accent" /></div>
            </div>
            <AnimatedNumber value={kpis.totaal} className="text-3xl font-bold text-autronis-text-primary tabular-nums" />
            <p className="text-xs text-autronis-text-secondary/40 mt-2">Alle facturen</p>
          </div>
        </div>

        {/* Quick actions + Ouderdomsanalyse */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setHerinneringPreviewOpen(true)}
              className="group flex flex-col gap-2 px-5 py-4 bg-autronis-card border border-autronis-border rounded-xl hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-orange-500/10 rounded-lg"><Bell className="w-3.5 h-3.5 text-orange-400" /></div>
                  <span className="text-sm font-semibold text-autronis-text-primary">Herinneringen</span>
                </div>
                <ChevronRight className="w-4 h-4 text-autronis-text-secondary/40 group-hover:text-orange-400 transition-colors" />
              </div>
              <p className="text-xs text-autronis-text-secondary pl-8">
                {(herinneringPreview?.aantal ?? 0) > 0
                  ? <span className="text-orange-400 font-medium">{herinneringPreview?.aantal} te late facturen</span>
                  : "Geen openstaande herinneringen"}
              </p>
            </button>
            <button
              onClick={() => setPeriodiekPreviewOpen(true)}
              className="group flex flex-col gap-2 px-5 py-4 bg-autronis-card border border-autronis-border rounded-xl hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-500/10 rounded-lg"><RefreshCw className="w-3.5 h-3.5 text-blue-400" /></div>
                  <span className="text-sm font-semibold text-autronis-text-primary">Periodiek</span>
                </div>
                <ChevronRight className="w-4 h-4 text-autronis-text-secondary/40 group-hover:text-blue-400 transition-colors" />
              </div>
              <p className="text-xs text-autronis-text-secondary pl-8">
                {(periodiekPreview?.aantal ?? 0) > 0
                  ? <span className="text-blue-400 font-medium">{periodiekPreview?.aantal} klaar om te genereren</span>
                  : "Geen facturen klaar"}
              </p>
            </button>
          </div>

          <div className="lg:col-span-2 bg-autronis-card border border-autronis-border rounded-2xl p-6 card-glow">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-autronis-accent" />
              <h3 className="text-sm font-semibold text-autronis-text-primary uppercase tracking-wide">Ouderdomsanalyse</h3>
            </div>
            {ouderdomData ? (
              <div className="space-y-3">
                {(["0-30", "31-60", "61-90", "90+"] as const).map((bucket, i) => {
                  const data = ouderdomData.ouderdom[bucket];
                  const totaal = ouderdomData.ouderdom.totaal.bedrag;
                  const pct = totaal > 0 ? (data.bedrag / totaal) * 100 : 0;
                  const kleuren: Record<string, string> = { "0-30": "bg-green-500", "31-60": "bg-yellow-500", "61-90": "bg-orange-500", "90+": "bg-red-500" };
                  return (
                    <motion.div key={bucket} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07, duration: 0.35 }} className="flex items-center gap-3">
                      <span className="text-xs text-autronis-text-secondary w-12 text-right tabular-nums">{bucket}d</span>
                      <div className="flex-1 h-5 bg-autronis-bg rounded-full overflow-hidden">
                        <motion.div className={cn("h-full rounded-full", kleuren[bucket])} initial={{ width: 0 }} animate={{ width: `${Math.max(pct, data.aantal > 0 ? 2 : 0)}%` }} transition={{ delay: i * 0.07 + 0.1, duration: 0.6, ease: "easeOut" as const }} />
                      </div>
                      <span className="text-xs text-autronis-text-secondary w-8 tabular-nums">{data.aantal}</span>
                      <span className="text-xs font-medium text-autronis-text-primary w-20 text-right tabular-nums">{formatBedrag(data.bedrag)}</span>
                    </motion.div>
                  );
                })}
                <div className="flex items-center gap-3 pt-2 border-t border-autronis-border">
                  <span className="text-xs font-semibold text-autronis-text-primary w-12 text-right">Totaal</span>
                  <div className="flex-1" />
                  <span className="text-xs font-semibold text-autronis-text-primary w-8 tabular-nums">{ouderdomData.ouderdom.totaal.aantal}</span>
                  <span className="text-xs font-bold text-autronis-accent w-20 text-right tabular-nums">{formatBedrag(ouderdomData.ouderdom.totaal.bedrag)}</span>
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

          {facturen.length === 0 ? (
            <EmptyState titel="Nog geen facturen" beschrijving="Maak je eerste factuur aan om te beginnen." actieLabel="Nieuwe factuur" actieHref="/financien/nieuw" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-autronis-border">
                    <th className="py-3 px-4 w-10">
                      <input type="checkbox" checked={selectedIds.size === facturen.length && facturen.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-autronis-border bg-autronis-bg text-autronis-accent focus:ring-autronis-accent/50 cursor-pointer accent-[#17B8A5]" />
                    </th>
                    {([
                      { col: "factuurnummer" as SortCol, label: "Nummer", align: "left" },
                      { col: "klantNaam" as SortCol, label: "Klant", align: "left" },
                      { col: "factuurdatum" as SortCol, label: "Datum", align: "left" },
                      { col: "bedragInclBtw" as SortCol, label: "Bedrag", align: "right" },
                      { col: "status" as SortCol, label: "Status", align: "center" },
                    ] as const).map(({ col, label, align }) => (
                      <th key={col} onClick={() => handleSortCol(col)} className={cn("py-3 px-4 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none hover:text-autronis-text-primary transition-colors", sortCol === col ? "text-autronis-accent" : "text-autronis-text-secondary", align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left")}>
                        <span className="inline-flex items-center gap-1">{label}{sortCol === col && <span className="text-[10px]">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>}</span>
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFacturen.map((factuur, rowIdx) => {
                    const effectiveStatus = getEffectiveStatus(factuur);
                    const sc = statusConfig[effectiveStatus] || statusConfig.concept;
                    const isVerzonden = factuur.status === "verzonden";
                    const isFlashing = betaaldFlashId === factuur.id;
                    const borderColors: Record<string, string> = { concept: "border-l-slate-500/50", verzonden: "border-l-blue-500/60", betaald: "border-l-green-500/60", te_laat: "border-l-red-500/70" };
                    return (
                      <motion.tr key={factuur.id} initial={{ opacity: 0, y: 6 }} animate={isFlashing ? { opacity: 1, y: 0, backgroundColor: "rgba(34,197,94,0.12)" } : { opacity: 1, y: 0, backgroundColor: "transparent" }} transition={{ duration: 0.18, delay: rowIdx * 0.03 }} className={cn("border-b border-autronis-border/50 border-l-2 hover:bg-autronis-bg/30 transition-colors group", borderColors[effectiveStatus] ?? "border-l-slate-500/50", selectedIds.has(factuur.id) && "bg-autronis-accent/5")}>
                        <td className="py-4 px-4"><input type="checkbox" checked={selectedIds.has(factuur.id)} onChange={() => toggleSelect(factuur.id)} className="w-4 h-4 rounded border-autronis-border bg-autronis-bg text-autronis-accent focus:ring-autronis-accent/50 cursor-pointer accent-[#17B8A5]" /></td>
                        <td className="py-4 px-4"><Link href={`/financien/${factuur.id}`} className="font-mono text-sm font-medium text-autronis-accent hover:underline">{factuur.factuurnummer}</Link></td>
                        <td className="py-4 px-4 text-base text-autronis-text-primary">{factuur.klantNaam}</td>
                        <td className="py-4 px-4 text-sm text-autronis-text-secondary">{factuur.factuurdatum ? formatDatum(factuur.factuurdatum) : "\u2014"}</td>
                        <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary text-right tabular-nums">{formatBedrag(factuur.bedragInclBtw || 0)}</td>
                        <td className="py-4 px-4 text-center"><span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text, effectiveStatus === "te_laat" && "animate-pulse")}>{sc.label}</span></td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {factuur.status === "concept" && (
                              <button onClick={() => inlineVerzondenMutation.mutate(factuur.id)} disabled={inlineVerzondenMutation.isPending} className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-semibold transition-all"><Send className="w-3.5 h-3.5" />Verstuur</button>
                            )}
                            {(isVerzonden || effectiveStatus === "te_laat") && (
                              <button onClick={() => inlineBetaaldMutation.mutate(factuur.id)} disabled={inlineBetaaldMutation.isPending} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all", effectiveStatus === "te_laat" ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "opacity-0 group-hover:opacity-100 bg-green-500/15 hover:bg-green-500/25 text-green-400")}><CheckCircle2 className="w-3.5 h-3.5" />Betaald</button>
                            )}
                            <Link href={`/financien/${factuur.id}`} className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"><Eye className="w-4 h-4" /></Link>
                            <a href={`/api/facturen/${factuur.id}/pdf`} className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"><Download className="w-4 h-4" /></a>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 bg-autronis-card border border-autronis-border rounded-2xl shadow-2xl">
              <span className="text-sm text-autronis-text-secondary">{selectedIds.size} geselecteerd</span>
              {allSelectedAreConcept && <button onClick={() => bulkVerzondenMutation.mutate(selectedIds)} disabled={bulkActie} className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-semibold transition-colors">Versturen</button>}
              {allSelectedAreVerzonden && <button onClick={() => bulkBetaaldMutation.mutate(selectedIds)} disabled={bulkActie} className="px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded-lg text-xs font-semibold transition-colors">Betaald</button>}
              {allSelectedAreConcept && <button onClick={() => setBulkDeleteDialogOpen(true)} disabled={bulkActie} className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-xs font-semibold transition-colors">Verwijderen</button>}
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmDialog
          open={bulkDeleteDialogOpen}
          onClose={() => setBulkDeleteDialogOpen(false)}
          onBevestig={() => bulkDeleteMutation.mutate(selectedIds)}
          titel="Facturen verwijderen"
          bericht={`Weet je zeker dat je ${selectedIds.size} factuur${selectedIds.size > 1 ? "en" : ""} wilt verwijderen?`}
          bevestigTekst="Verwijderen"
          variant="danger"
        />
      </div>
    </PageTransition>
  );
}
