"use client";

import { Terminal, CheckCircle2, AlertCircle, Clock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrchestrator, type LogEntry } from "./orchestrator-store";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

const typeConfig: Record<LogEntry["type"], { icon: typeof Terminal; color: string }> = {
  info: { icon: Terminal, color: "text-autronis-text-tertiary" },
  task_start: { icon: Play, color: "text-blue-400" },
  task_complete: { icon: CheckCircle2, color: "text-green-400" },
  review: { icon: CheckCircle2, color: "text-purple-400" },
  error: { icon: AlertCircle, color: "text-red-400" },
  approval: { icon: Clock, color: "text-amber-400" },
};

export function LogPanel() {
  const logs = useOrchestrator((s) => s.logs);

  if (logs.length === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-autronis-border/30">
        <Terminal className="w-3.5 h-3.5 text-autronis-accent" />
        <span className="text-xs font-semibold text-autronis-text-primary">Agent Logs</span>
        <span className="text-[9px] text-autronis-text-tertiary">live</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto scrollbar-thin">
        {logs.slice(0, 20).map((log) => {
          const cfg = typeConfig[log.type];
          const Icon = cfg.icon;
          return (
            <div key={log.id} className="flex items-start gap-2 px-4 py-1.5 hover:bg-autronis-card-hover text-[11px]">
              <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", cfg.color)} />
              <span className="text-autronis-accent font-medium shrink-0">{log.agentId}</span>
              <span className="text-autronis-text-secondary flex-1">{log.message}</span>
              <span className="text-autronis-text-tertiary text-[9px] shrink-0">{timeAgo(log.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
