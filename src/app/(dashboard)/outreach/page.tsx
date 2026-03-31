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
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SequentieListItem } from "@/hooks/queries/use-outreach";

// ============ STATUS CONFIG ============

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  draft:       { label: "Concept",        kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30", icon: Clock },
  actief:      { label: "Actief",         kleur: "text-emerald-400 bg-emerald-400/10", icon: Play },
  gepauzeerd:  { label: "Gepauzeerd",     kleur: "text-yellow-400 bg-yellow-400/10", icon: Pause },
  voltooid:    { label: "Voltooid",       kleur: "text-blue-400 bg-blue-400/10", icon: CheckCircle },
  gestopt:     { label: "Gestopt (reply)", kleur: "text-purple-400 bg-purple-400/10", icon: MessageCircle },
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

  return <>{display}{suffix}</>;
}

// ============ VOORTGANG BLOKJES ============

function VoortgangBlokjes({ verstuurd, totaal }: { verstuurd: number; totaal: number }) {
  if (totaal === 0) return null;
  return (
    <div
      className="flex items-center gap-0.5"
      title={`${verstuurd}/${totaal} e-mails verstuurd`}
    >
      {Array.from({ length: totaal }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-sm transition-colors",
            i < verstuurd ? "bg-[var(--accent)]" : "bg-[var(--border)]"
          )}
        />
      ))}
      <span className="ml-1 text-[10px] text-[var(--text-tertiary)] tabular-nums">
        {verstuurd}/{totaal}
      </span>
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
    <span
      className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"
      title={`${verstuurd}/${limiet} vandaag verstuurd via ${domein}`}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
      <ExternalLink className="w-3 h-3" />
      {domein}
      <span className="text-[10px] tabular-nums">
        ({verstuurd}/{limiet})
      </span>
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

  const isVandaag = dagen === 0 && uren < 24;
  const label = dagen > 0 ? `over ${dagen}d` : `over ${uren}u`;

  return (
    <span className={cn("text-xs", isVandaag ? "text-amber-400 font-medium" : "text-[var(--text-tertiary)]")}>
      {isVandaag && "📧 "}Volgende {label}
    </span>
  );
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

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

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
      {mutation.isPending ? (
        <span className="w-4 h-4 block border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      ) : armed ? "Bevestig?" : <Play className="w-4 h-4" />}
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "relative rounded-xl border transition-colors",
        isGestopt
          ? "border-emerald-500/25 bg-emerald-500/[0.03] hover:border-emerald-500/40 shadow-[0_0_16px_2px_rgba(52,211,153,0.05)]"
          : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--accent)]/30"
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/outreach/${seq.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h3 className="font-semibold text-lg truncate">
                {seq.bedrijfsnaam ?? "Onbekend"}
              </h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                  status.kleur
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
              {seq.abVariant && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold font-mono",
                    seq.abVariant === "a"
                      ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "bg-purple-500/15 text-purple-400"
                  )}
                >
                  {seq.abVariant.toUpperCase()}
                </span>
              )}
              {/* Bounced warning */}
              {seq.bounced > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {seq.bounced} bounce
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
                <span className="text-xs text-emerald-400 font-medium">
                  ✓ {seq.beantwoord} reply
                </span>
              )}
              {isActief && <VolgendeEmail geplandOp={seq.volgendeGeplandEmail} />}
              {seq.aangemaaktOp && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  {formatDatum(seq.aangemaaktOp)}
                </span>
              )}
            </div>
          </Link>

          {/* Actie knoppen */}
          <div className="flex items-center gap-2 shrink-0">
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
            <Link
              href={`/outreach/${seq.id}`}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/40 transition-colors"
              title="Bekijken"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============ FUNNEL KPI ROW ============

