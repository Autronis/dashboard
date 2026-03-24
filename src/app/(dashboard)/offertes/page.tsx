"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Euro,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Download,
  Eye,
  Trash2,
  Search,
  FileSignature,
  Copy,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useOffertes } from "@/hooks/queries/use-offertes";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractenTab } from "./contracten-tab";

// ─── Status config ───
const statusConfig: Record<string, { bg: string; text: string; label: string; border: string }> = {
  concept:     { bg: "bg-slate-500/15",  text: "text-slate-400",  label: "Concept",      border: "border-l-slate-500/60" },
  verzonden:   { bg: "bg-blue-500/15",   text: "text-blue-400",   label: "Verzonden",    border: "border-l-blue-500/70" },
  geaccepteerd:{ bg: "bg-green-500/15",  text: "text-green-400",  label: "Geaccepteerd", border: "border-l-green-500" },
  verlopen:    { bg: "bg-amber-500/15",  text: "text-amber-400",  label: "Verlopen",     border: "border-l-amber-500/70" },
  afgewezen:   { bg: "bg-red-500/15",    text: "text-red-400",    label: "Afgewezen",    border: "border-l-red-500/60" },
};

// ─── Donut chart voor win rate ───
function WinRateDonut({ percentage, geaccepteerd, afgewezen }: { percentage: number; geaccepteerd: number; afgewezen: number }) {
  const size = 48;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const total = geaccepteerd + afgewezen;
  const offset = total > 0 ? circumference - (percentage / 100) * circumference : circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A3538" strokeWidth="5" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#17B8A5" strokeWidth="5"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.4 }}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Confetti micro-burst voor geaccepteerd rows ───
