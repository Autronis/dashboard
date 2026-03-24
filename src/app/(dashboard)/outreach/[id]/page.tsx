"use client";

import { use, useState } from "react";
import { useOutreachDetail, useActivateSequentie, usePauseSequentie } from "@/hooks/queries/use-outreach";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertTriangle,
  Copy,
  Check,
  Code,
  AlignLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OutreachEmail } from "@/hooks/queries/use-outreach";

// ============ STATUS CONFIG ============

const emailStatusConfig: Record<string, { label: string; kleur: string; dotColor: string; icon: typeof Clock }> = {
  gepland:    { label: "Gepland",     kleur: "text-[var(--text-tertiary)]", dotColor: "#4B5563", icon: Clock },
  verstuurd:  { label: "Verstuurd",   kleur: "text-blue-400",               dotColor: "#60A5FA", icon: Send },
  geopend:    { label: "Geopend",     kleur: "text-purple-400",             dotColor: "#C084FC", icon: Eye },
  geklikt:    { label: "Geklikt",     kleur: "text-orange-400",             dotColor: "#FB923C", icon: MousePointerClick },
  beantwoord: { label: "Beantwoord",  kleur: "text-emerald-400",            dotColor: "#34D399", icon: MessageCircle },
  bounced:    { label: "Bounced",     kleur: "text-red-400",                dotColor: "#F87171", icon: AlertCircle },
  geannuleerd:{ label: "Geannuleerd", kleur: "text-[var(--text-tertiary)]", dotColor: "#6B7280", icon: AlertTriangle },
};

const seqStatusConfig: Record<string, { label: string; kleur: string }> = {
  draft:      { label: "Concept",         kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30" },
  actief:     { label: "Actief",          kleur: "text-emerald-400 bg-emerald-400/10" },
  gepauzeerd: { label: "Gepauzeerd",      kleur: "text-yellow-400 bg-yellow-400/10" },
  voltooid:   { label: "Voltooid",        kleur: "text-blue-400 bg-blue-400/10" },
  gestopt:    { label: "Gestopt (reply)", kleur: "text-purple-400 bg-purple-400/10" },
};

// ============ RELATIVE TIME ============

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const uren = Math.floor(diff / 3600000);
  const dagen = Math.floor(diff / 86400000);

  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m geleden`;
  if (uren < 24) return `${uren}u geleden`;
  if (dagen < 7) return `${dagen}d geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function Tijdstip({ iso, label }: { iso: string; label: string }) {
  const exact = new Date(iso).toLocaleString("nl-NL", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <span title={exact} className="text-xs tabular-nums text-[var(--text-tertiary)] cursor-default">
      {label}: {relativeTime(iso)}
    </span>
  );
}

// ============ EMAIL KAART ============

function htmlNaarPlaintext(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function EmailKaart({ email, isLast }: { email: OutreachEmail; isLast: boolean }) {
  const [plaintext, setPlaintext] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);
  const cfg = emailStatusConfig[email.status] ?? emailStatusConfig.gepland;
  const EmailIcon = cfg.icon;

  async function handleKopieer() {
    const tekst = plaintext ? htmlNaarPlaintext(email.inhoud) : email.inhoud;
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="flex gap-4">
      {/* Vertical timeline node */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-500"
          style={{
            borderColor: cfg.dotColor,
            backgroundColor: `${cfg.dotColor}18`,
          }}
        >
          <EmailIcon className="w-3.5 h-3.5" style={{ color: cfg.dotColor }} />
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 mt-2" style={{ backgroundColor: `${cfg.dotColor}30`, minHeight: "24px" }} />
        )}
      </div>

      {/* Email kaart */}
      <div className="flex-1 min-w-0 pb-6">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Header */}
          <div className="p-5 pb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  Stap {email.stapNummer}: {email.onderwerp}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={cn("text-xs font-medium", cfg.kleur)}>{cfg.label}</span>
                </div>
              </div>

              {/* Status dots */}
              <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                {[
                  { op: email.verstuurdOp, color: "#60A5FA", label: "Verstuurd" },
                  { op: email.geopendOp, color: "#C084FC", label: "Geopend" },
                  { op: email.gekliktOp, color: "#FB923C", label: "Geklikt" },
                  { op: email.beantwoordOp, color: "#34D399", label: "Beantwoord" },
                ].map(({ op, color, label }) => (
                  <div
                    key={label}
                    className={cn("w-2.5 h-2.5 rounded-full transition-colors duration-300")}
                    style={{ backgroundColor: op ? color : "#374151" }}
                    title={op ? `${label}: ${relativeTime(op)}` : label}
                  />
                ))}
              </div>
            </div>

            {/* Tijdstempels */}
            <div className="flex flex-wrap gap-3">
              {email.geplandOp && !email.verstuurdOp && (
                <Tijdstip iso={email.geplandOp} label="Gepland" />
              )}
              {email.verstuurdOp && <Tijdstip iso={email.verstuurdOp} label="Verstuurd" />}
              {email.geopendOp && <Tijdstip iso={email.geopendOp} label="Geopend" />}
              {email.gekliktOp && <Tijdstip iso={email.gekliktOp} label="Geklikt" />}
              {email.beantwoordOp && <Tijdstip iso={email.beantwoordOp} label="Beantwoord" />}
            </div>
          </div>

          {/* Email preview met toggle */}
          <div className="border-t border-[var(--border)]/50">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg)]/30">
              <div className="flex items-center gap-1 bg-[var(--card)] rounded-lg border border-[var(--border)]/60 p-0.5">
                <button
                  onClick={() => setPlaintext(false)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    !plaintext
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <Code className="w-3 h-3" />
                  HTML
                </button>
                <button
                  onClick={() => setPlaintext(true)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    plaintext
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <AlignLeft className="w-3 h-3" />
                  Tekst
                </button>
              </div>
              <button
                onClick={handleKopieer}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  gekopieerd
                    ? "text-emerald-400 bg-emerald-400/10"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/30"
                )}
              >
                {gekopieerd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {gekopieerd ? "Gekopieerd" : "Kopieer"}
              </button>
            </div>

            <div className="p-4 text-sm text-[var(--text-secondary)]">
              {plaintext ? (
                <pre className="whitespace-pre-wrap font-sans leading-relaxed text-sm">
                  {htmlNaarPlaintext(email.inhoud)}
                </pre>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: email.inhoud }} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============

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
      <div className="p-6 space-y-6 max-w-3xl">
        {/* Back + Header */}
        <div>
          <Link
            href="/outreach"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{lead?.bedrijfsnaam ?? "Onbekend"}</h1>
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium transition-colors duration-500",
                seqStatus.kleur
              )}>
                {seqStatus.label}
              </span>
              {sequentie.abVariant && (
                <span className={cn(
                  "px-2.5 py-1 rounded-lg text-sm font-bold font-mono",
                  sequentie.abVariant === "a"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "bg-purple-500/15 text-purple-400"
                )}>
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

          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)] flex-wrap">
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
            {sequentie.aangemaaktOp && (
              <span title={new Date(sequentie.aangemaaktOp).toLocaleString("nl-NL")}>
                Aangemaakt {relativeTime(sequentie.aangemaaktOp)}
              </span>
            )}
          </div>
        </div>

        {/* Email Timeline */}
        <div>
          <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
            <Send className="w-5 h-5 text-[var(--accent)]" />
            Email Sequentie
          </h2>
          <div>
            {emails.map((email, index) => (
              <EmailKaart
                key={email.id}
                email={email}
                isLast={index === emails.length - 1}
              />
            ))}
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
