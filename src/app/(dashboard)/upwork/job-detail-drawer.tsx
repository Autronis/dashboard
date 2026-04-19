"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  X,
  Check,
  Ban,
  RefreshCw,
  Copy,
  Star,
  Globe,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type UpworkJob,
  formatBudget,
  formatSpent,
  formatRelativeTime,
  parseStringArray,
  statusLabel,
} from "./upwork-client";

// Re-export for page.tsx / other consumers
export type { UpworkJob };

type Action = "claim" | "dismiss" | "refetch";

type Props = {
  job: UpworkJob;
  onClose: () => void;
  onAction: () => void;
};

type DrawerTab = "details" | "screening" | "pitch";

const ACTION_LABELS: Record<Action, { doing: string; done: string; fail: string }> = {
  claim: { doing: "Claimen…", done: "Job geclaimd", fail: "Claim mislukt" },
  dismiss: { doing: "Afwijzen…", done: "Job afgewezen", fail: "Afwijzen mislukt" },
  refetch: { doing: "Opnieuw ophalen…", done: "Job ververst", fail: "Re-fetch mislukt" },
};

const TIER_COLORS: Record<"low" | "mid" | "premium", string> = {
  low: "bg-white/5 text-white/50",
  mid: "bg-[#17B8A5]/20 text-[#4DC9B4]",
  premium: "bg-yellow-500/20 text-yellow-300",
};

const TIER_LABELS_INNER: Record<"low" | "mid" | "premium", string> = {
  low: "Laag",
  mid: "Mid",
  premium: "Premium",
};

const EXP_LABELS: Record<"entry" | "intermediate" | "expert", string> = {
  entry: "Entry",
  intermediate: "Intermediate",
  expert: "Expert",
};

function proposalsTrafficLight(min: number | null): string {
  if (min === null) return "bg-white/5 text-white/50";
  if (min < 10) return "bg-emerald-500/20 text-emerald-300";
  if (min < 20) return "bg-yellow-500/20 text-yellow-300";
  return "bg-red-500/20 text-red-300";
}

function RatingStars({ rating }: { rating: number }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <div className="flex items-center gap-0.5" title={`${clamped.toFixed(1)} van 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i + 1 <= Math.floor(clamped);
        const half = !filled && i + 0.5 <= clamped;
        return (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              filled ? "text-yellow-400 fill-yellow-400" : half ? "text-yellow-400/60 fill-yellow-400/40" : "text-white/20"
            }`}
          />
        );
      })}
      <span className="ml-1 text-xs text-[var(--text-secondary)] tabular-nums">{clamped.toFixed(1)}</span>
    </div>
  );
}

