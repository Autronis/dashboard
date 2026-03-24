"use client";

import { useRef, useEffect, useState } from "react";
import { Terminal, CheckCircle2, AlertCircle, Clock, Play, PauseCircle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrchestrator, type LogEntry } from "./orchestrator-store";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m`;
}

const typeConfig: Record<LogEntry["type"], { icon: typeof Terminal; color: string; rowBg: string; label: string }> = {
  info:          { icon: Terminal,     color: "text-autronis-text-tertiary", rowBg: "",                    label: "›" },
  task_start:    { icon: Play,         color: "text-blue-400",               rowBg: "bg-blue-500/[0.04]",  label: "▶" },
  task_complete: { icon: CheckCircle2, color: "text-green-400",              rowBg: "bg-green-500/[0.04]", label: "✓" },
  review:        { icon: CheckCircle2, color: "text-purple-400",             rowBg: "bg-purple-500/[0.04]",label: "⟳" },
  error:         { icon: AlertCircle,  color: "text-red-400",                rowBg: "bg-red-500/[0.04]",   label: "✗" },
  approval:      { icon: Clock,        color: "text-amber-400",              rowBg: "bg-amber-500/[0.04]", label: "⏸" },
};

export function LogPanel() {
  const logs = useOrchestrator((s) => s.logs);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-scroll to top (newest) unless paused
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, isPaused]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    // Pause when user scrolls away from top
    setIsPaused(scrollRef.current.scrollTop > 20);
  };

  if (logs.length === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-autronis-border/30">
        <Terminal className="w-3.5 h-3.5 text-autronis-accent" />
        <span className="text-xs font-semibold text-autronis-text-primary">Agent Logs</span>
        <span className="flex items-center gap-1 text-[9px] text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          live
        </span>
        {isPaused && (
          <button
            onClick={() => { setIsPaused(false); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
            className="ml-auto flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
          >
            <PauseCircle className="w-3 h-3" />
            Gepauzeerd — klik om te hervatten
          </button>
        )}
        {!isPaused && logs.length > 5 && (
          <button
            onClick={() => setIsPaused(true)}
            className="ml-auto flex items-center gap-1 text-[10px] text-autronis-text-tertiary hover:text-autronis-text-secondary transition-colors"
          >
            <PlayCircle className="w-3 h-3" />
            Pauzeer scroll
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[220px] overflow-y-auto scrollbar-thin font-mono"
      >
        {logs.slice(0, 30).map((log) => {
          const cfg = typeConfig[log.type];
          const Icon = cfg.icon;
          return (
            <div
              key={log.id}
              className={cn(
                "flex items-start gap-2 px-4 py-1.5 hover:bg-autronis-card-hover text-[11px] border-b border-autronis-border/10 last:border-0",
                cfg.rowBg
              )}
            >
              {/* Type indicator */}
              <span className={cn("text-[10px] font-bold shrink-0 w-3 mt-0.5 leading-none", cfg.color)}>
                {cfg.label}
              </span>
              <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", cfg.color)} />
              {/* Agent name */}
              <span className="text-autronis-accent font-semibold shrink-0 text-[10px]">{log.agentId}</span>
              {/* Message with type color */}
              <span className={cn(
                "flex-1 leading-relaxed",
                log.type === "error" ? "text-red-300" :
                log.type === "task_complete" ? "text-green-300" :
                log.type === "task_start" ? "text-blue-300" :
                log.type === "review" ? "text-purple-300" :
                log.type === "approval" ? "text-amber-300" :
                "text-autronis-text-secondary"
              )}>
                {log.message}
              </span>
              <span className="text-autronis-text-tertiary text-[9px] shrink-0 tabular-nums">{timeAgo(log.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
