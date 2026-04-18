"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import JobDetailDrawer, { type UpworkJob } from "./job-detail-drawer";

type Tab = "sem" | "syb" | "alle";

const TAB_LABELS: Record<Tab, string> = {
  sem: "Sem",
  syb: "Syb",
  alle: "Alle",
};

export default function UpworkClient() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>("sem");
  const [jobs, setJobs] = useState<UpworkJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeLow, setIncludeLow] = useState(false);
  const [selectedJob, setSelectedJob] = useState<UpworkJob | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== "alle") params.set("account", tab);
      if (includeLow) params.set("include_low", "1");
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
    }
  }, [tab, includeLow, addToast]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#17B8A5]/10 border border-[#17B8A5]/30 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[#17B8A5]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Upwork</h1>
            <p className="text-sm text-white/50">Binnenkomende jobs en claims</p>
          </div>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#192225] border border-[#2A3538] text-sm text-white/80 hover:border-[#17B8A5] hover:text-white transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Ververs
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["sem", "syb", "alle"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium transition ${
              tab === t
                ? "bg-[#17B8A5] text-black"
                : "bg-[#192225] border border-[#2A3538] text-white/80 hover:border-[#17B8A5]/50 hover:text-white"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeLow}
            onChange={(e) => setIncludeLow(e.target.checked)}
            className="w-4 h-4 rounded border-[#2A3538] bg-[#192225] accent-[#17B8A5]"
          />
          Toon ook low-budget
        </label>
      </div>

      {loading && jobs.length === 0 && (
        <div className="text-white/50 text-sm py-8 text-center">Laden…</div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="bg-[#192225] border border-[#2A3538] rounded-2xl p-10 text-center">
          <Briefcase className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/60 text-sm">Nog geen jobs in deze weergave.</p>
          <p className="text-white/40 text-xs mt-1">
            Nieuwe Upwork mails komen automatisch binnen via de n8n ingest.
          </p>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className="text-left bg-[#192225] border border-[#2A3538] rounded-2xl p-5 hover:border-[#17B8A5] card-glow transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="font-medium text-white truncate">
                      {job.titel ?? "(geen titel)"}
                    </span>
                    {job.budgetTier && <BudgetBadge tier={job.budgetTier} />}
                    {job.status !== "new" && job.status !== "viewed" && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/60">
                        {statusLabel(job.status)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-white/60 flex gap-3 flex-wrap">
                    <span>{formatBudget(job)}</span>
                    {job.country && <span>· {job.country}</span>}
                    {job.clientRating !== null && (
                      <span>· {job.clientRating.toFixed(1)} ster</span>
                    )}
                    {job.clientSpent !== null && (
                      <span>· ${formatSpent(job.clientSpent)} spent</span>
                    )}
                    {job.proposalsRangeMin !== null && (
                      <span>
                        · {job.proposalsRangeMin}
                        {job.proposalsRangeMax !== null && job.proposalsRangeMax !== job.proposalsRangeMin
                          ? `-${job.proposalsRangeMax}`
                          : ""}{" "}
                        proposals
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/40 mt-2">
                    Gezien door: {formatSeenBy(job.seenBy)}
                    {job.claimedBy && ` · Geclaimd door ${job.claimedBy}`}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedJob && (
        <JobDetailDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onAction={() => {
            fetchJobs();
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}

function BudgetBadge({ tier }: { tier: "low" | "mid" | "premium" }) {
  const labels: Record<"low" | "mid" | "premium", string> = {
    low: "Laag",
    mid: "Mid",
    premium: "Premium",
  };
  const colors: Record<"low" | "mid" | "premium", string> = {
    low: "bg-white/5 text-white/50",
    mid: "bg-[#17B8A5]/20 text-[#4DC9B4]",
    premium: "bg-yellow-500/20 text-yellow-300",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${colors[tier]}`}>
      {labels[tier]}
    </span>
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    claimed: "Geclaimd",
    dismissed: "Afgewezen",
    submitted: "Ingediend",
    ingest_partial: "Deels geladen",
    session_expired: "Sessie verlopen",
    deleted: "Verwijderd",
  };
  return map[status] ?? status;
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

function formatSeenBy(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v): v is string => typeof v === "string")) {
      return parsed.length > 0 ? parsed.join(", ") : "onbekend";
    }
  } catch {
    // fall through
  }
  return "onbekend";
}