export default function JobDetailDrawer({ job, onClose, onAction }: Props) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState<Action | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>("details");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const doAction = useCallback(
    async (action: Action) => {
      setBusy(action);
      try {
        const res = await fetch(`/api/upwork/jobs/${job.id}/${action}`, { method: "POST" });
        if (!res.ok) {
          let reason: string | undefined;
          try {
            const body = (await res.json()) as { fout?: string; reason?: string };
            reason = body.fout ?? body.reason;
          } catch {
            // body not JSON
          }
          addToast(
            reason ? `${ACTION_LABELS[action].fail}: ${reason}` : ACTION_LABELS[action].fail,
            "fout",
          );
          return;
        }
        addToast(ACTION_LABELS[action].done, "succes");
        if (action !== "refetch") {
          onAction();
        }
      } catch {
        addToast(`Netwerkfout bij ${action}`, "fout");
      } finally {
        setBusy(null);
      }
    },
    [job.id, addToast, onAction],
  );

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(job.url);
      addToast("URL gekopieerd", "succes");
    } catch {
      addToast("Kon niet kopiëren", "fout");
    }
  }, [job.url, addToast]);

  const screeningQs = parseStringArray(job.screeningQs);
  const categoryLabels = parseStringArray(job.categoryLabels);
  const showStatusChip = job.status !== "new" && job.status !== "viewed";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full max-w-3xl h-full bg-[var(--bg)] border-l border-[var(--border)] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)]">
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {job.budgetTier && (
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${TIER_COLORS[job.budgetTier]}`}>
                      {TIER_LABELS_INNER[job.budgetTier]}
                    </span>
                  )}
                  {showStatusChip && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/60 font-medium">
                      {statusLabel(job.status)}
                    </span>
                  )}
                  {job.claimedBy && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#17B8A5]/15 text-[#4DC9B4] font-semibold">
                      <Check className="w-3 h-3" />
                      Geclaimd door {job.claimedBy}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)] leading-tight">
                  {job.titel ?? "(geen titel)"}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition flex-shrink-0"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Primary CTA bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#17B8A5] text-black text-sm font-semibold hover:bg-[#4DC9B4] transition-colors"
              >
                Open op Upwork
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => void copyUrl()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[#17B8A5]/40 hover:text-[var(--text-primary)] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy URL
              </button>
            </div>
          </div>
        </div>

        {/* Content — 2 column */}
        <div className="flex-1 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left — client card */}
            <div className="md:col-span-1">
              <div className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Client</p>
                  <p className="font-medium text-[var(--text-primary)]">
                    {job.clientNaam ?? "Onbekend"}
                  </p>
                </div>

                {job.clientRating !== null && <RatingStars rating={job.clientRating} />}

                <div className="space-y-1.5 text-sm">
                  {job.clientReviews !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-tertiary)] text-xs">Reviews</span>
                      <span className="text-[var(--text-primary)] font-medium tabular-nums">
                        {job.clientReviews}
                      </span>
                    </div>
                  )}
                  {job.clientSpent !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-tertiary)] text-xs">Total spent</span>
                      <span className="text-[var(--text-primary)] font-medium tabular-nums">
                        ${formatSpent(job.clientSpent)}
                      </span>
                    </div>
                  )}
                  {job.clientHireRate !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-tertiary)] text-xs">Hire rate</span>
                      <span className="text-[var(--text-primary)] font-medium tabular-nums">
                        {Math.round(job.clientHireRate)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {job.country && (
                    <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                      <Globe className="w-3 h-3" />
                      {job.country}
                    </span>
                  )}
                  {job.clientVerified === 1 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-400/15 text-blue-300 font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  )}
                </div>

                {job.postedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] pt-1 border-t border-[var(--border)]">
                    <Clock className="w-3 h-3" />
                    Geplaatst {formatRelativeTime(job.postedAt)}
                  </div>
                )}
              </div>

              {/* Budget prominent */}
              <div className="mt-3 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                <p className="text-xs uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Budget</p>
                <p className="text-lg font-semibold text-[#4DC9B4] tabular-nums">
                  {formatBudget(job)}
                </p>
              </div>
            </div>

            {/* Right — tabs */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-1 border-b border-[var(--border)] mb-4">
                {(["details", "screening", "pitch"] as DrawerTab[]).map((t) => {
                  const label = t === "details" ? "Details" : t === "screening" ? "Screening" : "Pitch";
                  const isActive = activeTab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                        isActive
                          ? "text-[var(--text-primary)]"
                          : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      {label}
                      {t === "screening" && screeningQs.length > 0 && (
                        <span className="ml-1.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--border)]/50 text-[var(--text-secondary)]">
                          {screeningQs.length}
                        </span>
                      )}
                      {isActive && (
                        <motion.div
                          layoutId="drawer-tab-indicator"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#17B8A5]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "details" && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Meta chips */}
                    <div className="flex flex-wrap gap-2">
                      {job.experienceLevel && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)]">
                          {EXP_LABELS[job.experienceLevel]}
                        </span>
                      )}
                      {job.durationEstimate && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--text-secondary)]">
                          {job.durationEstimate}
                        </span>
                      )}
                      {job.proposalsRangeMin !== null && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${proposalsTrafficLight(job.proposalsRangeMin)}`}
                        >
                          {job.proposalsRangeMin}
                          {job.proposalsRangeMax !== null && job.proposalsRangeMax !== job.proposalsRangeMin
                            ? `-${job.proposalsRangeMax}`
                            : ""}{" "}
                          proposals
                        </span>
                      )}
                    </div>

                    {/* Category labels */}
                    {categoryLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {categoryLabels.map((label) => (
                          <span
                            key={label}
                            className="text-xs px-2 py-0.5 rounded-full bg-[var(--border)]/40 text-[var(--text-tertiary)]"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Beschrijving */}
                    {job.beschrijving ? (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                          Beschrijving
                        </h3>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)]">
                          {job.beschrijving}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--text-tertiary)] italic">
                        Geen beschrijving beschikbaar.
                      </p>
                    )}

                    {job.fetchError && (
                      <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                        <span className="font-semibold">Fout bij ophalen:</span> {job.fetchError}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "screening" && (
                  <motion.div
                    key="screening"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {screeningQs.length > 0 ? (
                      <ol className="text-sm space-y-3 list-decimal list-outside ml-5 text-[var(--text-secondary)]">
                        {screeningQs.map((q, i) => (
                          <li key={i} className="leading-relaxed">{q}</li>
                        ))}
                      </ol>
                    ) : (
                      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 text-center text-sm text-[var(--text-tertiary)]">
                        Geen screening vragen
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "pitch" && (
                  <motion.div
                    key="pitch"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="bg-[var(--card)] border border-dashed border-[var(--border)] rounded-xl p-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                            AI-gegenereerde pitch komt in Fase 2
                          </p>
                          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                            Voor nu: open de job op Upwork en schrijf handmatig.
                          </p>
                        </div>
                      </div>
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text-tertiary)] cursor-not-allowed opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Genereer pitch (Fase 2)
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Sticky action footer */}
        <div className="sticky bottom-0 bg-[var(--bg)]/95 backdrop-blur border-t border-[var(--border)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {!job.claimedBy && (
              <button
                disabled={busy !== null}
                onClick={() => void doAction("claim")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#17B8A5] text-black text-sm font-semibold hover:bg-[#4DC9B4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                {busy === "claim" ? ACTION_LABELS.claim.doing : "Claim"}
              </button>
            )}
            <button
              disabled={busy !== null}
              onClick={() => void doAction("dismiss")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Ban className="w-4 h-4" />
              {busy === "dismiss" ? ACTION_LABELS.dismiss.doing : "Dismiss"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => void doAction("refetch")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-auto"
            >
              <RefreshCw className={`w-4 h-4 ${busy === "refetch" ? "animate-spin" : ""}`} />
              {busy === "refetch" ? ACTION_LABELS.refetch.doing : "Re-fetch"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
