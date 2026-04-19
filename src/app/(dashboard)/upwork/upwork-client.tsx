"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  RefreshCw,
  Target,
  Sparkles,
  Euro,
  TrendingUp,
  AlertCircle,
  Copy,
  Search,
  ArrowUpDown,
  ChevronDown,
  Flame,
  Clock,
  Star,
  CheckCircle,
  ShieldCheck,
  Globe,
  Users,
  X,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import JobDetailDrawer from "./job-detail-drawer";

// ─── Types ───
export type UpworkJob = {
  id: number;
  jobId: string;
  url: string;
  titel: string | null;
  beschrijving: string | null;
  budgetType: "fixed" | "hourly" | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetTier: "low" | "mid" | "premium" | null;
  country: string | null;
  postedAt: string | null;
  durationEstimate: string | null;
  experienceLevel: "entry" | "intermediate" | "expert" | null;
  categoryLabels: string | null;
  clientNaam: string | null;
  clientVerified: number | null;
  clientSpent: number | null;
  clientHireRate: number | null;
  clientReviews: number | null;
  clientRating: number | null;
  screeningQs: string | null;
  proposalsRangeMin: number | null;
  proposalsRangeMax: number | null;
  seenBy: string;
  claimedBy: string | null;
  claimedAt: string | null;
  status: string;
  fetchError: string | null;
};

type Tab = "sem" | "syb" | "alle";
type TierFilter = "low" | "mid" | "premium" | "unknown";
type SortOption = "nieuwst" | "budget" | "rating" | "proposals";

const TAB_LABELS: Record<Tab, string> = { sem: "Sem", syb: "Syb", alle: "Alle" };

const SORT_LABELS: Record<SortOption, string> = {
  nieuwst: "Nieuwst",
  budget: "Budget hoog-laag",
  rating: "Client rating",
  proposals: "Minste proposals",
};

const TIER_RING: Record<TierFilter, string> = {
  low: "ring-[var(--text-tertiary)]/50",
  mid: "ring-[#17B8A5]/50",
  premium: "ring-yellow-400/60",
  unknown: "ring-white/20",
};

const TIER_LABELS: Record<TierFilter, string> = {
  low: "Low",
  mid: "Mid",
  premium: "Premium",
  unknown: "Onbekend",
};

// ─── useCountUp (inlined, matches sales-engine pattern) ───
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start: number | null = null;
    let rafId: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return value;
}

// ─── Helpers (exported so drawer can reuse) ───
export function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // fall through
  }
  return [];
}

export function formatBudget(job: UpworkJob): string {
  if (!job.budgetType) return "Budget onbekend";
  if (job.budgetType === "hourly") {
    if (job.budgetMin !== null && job.budgetMax !== null && job.budgetMax !== job.budgetMin) {
      return `$${formatNum(job.budgetMin)}-${formatNum(job.budgetMax)}/uur`;
    }
    if (job.budgetMin !== null) return `$${formatNum(job.budgetMin)}/uur`;
    return "Uurtarief onbekend";
  }
  if (job.budgetMin !== null && job.budgetMax !== null && job.budgetMax !== job.budgetMin) {
    return `$${formatNum(job.budgetMin)}-${formatNum(job.budgetMax)} fixed`;
  }
  if (job.budgetMin !== null) return `$${formatNum(job.budgetMin)} fixed`;
  return "Fixed budget onbekend";
}

export function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(0);
}

export function formatSpent(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return String(Math.round(n));
}

