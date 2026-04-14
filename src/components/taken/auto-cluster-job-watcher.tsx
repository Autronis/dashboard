"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "autronis:auto-cluster-job";
const EVENT_START = "autronis:auto-cluster-started";
const POLL_INTERVAL = 3000;

interface AutoClusterJob {
  id: string;
  status: "running" | "done" | "error";
  totaal: number;
  bijgewerkt: number;
  perCluster: Record<string, number>;
  gestartOp: string;
  klaarOp: string | null;
  fout: string | null;
}

/**
 * Globale watcher voor auto-cluster jobs. Leest jobId uit localStorage en
 * polt elke 3s de status endpoint. Blijft actief over page navigations
 * heen want hij is gemount in AppShell. Zodra een job klaar is toont 'ie
 * een final toast en invalideert de taken query.
 *
 * Start een job door te posten naar /api/taken/auto-cluster en dan te
 * firen:
 *   window.dispatchEvent(new CustomEvent("autronis:auto-cluster-started", {
 *     detail: { jobId }
 *   }));
 * Of gewoon: localStorage.setItem("autronis:auto-cluster-job", jobId) +
 * dispatch event (zodat deze watcher direct start met pollen).
 */
export function AutoClusterJobWatcher() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [job, setJob] = useState<AutoClusterJob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  // Initial load van jobId uit localStorage (na mount)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setJobId(stored);
  }, []);

  // Listener voor nieuwe jobs
  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<{ jobId: string }>).detail;
      if (detail?.jobId) {
        localStorage.setItem(STORAGE_KEY, detail.jobId);
        setJobId(detail.jobId);
        lastStatusRef.current = null;
      }
    }
    window.addEventListener(EVENT_START, onStart);
    return () => window.removeEventListener(EVENT_START, onStart);
  }, []);

  // Polling loop
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!jobId) {
      setJob(null);
      return;
    }

    async function poll() {
      try {
        const res = await fetch(`/api/taken/auto-cluster/status?jobId=${jobId}`);
        if (!res.ok) {
          if (res.status === 404) {
            // Job verlopen / opgeruimd — stop met pollen en wis localStorage
            localStorage.removeItem(STORAGE_KEY);
            setJobId(null);
            setJob(null);
          }
          return;
        }
        const data = (await res.json()) as { job: AutoClusterJob };
        setJob(data.job);

        // Detecteer de overgang naar done/error en show toast 1x
        if (data.job.status !== "running" && lastStatusRef.current !== data.job.status) {
          lastStatusRef.current = data.job.status;
          if (data.job.status === "done") {
            const summary = Object.entries(data.job.perCluster)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            addToast(
              `Auto-cluster klaar: ${data.job.bijgewerkt} van ${data.job.totaal} taken gelabeld${
                summary ? ` — ${summary}` : ""
              }`,
              "succes"
            );
            queryClient.invalidateQueries({ queryKey: ["taken"] });
          } else if (data.job.status === "error") {
            addToast(
              `Auto-cluster mislukt: ${data.job.fout ?? "onbekende fout"}`,
              "fout"
            );
          }
          // Clear na 10 sec zodat de user de final state ziet
          setTimeout(() => {
            localStorage.removeItem(STORAGE_KEY);
            setJobId(null);
            setJob(null);
          }, 10_000);
        }
      } catch {
        // netwerkfout — blijf pollen
      }
    }

    poll(); // direct eerste keer
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId, addToast, queryClient]);

  if (!job) return null;

  const progressPct =
    job.totaal > 0 ? Math.round((job.bijgewerkt / job.totaal) * 100) : 0;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
      <div
        className={cn(
          "rounded-2xl border shadow-xl backdrop-blur-md p-4",
          job.status === "done"
            ? "bg-emerald-500/10 border-emerald-500/30"
            : job.status === "error"
              ? "bg-red-500/10 border-red-500/30"
              : "bg-autronis-card/95 border-autronis-border"
        )}
      >
        <div className="flex items-center gap-3">
          {job.status === "running" && (
            <div className="h-9 w-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-purple-300 animate-spin" />
            </div>
          )}
          {job.status === "done" && (
            <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          )}
          {job.status === "error" && (
            <div className="h-9 w-9 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-autronis-text-primary">
              <Sparkles className="w-3 h-3 text-purple-300" />
              Auto-cluster
              {job.status === "running" && (
                <span className="text-autronis-text-secondary font-normal">
                  — {job.bijgewerkt}/{job.totaal || "..."}
                </span>
              )}
            </div>
            {job.status === "running" && (
              <div className="mt-2 h-1 bg-autronis-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
            {job.status === "done" && (
              <p className="text-[11px] text-autronis-text-secondary mt-0.5">
                {job.bijgewerkt} van {job.totaal} taken gelabeld
              </p>
            )}
            {job.status === "error" && (
              <p className="text-[11px] text-red-400 mt-0.5 truncate">
                {job.fout ?? "Onbekende fout"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
