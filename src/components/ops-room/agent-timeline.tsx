"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, Loader2, Calendar, Zap, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineActivity {
  id: number;
  opdracht: string;
  status: string;
  timestamp: string;
  updatedAt: string;
  planBeschrijving: string | null;
}

interface DailyStat {
  datum: string;
  tokens: number;
  acties: number;
  projecten: string;
}

interface AgentTimelineProps {
  agentId: string;
}

const STATUS_ICONS: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: "text-emerald-400", label: "Afgerond" },
  in_progress: { icon: Loader2, color: "text-blue-400", label: "Bezig" },
  rejected: { icon: XCircle, color: "text-red-400", label: "Afgewezen" },
  approved: { icon: CheckCircle2, color: "text-amber-400", label: "Goedgekeurd" },
  pending: { icon: Clock, color: "text-gray-400", label: "Wachtend" },
};

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min}m geleden`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

export function AgentTimeline({ agentId }: AgentTimelineProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["agent-history", agentId],
    queryFn: async () => {
      const res = await fetch(`/api/ops-room/history?agentId=${agentId}&days=7`, {
        headers: { "x-ops-token": "autronis-ops-2026" },
      });
      if (!res.ok) return { activities: [], dailyStats: [] };
      return res.json() as Promise<{ activities: TimelineActivity[]; dailyStats: DailyStat[] }>;
    },
    staleTime: 30_000,
  });

  const activities = data?.activities ?? [];
  const dailyStats = data?.dailyStats ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-autronis-text-tertiary" />
      </div>
    );
  }

  if (activities.length === 0 && dailyStats.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-autronis-text-tertiary">
        Geen activiteit gevonden in de laatste 7 dagen
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Daily stats summary */}
      {dailyStats.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Dagelijks overzicht
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {dailyStats.slice(0, 6).map((stat) => {
              const cost = (stat.tokens / 1_000_000) * 15;
              const projects = stat.projecten ? stat.projecten.split(",") : [];
              return (
                <div
                  key={stat.datum}
                  className="p-2 rounded-lg bg-autronis-bg border border-autronis-border/40"
                >
                  <p className="text-[10px] font-medium text-autronis-text-secondary">
                    {formatDate(stat.datum)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-autronis-text-tertiary flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 text-emerald-400" />
                      {stat.tokens >= 1000 ? `${(stat.tokens / 1000).toFixed(0)}k` : stat.tokens}
                    </span>
                    <span className="text-[10px] text-amber-400 font-medium">
                      {"\u20AC"}{cost.toFixed(2)}
                    </span>
                  </div>
                  {projects.length > 0 && (
                    <div className="flex items-center gap-0.5 mt-1">
                      <FolderOpen className="w-2.5 h-2.5 text-autronis-text-tertiary" />
                      <span className="text-[9px] text-autronis-text-tertiary truncate">
                        {projects.slice(0, 2).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity timeline */}
      {activities.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-autronis-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Activiteit
          </p>
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-autronis-border/30" />

            <div className="space-y-1">
              {activities.slice(0, 10).map((activity) => {
                const statusCfg = STATUS_ICONS[activity.status] ?? STATUS_ICONS.pending;
                const Icon = statusCfg.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-2.5 pl-0 py-1 relative"
                  >
                    {/* Timeline dot */}
                    <div className={cn("w-[15px] h-[15px] rounded-full flex items-center justify-center shrink-0 z-10 bg-autronis-card")}>
                      <Icon className={cn("w-3 h-3", statusCfg.color, activity.status === "in_progress" && "animate-spin")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-autronis-text-primary leading-snug">
                        {activity.opdracht.length > 60
                          ? activity.opdracht.slice(0, 59) + "..."
                          : activity.opdracht}
                      </p>
                      {activity.planBeschrijving && (
                        <p className="text-[9px] text-autronis-text-tertiary mt-0.5 truncate">
                          {activity.planBeschrijving}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn("text-[9px] font-medium", statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                        <span className="text-[9px] text-autronis-text-tertiary">
                          {timeAgo(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
