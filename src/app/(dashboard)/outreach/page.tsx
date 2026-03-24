"use client";

import { useState, useEffect, useRef } from "react";
import {
  useOutreach,
  useOutreachDomeinen,
  useActivateSequentie,
  usePauseSequentie,
} from "@/hooks/queries/use-outreach";
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
  ArrowRight,
  Server,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SequentieListItem } from "@/hooks/queries/use-outreach";

// ============ STATUS CONFIG ============

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  draft: { label: "Concept", kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30", icon: Clock },
  actief: { label: "Actief", kleur: "text-emerald-400 bg-emerald-400/10", icon: Play },
  gepauzeerd: { label: "Gepauzeerd", kleur: "text-yellow-400 bg-yellow-400/10", icon: Pause },
  voltooid: { label: "Voltooid", kleur: "text-blue-400 bg-blue-400/10", icon: CheckCircle },
  gestopt: { label: "Gestopt (reply)", kleur: "text-purple-400 bg-purple-400/10", icon: MessageCircle },
};

// ============ ANIMATED COUNT ============

function AnimatedCount({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const target = value;
    const duration = 600;
    const start = prev.current;
    const startTime = performance.now();

    function step(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
    prev.current = target;
  }, [value]);

  return <>{display}{suffix}</>
}

// ============ VOORTGANG BLOKJES ============

function VoortgangBlokjes({ verstuurd, totaal }: { verstuurd: number; totaal: number }) {
  if (totaal === 0) return null;
  return (
    <div className="flex items-center gap-0.5" title={`${verstuurd}/${totaal} verstuurd`}>
      {Array.from({ length: totaal }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2.5 h-2.5 rounded-sm transition-colors",
            i < verstuurd ? "bg-[var(--accent)]" : "bg-[var(--border)]"
          )}
        />
      ))}
    </div>
  );
}

// ============ DOMEIN DOT ============

function DomeinDot({
  domein,
  vandaagVerstuurd,
  dagLimiet,
}: {
  domein: string | null;
  vandaagVerstuurd: number | null;
  dagLimiet: number | null;
}) {
  if (!domein) return null;

  const verstuurd = vandaagVerstuurd ?? 0;
  const limiet = dagLimiet ?? 50;
  const pct = limiet > 0 ? verstuurd / limiet : 0;

  const dotColor =
    pct >= 1 ? "bg-red-500" : pct >= 0.8 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} title={`${verstuurd}/${limiet} vandaag`} />
      <ExternalLink className="w-3 h-3" />
      {domein}
    </span>
  );
}

// ============ VOLGENDE EMAIL ============

function VolgendeEmail({ geplandOp }: { geplandOp: string | null }) {
  if (!geplandOp) return null;
  const nu = Date.now();
  const gepland = new Date(geplandOp).getTime();
  const diffMs = gepland - nu;
  if (diffMs < 0) return <span className="text-xs text-amber-400">Wordt verwerkt...</span>;

  const dagen = Math.floor(diffMs / 86400000);
  const uren = Math.floor((diffMs % 86400000) / 3600000);

  const label = dagen > 0 ? `over ${dagen}d` : `over ${uren}u`;
  return <span className="text-xs text-[var(--text-tertiary)]">Volgende {label}</span>;
}

// ============ ACTIVEER KNOP (arm → confirm) ============