export function formatEur(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `€${Math.round(value / 1000)}k`;
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${Math.round(value).toLocaleString("nl-NL")}`;
}

export function postedMinutesAgo(postedAt: string | null): number | null {
  if (!postedAt) return null;
  const posted = new Date(postedAt).getTime();
  if (Number.isNaN(posted)) return null;
  return Math.max(0, Math.floor((Date.now() - posted) / 60000));
}

export function formatRelativeTime(postedAt: string | null): string {
  const mins = postedMinutesAgo(postedAt);
  if (mins === null) return "onbekend";
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: "Nieuw",
    viewed: "Gezien",
    claimed: "Geclaimd",
    dismissed: "Afgewezen",
    submitted: "Ingediend",
    ingest_partial: "Deels geladen",
    session_expired: "Sessie verlopen",
    deleted: "Verwijderd",
  };
  return map[status] ?? status;
}

// ─── Budget badge ───
function BudgetBadge({ tier }: { tier: "low" | "mid" | "premium" }) {
  const labels = { low: "Laag", mid: "Mid", premium: "Premium" } as const;
  const colors = {
    low: "bg-white/5 text-white/50",
    mid: "bg-[#17B8A5]/20 text-[#4DC9B4]",
    premium: "bg-yellow-500/20 text-yellow-300",
  } as const;
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${colors[tier]}`}>
      {labels[tier]}
    </span>
  );
}

// ─── KPI Card ───
function KpiCard({
  icon: Icon,
  iconKleur,
  label,
  value,
  sub,
  suffix = "",
  prefix = "",
  formatted,
  delay = 0,
}: {
  icon: typeof TrendingUp;
  iconKleur: string;
  label: string;
  value: number;
  sub: string;
  suffix?: string;
  prefix?: string;
  formatted?: string;
  delay?: number;
}) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${iconKleur}`} />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums">
        {formatted ?? `${prefix}${animated}${suffix}`}
      </p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</p>
    </motion.div>
  );
}

// ─── Seen-by avatars ───
function SeenByAvatars({ seenByRaw }: { seenByRaw: string }) {
  const names = parseStringArray(seenByRaw);
  if (names.length === 0) return null;
  return (
    <div className="flex items-center -space-x-1.5">
      {names.slice(0, 3).map((name) => {
        const initial = name.charAt(0).toUpperCase();
        const isSem = name.toLowerCase() === "sem";
        const bg = isSem ? "bg-[#17B8A5]/80" : "bg-purple-500/80";
        return (
          <span
            key={name}
            title={`Gezien door ${name}`}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black border border-[var(--card)] ${bg}`}
          >
            {initial}
          </span>
        );
      })}
    </div>
  );
}

