"use client";

import { useRef, useEffect, useMemo } from "react";
import { Terminal, GitBranch, GitPullRequest, FileCode, Shield, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrchestrator, type LogEntry } from "./orchestrator-store";

const TYPE_STYLE: Record<LogEntry["type"], { color: string; bg: string; prefix: string }> = {
  info:          { color: "text-gray-400",   bg: "",                prefix: "·" },
  task_start:    { color: "text-blue-400",   bg: "bg-blue-500/3",  prefix: "\u25B6" },
  task_complete: { color: "text-emerald-400",  bg: "bg-green-500/3", prefix: "\u2713" },
  review:        { color: "text-purple-400", bg: "bg-purple-500/3", prefix: "\u27F3" },
  error:         { color: "text-red-400",    bg: "bg-red-500/5",   prefix: "\u2717" },
  approval:      { color: "text-amber-400",  bg: "bg-amber-500/3", prefix: "\u23F3" },
};

function timeStr(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}u`;
}

export function ExecutionFeed() {
  const logs = useOrchestrator((s) => s.logs);
  const commands = useOrchestrator((s) => s.commands);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Current active command for phase display
  const activeCmd = useMemo(() => {
    return commands.find((c) =>
      c.status === "in_progress" || c.status === "approved" || c.status === "planning" ||
      c.status === "awaiting_approval" || c.status === "intake" || c.status === "intake_idee"
    );
  }, [commands]);

  // Phase indicator
  const phase = useMemo(() => {
    if (!activeCmd) return null;
    switch (activeCmd.status) {
      case "intake": case "intake_idee": return { label: "Intake", color: "text-purple-400", bg: "bg-purple-500/15" };
      case "planning": return { label: "Planning", color: "text-blue-400", bg: "bg-blue-500/15" };
      case "awaiting_approval": return { label: "Approval", color: "text-amber-400", bg: "bg-amber-500/15" };
      case "in_progress": case "approved": return { label: "Executing", color: "text-emerald-400", bg: "bg-emerald-500/15" };
      default: return null;
    }
  }, [activeCmd]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [logs.length]);

  // Detect special log entries for richer rendering
  function isGitLog(msg: string) { return msg.includes("Branch") || msg.includes("PR") || msg.includes("commit") || msg.includes("push"); }
  function isFileLog(msg: string) { return msg.includes("Schrijft") || msg.includes("bestanden"); }
  function isApprovalLog(msg: string) { return msg.includes("goedkeuring") || msg.includes("Auto-goedgekeurd") || msg.includes("HANDMATIGE"); }
  function isBlockedLog(msg: string) { return msg.includes("Wacht op") || msg.includes("blocked") || msg.includes("gelocked"); }

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-autronis-border/30">
        <Terminal className="w-4 h-4 text-autronis-accent" />
        <span className="text-sm font-semibold text-autronis-text-primary">Executie Log</span>
        {logs.length > 0 && (
          <span className="text-[9px] text-emerald-400 font-medium ml-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            live
          </span>
        )}
        {phase && (
          <span className={cn("ml-auto text-[9px] font-semibold px-2 py-0.5 rounded", phase.bg, phase.color)}>
            {phase.label}
          </span>
        )}
      </div>

      {/* Active command context */}
      {activeCmd && (
        <div className="px-4 py-2 border-b border-autronis-border/10 bg-autronis-bg/30">
          <p className="text-[10px] text-autronis-text-tertiary">Huidige opdracht</p>
          <p className="text-[11px] font-semibold text-autronis-text-primary truncate">{activeCmd.opdracht}</p>
          {activeCmd.plan && (
            <div className="flex items-center gap-1.5 mt-1">
              {activeCmd.plan.taken.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full flex-1 transition-all duration-500",
                    t.status === "completed" ? "bg-green-400" :
                    t.status === "in_progress" ? "bg-blue-400 animate-pulse" :
                    t.status === "review" ? "bg-purple-400" :
                    t.status === "blocked" ? "bg-red-400" :
                    "bg-gray-700"
                  )}
                  title={`${t.titel} (${t.agentId ?? "?"})`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 max-h-[320px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="px-4 py-4 flex items-center gap-2 text-autronis-text-tertiary">
            <Terminal className="w-3.5 h-3.5 opacity-30 shrink-0" />
            <p className="text-[11px] italic opacity-50">Geef een opdracht om te starten...</p>
          </div>
        ) : (
          logs.slice(0, 40).map((log) => {
            const style = TYPE_STYLE[log.type];
            const isGit = isGitLog(log.message);
            const isFile = isFileLog(log.message);
            const isApproval = isApprovalLog(log.message);
            const isBlocked = isBlockedLog(log.message);

            return (
              <div
                key={log.id}
                className={cn(
                  "px-4 py-1.5 flex items-start gap-2 border-b border-autronis-border/5",
                  "hover:bg-autronis-card-hover/30 transition-colors",
                  style.bg,
                  isBlocked && "bg-amber-500/5",
                )}
              >
                {/* Timeline dot */}
                <div className="flex flex-col items-center shrink-0 mt-1">
                  <span className={cn("w-1.5 h-1.5 rounded-full", style.color.replace("text-", "bg-"))} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[10px] font-bold", style.color)}>{log.agentId}</span>
                    <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(log.timestamp)}</span>

                    {/* Special badges */}
                    {isGit && <GitBranch className="w-2.5 h-2.5 text-autronis-accent opacity-50" />}
                    {isFile && <FileCode className="w-2.5 h-2.5 text-blue-400 opacity-50" />}
                    {isApproval && <Shield className="w-2.5 h-2.5 text-amber-400 opacity-50" />}
                    {isBlocked && <AlertTriangle className="w-2.5 h-2.5 text-amber-400 opacity-50" />}
                  </div>
                  <p className={cn(
                    "text-[11px] leading-snug",
                    log.type === "error" ? "text-red-400" :
                    log.type === "task_complete" ? "text-autronis-text-primary" :
                    "text-autronis-text-secondary"
                  )}>
                    {log.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