function ActiveerKnop({ seqId, onSuccess }: { seqId: number; onSuccess: () => void }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutation = useActivateSequentie();

  function handleClick() {
    if (!armed) {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setArmed(false);
      mutation.mutate(seqId, { onSuccess });
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <button
      onClick={(e) => { e.preventDefault(); handleClick(); }}
      disabled={mutation.isPending}
      className={cn(
        "p-2 rounded-lg text-sm font-medium transition-all duration-200",
        armed
          ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40 px-3"
          : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20"
      )}
      title={armed ? "Klik nogmaals om te bevestigen" : "Activeren"}
    >
      {armed ? "Bevestig?" : <Play className="w-4 h-4" />}
    </button>
  );
}

// ============ SEQUENTIE RIJ ============

function SequentieRij({
  seq,
  index,
  onPause,
  onActivate,
}: {
  seq: SequentieListItem;
  index: number;
  onPause: (id: number) => void;
  onActivate: () => void;
}) {
  const status = statusConfig[seq.status] ?? statusConfig.draft;
  const StatusIcon = status.icon;
  const isGestopt = seq.status === "gestopt";
  const isActief = seq.status === "actief";

  return (
    <div
      className={cn(
        "relative rounded-xl border transition-all",
        "opacity-0 animate-[fadeSlideIn_0.3s_ease_forwards]",
        isGestopt
          ? "border-emerald-500/20 bg-emerald-500/3 hover:border-emerald-500/30 gestopt-shimmer"
          : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/30"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <Link href={`/outreach/${seq.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h3 className="font-semibold text-lg truncate">
                {seq.bedrijfsnaam ?? "Onbekend"}
              </h3>
              {/* Status badge */}
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors duration-500",
                status.kleur
              )}>
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
              {/* A/B badge */}
              {seq.abVariant && (
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold font-mono",
                  seq.abVariant === "a"
                    ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "bg-purple-500/15 text-purple-400"
                )}>
                  {seq.abVariant.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              {seq.email && (
                <span className="text-[var(--text-secondary)]">{seq.email}</span>
              )}
              <DomeinDot
                domein={seq.domein}
                vandaagVerstuurd={seq.domeinVandaagVerstuurd}
                dagLimiet={seq.domeinDagLimiet}
              />
              <VoortgangBlokjes verstuurd={seq.verstuurd} totaal={seq.totaalEmails} />
              {seq.geopend > 0 && (
                <span className="text-xs text-purple-400">{seq.geopend} geopend</span>
              )}
              {seq.beantwoord > 0 && (
                <span className="text-xs text-emerald-400 font-medium">{seq.beantwoord} reply</span>
              )}
              {isActief && <VolgendeEmail geplandOp={seq.volgendeGeplandEmail} />}
              {seq.aangemaaktOp && (
                <span className="text-xs text-[var(--text-tertiary)]">{formatDatum(seq.aangemaaktOp)}</span>
              )}
            </div>
          </Link>

          {/* Actie knoppen */}
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {(seq.status === "draft" || seq.status === "gepauzeerd") && (
              <ActiveerKnop seqId={seq.id} onSuccess={onActivate} />
            )}
            {seq.status === "actief" && (
              <button
                onClick={(e) => { e.preventDefault(); onPause(seq.id); }}
                className="p-2 rounded-lg bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 transition-colors"
                title="Pauzeren"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAILBOXEN TAB ============

function MailboxenTab() {
  const { data, isLoading } = useOutreachDomeinen();
  const domeinen = data?.domeinen ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (domeinen.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl p-12 text-center border border-[var(--border)]">
        <Server className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4 opacity-40" />
        <p className="text-[var(--text-secondary)]">Nog geen mailboxen geconfigureerd.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {domeinen.map((d) => {
        const verstuurd = d.vandaagVerstuurd ?? 0;
        const limiet = d.dagLimiet ?? 50;
        const pct = limiet > 0 ? Math.min(1, verstuurd / limiet) : 0;
        const barColor = pct >= 1 ? "bg-red-500" : pct >= 0.8 ? "bg-amber-400" : "bg-emerald-400";
        const dotColor = pct >= 1 ? "bg-red-500" : pct >= 0.8 ? "bg-amber-400" : "bg-emerald-400";
        const actief = d.isActief === 1;
        const sesOk = d.sesConfigured === 1;

        return (
          <div
            key={d.id}
            className={cn(
              "bg-[var(--card)] rounded-xl p-5 border transition-colors",
              actief ? "border-[var(--border)]" : "border-[var(--border)]/40 opacity-60"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={cn("w-2 h-2 rounded-full", dotColor)} />
                  <p className="font-semibold text-[var(--text-primary)]">{d.displayNaam}</p>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{d.emailAdres}</p>
              </div>
              <div className="flex gap-1.5">
                {sesOk ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400">
                    SES ✓
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-400/10 text-red-400">
                    SES ✗
                  </span>
                )}
                {!actief && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--border)]/30 text-[var(--text-tertiary)]">
                    Inactief
                  </span>
                )}
              </div>
            </div>

            {/* Daglimiet balk */}
            <div className="mb-1">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-[var(--text-tertiary)]">Vandaag verstuurd</span>
                <span className="tabular-nums text-[var(--text-secondary)] font-medium">
                  {verstuurd} / {limiet}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--border)]/30 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", barColor)}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{d.domein}</p>
          </div>
        );
      })}
    </div>
  );
}

// ============ MAIN PAGE ============

type PageTab = "sequenties" | "mailboxen";

export default function OutreachPage() {
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [pageTab, setPageTab] = useState<PageTab>("sequenties");
  const { data, isLoading } = useOutreach(statusFilter);
  const pauseMutation = usePauseSequentie();
  const { addToast } = useToast();

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const sequenties = data?.sequenties ?? [];
  const kpis = data?.kpis;
  const statusCounts = kpis?.statusCounts;
  const scansZonderOutreach = kpis?.scansZonderOutreach ?? 0;

  const STATUS_TABS: { id: string; label: string; count?: number }[] = [
    { id: "alle", label: "Alle", count: kpis?.totaalSequenties },
    { id: "actief", label: "Actief", count: statusCounts?.actief },
    { id: "draft", label: "Concept", count: statusCounts?.draft },
    { id: "gepauzeerd", label: "Gepauzeerd", count: statusCounts?.gepauzeerd },
    { id: "gestopt", label: "Gestopt", count: statusCounts?.gestopt },
    { id: "voltooid", label: "Voltooid", count: statusCounts?.voltooid },
  ];

  function handlePause(id: number) {
    pauseMutation.mutate(id, {
      onSuccess: () => addToast("Sequentie gepauzeerd", "succes"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-8 h-8 text-[var(--accent)]" />
            <h1 className="text-3xl font-bold">Outreach</h1>
          </div>
          {/* Page tab toggle */}
          <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 gap-1">
            <button
              onClick={() => setPageTab("sequenties")}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pageTab === "sequenties"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              Sequenties
            </button>
            <button
              onClick={() => setPageTab("mailboxen")}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                pageTab === "mailboxen"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Server className="w-3.5 h-3.5" />
              Mailboxen
            </button>
          </div>
        </div>

        {pageTab === "mailboxen" ? (
          <MailboxenTab />
        ) : (
          <>
            {/* KPI Cards */}
            {kpis && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Send className="w-4 h-4 text-[var(--accent)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Verstuurd</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCount value={kpis.verstuurd} />
                  </p>
                </div>
                <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-[var(--text-secondary)]">Open Rate</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCount value={kpis.openRate} suffix="%" />
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{kpis.geopend} geopend</p>
                </div>
                <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointerClick className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-[var(--text-secondary)]">Click Rate</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCount value={kpis.clickRate} suffix="%" />
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{kpis.geklikt} geklikt</p>
                </div>
                <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-[var(--text-secondary)]">Reply Rate</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    <AnimatedCount value={kpis.replyRate} suffix="%" />
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">{kpis.beantwoord} replies</p>
                </div>
              </div>
            )}

            {/* Status filter tabs met counts */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    statusFilter === tab.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)]"
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                      statusFilter === tab.id
                        ? "bg-white/20 text-white"
                        : "bg-[var(--border)] text-[var(--text-tertiary)]"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Sequentie list */}
            {sequenties.length === 0 ? (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-12 text-center">
                  <Mail className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4 opacity-40" />
                  {scansZonderOutreach > 0 ? (
                    <>
                      <p className="text-[var(--text-primary)] font-medium mb-1">
                        Je hebt {scansZonderOutreach} Sales Engine {scansZonderOutreach === 1 ? "scan" : "scans"} klaarstaan zonder outreach
                      </p>
                      <p className="text-[var(--text-secondary)] text-sm mb-5">
                        Genereer sequenties vanuit de Sales Engine pagina
                      </p>
                      <Link
                        href="/sales-engine"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors"
                      >
                        Naar Sales Engine
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </>
                  ) : (
                    <p className="text-[var(--text-secondary)]">
                      Nog geen outreach sequenties. Genereer er een vanuit een Sales Engine scan.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sequenties.map((seq, i) => (
                  <SequentieRij
                    key={seq.id}
                    seq={seq}
                    index={i}
                    onPause={handlePause}
                    onActivate={() => addToast("Sequentie geactiveerd", "succes")}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gestoptShimmer {
          0%, 100% { box-shadow: 0 0 0 0 transparent; }
          50% { box-shadow: 0 0 12px 2px rgba(52, 211, 153, 0.08); }
        }
        .gestopt-shimmer {
          animation: gestoptShimmer 3s ease-in-out infinite;
        }
      `}</style>
    </PageTransition>
  );
}
