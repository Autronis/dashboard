"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  Send,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useOffertes, type Offerte } from "@/hooks/queries/use-offertes";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractenTab } from "./contracten-tab";

// ─── Status config ───
const statusConfig: Record<string, { bg: string; text: string; label: string; border: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept", border: "border-l-slate-500/60" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden", border: "border-l-blue-500/70" },
  geaccepteerd: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Geaccepteerd", border: "border-l-green-500" },
  verlopen: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Verlopen", border: "border-l-amber-500/70" },
  afgewezen: { bg: "bg-red-500/15", text: "text-red-400", label: "Afgewezen", border: "border-l-red-500/60" },
};

// ─── Pipeline colors ───
const pipelineColors: Record<string, string> = {
  concept: "bg-slate-500",
  verzonden: "bg-blue-500",
  geaccepteerd: "bg-emerald-500",
  verlopen: "bg-amber-500",
  afgewezen: "bg-red-500",
};

// ─── Sort types ───
type SortKolom = "offertenummer" | "klantNaam" | "datum" | "geldigTot" | "bedragInclBtw" | "status" | "bijgewerktOp";
type SortRichting = "asc" | "desc";

// ─── Donut chart ───
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

// ─── Confetti ───
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

// ─── Sort Header ───
function SortHeader({
  label,
  kolom,
  activeKolom,
  richting,
  onSort,
  className,
}: {
  label: string;
  kolom: SortKolom;
  activeKolom: SortKolom;
  richting: SortRichting;
  onSort: (k: SortKolom) => void;
  className?: string;
}) {
  const isActive = activeKolom === kolom;
  return (
    <th className={cn("py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide", className)}>
      <button
        onClick={() => onSort(kolom)}
        className="inline-flex items-center gap-1 hover:text-autronis-text-primary transition-colors"
      >
        {label}
        {isActive ? (
          richting === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

// ─── Pipeline Funnel ───
function PipelineFunnel({
  counts,
  activeFilter,
  onFilter,
}: {
  counts: Record<string, number>;
  activeFilter: string;
  onFilter: (key: string) => void;
}) {
  const fases = ["concept", "verzonden", "geaccepteerd", "afgewezen"];
  const totaal = fases.reduce((s, f) => s + (counts[f] ?? 0), 0);
  if (totaal === 0) return null;

  return (
    <div className="flex items-center gap-1 h-8 rounded-xl overflow-hidden bg-autronis-border/30">
      {fases.map((fase) => {
        const count = counts[fase] ?? 0;
        if (count === 0) return null;
        const pct = Math.max((count / totaal) * 100, 8);
        const sc = statusConfig[fase];
        const isActive = activeFilter === fase;
        return (
          <motion.button
            key={fase}
            onClick={() => onFilter(activeFilter === fase ? "alle" : fase)}
            className={cn(
              "h-full flex items-center justify-center gap-1 text-xs font-semibold transition-all relative",
              pipelineColors[fase],
              isActive ? "opacity-100 ring-2 ring-white/20" : "opacity-70 hover:opacity-90"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            title={`${sc.label}: ${count}`}
          >
            <span className="text-white/90 truncate px-2">{count}</span>
          </motion.button>
        );
      })}
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
    <div className="max-w-7xl mx-auto p-4 lg:p-8 pb-32 space-y-8">
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
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get("tab") === "contracten" ? "contracten" : "offertes") as ActiveTab;
  const statusFilter = searchParams.get("status") ?? "alle";
  const [zoekLokaal, setZoekLokaal] = useState(searchParams.get("q") ?? "");
  const zoek = zoekLokaal;

  const updateParams = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "alle" || (k === "tab" && v === "offertes")) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `/offertes?${qs}` : "/offertes", { scroll: false });
  }, [router, searchParams]);

  const setActiveTab = (tab: ActiveTab) => updateParams({ tab });
  const setStatusFilter = (status: string) => updateParams({ status });
  const setZoek = (q: string) => {
    setZoekLokaal(q);
    updateParams({ q });
  };
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [sortKolom, setSortKolom] = useState<SortKolom>("datum");
  const [sortRichting, setSortRichting] = useState<SortRichting>("desc");

  const { data, isLoading: loading } = useOffertes(statusFilter, zoek);
  const offertes = data?.offertes ?? [];
  const kpis = data?.kpis ?? {
    openstaandCount: 0, openstaandWaarde: 0, geaccepteerdDezeMaand: 0,
    winRate: 0, winRateVorigeMaand: null, totaalGeaccepteerd: 0, totaalAfgewezen: 0,
    statusCounts: {},
  };

  const heeftData = Object.values(kpis.statusCounts).reduce((s, n) => s + n, 0) > 0;

  // Sorted offertes
  const sortedOffertes = useMemo(() => {
    const copy = [...offertes];
    copy.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKolom) {
        case "offertenummer": aVal = a.offertenummer; bVal = b.offertenummer; break;
        case "klantNaam": aVal = a.klantNaam; bVal = b.klantNaam; break;
        case "datum": aVal = a.datum ?? ""; bVal = b.datum ?? ""; break;
        case "geldigTot": aVal = a.geldigTot ?? ""; bVal = b.geldigTot ?? ""; break;
        case "bedragInclBtw": aVal = a.bedragInclBtw ?? 0; bVal = b.bedragInclBtw ?? 0; break;
        case "status": aVal = a.status; bVal = b.status; break;
        case "bijgewerktOp": aVal = a.bijgewerktOp ?? ""; bVal = b.bijgewerktOp ?? ""; break;
      }
      if (aVal < bVal) return sortRichting === "asc" ? -1 : 1;
      if (aVal > bVal) return sortRichting === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [offertes, sortKolom, sortRichting]);

  // Follow-up alerts
  const followUpOffertes = useMemo(
    () =>
      offertes.filter(
        (o) =>
          o.status === "verzonden" &&
          o.datum &&
          dagenSindsVerzonden(o.datum) >= 5 &&
          !o.herinneringVerstuurdOp
      ),
    [offertes]
  );

  function handleSort(kolom: SortKolom) {
    if (sortKolom === kolom) {
      setSortRichting((r) => (r === "asc" ? "desc" : "asc"));
    } else {
      setSortKolom(kolom);
      setSortRichting("desc");
    }
  }

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

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/offertes/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offertes"] });
    },
    onError: () => addToast("Kon status niet wijzigen", "fout"),
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
          titel: offerte.titel ? `Kopie - ${offerte.titel}` : null,
          datum: new Date().toISOString().slice(0, 10),
          geldigTot: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })(),
          notities: offerte.notities,
          regels: regels.map((r: { omschrijving: string; aantal: number; eenheidsprijs: number; btwPercentage: number }) => ({
            omschrijving: r.omschrijving, aantal: r.aantal, eenheidsprijs: r.eenheidsprijs, btwPercentage: r.btwPercentage,
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

  function handleQuickStatus(offerte: Offerte, nieuweStatus: string) {
    statusMutation.mutate({ id: offerte.id, status: nieuweStatus }, {
      onSuccess: () => {
        const label = statusConfig[nieuweStatus]?.label ?? nieuweStatus;
        addToast(`Offerte ${offerte.offertenummer} → ${label}`, "succes");
      },
    });
  }

  const deleteOfferte = offertes.find((o) => o.id === deleteId);
  const winRateDelta = kpis.winRateVorigeMaand !== null ? kpis.winRate - kpis.winRateVorigeMaand : null;

  const filterTabs = [
    { key: "alle", label: "Alle", count: Object.values(kpis.statusCounts).reduce((s, n) => s + n, 0) },
    { key: "concept", label: "Concept", count: kpis.statusCounts["concept"] ?? 0 },
    { key: "verzonden", label: "Verzonden", count: kpis.statusCounts["verzonden"] ?? 0 },
    { key: "geaccepteerd", label: "Geaccepteerd", count: kpis.statusCounts["geaccepteerd"] ?? 0 },
    { key: "afgewezen", label: "Afgewezen", count: kpis.statusCounts["afgewezen"] ?? 0 },
  ];

  if (loading && activeTab === "offertes") return <OffertesSkeleton />;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 pb-32 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-autronis-text-primary">Offertes & Contracten</h1>
          {activeTab === "offertes" && (
            <Link href="/offertes/nieuw" className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20">
              <Plus className="w-4 h-4" />
              Nieuwe offerte
            </Link>
          )}
        </div>

        {/* Tab bar met sliding indicator */}
        <div className="relative flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 w-fit">
          {(["offertes", "contracten"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors z-10",
                activeTab === tab ? "text-autronis-bg" : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="offerte-tab-bg"
                  className="absolute inset-0 bg-autronis-accent rounded-lg"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-2">
                {tab === "offertes" ? <FileText className="w-4 h-4" /> : <FileSignature className="w-4 h-4" />}
                {tab === "offertes" ? "Offertes" : "Contracten"}
              </span>
            </button>
          ))}
        </div>

        {/* Offertes tab */}
        <AnimatePresence mode="wait">
          {activeTab === "offertes" && (
            <motion.div
              key="offertes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* KPI balk — alleen tonen als er data is */}
              {heeftData ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow">
                    <div className="p-2 bg-blue-500/10 rounded-xl w-fit mb-2.5">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <AnimatedNumber value={kpis.openstaandCount} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
                    <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Openstaand</p>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow">
                    <div className="p-2 bg-autronis-accent/10 rounded-xl w-fit mb-2.5">
                      <Euro className="w-5 h-5 text-autronis-accent" />
                    </div>
                    <AnimatedNumber value={kpis.openstaandWaarde} format={formatBedrag} className="text-2xl font-bold text-autronis-accent tabular-nums" />
                    <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Waarde openstaand</p>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow">
                    <div className="p-2 bg-emerald-500/10 rounded-xl w-fit mb-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <AnimatedNumber value={kpis.geaccepteerdDezeMaand} className="text-2xl font-bold text-emerald-400 tabular-nums" />
                    <p className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Geaccepteerd deze maand</p>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6 card-glow">
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="p-2 bg-autronis-accent/10 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-autronis-accent" />
                      </div>
                      <WinRateDonut percentage={kpis.winRate} geaccepteerd={kpis.totaalGeaccepteerd} afgewezen={kpis.totaalAfgewezen} />
                    </div>
                    <div className="flex items-end gap-2">
                      <AnimatedNumber value={kpis.winRate} format={(n) => `${Math.round(n)}%`} className="text-2xl font-bold text-autronis-text-primary tabular-nums" />
                      {winRateDelta !== null && (
                        <span className={cn("flex items-center gap-0.5 text-xs font-semibold mb-1", winRateDelta > 0 ? "text-emerald-400" : winRateDelta < 0 ? "text-red-400" : "text-autronis-text-secondary")}>
                          {winRateDelta > 0 ? <TrendingUp className="w-3 h-3" /> : winRateDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {winRateDelta > 0 ? "+" : ""}{winRateDelta}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-autronis-text-secondary mt-0.5 uppercase tracking-wide">Win rate</p>
                  </motion.div>
                </div>
              ) : null}

              {/* Pipeline funnel */}
              {heeftData && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Pipeline</span>
                    <div className="flex items-center gap-2 text-[10px] text-autronis-text-secondary/60">
                      {["concept", "verzonden", "geaccepteerd", "afgewezen"].map((fase) => (
                        <span key={fase} className="flex items-center gap-1">
                          <span className={cn("w-2 h-2 rounded-full", pipelineColors[fase])} />
                          {statusConfig[fase].label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <PipelineFunnel counts={kpis.statusCounts} activeFilter={statusFilter} onFilter={setStatusFilter} />
                </motion.div>
              )}

              {/* Follow-up alert banner */}
              {followUpOffertes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-5 py-3"
                >
                  <Bell className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-sm text-autronis-text-primary flex-1">
                    <span className="font-semibold text-amber-400">{followUpOffertes.length}</span>{" "}
                    offerte{followUpOffertes.length > 1 ? "s" : ""} wacht{followUpOffertes.length > 1 ? "en" : ""} op reactie (5+ dagen)
                  </p>
                  <button
                    onClick={() => setStatusFilter("verzonden")}
                    className="px-3 py-1.5 bg-amber-500/15 text-amber-400 rounded-lg text-xs font-semibold hover:bg-amber-500/25 transition-colors flex-shrink-0"
                  >
                    Bekijken
                  </button>
                </motion.div>
              )}

              {/* Filter + tabel */}
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
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
                            statusFilter === f.key ? "bg-autronis-bg/20 text-autronis-bg" : "bg-autronis-border text-autronis-text-secondary"
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
                {sortedOffertes.length === 0 ? (
                  <div className="py-16 text-center space-y-4">
                    {statusFilter === "alle" && !zoek ? (
                      <>
                        <div className="w-14 h-14 bg-autronis-accent/10 rounded-2xl flex items-center justify-center mx-auto">
                          <FileText className="w-7 h-7 text-autronis-accent" />
                        </div>
                        <div>
                          <p className="text-autronis-text-primary font-semibold text-lg">Nog geen offertes</p>
                          <p className="text-autronis-text-secondary text-sm mt-1 max-w-sm mx-auto">
                            Maak je eerste offerte aan of genereer er een op basis van een Sales Engine scan.
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                          <Link href="/offertes/nieuw" className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors">
                            <Plus className="w-4 h-4" />
                            Nieuwe offerte
                          </Link>
                          <Link href="/sales-engine" className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-card border border-autronis-border hover:border-autronis-accent/50 text-autronis-text-secondary hover:text-autronis-text-primary rounded-xl text-sm font-medium transition-colors">
                            <Sparkles className="w-4 h-4" />
                            Sales Engine scans
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
                          <SortHeader label="Nummer" kolom="offertenummer" activeKolom={sortKolom} richting={sortRichting} onSort={handleSort} className="text-left" />
                          <SortHeader label="Klant" kolom="klantNaam" activeKolom={sortKolom} richting={sortRichting} onSort={handleSort} className="text-left" />
                          <SortHeader label="Datum" kolom="datum" activeKolom={sortKolom} richting={sortRichting} onSort={handleSort} className="text-left max-sm:hidden" />
                          <SortHeader label="Geldig tot" kolom="geldigTot" activeKolom={sortKolom} richting={sortRichting} onSort={handleSort} className="text-left max-sm:hidden" />
                          <SortHeader label="Bedrag" kolom="bedragInclBtw" activeKolom={sortKolom} richting={sortRichting} onSort={handleSort} className="text-right" />
                          <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Acties</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence mode="popLayout">
                          {sortedOffertes.map((offerte, index) => {
                            const sc = statusConfig[offerte.status] ?? statusConfig.concept;
                            const isGeaccepteerd = offerte.status === "geaccepteerd";
                            const isVerzonden = offerte.status === "verzonden";
                            const isConcept = offerte.status === "concept";

                            const isOverdue = (isVerzonden || isConcept)
                              && offerte.geldigTot
                              && dagenVerlopen(offerte.geldigTot) > 0;
                            const daysOverdue = isOverdue && offerte.geldigTot ? dagenVerlopen(offerte.geldigTot) : 0;

                            const needsFollowUp = isVerzonden
                              && offerte.datum
                              && dagenSindsVerzonden(offerte.datum) >= 5
                              && !offerte.herinneringVerstuurdOp;

                            // High value highlight (top 20%)
                            const isHighValue = offerte.bedragInclBtw != null
                              && offertes.length >= 3
                              && offerte.bedragInclBtw >= (offertes.map((o) => o.bedragInclBtw ?? 0).sort((a, b) => b - a)[Math.floor(offertes.length * 0.2)] ?? Infinity);

                            return (
                              <motion.tr
                                key={offerte.id}
                                layout
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                                transition={{ duration: 0.18, delay: index * 0.03 }}
                                className={cn(
                                  "border-b border-autronis-border/50 hover:bg-autronis-bg/40 transition-colors relative group",
                                  isGeaccepteerd && "bg-emerald-500/[0.03]",
                                  isOverdue && "bg-amber-500/[0.04]",
                                  isHighValue && !isGeaccepteerd && !isOverdue && "bg-autronis-accent/[0.02]",
                                )}
                              >
                                <td className={cn("w-1 p-0 border-l-4", sc.border)} />

                                <td className="py-3.5 px-4">
                                  <Link href={`/offertes/${offerte.id}`} className="font-mono text-sm font-semibold text-autronis-accent hover:underline tracking-tight">
                                    {offerte.offertenummer}
                                  </Link>
                                  {offerte.titel && <p className="text-xs text-autronis-text-secondary mt-0.5 truncate max-w-[180px]">{offerte.titel}</p>}
                                  {needsFollowUp && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Bell className="w-3 h-3 text-amber-400" />
                                      <span className="text-xs text-amber-400">
                                        {offerte.datum ? dagenSindsVerzonden(offerte.datum) : 0}d —{" "}
                                        <Link href={`/offertes/${offerte.id}`} className="underline underline-offset-2 hover:text-amber-300">Herinnering</Link>
                                      </span>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-sm text-autronis-text-primary">{offerte.klantNaam}</td>

                                <td className="py-3.5 px-4 text-sm text-autronis-text-secondary max-sm:hidden">
                                  {offerte.datum ? formatDatumKort(offerte.datum) : "\u2014"}
                                </td>

                                <td className="py-3.5 px-4 max-sm:hidden">
                                  {isOverdue ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                      <span className="text-xs font-semibold text-rose-300">{daysOverdue}d verlopen</span>
                                    </span>
                                  ) : (
                                    <span className="text-sm text-autronis-text-secondary">{offerte.geldigTot ? formatDatumKort(offerte.geldigTot) : "\u2014"}</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-sm font-semibold text-autronis-text-primary text-right tabular-nums">
                                  {formatBedrag(offerte.bedragInclBtw || 0)}
                                </td>

                                <td className="py-3.5 px-4 text-center relative overflow-hidden">
                                  {isGeaccepteerd && <ConfettiBurst />}
                                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>
                                    {sc.label}
                                  </span>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="flex items-center justify-end gap-1">
                                    {/* Quick status actions */}
                                    {isConcept && (
                                      <button
                                        onClick={() => handleQuickStatus(offerte, "verzonden")}
                                        className="p-1.5 text-autronis-text-secondary hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Markeer als verzonden"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {isVerzonden && (
                                      <button
                                        onClick={() => handleQuickStatus(offerte, "geaccepteerd")}
                                        className="p-1.5 text-autronis-text-secondary hover:text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Markeer als geaccepteerd"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    <Link href={`/offertes/${offerte.id}`} className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors" title="Bekijken">
                                      <Eye className="w-3.5 h-3.5" />
                                    </Link>
                                    <a href={`/api/offertes/${offerte.id}/pdf`} className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors" title="PDF">
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                    <button onClick={() => handleDuplicate(offerte.id)} disabled={duplicatingId === offerte.id} className="p-1.5 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors disabled:opacity-40" title="Dupliceren">
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setDeleteId(offerte.id)} className="p-1.5 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors" title="Verwijderen">
                                      <Trash2 className="w-3.5 h-3.5" />
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
            </motion.div>
          )}

          {activeTab === "contracten" && (
            <motion.div
              key="contracten"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <ContractenTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