function ConfettiBurst() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 180,
    y: (Math.random() - 0.5) * 50 - 15,
    color: ["#17B8A5", "#22c55e", "#4DC9B4", "#a3e635", "#34d399", "#86efac"][i % 6],
    size: Math.random() * 5 + 3,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.25,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size * 0.6, backgroundColor: p.color, left: "30%", top: "50%" }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2, rotate: p.rotation }}
          transition={{ duration: 1, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ─── Helpers ───
function dagenVerlopen(geldigTot: string): number {
  return Math.floor((Date.now() - new Date(geldigTot).getTime()) / 86400000);
}

function dagenSindsVerzonden(datum: string): number {
  return Math.floor((Date.now() - new Date(datum).getTime()) / 86400000);
}

// ─── Skeleton ───
function OffertesSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

type ActiveTab = "offertes" | "contracten";

export default function OffertesPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("offertes");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  const { data, isLoading: loading } = useOffertes(statusFilter, zoek);
  const offertes = data?.offertes ?? [];
  const kpis = data?.kpis ?? {
    openstaandCount: 0, openstaandWaarde: 0, geaccepteerdDezeMaand: 0,
    winRate: 0, winRateVorigeMaand: null, totaalGeaccepteerd: 0, totaalAfgewezen: 0,
    statusCounts: {},
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/offertes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Offerte verwijderd", "succes");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["offertes"] });
    },
    onError: () => addToast("Kon offerte niet verwijderen", "fout"),
  });

  async function handleDuplicate(id: number) {
    setDuplicatingId(id);
    try {
      const res = await fetch(`/api/offertes/${id}`);
      if (!res.ok) throw new Error();
      const { offerte, regels } = await res.json();

      const nieuwRes = await fetch("/api/offertes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId: offerte.klantId,
          projectId: offerte.projectId,
          titel: offerte.titel ? `Kopie — ${offerte.titel}` : null,
          datum: new Date().toISOString().slice(0, 10),
          geldigTot: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d.toISOString().slice(0, 10);
          })(),
          notities: offerte.notities,
          regels: regels.map((r: { omschrijving: string; aantal: number; eenheidsprijs: number; btwPercentage: number }) => ({
            omschrijving: r.omschrijving,
            aantal: r.aantal,
            eenheidsprijs: r.eenheidsprijs,
            btwPercentage: r.btwPercentage,
          })),
        }),
      });
      if (!nieuwRes.ok) throw new Error();
      const { offerte: nieuw } = await nieuwRes.json();
      addToast("Offerte gedupliceerd", "succes");
      queryClient.invalidateQueries({ queryKey: ["offertes"] });
      router.push(`/offertes/${nieuw.id}`);
    } catch {
      addToast("Kon offerte niet dupliceren", "fout");
    } finally {
      setDuplicatingId(null);
    }
  }

  const deleteOfferte = offertes.find((o) => o.id === deleteId);

  // Win rate trend
  const winRateDelta =
    kpis.winRateVorigeMaand !== null ? kpis.winRate - kpis.winRateVorigeMaand : null;

  const filterTabs = [
    { key: "alle",         label: "Alle",         count: Object.values(kpis.statusCounts).reduce((s, n) => s + n, 0) },
    { key: "concept",      label: "Concept",      count: kpis.statusCounts["concept"] ?? 0 },
    { key: "verzonden",    label: "Verzonden",     count: kpis.statusCounts["verzonden"] ?? 0 },
    { key: "geaccepteerd", label: "Geaccepteerd",  count: kpis.statusCounts["geaccepteerd"] ?? 0 },
    { key: "afgewezen",    label: "Afgewezen",     count: kpis.statusCounts["afgewezen"] ?? 0 },
  ];

  if (loading && activeTab === "offertes") return <OffertesSkeleton />;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-autronis-text-primary">Offertes & Contracten</h1>
          {activeTab === "offertes" && (
            <Link
              href="/offertes/nieuw"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
            >
              <Plus className="w-4 h-4" />
              Nieuwe offerte
            </Link>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 w-fit">
          {(["offertes", "contracten"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {tab === "offertes" ? <FileText className="w-4 h-4" /> : <FileSignature className="w-4 h-4" />}
              {tab === "offertes" ? "Offertes" : "Contracten"}
            </button>
          ))}
        </div>

        {/* Offertes tab */}
        {activeTab === "offertes" && (
          <>
            {/* KPI balk */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="p-2.5 bg-blue-500/10 rounded-xl w-fit mb-3">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <AnimatedNumber value={kpis.openstaandCount} className="text-3xl font-bold text-autronis-text-primary tabular-nums" />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Openstaand</p>
              </div>

              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="p-2.5 bg-autronis-accent/10 rounded-xl w-fit mb-3">
                  <Euro className="w-5 h-5 text-autronis-accent" />
                </div>
                <AnimatedNumber value={kpis.openstaandWaarde} format={formatBedrag} className="text-3xl font-bold text-autronis-accent tabular-nums" />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Waarde openstaand</p>
              </div>

              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="p-2.5 bg-green-500/10 rounded-xl w-fit mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <AnimatedNumber value={kpis.geaccepteerdDezeMaand} className="text-3xl font-bold text-green-400 tabular-nums" />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Geaccepteerd deze maand</p>
              </div>

              {/* Win rate met donut + trend */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-autronis-accent" />
                  </div>
                  <WinRateDonut
                    percentage={kpis.winRate}
                    geaccepteerd={kpis.totaalGeaccepteerd}
                    afgewezen={kpis.totaalAfgewezen}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <AnimatedNumber
                    value={kpis.winRate}
                    format={(n) => `${Math.round(n)}%`}
                    className="text-3xl font-bold text-autronis-text-primary tabular-nums"
                  />
                  {winRateDelta !== null && (
                    <span className={cn(
                      "flex items-center gap-0.5 text-xs font-semibold mb-1.5",
                      winRateDelta > 0 ? "text-green-400" : winRateDelta < 0 ? "text-red-400" : "text-autronis-text-secondary"
                    )}>
                      {winRateDelta > 0 ? <TrendingUp className="w-3 h-3" /> : winRateDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {winRateDelta > 0 ? "+" : ""}{winRateDelta}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-autronis-text-secondary mt-0.5 uppercase tracking-wide">
                  Win rate
                  {kpis.winRateVorigeMaand !== null && (
                    <span className="normal-case ml-1 text-xs opacity-60">vs {kpis.winRateVorigeMaand}% vorige maand</span>
                  )}
                </p>
              </div>
            </div>

            {/* Filter + tabel */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {filterTabs.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        statusFilter === f.key
                          ? "bg-autronis-accent text-autronis-bg"
                          : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                      )}
                    >
                      {f.label}
                      {f.count > 0 && (
                        <span className={cn(
                          "text-xs rounded-full px-1.5 py-0.5 tabular-nums font-semibold",
                          statusFilter === f.key
                            ? "bg-autronis-bg/20 text-autronis-bg"
                            : "bg-autronis-border text-autronis-text-secondary"
                        )}>
                          {f.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="relative sm:ml-auto sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
                  <input
                    type="text"
                    value={zoek}
                    onChange={(e) => setZoek(e.target.value)}
                    placeholder="Zoeken op nummer, klant of titel..."
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
                  />
                </div>
              </div>

              {/* Tabel */}
              {offertes.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  {statusFilter === "alle" && !zoek ? (
                    <>
                      <div className="w-14 h-14 bg-autronis-accent/10 rounded-2xl flex items-center justify-center mx-auto">
                        <FileText className="w-7 h-7 text-autronis-accent" />
                      </div>
                      <div>
                        <p className="text-autronis-text-primary font-semibold text-lg">Nog geen offertes</p>
                        <p className="text-autronis-text-secondary text-sm mt-1 max-w-xs mx-auto">
                          Je hebt actieve leads en Sales Engine scans — genereer een offerte op basis van een scan.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <Link
                          href="/offertes/nieuw"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Nieuwe offerte
                        </Link>
                        <Link
                          href="/sales-engine"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card border border-autronis-border hover:border-autronis-accent/50 text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors"
                        >
                          Bekijk Sales Engine scans →
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="text-autronis-text-secondary">Geen offertes gevonden voor dit filter.</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-autronis-border">
                        <th className="w-1 p-0" />
                        <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Nummer</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Klant</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide max-sm:hidden">Datum</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide max-sm:hidden">Geldig tot</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence mode="popLayout">
                        {offertes.map((offerte, index) => {
                          const sc = statusConfig[offerte.status] ?? statusConfig.concept;
                          const isGeaccepteerd = offerte.status === "geaccepteerd";
                          const isVerzonden = offerte.status === "verzonden";

                          // Verlopen check: verzonden/concept + geldigTot in verleden
                          const isOverdue = (isVerzonden || offerte.status === "concept")
                            && offerte.geldigTot
                            && dagenVerlopen(offerte.geldigTot) > 0;
                          const daysOverdue = isOverdue && offerte.geldigTot ? dagenVerlopen(offerte.geldigTot) : 0;

                          // Follow-up hint: verzonden 5+ days, no reminder yet
                          const needsFollowUp = isVerzonden
                            && offerte.datum
                            && dagenSindsVerzonden(offerte.datum) >= 5
                            && !offerte.herinneringVerstuurdOp;

                          return (
                            <motion.tr
                              key={offerte.id}
                              layout
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              transition={{ duration: 0.18, delay: index * 0.04 }}
                              className={cn(
                                "border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors relative",
                                isGeaccepteerd && "bg-green-500/[0.03]",
                                isOverdue && "bg-amber-500/[0.04]",
                              )}
                            >
                              {/* Colored left border strip */}
                              <td className={cn("w-1 p-0 border-l-4", sc.border)} />

                              <td className="py-4 px-4">
                                <Link href={`/offertes/${offerte.id}`} className="font-mono text-sm font-semibold text-autronis-accent hover:underline tracking-tight">
                                  {offerte.offertenummer}
                                </Link>
                                {offerte.titel && (
                                  <p className="text-xs text-autronis-text-secondary mt-0.5 truncate max-w-[180px]">{offerte.titel}</p>
                                )}
                                {needsFollowUp && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Bell className="w-3 h-3 text-amber-400" />
                                    <span className="text-xs text-amber-400">
                                      {offerte.datum ? dagenSindsVerzonden(offerte.datum) : 0}d geen reactie —{" "}
                                      <Link href={`/offertes/${offerte.id}`} className="underline underline-offset-2 hover:text-amber-300">
                                        Herinnering sturen
                                      </Link>
                                    </span>
                                  </div>
                                )}
                              </td>

                              <td className="py-4 px-4 text-sm text-autronis-text-primary">{offerte.klantNaam}</td>

                              <td className="py-4 px-4 text-sm text-autronis-text-secondary max-sm:hidden">
                                {offerte.datum ? formatDatumKort(offerte.datum) : "—"}
                              </td>

                              <td className="py-4 px-4 max-sm:hidden">
                                {isOverdue ? (
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span className="text-xs font-medium text-amber-400">{daysOverdue}d verlopen</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-autronis-text-secondary">
                                    {offerte.geldigTot ? formatDatumKort(offerte.geldigTot) : "—"}
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4 text-sm font-semibold text-autronis-text-primary text-right tabular-nums">
                                {formatBedrag(offerte.bedragInclBtw || 0)}
                              </td>

                              <td className="py-4 px-4 text-center relative overflow-hidden">
                                {isGeaccepteerd && <ConfettiBurst />}
                                <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>
                                  {sc.label}
                                </span>
                              </td>

                              <td className="py-4 px-4">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Link
                                    href={`/offertes/${offerte.id}`}
                                    className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                                    title="Bekijken"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Link>
                                  <a
                                    href={`/api/offertes/${offerte.id}/pdf`}
                                    className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                                    title="Download PDF"
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                  <button
                                    onClick={() => handleDuplicate(offerte.id)}
                                    disabled={duplicatingId === offerte.id}
                                    className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors disabled:opacity-40"
                                    title="Dupliceren"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteId(offerte.id)}
                                    className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                    title="Verwijderen"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <ConfirmDialog
              open={deleteId !== null}
              onClose={() => setDeleteId(null)}
              onBevestig={() => deleteId && deleteMutation.mutate(deleteId)}
              titel="Offerte verwijderen?"
              bericht={`Weet je zeker dat je offerte ${deleteOfferte?.offertenummer ?? ""} wilt verwijderen?`}
              bevestigTekst="Verwijderen"
              variant="danger"
            />
          </>
        )}

        {activeTab === "contracten" && <ContractenTab />}
      </div>
    </PageTransition>
  );
}