function FunnelKpis({
  verstuurd,
  geopend,
  geklikt,
  beantwoord,
  openRate,
  clickRate,
  replyRate,
}: {
  verstuurd: number;
  geopend: number;
  geklikt: number;
  beantwoord: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}) {
  const stappen = [
    {
      icon: Send,
      iconColor: "text-[var(--accent)]",
      iconBg: "bg-[var(--accent)]/10",
      label: "Verstuurd",
      value: verstuurd,
      sub: null as string | null,
      barPct: 100,
      barColor: "bg-[var(--accent)]",
    },
    {
      icon: Eye,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
      label: "Open Rate",
      value: openRate,
      suffix: "%",
      sub: `${geopend} geopend`,
      barPct: openRate,
      barColor: "bg-blue-400",
    },
    {
      icon: MousePointerClick,
      iconColor: "text-purple-400",
      iconBg: "bg-purple-400/10",
      label: "Click Rate",
      value: clickRate,
      suffix: "%",
      sub: `${geklikt} geklikt`,
      barPct: clickRate,
      barColor: "bg-purple-400",
    },
    {
      icon: MessageCircle,
      iconColor: replyRate > 0 ? "text-emerald-400" : "text-[var(--text-tertiary)]",
      iconBg: replyRate > 0 ? "bg-emerald-400/10" : "bg-[var(--border)]/20",
      label: "Reply Rate",
      value: replyRate,
      suffix: "%",
      sub: `${beantwoord} ${beantwoord === 1 ? "reply" : "replies"}`,
      barPct: replyRate,
      barColor: "bg-emerald-400",
      highlight: replyRate > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stappen.map((stap, i) => {
        const Icon = stap.icon;
        return (
          <motion.div
            key={stap.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            className={cn(
              "bg-[var(--card)] rounded-xl p-5 border transition-colors",
              stap.highlight
                ? "border-emerald-500/30 shadow-[0_0_20px_2px_rgba(52,211,153,0.06)]"
                : "border-[var(--border)]"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-1.5 rounded-lg", stap.iconBg)}>
                <Icon className={cn("w-3.5 h-3.5", stap.iconColor)} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">{stap.label}</span>
              {/* Funnel arrow connector — hidden on last */}
              {i < stappen.length - 1 && (
                <ChevronDown className="w-3 h-3 text-[var(--border)] ml-auto md:hidden" />
              )}
            </div>
            <p className="text-2xl font-bold tabular-nums">
              <AnimatedCount value={stap.value} suffix={"suffix" in stap ? stap.suffix : ""} />
            </p>
            {stap.sub && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{stap.sub}</p>
            )}
            {/* Conversion bar */}
            <div className="mt-3 h-1 bg-[var(--border)]/30 rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", stap.barColor)}
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min(stap.barPct, 100)}%` }}
                transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.1 + 0.2 }}
              />
            </div>
          </motion.div>
        );
      })}
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
              actief ? "border-[var(--border)] hover:border-[var(--accent)]/30" : "border-[var(--border)]/40 opacity-60"
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
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-400/10 text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    SES
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
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-[var(--text-tertiary)]">Vandaag verstuurd</span>
                <span className="tabular-nums text-[var(--text-secondary)] font-medium">
                  {verstuurd} / {limiet}
                </span>
              </div>
              <div className="h-2 bg-[var(--border)]/30 rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", barColor)}
                  initial={{ width: "0%" }}
                  animate={{ width: `${pct * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
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

// ============ SORT TYPES ============

type SorteerOptie = "datum" | "naam" | "status";

function sorteerSequenties(lijst: SequentieListItem[], optie: SorteerOptie): SequentieListItem[] {
  return [...lijst].sort((a, b) => {
    if (optie === "naam") {
      return (a.bedrijfsnaam ?? "").localeCompare(b.bedrijfsnaam ?? "");
    }
    if (optie === "status") {
      const order = ["actief", "gepauzeerd", "draft", "gestopt", "voltooid"];
      return order.indexOf(a.status) - order.indexOf(b.status);
    }
    // datum (default: nieuwste eerst)
    return (b.aangemaaktOp ?? "").localeCompare(a.aangemaaktOp ?? "");
  });
}

// ============ MAIN PAGE ============

type PageTab = "sequenties" | "mailboxen";

export default function OutreachPage() {
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [pageTab, setPageTab] = useState<PageTab>("sequenties");
  const [zoek, setZoek] = useState("");
  const [sorteer, setSorteer] = useState<SorteerOptie>("datum");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useOutreach(statusFilter);
  const pauseMutation = usePauseSequentie();
  const { addToast } = useToast();

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const alleSequenties = data?.sequenties ?? [];
  const kpis = data?.kpis;
  const statusCounts = kpis?.statusCounts;
  const scansZonderOutreach = kpis?.scansZonderOutreach ?? 0;

  // Filter + sort
  const zoekTerm = zoek.toLowerCase().trim();
  const gefilterdeSequenties = sorteerSequenties(
    zoekTerm
      ? alleSequenties.filter(
          (s) =>
            s.bedrijfsnaam?.toLowerCase().includes(zoekTerm) ||
            s.email?.toLowerCase().includes(zoekTerm) ||
            s.domein?.toLowerCase().includes(zoekTerm)
        )
      : alleSequenties,
    sorteer
  );

  const STATUS_TABS: { id: string; label: string; count?: number }[] = [
    { id: "alle", label: "Alle", count: kpis?.totaalSequenties },
    { id: "actief", label: "Actief", count: statusCounts?.actief },
    { id: "draft", label: "Concept", count: statusCounts?.draft },
    { id: "gepauzeerd", label: "Gepauzeerd", count: statusCounts?.gepauzeerd },
    { id: "gestopt", label: "Gestopt", count: statusCounts?.gestopt },
    { id: "voltooid", label: "Voltooid", count: statusCounts?.voltooid },
  ];

  const SORTEER_LABELS: Record<SorteerOptie, string> = {
    datum: "Nieuwste eerst",
    naam: "Naam A-Z",
    status: "Status",
  };

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
            <div>
              <h1 className="text-3xl font-bold">Outreach</h1>
              {kpis && kpis.actief > 0 && (
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                  {kpis.actief} actieve {kpis.actief === 1 ? "sequentie" : "sequenties"} · {kpis.totaalSequenties} totaal
                </p>
              )}
            </div>
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
            {/* KPI Funnel */}
            {kpis && (
              <FunnelKpis
                verstuurd={kpis.verstuurd}
                geopend={kpis.geopend}
                geklikt={kpis.geklikt}
                beantwoord={kpis.beantwoord}
                openRate={kpis.openRate}
                clickRate={kpis.clickRate}
                replyRate={kpis.replyRate}
              />
            )}

            {/* Zoek + Sort + Status filter row */}
            <div className="space-y-3">
              {/* Search + Sort */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    value={zoek}
                    onChange={(e) => setZoek(e.target.value)}
                    placeholder="Zoek op bedrijf, e-mail of domein..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                  />
                  {zoek && (
                    <button
                      onClick={() => setZoek("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Sort dropdown */}
                <div className="relative" ref={sortRef}>
                  <button
                    onClick={() => setSortDropdownOpen((o) => !o)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {SORTEER_LABELS[sorteer]}
                    {sortDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <AnimatePresence>
                    {sortDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-1 z-20 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                      >
                        {(Object.keys(SORTEER_LABELS) as SorteerOptie[]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => { setSorteer(opt); setSortDropdownOpen(false); }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm transition-colors",
                              sorteer === opt
                                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                                : "text-[var(--text-secondary)] hover:bg-[var(--border)]/30 hover:text-[var(--text-primary)]"
                            )}
                          >
                            {SORTEER_LABELS[opt]}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Status filter tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      statusFilter === tab.id
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                          statusFilter === tab.id
                            ? "bg-white/20 text-white"
                            : "bg-[var(--border)] text-[var(--text-tertiary)]"
                        )}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sequentie list */}
            {gefilterdeSequenties.length === 0 ? (
              <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="p-12 text-center">
                  {zoek ? (
                    <>
                      <Search className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3 opacity-40" />
                      <p className="text-[var(--text-primary)] font-medium mb-1">
                        Geen resultaten voor &ldquo;{zoek}&rdquo;
                      </p>
                      <button
                        onClick={() => setZoek("")}
                        className="text-sm text-[var(--accent)] hover:opacity-80 transition-opacity"
                      >
                        Zoekopdracht wissen
                      </button>
                    </>
                  ) : (
                    <>
                      <Mail className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4 opacity-40" />
                      {scansZonderOutreach > 0 ? (
                        <>
                          <p className="text-[var(--text-primary)] font-medium mb-1">
                            {scansZonderOutreach} Sales Engine{" "}
                            {scansZonderOutreach === 1 ? "scan" : "scans"} klaarstaan
                          </p>
                          <p className="text-[var(--text-secondary)] text-sm mb-5">
                            Genereer sequenties vanuit de Sales Engine pagina
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[var(--text-primary)] font-medium mb-1">
                            Nog geen outreach sequenties
                          </p>
                          <p className="text-[var(--text-secondary)] text-sm mb-5">
                            Scan een bedrijf via Sales Engine om een sequentie te genereren
                          </p>
                        </>
                      )}
                      <Link
                        href="/sales-engine"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors"
                      >
                        Naar Sales Engine
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {zoek && (
                  <p className="text-xs text-[var(--text-tertiary)] px-1">
                    {gefilterdeSequenties.length} resultaat{gefilterdeSequenties.length !== 1 ? "en" : ""} voor &ldquo;{zoek}&rdquo;
                  </p>
                )}
                <AnimatePresence>
                  {gefilterdeSequenties.map((seq, i) => (
                    <SequentieRij
                      key={seq.id}
                      seq={seq}
                      index={i}
                      onPause={handlePause}
                      onActivate={() => addToast("Sequentie geactiveerd", "succes")}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
