"use client";

import { useMemo } from "react";
import { useOrchestrator } from "./orchestrator-store";
import { Target, Play, Pause, ChevronRight, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "./types";

interface MissionControlProps {
  agents: Agent[];
}

export function MissionControl({ agents }: MissionControlProps) {
  const commands = useOrchestrator((s) => s.commands);
  const activeAgentIds = useOrchestrator((s) => s.activeAgents);
  const killExecution = useOrchestrator((s) => s.killExecution);

  const activeCommand = useMemo(() => {
    return commands.find((c) => c.status === "in_progress" || c.status === "approved");
  }, [commands]);

  const planningCommand = useMemo(() => {
    return commands.find((c) => c.status === "planning" || c.status === "pending" || c.status === "intake" || c.status === "intake_idee");
  }, [commands]);

  const awaitingCommand = useMemo(() => {
    return commands.find((c) => c.status === "awaiting_approval");
  }, [commands]);

  const cmd = activeCommand || planningCommand || awaitingCommand;

  const stats = useMemo(() => {
    const working = agents.filter((a) => a.status === "working").length;
    const idle = agents.filter((a) => a.status === "idle").length;
    const reviewing = agents.filter((a) => a.status === "reviewing").length;
    const errors = agents.filter((a) => a.status === "error").length;
    return { working, idle, reviewing, errors };
  }, [agents]);

  const taskStats = useMemo(() => {
    if (!activeCommand?.plan) return null;
    const tasks = activeCommand.plan.taken;
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "completed").length;
    const running = tasks.filter((t) => t.status === "in_progress").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const queued = total - done - running - review - blocked;
    return { total, done, running, review, blocked, queued };
  }, [activeCommand]);

  if (!cmd && stats.working === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      {/* Active command */}
      {cmd && (
        <div className="px-4 py-3 flex items-center gap-3">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            cmd.status === "in_progress" ? "bg-green-500/15" :
            cmd.status === "planning" || cmd.status === "pending" ? "bg-blue-500/15" :
            cmd.status === "awaiting_approval" ? "bg-amber-500/15" :
            "bg-gray-500/15"
          )}>
            {cmd.status === "in_progress" ? <Play className="w-4 h-4 text-green-400" /> :
             cmd.status === "planning" || cmd.status === "pending" ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" /> :
             cmd.status === "awaiting_approval" ? <Pause className="w-4 h-4 text-amber-400" /> :
             <Target className="w-4 h-4 text-gray-400" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-autronis-text-primary truncate">{cmd.opdracht}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-[9px] font-semibold px-1.5 py-0.5 rounded",
                cmd.status === "in_progress" ? "bg-green-500/15 text-green-400" :
                cmd.status === "planning" ? "bg-blue-500/15 text-blue-400" :
                cmd.status === "awaiting_approval" ? "bg-amber-500/15 text-amber-400" :
                cmd.status === "intake" || cmd.status === "intake_idee" ? "bg-purple-500/15 text-purple-400" :
                "bg-gray-500/15 text-gray-400"
              )}>
                {cmd.status === "in_progress" ? "Agents bezig" :
                 cmd.status === "planning" ? "Plan wordt gemaakt" :
                 cmd.status === "awaiting_approval" ? "Wacht op goedkeuring" :
                 cmd.status === "intake" ? "Brent stelt vragen" :
                 cmd.status === "intake_idee" ? "Brent spart (idee)" :
                 cmd.status}
              </span>
              {taskStats && (
                <span className="text-[9px] text-autronis-text-tertiary">
                  {taskStats.done}/{taskStats.total} taken klaar
                </span>
              )}
            </div>
          </div>

          {/* Task progress mini */}
          {taskStats && (
            <div className="flex items-center gap-1 shrink-0">
              {activeCommand?.plan?.taken.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    t.status === "completed" ? "bg-green-400" :
                    t.status === "in_progress" ? "bg-blue-400 animate-pulse" :
                    t.status === "review" ? "bg-purple-400" :
                    t.status === "blocked" ? "bg-red-400" :
                    "bg-gray-600"
                  )}
                  title={`${t.titel} (${t.agentId})`}
                />
              ))}
            </div>
          )}

          {/* Controls */}
          {cmd.status === "in_progress" && (
            <button
              onClick={() => killExecution(cmd.id)}
              className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors shrink-0"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Agent status strip */}
      {(stats.working > 0 || cmd) && (
        <div className="px-4 py-2 border-t border-autronis-border/20 flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1.5 text-green-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {stats.working} actief
          </span>
          {stats.reviewing > 0 && (
            <span className="flex items-center gap-1.5 text-purple-400">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              {stats.reviewing} review
            </span>
          )}
          {stats.errors > 0 && (
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {stats.errors} error
            </span>
          )}
          <span className="text-autronis-text-tertiary">
            {stats.idle} stand-by
          </span>
          {taskStats && taskStats.blocked > 0 && (
            <span className="flex items-center gap-1 text-amber-400 ml-auto">
              <AlertTriangle className="w-3 h-3" />
              {taskStats.blocked} geblokkeerd
            </span>
          )}
        </div>
      )}
    </div>
  );
}
