"use client";

import { use } from "react";
import { useOutreachDetail, useActivateSequentie, usePauseSequentie } from "@/hooks/queries/use-outreach";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import {
  ArrowLeft,
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
  User,
  Building2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

const emailStatusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  gepland: { label: "Gepland", kleur: "text-[var(--text-tertiary)]", icon: Clock },
  verstuurd: { label: "Verstuurd", kleur: "text-blue-400", icon: Send },
  geopend: { label: "Geopend", kleur: "text-purple-400", icon: Eye },
  geklikt: { label: "Geklikt", kleur: "text-orange-400", icon: MousePointerClick },
  beantwoord: { label: "Beantwoord", kleur: "text-emerald-400", icon: MessageCircle },
  bounced: { label: "Bounced", kleur: "text-red-400", icon: AlertCircle },
  geannuleerd: { label: "Geannuleerd", kleur: "text-[var(--text-tertiary)]", icon: AlertTriangle },
};

const seqStatusConfig: Record<string, { label: string; kleur: string }> = {
  draft: { label: "Concept", kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30" },
  actief: { label: "Actief", kleur: "text-emerald-400 bg-emerald-400/10" },
  gepauzeerd: { label: "Gepauzeerd", kleur: "text-yellow-400 bg-yellow-400/10" },
  voltooid: { label: "Voltooid", kleur: "text-blue-400 bg-blue-400/10" },
  gestopt: { label: "Gestopt (reply)", kleur: "text-purple-400 bg-purple-400/10" },
};

export default function OutreachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const seqId = parseInt(id, 10);
  const { data, isLoading } = useOutreachDetail(isNaN(seqId) ? null : seqId);
  const activateMutation = useActivateSequentie();
  const pauseMutation = usePauseSequentie();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-secondary)]">Sequentie niet gevonden.</p>
        <Link href="/outreach" className="text-[var(--accent)] hover:underline mt-2 inline-block">
          ← Terug naar overzicht
        </Link>
      </div>
    );
  }

  const { sequentie, lead, domein, scan, emails } = data;
  const seqStatus = seqStatusConfig[sequentie.status] ?? seqStatusConfig.draft;

  function handleActivate() {
    activateMutation.mutate(seqId, {
      onSuccess: () => {
        addToast("Sequentie geactiveerd", "succes");
        queryClient.invalidateQueries({ queryKey: ["outreach-detail", seqId] });
      },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  function handlePause() {
    pauseMutation.mutate(seqId, {
      onSuccess: () => {
        addToast("Sequentie gepauzeerd", "succes");
        queryClient.invalidateQueries({ queryKey: ["outreach-detail", seqId] });
      },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Back + Header */}
        <div>
          <Link
            href="/outreach"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold">{lead?.bedrijfsnaam ?? "Onbekend"}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${seqStatus.kleur}`}>
                {seqStatus.label}
              </span>
              {sequentie.abVariant && (
                <span className="px-2 py-1 rounded text-xs font-mono bg-[var(--border)]/30 text-[var(--text-tertiary)]">
                  Variant {sequentie.abVariant.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {(sequentie.status === "draft" || sequentie.status === "gepauzeerd") && (
                <button
                  onClick={handleActivate}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-400/10 text-emerald-400 rounded-lg hover:bg-emerald-400/20 transition-colors text-sm font-medium"
                >
                  <Play className="w-4 h-4" />
                  {sequentie.status === "draft" ? "Activeren" : "Hervatten"}
                </button>
              )}
              {sequentie.status === "actief" && (
                <button
                  onClick={handlePause}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400/10 text-yellow-400 rounded-lg hover:bg-yellow-400/20 transition-colors text-sm font-medium"
                >
                  <Pause className="w-4 h-4" />
                  Pauzeren
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
            {lead?.email && <span>{lead.email}</span>}
            {domein && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                via {domein.emailAdres}
              </span>
            )}
            {scan && (
              <Link href={`/sales-engine/${scan.id}`} className="flex items-center gap-1 hover:text-[var(--accent)]">
                <ExternalLink className="w-3.5 h-3.5" />
                Bekijk scan
              </Link>
            )}
            {sequentie.aangemaaktOp && <span>Aangemaakt {formatDatum(sequentie.aangemaaktOp)}</span>}
          </div>
        </div>

        {/* Email Timeline */}
        <div>
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-[var(--accent)]" />
            Email Sequentie
          </h2>
          <div className="space-y-4">
            {emails.map((email, index) => {
              const emailStatus = emailStatusConfig[email.status] ?? emailStatusConfig.gepland;
              const EmailIcon = emailStatus.icon;

              return (
                <div
                  key={email.id}
                  className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden"
                >
                  {/* Email Header */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          email.status === "beantwoord" ? "bg-emerald-400/10" :
                          email.status === "geopend" || email.status === "geklikt" ? "bg-purple-400/10" :
                          email.status === "verstuurd" ? "bg-blue-400/10" :
                          "bg-[var(--border)]/30"
                        }`}>
                          <EmailIcon className={`w-4 h-4 ${emailStatus.kleur}`} />
                        </div>
                        <div>
                          <p className="font-medium">Stap {email.stapNummer}: {email.onderwerp}</p>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-0.5">
                            <span className={emailStatus.kleur}>{emailStatus.label}</span>
                            {email.geplandOp && !email.verstuurdOp && (
                              <span>Gepland: {formatDatum(email.geplandOp)}</span>
                            )}
                            {email.verstuurdOp && <span>Verstuurd: {formatDatum(email.verstuurdOp)}</span>}
                            {email.geopendOp && <span>Geopend: {formatDatum(email.geopendOp)}</span>}
                            {email.gekliktOp && <span>Geklikt: {formatDatum(email.gekliktOp)}</span>}
                            {email.beantwoordOp && <span>Beantwoord: {formatDatum(email.beantwoordOp)}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator dots */}
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${email.verstuurdOp ? "bg-blue-400" : "bg-[var(--border)]"}`} title="Verstuurd" />
                        <div className={`w-2.5 h-2.5 rounded-full ${email.geopendOp ? "bg-purple-400" : "bg-[var(--border)]"}`} title="Geopend" />
                        <div className={`w-2.5 h-2.5 rounded-full ${email.gekliktOp ? "bg-orange-400" : "bg-[var(--border)]"}`} title="Geklikt" />
                        <div className={`w-2.5 h-2.5 rounded-full ${email.beantwoordOp ? "bg-emerald-400" : "bg-[var(--border)]"}`} title="Beantwoord" />
                      </div>
                    </div>

                    {/* Email Preview */}
                    <div className="bg-[var(--bg)]/50 rounded-lg p-4 text-sm text-[var(--text-secondary)]">
                      <div dangerouslySetInnerHTML={{ __html: email.inhoud }} />
                    </div>
                  </div>

                  {/* Connector line between emails */}
                  {index < emails.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-4 bg-[var(--border)]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scan samenvatting */}
        {scan?.samenvatting && (
          <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-5">
            <h2 className="font-semibold text-sm text-[var(--accent)] mb-2">Scan Samenvatting</h2>
            <p className="text-sm text-[var(--text-secondary)]">{scan.samenvatting}</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
