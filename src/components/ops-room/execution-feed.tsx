"use client";

import { useRef, useEffect } from "react";
import { Terminal, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrchestrator, type LogEntry } from "./orchestrator-store";

const TYPE_CONFIG: Record<LogEntry["type"], { color: string; prefix: string; icon: string }> = {
  info:          { color: "text-gray-400",   prefix: "~",  icon: "·" },
  task_start:    { color: "text-blue-400",   prefix: "▶",  icon: "→" },
  task_complete: { color: "text-green-400",  prefix: "✓",  icon: "✓" },
  review:        { color: "text-purple-400", prefix: "⟳",  icon: "⟳" },
  error:         { color: "text-red-400",    prefix: "✗",  icon: "!" },
  approval:      { color: "text-amber-400",  prefix: "⏳", icon: "?" },
};

function timeStr(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export function ExecutionFeed() {
  const logs = useOrchestrator((s) => s.logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // logs are newest-first
    }
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
          <Terminal className="w-4 h-4 text-autronis-accent" />
          <span className="text-sm font-semibold text-autronis-text-primary">Executie Log</span>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-[11px] text-autronis-text-tertiary">
            Geef een opdracht om de executie log te starten
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
        <Terminal className="w-4 h-4 text-autronis-accent" />
        <span className="text-sm font-semibold text-autronis-text-primary">Executie Log</span>
        <span className="text-[9px] text-green-400 font-medium ml-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          live
        </span>
        <span className="ml-auto text-[9px] text-autronis-text-tertiary">{logs.length} entries</span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[280px] overflow-y-auto font-mono text-[11px] leading-relaxed"
      >
        {logs.slice(0, 30).map((log) => {
          const config = TYPE_CONFIG[log.type];
          return (
            <div
              key={log.id}
              className={cn(
                "px-4 py-1.5 flex items-start gap-2 border-b border-autronis-border/10 hover:bg-autronis-card-hover/50 transition-colors",
                log.type === "error" && "bg-red-500/5",
                log.type === "task_complete" && "bg-green-500/3",
              )}
            >
              {/* Timestamp */}
              <span className="text-[9px] text-autronis-text-tertiary tabular-nums shrink-0 mt-0.5 w-14">
                {timeStr(log.timestamp)}
              </span>

              {/* Type indicator */}
              <span className={cn("shrink-0 w-3 text-center mt-0.5", config.color)}>
                {config.prefix}
              </span>

              {/* Agent */}
              <span className={cn("shrink-0 w-14 font-semibold truncate mt-0.5", config.color)}>
                {log.agentId}
              </span>

              {/* Message */}
              <span className="text-autronis-text-secondary flex-1 min-w-0">
                {log.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