// ─── Rich job card ───
function JobCard({
  job,
  index,
  onOpen,
  onClaim,
  onDismiss,
  actionBusy,
}: {
  job: UpworkJob;
  index: number;
  onOpen: (job: UpworkJob) => void;
  onClaim: (job: UpworkJob) => void;
  onDismiss: (job: UpworkJob) => void;
  actionBusy: boolean;
}) {
  const categoryLabels = parseStringArray(job.categoryLabels);
  const minsAgo = postedMinutesAgo(job.postedAt);
  const isNew = minsAgo !== null && minsAgo < 60;
  const isPremium = job.budgetTier === "premium";

  const pills: Array<{ icon: typeof Star; text: string; kleur: string }> = [];
  if (job.clientRating !== null) {
    pills.push({
      icon: Star,
      text: job.clientRating.toFixed(1),
      kleur: "text-yellow-400",
    });
  }
  if (job.clientSpent !== null) {
    pills.push({
      icon: Euro,
      text: `$${formatSpent(job.clientSpent)} spent`,
      kleur: "text-[var(--text-secondary)]",
    });
  }
  if (job.clientHireRate !== null) {
    pills.push({
      icon: CheckCircle,
      text: `${Math.round(job.clientHireRate)}% hire rate`,
      kleur: "text-emerald-400",
    });
  }
  if (job.clientVerified === 1) {
    pills.push({
      icon: ShieldCheck,
      text: "Verified",
      kleur: "text-blue-400",
    });
  }

  const proposalsText =
    job.proposalsRangeMin !== null
      ? `${job.proposalsRangeMin}${
          job.proposalsRangeMax !== null && job.proposalsRangeMax !== job.proposalsRangeMin
            ? `-${job.proposalsRangeMax}`
            : ""
        } proposals`
      : null;

  const showStatusChip = job.status !== "new" && job.status !== "viewed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.25 }}
      className={`group relative bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 card-glow cursor-pointer transition-all hover:border-[#17B8A5]/40 ${
        isPremium ? "shadow-[0_0_14px_rgba(23,184,165,0.2)]" : ""
      }`}
      onClick={() => onOpen(job)}
    >
      {/* Row 1 — title strip */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 min-w-0 text-base font-semibold text-[var(--text-primary)] line-clamp-2">
          {job.titel ?? "(geen titel)"}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isNew && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
              <Flame className="w-3 h-3" />
              Nieuw
            </span>
          )}
          {job.budgetTier && <BudgetBadge tier={job.budgetTier} />}
          {showStatusChip && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/60 font-medium">
              {statusLabel(job.status)}
            </span>
          )}
        </div>
      </div>

      {/* Row 2 — budget prominent */}
      <div className="mt-3 flex items-center gap-2">
        {job.budgetType === "hourly" ? (
          <Clock className="w-4 h-4 text-[#4DC9B4]" />
        ) : (
          <Euro className="w-4 h-4 text-[#4DC9B4]" />
        )}
        <span className={`text-lg font-semibold tabular-nums ${job.budgetType ? "text-[#4DC9B4]" : "text-[var(--text-tertiary)]"}`}>
          {formatBudget(job)}
        </span>
      </div>

      {/* Row 3 — client strip */}
      {pills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          {pills.map((p, i) => (
            <span key={i} className={`inline-flex items-center gap-1 ${p.kleur}`}>
              <p.icon className={`w-3.5 h-3.5 ${p.icon === Star ? "fill-yellow-400" : ""}`} />
              <span>{p.text}</span>
            </span>
          ))}
        </div>
      )}

      {/* Row 4 — category chips */}
      {categoryLabels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {categoryLabels.slice(0, 6).map((c) => (
            <span
              key={c}
              className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--text-tertiary)]"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Row 5 — description preview */}
      {job.beschrijving && (
        <p className="mt-3 text-sm text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
          {job.beschrijving}
        </p>
      )}

      {/* Row 6 — footer strip */}
      <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-[var(--border)]/60">
        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] flex-wrap min-w-0">
          {job.country && (
            <span className="inline-flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {job.country}
            </span>
          )}
          {job.postedAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(job.postedAt)}
            </span>
          )}
          {proposalsText && (
            <span className="inline-flex items-center gap-1">
              <Users className="w-3 h-3" />
              {proposalsText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <SeenByAvatars seenByRaw={job.seenBy} />
          {job.claimedBy && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#17B8A5]/15 text-[#4DC9B4] font-medium">
              <Check className="w-3 h-3" />
              Geclaimd door {job.claimedBy}
            </span>
          )}
        </div>
      </div>

      {/* Quick actions — hover float top-right */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!job.claimedBy && (
          <button
            disabled={actionBusy}
            onClick={(e) => {
              e.stopPropagation();
              onClaim(job);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#17B8A5] text-black text-xs font-semibold hover:bg-[#4DC9B4] transition-colors disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            Claim
          </button>
        )}
        <button
          disabled={actionBusy}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(job);
          }}
          title="Afwijzen"
          className="p-1.5 rounded-lg bg-[var(--bg)]/80 border border-[var(--border)] text-[var(--text-tertiary)] hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main component ───
export default function UpworkClient() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>("sem");
  const [jobs, setJobs] = useState<UpworkJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<UpworkJob | null>(null);
  const [tierFilters, setTierFilters] = useState<Set<TierFilter>>(
    new Set<TierFilter>(["low", "mid", "premium", "unknown"]),
  );
  const [sortBy, setSortBy] = useState<SortOption>("nieuwst");
  const [sortOpen, setSortOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const hasFetchedOnce = useRef(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // We always fetch with include_low=1 — tier filtering happens client-side
  const fetchJobs = useCallback(async () => {
    if (!hasFetchedOnce.current) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "alle") params.set("account", tab);
      params.set("include_low", "1");
      const res = await fetch(`/api/upwork/jobs?${params.toString()}`);
      if (!res.ok) {
        addToast("Kon jobs niet laden", "fout");
        setJobs([]);
        return;
      }
      const data = (await res.json()) as { jobs?: UpworkJob[] };
      setJobs(data.jobs ?? []);
    } catch {
      addToast("Netwerkfout bij laden jobs", "fout");
      setJobs([]);
    } finally {
      setLoading(false);
      hasFetchedOnce.current = true;
    }
  }, [tab, addToast]);

  useEffect(() => {
    void fetchJobs();
    const interval = setInterval(() => {
      void fetchJobs();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ─── Actions ───
  const doAction = useCallback(
    async (job: UpworkJob, action: "claim" | "dismiss") => {
      setActionBusy(true);
      try {
        const res = await fetch(`/api/upwork/jobs/${job.id}/${action}`, { method: "POST" });
        if (!res.ok) {
          let reason: string | undefined;
          try {
            const body = (await res.json()) as { fout?: string; reason?: string };
            reason = body.fout ?? body.reason;
          } catch {
            // ignore
          }
          addToast(
            reason
              ? `${action === "claim" ? "Claim mislukt" : "Afwijzen mislukt"}: ${reason}`
              : action === "claim"
                ? "Claim mislukt"
                : "Afwijzen mislukt",
            "fout",
          );
          return;
        }
        addToast(action === "claim" ? "Job geclaimd" : "Job afgewezen", "succes");
        await fetchJobs();
      } catch {
        addToast(`Netwerkfout bij ${action}`, "fout");
      } finally {
        setActionBusy(false);
      }
    },
    [addToast, fetchJobs],
  );

  const handleClaim = useCallback((job: UpworkJob) => void doAction(job, "claim"), [doAction]);
  const handleDismiss = useCallback((job: UpworkJob) => void doAction(job, "dismiss"), [doAction]);

  const copyLoginCommand = useCallback(
    async (account: "sem" | "syb" | "beide") => {
      const cmd =
        account === "beide"
          ? "npm run upwork:login -- sem && npm run upwork:login -- syb"
          : `npm run upwork:login -- ${account}`;
      try {
        await navigator.clipboard.writeText(cmd);
        addToast("Commando gekopieerd", "succes");
      } catch {
        addToast("Kon niet kopiëren", "fout");
      }
    },
    [addToast],
  );

  // ─── Derived ───
  const tabCounts = useMemo(() => {
    // Counts reflect the current fetched set (already scoped to tab) — so
    // "alle" count == jobs.length when tab='alle'; when tab='sem' we can't
    // know syb's count without a second fetch. Show counts for current tab only.
    return {
      sem: tab === "sem" || tab === "alle" ? jobs.filter((j) => parseStringArray(j.seenBy).includes("sem")).length : null,
      syb: tab === "syb" || tab === "alle" ? jobs.filter((j) => parseStringArray(j.seenBy).includes("syb")).length : null,
      alle: tab === "alle" ? jobs.length : null,
    };
  }, [jobs, tab]);

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    let result = jobs.filter((j) => {
      const tier: TierFilter = j.budgetTier ?? "unknown";
      if (!tierFilters.has(tier)) return false;
      if (searchLower && !(j.titel ?? "").toLowerCase().includes(searchLower)) return false;
      return true;
    });

    if (sortBy === "budget") {
      result = [...result].sort((a, b) => (b.budgetMin ?? -1) - (a.budgetMin ?? -1));
    } else if (sortBy === "rating") {
      result = [...result].sort((a, b) => (b.clientRating ?? -1) - (a.clientRating ?? -1));
    } else if (sortBy === "proposals") {
      result = [...result].sort(
        (a, b) => (a.proposalsRangeMin ?? Infinity) - (b.proposalsRangeMin ?? Infinity),
      );
    } else {
      // nieuwst — by postedAt desc, nulls last
      result = [...result].sort((a, b) => {
        const at = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const bt = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return bt - at;
      });
    }

    return result;
  }, [jobs, tierFilters, sortBy, search]);

  // Status-bar stats (against full fetched set)
  const stats = useMemo(() => {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;
    const nieuw1h = jobs.filter((j) => {
      if (!j.postedAt) return false;
      const t = new Date(j.postedAt).getTime();
      return !Number.isNaN(t) && now - t < hourMs;
    }).length;
    const nieuw24h = jobs.filter((j) => {
      if (!j.postedAt) return false;
      const t = new Date(j.postedAt).getTime();
      return !Number.isNaN(t) && now - t < dayMs;
    }).length;
    const geclaimd = jobs.filter((j) => j.claimedBy !== null).length;
    const sessionExpired = jobs.filter((j) => j.status === "session_expired").length;
    const premium = jobs.filter((j) => j.budgetTier === "premium").length;
    const pipelineWaarde = jobs.reduce((sum, j) => sum + (j.budgetMin ?? 0), 0);
    const claimRate = jobs.length > 0 ? Math.round((geclaimd / jobs.length) * 100) : 0;
    return { nieuw1h, nieuw24h, geclaimd, sessionExpired, premium, pipelineWaarde, claimRate };
  }, [jobs]);

  // Which accounts have session_expired status?
  const expiredAccounts = useMemo(() => {
    const hasSem = jobs.some(
      (j) => j.status === "session_expired" && parseStringArray(j.seenBy).includes("sem"),
    );
    const hasSyb = jobs.some(
      (j) => j.status === "session_expired" && parseStringArray(j.seenBy).includes("syb"),
    );
    if (hasSem && hasSyb) return "beide" as const;
    if (hasSem) return "sem" as const;
    if (hasSyb) return "syb" as const;
    return null;
  }, [jobs]);

  // ─── Tier toggle ───
  const toggleTier = useCallback((tier: TierFilter) => {
    setTierFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      // Guard: never allow empty set — treat as "alle"
      if (next.size === 0) {
        return new Set<TierFilter>(["low", "mid", "premium", "unknown"]);
      }
      return next;
    });
  }, []);

  const allTiersActive = tierFilters.size === 4;

  const resetFilters = useCallback(() => {
    setTierFilters(new Set<TierFilter>(["low", "mid", "premium", "unknown"]));
    setSearch("");
    setTab("alle");
  }, []);

  // ─── Render ───
  if (loading && jobs.length === 0) {
    return (
      <PageTransition>
        <div className="p-6 space-y-5 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <Skeleton className="h-8 w-40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 space-y-5 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-[#17B8A5]" />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Upwork</h1>
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 flex-wrap">
                <span>{jobs.length} nieuwe jobs</span>
                <span>·</span>
                <span>{stats.geclaimd} geclaimd</span>
                {stats.sessionExpired > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-400">{stats.sessionExpired} session expired</span>
                  </>
                )}
                {stats.nieuw1h > 0 && (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
                    {stats.nieuw24h} nieuw vandaag
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => void fetchJobs()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[#17B8A5] hover:text-[var(--text-primary)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Ververs
          </button>
        </div>

        {/* Session expired banner */}
        {expiredAccounts && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-400/10 border border-red-400/30 rounded-xl p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-300">
                Sessie verlopen voor {expiredAccounts === "beide" ? "sem en syb" : expiredAccounts}
              </p>
              <p className="text-xs text-red-300/80 mt-0.5 font-mono">
                run{" "}
                <code className="px-1.5 py-0.5 rounded bg-red-500/10">
                  npm run upwork:login -- {expiredAccounts === "beide" ? "<account>" : expiredAccounts}
                </code>
              </p>
            </div>
            <button
              onClick={() => void copyLoginCommand(expiredAccounts)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-400/30 text-xs font-medium text-red-200 hover:bg-red-500/25 transition-colors flex-shrink-0"
            >
              <Copy className="w-3 h-3" />
              Kopieer
            </button>
          </motion.div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Target}
            iconKleur="text-[#17B8A5]"
            label="Nieuwe jobs (24u)"
            value={stats.nieuw24h}
            sub={`van ${jobs.length} totaal`}
            delay={0}
          />
          <KpiCard
            icon={Sparkles}
            iconKleur="text-yellow-400"
            label="Premium opportunities"
            value={stats.premium}
            sub="hoogste budget-categorie"
            delay={0.05}
          />
          <KpiCard
            icon={Euro}
            iconKleur="text-emerald-400"
            label="Pipeline-waarde"
            value={stats.pipelineWaarde}
            sub="bij min. budget"
            formatted={formatEur(stats.pipelineWaarde)}
            delay={0.1}
          />
          <KpiCard
            icon={TrendingUp}
            iconKleur="text-blue-400"
            label="Claim rate (week)"
            value={stats.claimRate}
            suffix="%"
            sub="van alle gezien"
            delay={0.15}
          />
        </div>

        {/* Account tabs + tier filter + sort + search */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Account tabs */}
            <div className="flex items-center gap-1">
              {(["sem", "syb", "alle"] as Tab[]).map((t) => {
                const count = tabCounts[t];
                const isActive = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? "bg-[#17B8A5] text-black"
                        : "bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#17B8A5]/40 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {TAB_LABELS[t]}
                    {count !== null && (
                      <span
                        className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                          isActive ? "bg-black/20 text-black" : "bg-[var(--bg)] text-[var(--text-tertiary)]"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-36 max-w-60 ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Zoek in titels…"
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[#17B8A5]/50"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setSortOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[#17B8A5]/40 transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
                {SORT_LABELS[sortBy]}
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-10 overflow-hidden min-w-[180px]"
                  >
                    {(["nieuwst", "budget", "rating", "proposals"] as SortOption[]).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => {
                          setSortBy(opt);
                          setSortOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          sortBy === opt
                            ? "text-[#17B8A5] bg-[#17B8A5]/10"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]/50"
                        }`}
                      >
                        {SORT_LABELS[opt]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Tier filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() =>
                setTierFilters(new Set<TierFilter>(["low", "mid", "premium", "unknown"]))
              }
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                allTiersActive
                  ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)] ring-1 ring-[var(--text-primary)]/20"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]/30"
              }`}
            >
              Alle tiers
            </button>
            {(["mid", "premium", "low", "unknown"] as TierFilter[]).map((tier) => {
              const isActive = tierFilters.has(tier);
              return (
                <button
                  key={tier}
                  onClick={() => toggleTier(tier)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? `bg-[var(--card)] text-[var(--text-primary)] ring-1 ${TIER_RING[tier]}`
                      : "bg-[var(--card)]/50 border border-[var(--border)]/60 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {TIER_LABELS[tier]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Job list */}
        {filtered.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-12 text-center">
            <Briefcase className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-base font-medium text-[var(--text-primary)] mb-1">
              Geen jobs in deze weergave.
            </p>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Probeer filters aan te passen of wacht op nieuwe alerts.
            </p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[#17B8A5]/40 hover:text-[var(--text-primary)] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  index={i}
                  onOpen={setSelectedJob}
                  onClaim={handleClaim}
                  onDismiss={handleDismiss}
                  actionBusy={actionBusy}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {selectedJob && (
          <JobDetailDrawer
            job={selectedJob}
            onClose={() => setSelectedJob(null)}
            onAction={() => {
              void fetchJobs();
              setSelectedJob(null);
            }}
          />
        )}
      </div>
    </PageTransition>
  );
}
