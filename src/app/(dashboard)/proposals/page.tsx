"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Send,
  CheckCircle2,
  Euro,
  Plus,
  Eye,
  Download,
  Link2,
  Trash2,
  Mail,
} from "lucide-react";
import { cn, formatBedrag, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useProposals } from "@/hooks/queries/use-proposals";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SkeletonFacturen } from "@/components/ui/skeleton";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  concept: { bg: "bg-slate-500/15", text: "text-slate-400", label: "Concept" },
  verzonden: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Verzonden" },
  bekeken: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Bekeken" },
  ondertekend: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Ondertekend" },
  afgewezen: { bg: "bg-red-500/15", text: "text-red-400", label: "Afgewezen" },
};

export default function ProposalsPage() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("alle");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading: loading } = useProposals(statusFilter);
  const proposals = data?.proposals ?? [];
  const kpis = data?.kpis ?? { openstaand: 0, verzonden: 0, ondertekendDezeMaand: 0, totaleWaarde: 0 };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => {
      addToast("Proposal verwijderd", "succes");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => {
      addToast("Kon proposal niet verwijderen", "fout");
    },
  });

  const verstuurMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/proposals/${id}/verstuur`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fout || "Onbekende fout");
    },
    onSuccess: () => {
      addToast("Proposal verstuurd per e-mail", "succes");
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: (error) => {
      addToast(error instanceof Error ? error.message : "Kon niet versturen", "fout");
    },
  });

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
  };

  const handleVerstuur = (id: number) => {
    verstuurMutation.mutate(id);
  };

  const handleCopyLink = (token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/proposal/${token}`;
    navigator.clipboard.writeText(url);
    addToast("Link gekopieerd", "succes");
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
            <h1 className="text-3xl font-bold text-autronis-text-primary">Proposals</h1>
            <p className="text-base text-autronis-text-secondary mt-1">
              Voorstellen en offertes met digitale ondertekening
            </p>
          </div>
          <Link
            href="/proposals/nieuw"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20"
          >
            <Plus className="w-4 h-4" />
            Nieuwe proposal
          </Link>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow bg-autronis-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.openstaand}
              className="text-3xl font-bold text-autronis-text-primary tabular-nums"
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Openstaand
            </p>
          </div>

          <div className="border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow bg-autronis-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl">
                <Send className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.verzonden}
              className="text-3xl font-bold text-blue-400 tabular-nums"
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Verzonden
            </p>
          </div>

          <div className="border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow bg-autronis-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.ondertekendDezeMaand}
              className="text-3xl font-bold text-emerald-400 tabular-nums"
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Ondertekend deze maand
            </p>
          </div>

          <div className="border border-autronis-border rounded-2xl p-6 lg:p-7 card-glow bg-autronis-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-autronis-accent/10 rounded-xl">
                <Euro className="w-5 h-5 text-autronis-accent" />
              </div>
            </div>
            <AnimatedNumber
              value={kpis.totaleWaarde}
              format={formatBedrag}
              className="text-3xl font-bold text-autronis-accent tabular-nums"
            />
            <p className="text-sm text-autronis-text-secondary mt-1.5 uppercase tracking-wide">
              Totale waarde
            </p>
          </div>
        </div>

        {/* Filters + table */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-7">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto">
            {[
              { key: "alle", label: "Alle" },
              { key: "concept", label: "Concept" },
              { key: "verzonden", label: "Verzonden" },
              { key: "bekeken", label: "Bekeken" },
              { key: "ondertekend", label: "Ondertekend" },
              { key: "afgewezen", label: "Afgewezen" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  statusFilter === f.key
                    ? "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {proposals.length === 0 ? (
            <EmptyState
              titel="Nog geen proposals"
              beschrijving="Maak je eerste proposal aan om potentiele klanten te overtuigen."
              actieLabel="Nieuwe proposal"
              actieHref="/proposals/nieuw"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-autronis-border">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">
                      Titel
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">
                      Klant
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">
                      Datum
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">
                      Bedrag
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => {
                    const sc = statusConfig[p.status] || statusConfig.concept;
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <Link
                            href={`/proposals/${p.id}`}
                            className="text-base font-medium text-autronis-accent hover:underline"
                          >
                            {p.titel}
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-base text-autronis-text-primary">
                          {p.klantNaam}
                        </td>
                        <td className="py-4 px-4 text-sm text-autronis-text-secondary">
                          {p.aangemaaktOp ? formatDatum(p.aangemaaktOp) : "\u2014"}
                        </td>
                        <td className="py-4 px-4 text-base font-semibold text-autronis-text-primary text-right tabular-nums">
                          {formatBedrag(p.totaalBedrag || 0)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full font-semibold",
                              sc.bg,
                              sc.text
                            )}
                          >
                            {sc.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/proposals/${p.id}`}
                              className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                              title="Bekijken"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleCopyLink(p.token)}
                              className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                              title="Kopieer link"
                            >
                              <Link2 className="w-4 h-4" />
                            </button>
                            <a
                              href={`/api/proposals/${p.id}/pdf`}
                              className="p-2 text-autronis-text-secondary hover:text-autronis-accent rounded-lg hover:bg-autronis-accent/10 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            {(p.status === "concept" || p.status === "verzonden") && (
                              <button
                                onClick={() => handleVerstuur(p.id)}
                                className="p-2 text-autronis-text-secondary hover:text-blue-400 rounded-lg hover:bg-blue-500/10 transition-colors"
                                title="Verstuur per e-mail"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            )}
                            {p.status === "concept" && (
                              <button
                                onClick={() => setDeleteId(p.id)}
                                className="p-2 text-autronis-text-secondary hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                                title="Verwijderen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
          titel="Proposal verwijderen?"
          bericht="Weet je zeker dat je deze proposal wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
          bevestigTekst="Verwijderen"
          variant="danger"
        />
      </div>
    </PageTransition>
  );
}
