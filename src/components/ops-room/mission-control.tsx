"use client";

import { useMemo, useState } from "react";
import { useOrchestrator } from "./orchestrator-store";
import { Target, Play, Pause, Loader2, AlertTriangle, Shield, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "./types";

interface MissionControlProps {
  agents: Agent[];
}

export function MissionControl({ agents }: MissionControlProps) {
  const commands = useOrchestrator((s) => s.commands);
  const approvals = useOrchestrator((s) => s.approvals);
  const killExecution = useOrchestrator((s) => s.killExecution);
  const approveApproval = useOrchestrator((s) => s.approveApproval);
  const [showPlan, setShowPlan] = useState(false);

  const activeCommand = useMemo(() =>
    commands.find((c) => c.status === "in_progress" || c.status === "approved"), [commands]);
  const planningCommand = useMemo(() =>
    commands.find((c) => c.status === "planning" || c.status === "pending" || c.status === "intake" || c.status === "intake_idee"), [commands]);
  const awaitingCommand = useMemo(() =>
    commands.find((c) => c.status === "awaiting_approval"), [commands]);

  const cmd = activeCommand || awaitingCommand || planningCommand;

  const stats = useMemo(() => ({
    working: agents.filter((a) => a.status === "working").length,
    idle: agents.filter((a) => a.status === "idle").length,
    reviewing: agents.filter((a) => a.status === "reviewing").length,
    errors: agents.filter((a) => a.status === "error").length,
  }), [agents]);

  const taskStats = useMemo(() => {
    const plan = (activeCommand || awaitingCommand)?.plan;
    if (!plan) return null;
    const tasks = plan.taken;
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "completed").length;
    const running = tasks.filter((t) => t.status === "in_progress").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const agentCount = new Set(tasks.map((t) => t.agentId).filter(Boolean)).size;

    // Bottleneck: an agentId with ≥3 active/queued tasks while team has idle agents
    const activeTasks = tasks.filter((t) => t.status !== "completed" && t.agentId);
    const loadMap = new Map<string, number>();
    for (const t of activeTasks) {
      if (t.agentId) loadMap.set(t.agentId, (loadMap.get(t.agentId) ?? 0) + 1);
    }
    const bottleneckAgent = Array.from(loadMap.entries()).find(([, n]) => n >= 3);
    const bottleneck = bottleneckAgent && stats.idle > 0
      ? { agentId: bottleneckAgent[0], taskCount: bottleneckAgent[1] }
      : null;

    return { total, done, running, blocked, agents: agentCount, bottleneck };
  }, [activeCommand, awaitingCommand, stats.idle]);

  // Find pending approval for awaiting command
  const pendingApproval = useMemo(() => {
    if (!awaitingCommand) return null;
    return approvals.find((a) => a.commandId === awaitingCommand.id && a.status === "pending");
  }, [awaitingCommand, approvals]);

  if (!cmd && stats.working === 0) return null;

  const isRed = pendingApproval?.permissie === "red";
  const isYellow = pendingApproval?.permissie === "yellow";

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      isRed ? "border-red-500/30 bg-red-500/5" :
      isYellow ? "border-amber-500/30 bg-amber-500/5" :
      "border-autronis-border/50 bg-autronis-card"
    )}>
      {/* Main strip */}
      {cmd && (
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Status icon */}
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            cmd.status === "in_progress" ? "bg-emerald-500/15" :
            cmd.status === "awaiting_approval" ? (isRed ? "bg-red-500/15" : "bg-amber-500/15") :
            "bg-blue-500/15"
          )}>
            {cmd.status === "in_progress" ? <Play className="w-4 h-4 text-emerald-400" /> :
             cmd.status === "awaiting_approval" ? <Shield className={cn("w-4 h-4", isRed ? "text-red-400" : "text-amber-400")} /> :
             <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          </div>

          {/* Command info */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-autronis-text-primary truncate">{cmd.opdracht}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-[9px] font-semibold px-1.5 py-0.5 rounded",
                cmd.status === "in_progress" ? "bg-emerald-500/15 text-emerald-400" :
                cmd.status === "planning" ? "bg-blue-500/15 text-blue-400" :
                cmd.status === "awaiting_approval" ? (isRed ? "bg-red-500/20 text-red-400" : "bg-amber-500/15 text-amber-400") :
                cmd.status === "intake" || cmd.status === "intake_idee" ? "bg-purple-500/15 text-purple-400" :
                "bg-gray-500/15 text-gray-400"
              )}>
                {cmd.status === "in_progress" ? "Agents bezig" :
                 cmd.status === "planning" ? "Plan wordt gemaakt..." :
                 cmd.status === "awaiting_approval" ? (isRed ? "Goedkeuring vereist" : "Auto-approve in 10s") :
                 cmd.status === "intake" ? "Brent stelt vragen" :
                 cmd.status === "intake_idee" ? "Idee sparring" :
                 cmd.status}
              </span>
              {taskStats && (
                <>
                  <span className="text-[9px] text-autronis-text-tertiary">
                    {taskStats.done}/{taskStats.total} taken
                  </span>
                  <span className="text-[9px] text-autronis-text-tertiary">
                    {taskStats.agents} agents
                  </span>
                </>
              )}
              {isRed && (
                <span className="text-[9px] text-red-400 font-medium">
                  DB/deploy geraakt
                </span>
              )}
            </div>
          </div>

          {/* Task progress dots */}
          {taskStats && (
            <div className="flex items-center gap-0.5 shrink-0">
              {(activeCommand || awaitingCommand)?.plan?.taken.map((t, i) => (
                <div key={i} className={cn(
                  "w-2.5 h-2.5 rounded-sm",
                  t.status === "completed" ? "bg-green-400" :
                  t.status === "in_progress" ? "bg-blue-400 animate-pulse" :
                  t.status === "review" ? "bg-purple-400" :
                  t.status === "blocked" ? "bg-red-400" :
                  "bg-gray-600/50"
                )} title={`${t.titel} → ${t.agentId}`} />
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {cmd.plan && (
              <button
                onClick={() => setShowPlan(!showPlan)}
                className="px-2 py-1 rounded-lg bg-autronis-border/20 text-autronis-text-tertiary text-[10px] font-medium hover:bg-autronis-border/40 transition-colors flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                Plan
              </button>
            )}
            {cmd.status === "awaiting_approval" && pendingApproval && (
              <button
                onClick={() => approveApproval(pendingApproval.id)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold hover:bg-green-500/25 transition-colors"
              >
                Goedkeuren
              </button>
            )}
            {cmd.status === "in_progress" && (
              <button
                onClick={() => killExecution(cmd.id)}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plan expandable */}
      {showPlan && cmd?.plan && (
        <div className="px-4 py-2 border-t border-autronis-border/15 bg-autronis-bg/30">
          <p className="text-[10px] text-autronis-text-secondary mb-2">{cmd.plan.beschrijving}</p>
          <div className="space-y-1">
            {cmd.plan.taken.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className={cn(
                  "w-4 text-center font-bold",
                  t.status === "completed" ? "text-emerald-400" :
                  t.status === "in_progress" ? "text-blue-400" :
                  t.status === "blocked" ? "text-red-400" :
                  "text-autronis-text-tertiary"
                )}>
                  {t.status === "completed" ? "\u2713" : t.status === "in_progress" ? "\u25B6" : t.status === "blocked" ? "\u2717" : `${i + 1}`}
                </span>
                <span className="text-autronis-text-primary flex-1 truncate">{t.titel}</span>
                <span className="text-autronis-accent text-[9px]">{t.agentId}</span>
                {t.afhankelijkVan.length > 0 && (
                  <span className="text-[8px] text-autronis-text-tertiary">dep: {t.afhankelijkVan.length}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent status strip */}
      {(stats.working > 0 || cmd) && (
        <div className="px-4 py-2 border-t border-autronis-border/15 flex items-center gap-4 text-[10px]">
          {stats.working > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {stats.working} actief
            </span>
          )}
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
          <span className="text-autronis-text-tertiary">{stats.idle} stand-by</span>
          {taskStats && taskStats.blocked > 0 && (
            <span className="flex items-center gap-1 text-red-400 ml-auto font-medium">
              <AlertTriangle className="w-3 h-3" />
              {taskStats.blocked} geblokkeerd
            </span>
          )}
          {taskStats?.bottleneck && (
            <span className="flex items-center gap-1 text-amber-400 ml-auto font-medium" title={`${taskStats.bottleneck.agentId} heeft ${taskStats.bottleneck.taskCount} taken terwijl ${stats.idle} agents stand-by zijn`}>
              <AlertTriangle className="w-3 h-3" />
              Bottleneck: {taskStats.bottleneck.agentId} ×{taskStats.bottleneck.taskCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
