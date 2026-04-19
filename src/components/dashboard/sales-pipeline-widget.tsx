"use client";

import Link from "next/link";
import { Rocket, ArrowRight, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PipelineStats {
  scansDezeWeek: number;
  outreachVerstuurd: number;
  repliesOntvangen: number;
  dealsGesloten: number;
  maandTarget: { scans: number; deals: number };
}

// Doelen uit go-to-market plan (maand 3 target):
// 200 prospects/scans per maand → ~50/week
// 200 outreach per maand → ~50/week
// 20 replies per maand → ~5/week
// 2-3 deals per maand → ~0.6/week
const WEEKLY_TARGETS = {
  scans: 50,
  outreach: 50,
  replies: 5,
  deals: 1,
};

async function fetchStats(): Promise<PipelineStats> {
  const res = await fetch("/api/dashboard/pipeline-week");
  if (!res.ok) throw new Error("Pipeline fetch mislukte");
  return res.json();
}

export function SalesPipelineWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "pipeline-week"],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Rocket className="w-4 h-4 text-autronis-accent" />
          Sales pipeline
        </h3>
        <Link
          href="/sales-engine"
          className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium inline-flex items-center gap-1"
        >
          Open <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="text-[11px] uppercase tracking-wider text-autronis-text-secondary mb-3">
        Deze week · target maand 3
      </div>

      <div className="space-y-3">
        <Row
          label="Scans"
          value={data?.scansDezeWeek ?? 0}
          target={WEEKLY_TARGETS.scans}
          loading={isLoading}
          actionHref="/sales-engine"
          actionLabel="Scan"
        />
        <Row
          label="Outreach"
          value={data?.outreachVerstuurd ?? 0}
          target={WEEKLY_TARGETS.outreach}
          loading={isLoading}
          actionHref="/leads/emails"
          actionLabel="Mails"
        />
        <Row
          label="Replies"
          value={data?.repliesOntvangen ?? 0}
          target={WEEKLY_TARGETS.replies}
          loading={isLoading}
        />
        <Row
          label="Deals"
          value={data?.dealsGesloten ?? 0}
          target={WEEKLY_TARGETS.deals}
          loading={isLoading}
          accent
        />
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: number;
  target: number;
  loading: boolean;
  accent?: boolean;
  actionHref?: string;
  actionLabel?: string;
}

function Row({ label, value, target, loading, accent, actionHref, actionLabel }: RowProps) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const barColor =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 40
        ? "bg-amber-500"
        : "bg-red-500/70";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className={cn(
              "text-xs font-medium truncate",
              accent ? "text-autronis-accent" : "text-autronis-text-primary",
            )}
          >
            {label}
          </span>
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="text-[10px] text-autronis-text-secondary hover:text-autronis-accent transition-colors"
            >
              → {actionLabel}
            </Link>
          )}
        </div>
        {loading ? (
          <Skeleton className="h-3 w-14" />
        ) : (
          <span className="text-[11px] tabular-nums text-autronis-text-secondary flex-shrink-0">
            <span
              className={cn(
                "font-semibold",
                accent ? "text-autronis-accent" : "text-autronis-text-primary",
              )}
            >
              {value}
            </span>
            <span> / {target}</span>
          </span>
        )}
      </div>
      <div className="h-1.5 bg-autronis-border rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", loading ? "bg-autronis-border" : barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {value === 0 && !loading && (
        <div className="text-[10px] text-autronis-text-secondary mt-1 flex items-center gap-1">
          <Flame className="w-2.5 h-2.5 text-red-400" />
          Nog niks deze week
        </div>
      )}
    </div>
  );
}
