"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Euro,
  CheckCircle2,
  TrendingUp,
  Plus,
  Download,
  Eye,
  Trash2,
  Search,
  FileSignature,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useOffertes } from "@/hooks/queries/use-offertes";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractenTab } from "./contracten-tab";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  geaccepteerd: { bg: "bg-green-500/15", text: "text-green-400", label: "Geaccepteerd" },
  verlopen: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Verlopen" },
  afgewezen: { bg: "bg-red-500/15", text: "text-red-400", label: "Afgewezen" },
};

function OffertesSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

type ActiveTab = "offertes" | "contracten";

export default function OffertesPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>("offertes");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading: loading } = useOffertes(statusFilter, zoek);
  const offertes = data?.offertes ?? [];
  const kpis = data?.kpis ?? { openstaandCount: 0, openstaandWaarde: 0, geaccepteerdDezeMaand: 0, winRate: 0 };

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
    onError: () => {
      addToast("Kon offerte niet verwijderen", "fout");
    },
  });

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  };

  const deleteOfferte = offertes.find((o) => o.id === deleteId);

  if (loading && activeTab === "offertes") {
    return <OffertesSkeleton />;
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Offertes & Contracten</h1>
          </div>
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
          <button
            onClick={() => setActiveTab("offertes")}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "offertes"
                ? "bg-autronis-accent text-autronis-bg"
                : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            <FileText className="w-4 h-4" />
            Offertes
          </button>
          <button
            onClick={() => setActiveTab("contracten")}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "contracten"
                ? "bg-autronis-accent text-autronis-bg"
                : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            <FileSignature className="w-4 h-4" />
            Contracten
          </button>
        </div>

        {/* Offertes tab */}
        {activeTab === "offertes" && (
          <>
            {/* KPI balk */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <AnimatedNumber
                  value={kpis.openstaandCount}
                  className="text-3xl font-bold text-autronis-text-primary tabular-nums"
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Openstaand</p>
              </div>

              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                    <Euro className="w-5 h-5 text-autronis-accent" />
                  </div>
                </div>
                <AnimatedNumber
                  value={kpis.openstaandWaarde}
                  format={formatBedrag}
                  className="text-3xl font-bold text-autronis-accent tabular-nums"
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Waarde openstaand</p>
              </div>

              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-green-500/10 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                </div>
                <AnimatedNumber
                  value={kpis.geaccepteerdDezeMaand}
                  className="text-3xl font-bold text-green-400 tabular-nums"
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Geaccepteerd deze maand</p>
              </div>

              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-autronis-accent" />
                  </div>
                </div>
                <AnimatedNumber
                  value={kpis.winRate}
                  format={(n) => `${Math.round(n)}%`}
                  className="text-3xl font-bold text-autronis-text-primary tabular-nums"
                />
                <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">Win rate</p>
              </div>
            </div>

            {/* Filters + tabel */}
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { key: "alle", label: "Alle" },
                    { key: "concept", label: "Concept" },
                    { key: "verzonden", label: "Verzonden" },
                    { key: "geaccepteerd", label: "Geaccepteerd" },
                    { key: "afgewezen", label: "Afgewezen" },
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
                <EmptyState
                  titel="Nog geen offertes"
                  beschrijving="Maak je eerste offerte aan om te beginnen."
                  actieLabel="Nieuwe offerte"
                  actieHref="/offertes/nieuw"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-autronis-border">
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
                      {offertes.map((offerte) => {
                        const sc = statusConfig[offerte.status] || statusConfig.concept;
                        return (
                          <tr
                            key={offerte.id}
                            className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <Link href={`/offertes/${offerte.id}`} className="text-base font-medium text-autronis-accent hover:underline">
                                {offerte.offertenummer}
                              </Link>
                              {offerte.titel && (
                                <p className="text-xs text-autronis-text-secondary mt-0.5 truncate max-w-[200px]">{offerte.titel}</p>
                              )}
                            </td>
                            <td className="py-4 px-4 text-base text-autronis-text-primary">{offerte.klantNaam}</td>
                            <td className="py-4 px-4 text-sm text-autronis-text-secondary max-sm:hidden">
                              {offerte.datum ? formatDatumKort(offerte.datum) : "\u2014"}
                            </td>
                            <td className="py-4 px-4 text-sm text-autronis-text-secondary max-sm:hidden">
                              {offerte.geldigTot ? formatDatumKort(offerte.geldigTot) : "\u2014"}
                            </td>
                            <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary text-right tabular-nums">
                              {formatBedrag(offerte.bedragInclBtw || 0)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", sc.bg, sc.text)}>
                                {sc.label}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-end gap-2">
                                <Link
                                  href={`/offertes/${offerte.id}`}
                                  className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <a
                                  href={`/api/offertes/${offerte.id}/pdf`}
                                  className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                                <button
                                  onClick={() => setDeleteId(offerte.id)}
                                  className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

            {/* Delete confirm dialog */}
            <ConfirmDialog
              open={deleteId !== null}
              onClose={() => setDeleteId(null)}
              onBevestig={handleDelete}
              titel="Offerte verwijderen?"
              bericht={`Weet je zeker dat je offerte ${deleteOfferte?.offertenummer || ""} wilt verwijderen?`}
              bevestigTekst="Verwijderen"
              variant="danger"
            />
          </>
        )}

        {/* Contracten tab */}
        {activeTab === "contracten" && <ContractenTab />}
      </div>
    </PageTransition>
  );
}
