"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X, Check, Ban, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

type Action = "claim" | "dismiss" | "refetch";

type Props = {
  job: UpworkJob;
  onClose: () => void;
  onAction: () => void;
};

const ACTION_LABELS: Record<Action, { doing: string; done: string; fail: string }> = {
  claim: { doing: "Claimen…", done: "Job geclaimd", fail: "Claim mislukt" },
  dismiss: { doing: "Afwijzen…", done: "Job afgewezen", fail: "Afwijzen mislukt" },
  refetch: { doing: "Opnieuw ophalen…", done: "Job ververst", fail: "Re-fetch mislukt" },
};

export default function JobDetailDrawer({ job, onClose, onAction }: Props) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState<Action | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function doAction(action: Action) {
    setBusy(action);
    try {
      const res = await fetch(`/api/upwork/jobs/${job.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        let reason: string | undefined;
        try {
          const body = (await res.json()) as { fout?: string; reason?: string };
          reason = body.fout ?? body.reason;
        } catch {
          // body not JSON, ignore
        }
        addToast(reason ? `${ACTION_LABELS[action].fail}: ${reason}` : ACTION_LABELS[action].fail, "fout");
        return;
      }
      addToast(ACTION_LABELS[action].done, "succes");
      onAction();
    } catch {
      addToast(`Netwerkfout bij ${action}`, "fout");
    } finally {
      setBusy(null);
    }
  }

  const screeningQs = parseStringArray(job.screeningQs);
  const categoryLabels = parseStringArray(job.categoryLabels);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl h-full bg-[#0E1719] border-l border-[#2A3538] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold text-white leading-tight">
              {job.titel ?? "(geen titel)"}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition flex-shrink-0"
              aria-label="Sluiten"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#17B8A5] hover:text-[#4DC9B4] hover:underline"
          >
            Open op Upwork
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow label="Budget" value={formatBudget(job)} />
            {job.country && <DetailRow label="Land" value={job.country} />}
            {job.experienceLevel && (
              <DetailRow label="Ervaring" value={experienceLabel(job.experienceLevel)} />
            )}
            {job.durationEstimate && <DetailRow label="Duur" value={job.durationEstimate} />}
            {job.clientNaam && <DetailRow label="Client" value={job.clientNaam} />}
            {job.clientRating !== null && (
              <DetailRow label="Rating" value={`${job.clientRating.toFixed(1)} ster`} />
            )}
            {job.clientSpent !== null && (
              <DetailRow label="Spent" value={`$${formatSpent(job.clientSpent)}`} />
            )}
            {job.clientHireRate !== null && (
              <DetailRow label="Hire rate" value={`${Math.round(job.clientHireRate * 100)}%`} />
            )}
            {job.clientReviews !== null && (
              <DetailRow label="Reviews" value={String(job.clientReviews)} />
            )}
            {job.proposalsRangeMin !== null && (
              <DetailRow
                label="Proposals"
                value={`${job.proposalsRangeMin}${
                  job.proposalsRangeMax !== null && job.proposalsRangeMax !== job.proposalsRangeMin
                    ? `-${job.proposalsRangeMax}`
                    : ""
                }`}
              />
            )}
          </div>

          {categoryLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categoryLabels.map((label) => (
                <span
                  key={label}
                  className="text-xs px-2 py-1 rounded-full bg-[#192225] border border-[#2A3538] text-white/70"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {job.beschrijving && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                Beschrijving
              </h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-white/80">
                {job.beschrijving}
              </p>
            </div>
          )}

          {screeningQs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">
                Screening vragen
              </h3>
              <ol className="text-sm space-y-1.5 list-decimal list-inside text-white/80">
                {screeningQs.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}

          {job.fetchError && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <span className="font-semibold">Fout bij ophalen:</span> {job.fetchError}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4 border-t border-[#2A3538]">
            {!job.claimedBy && (
              <button
                disabled={busy !== null}
                onClick={() => doAction("claim")}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#17B8A5] text-black text-sm font-medium hover:bg-[#4DC9B4] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Check className="w-4 h-4" />
                {busy === "claim" ? ACTION_LABELS.claim.doing : "Claim"}
              </button>
            )}
            {job.claimedBy && (
              <div className="px-4 py-2 rounded-2xl bg-[#17B8A5]/10 border border-[#17B8A5]/30 text-sm text-[#4DC9B4]">
                Geclaimd door {job.claimedBy}
              </div>
            )}
            <button
              disabled={busy !== null}
              onClick={() => doAction("dismiss")}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#192225] border border-[#2A3538] text-sm text-white/80 hover:text-white hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Ban className="w-4 h-4" />
              {busy === "dismiss" ? ACTION_LABELS.dismiss.doing : "Wijs af"}
            </button>
            <button
              disabled={busy !== null}
              onClick={() => doAction("refetch")}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#192225] border border-[#2A3538] text-sm text-white/70 hover:text-white hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <RefreshCw className={`w-4 h-4 ${busy === "refetch" ? "animate-spin" : ""}`} />
              {busy === "refetch" ? ACTION_LABELS.refetch.doing : "Re-fetch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
      <span className="text-white/90">{value}</span>
    </div>
  );
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    // ignore
  }
  return [];
}

function experienceLabel(level: "entry" | "intermediate" | "expert"): string {
  const map: Record<"entry" | "intermediate" | "expert", string> = {
    entry: "Entry",
    intermediate: "Intermediate",
    expert: "Expert",
  };
  return map[level];
}

function formatBudget(job: UpworkJob): string {
  if (!job.budgetType) return "Budget onbekend";
  if (job.budgetType === "hourly") {
    if (job.budgetMin !== null && job.budgetMax !== null && job.budgetMax !== job.budgetMin) {
      return `$${formatNum(job.budgetMin)}-${formatNum(job.budgetMax)}/uur`;
    }
    if (job.budgetMin !== null) return `$${formatNum(job.budgetMin)}/uur`;
    return "Uurtarief onbekend";
  }
  if (job.budgetMin !== null) return `$${formatNum(job.budgetMin)} fixed`;
  return "Fixed budget onbekend";
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(0);
}

function formatSpent(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(Math.round(n));
}
