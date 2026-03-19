"use client";

import { useState } from "react";
import { useOutreach, useActivateSequentie, usePauseSequentie } from "@/hooks/queries/use-outreach";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import {
  Mail,
  Send,
  Eye,
  MousePointerClick,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  ExternalLink,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  draft: { label: "Concept", kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30", icon: Clock },
  actief: { label: "Actief", kleur: "text-emerald-400 bg-emerald-400/10", icon: Play },
  gepauzeerd: { label: "Gepauzeerd", kleur: "text-yellow-400 bg-yellow-400/10", icon: Pause },
  voltooid: { label: "Voltooid", kleur: "text-blue-400 bg-blue-400/10", icon: CheckCircle },
  gestopt: { label: "Gestopt (reply)", kleur: "text-purple-400 bg-purple-400/10", icon: MessageCircle },
};

export default function OutreachPage() {
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const { data, isLoading } = useOutreach(statusFilter);
  const activateMutation = useActivateSequentie();
  const pauseMutation = usePauseSequentie();
  const { addToast } = useToast();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const sequenties = data?.sequenties ?? [];
  const kpis = data?.kpis;

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Mail className="w-8 h-8 text-[var(--accent)]" />
          <h1 className="text-3xl font-bold">Outreach</h1>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-xs text-[var(--text-secondary)]">Verstuurd</span>
              </div>
              <p className="text-2xl font-bold">{kpis.verstuurd}</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-[var(--text-secondary)]">Open Rate</span>
              </div>
              <p className="text-2xl font-bold">{kpis.openRate}%</p>
              <p className="text-xs text-[var(--text-tertiary)]">{kpis.geopend} geopend</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-[var(--text-secondary)]">Click Rate</span>
              </div>
              <p className="text-2xl font-bold">{kpis.clickRate}%</p>
              <p className="text-xs text-[var(--text-tertiary)]">{kpis.geklikt} geklikt</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-[var(--text-secondary)]">Reply Rate</span>
              </div>
              <p className="text-2xl font-bold">{kpis.replyRate}%</p>
              <p className="text-xs text-[var(--text-tertiary)]">{kpis.beantwoord} replies</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {["alle", "actief", "draft", "gepauzeerd", "gestopt", "voltooid"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)]"
              }`}
            >
              {s === "alle" ? "Alle" : statusConfig[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Sequentie List */}
        {sequenties.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl p-12 text-center border border-[var(--border)]">
            <Mail className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">
              Nog geen outreach sequenties. Genereer er een vanuit een Sales Engine scan.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sequenties.map((seq) => {
              const status = statusConfig[seq.status] ?? statusConfig.draft;
              const StatusIcon = status.icon;

              return (
                <div
                  key={seq.id}
                  className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <Link href={`/outreach/${seq.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg truncate">
                          {seq.bedrijfsnaam ?? "Onbekend"}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.kleur}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        {seq.abVariant && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--border)]/30 text-[var(--text-tertiary)]">
                            {seq.abVariant.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                        {seq.email && <span>{seq.email}</span>}
                        {seq.domein && (
                          <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {seq.domein}
                          </span>
                        )}
                        <span>{seq.verstuurd}/{seq.totaalEmails} verstuurd</span>
                        {seq.geopend > 0 && <span>{seq.geopend} geopend</span>}
                        {seq.beantwoord > 0 && (
                          <span className="text-emerald-400">{seq.beantwoord} reply</span>
                        )}
                        {seq.aangemaaktOp && <span>{formatDatum(seq.aangemaaktOp)}</span>}
                      </div>
                    </Link>

                    {/* Actie knoppen */}
                    <div className="flex items-center gap-2 ml-4">
                      {seq.status === "draft" && (
                        <button
                          onClick={() => {
                            activateMutation.mutate(seq.id, {
                              onSuccess: () => addToast("Sequentie geactiveerd", "succes"),
                              onError: (err) => addToast(err.message, "fout"),
                            });
                          }}
                          className="p-2 rounded-lg bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-colors"
                          title="Activeren"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {seq.status === "actief" && (
                        <button
                          onClick={() => {
                            pauseMutation.mutate(seq.id, {
                              onSuccess: () => addToast("Sequentie gepauzeerd", "succes"),
                              onError: (err) => addToast(err.message, "fout"),
                            });
                          }}
                          className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                          title="Pauzeren"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {seq.status === "gepauzeerd" && (
                        <button
                          onClick={() => {
                            activateMutation.mutate(seq.id, {
                              onSuccess: () => addToast("Sequentie hervat", "succes"),
                              onError: (err) => addToast(err.message, "fout"),
                            });
                          }}
                          className="p-2 rounded-lg bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-colors"
                          title="Hervatten"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
