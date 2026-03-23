"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, ChevronDown, ChevronUp, User, FileCode, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrchestrator } from "./orchestrator-store";
import { SPECIALIZATION_LABELS } from "./orchestrator-types";
import type { AgentSpecialization } from "./orchestrator-types";

interface DbCommand {
  id: number;
  opdracht: string;
  status: string;
  plan: { beschrijving: string; taken: { id: string; titel: string; beschrijving: string; agentId: string | null; specialisatie: string; bestanden: string[]; status: string }[] } | null;
  bron: string;
  feedback: string | null;
  aangemaakt: string;
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}u`;
}

// Shared task list renderer
function TaskList({ tasks }: { tasks: DbCommand["plan"] extends infer T ? T extends { taken: infer U } ? U : never : never }) {
  return (
    <div className="space-y-1.5">
      {tasks.map((task, i) => (
        <div key={task.id ?? i} className={cn(
          "flex items-start gap-2 p-2 rounded border",
          task.status === "completed" && "bg-green-500/5 border-green-500/20",
          task.status === "in_progress" && "bg-blue-500/5 border-blue-500/20",
          task.status === "review" && "bg-purple-500/5 border-purple-500/20",
          task.status === "blocked" && "bg-red-500/5 border-red-500/20",
          (!task.status || task.status === "queued" || task.status === "assigned") && "bg-autronis-card/50 border-autronis-border/20",
        )}>
          <span className={cn(
            "text-[9px] mt-0.5 font-bold",
            task.status === "completed" ? "text-green-400" :
            task.status === "in_progress" ? "text-blue-400" :
            task.status === "review" ? "text-purple-400" :
            task.status === "blocked" ? "text-red-400" :
            "text-autronis-text-tertiary"
          )}>
            {task.status === "completed" ? "\u2713" :
             task.status === "in_progress" ? "\u25B6" :
             task.status === "review" ? "\u27F3" :
             task.status === "blocked" ? "\u2717" :
             `${i + 1}.`}
          </span>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "text-[11px] font-medium",
              task.status === "completed" ? "text-autronis-text-secondary line-through" : "text-autronis-text-primary"
            )}>{task.titel}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {task.agentId && (
                <span className={cn(
                  "flex items-center gap-0.5 text-[9px]",
                  task.status === "in_progress" ? "text-blue-400" :
                  task.status === "review" ? "text-purple-400" :
                  "text-autronis-accent"
                )}>
                  <User className="w-2.5 h-2.5" />{task.agentId}
                  {task.status === "in_progress" && <Loader2 className="w-2.5 h-2.5 animate-spin ml-0.5" />}
                </span>
              )}
              <span className="text-[9px] text-autronis-text-tertiary">
                {SPECIALIZATION_LABELS[task.specialisatie as AgentSpecialization] ?? task.specialisatie}
              </span>
              {task.bestanden.length > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-autronis-text-tertiary">
                  <FileCode className="w-2.5 h-2.5" />{task.bestanden.length}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApprovalPanel() {
  const { commands: localCommands, approvals, approveApproval, rejectApproval } = useOrchestrator();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  // Poll database — single source of truth
  const { data: dbCommands } = useQuery<DbCommand[]>({
    queryKey: ["orchestrator-commands"],
    queryFn: async () => {
      const res = await fetch("/api/ops-room/orchestrate", {
        headers: { "x-ops-token": "autronis-ops-2026" },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.commands ?? [];
    },
    refetchInterval: 3000,
  });

  const handleDbApprove = useCallback(async (id: number) => {
    await fetch("/api/ops-room/orchestrate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
      body: JSON.stringify({ id, actie: "approve" }),
    });
    queryClient.invalidateQueries({ queryKey: ["orchestrator-commands"] });
  }, [queryClient]);

  const handleDbReject = useCallback(async (id: number, fb: string) => {
    await fetch("/api/ops-room/orchestrate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
      body: JSON.stringify({ id, actie: "reject", feedback: fb }),
    });
    setRejectId(null);
    setFeedback("");
    queryClient.invalidateQueries({ queryKey: ["orchestrator-commands"] });
  }, [queryClient]);

  // Merge DB + Zustand: use DB as source of truth, overlay Zustand real-time task progress
  const mergedCommands = useMemo(() => {
    const all = dbCommands ?? [];
    // Find Zustand commands that have a dbId — use their task statuses as real-time overlay
    const zustandByDbId = new Map(
      localCommands.filter((c) => c.dbId).map((c) => [c.dbId, c])
    );

    return all.map((dbCmd) => {
      const zustandCmd = zustandByDbId.get(dbCmd.id);
      if (!zustandCmd?.plan || !dbCmd.plan) return dbCmd;

      // Overlay Zustand task statuses (more real-time than DB polling)
      const mergedTasks = dbCmd.plan.taken.map((dbTask) => {
        const zTask = zustandCmd.plan?.taken.find((t) => t.id === dbTask.id);
        if (!zTask) return dbTask;
        // Use whichever status is "further along"
        const statusOrder = ["queued", "assigned", "in_progress", "review", "completed", "blocked"];
        const dbIdx = statusOrder.indexOf(dbTask.status);
        const zIdx = statusOrder.indexOf(zTask.status);
        return zIdx > dbIdx ? { ...dbTask, status: zTask.status } : dbTask;
      });

      // Use whichever command status is further along
      const cmdStatusOrder = ["pending", "planning", "awaiting_approval", "approved", "in_progress", "review", "completed", "rejected"];
      const dbSIdx = cmdStatusOrder.indexOf(dbCmd.status);
      const zSIdx = cmdStatusOrder.indexOf(zustandCmd.status);
      const mergedStatus = zSIdx > dbSIdx ? zustandCmd.status : dbCmd.status;

      return { ...dbCmd, status: mergedStatus, plan: { ...dbCmd.plan, taken: mergedTasks } };
    });
  }, [dbCommands, localCommands]);

  // Categorize commands
  const pendingCommands = mergedCommands.filter((c) =>
    c.status === "awaiting_approval" || c.status === "planning" || c.status === "pending"
  );
  const activeCommands = mergedCommands.filter((c) =>
    c.status === "approved" || c.status === "in_progress"
  );
  const recentlyCompleted = mergedCommands.filter((c) =>
    c.status === "completed"
  ).slice(0, 3); // Show last 3 completed

  // Zustand-only pending approvals (for the approve/reject buttons — these trigger executePlan)
  const pendingApprovalItems = approvals.filter((a) => a.status === "pending");

  const handleReject = (id: string) => {
    rejectApproval(id, feedback);
    setRejectId(null);
    setFeedback("");
  };

  const totalVisible = pendingCommands.length + activeCommands.length + recentlyCompleted.length + pendingApprovalItems.length;
  if (totalVisible === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-autronis-card-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-autronis-text-primary">Opdrachten</span>
          {pendingCommands.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
              {pendingCommands.length} wacht
            </span>
          )}
          {activeCommands.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">
              {activeCommands.length} actief
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-autronis-text-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">

          {/* === ACTIVE COMMANDS — progress tracker === */}
          {activeCommands.map((cmd) => {
            const tasks = cmd.plan?.taken ?? [];
            const done = tasks.filter((t) => t.status === "completed").length;
            const total = tasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={`active-${cmd.id}`} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                    {done}/{total} taken
                  </span>
                  <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(cmd.aangemaakt)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-autronis-border/30 mb-3 overflow-hidden">
                  <div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                {tasks.length > 0 && <TaskList tasks={tasks} />}
              </div>
            );
          })}

          {/* === PENDING COMMANDS — awaiting approval === */}
          {pendingCommands.map((cmd) => {
            // Check if there's a Zustand approval for this command (to use approve/reject flow)
            const zustandApproval = pendingApprovalItems.find((a) => {
              const zustandCmd = localCommands.find((c) => c.dbId === cmd.id);
              return zustandCmd && a.commandId === zustandCmd.id;
            });

            return (
              <div key={`pending-${cmd.id}`} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  {cmd.bron !== "ui" && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-semibold">
                      {cmd.bron === "ideeen" ? "IDEE\u00CBN" : cmd.bron.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(cmd.aangemaakt)}</span>
                </div>

                {cmd.plan && (
                  <div className="mb-3">
                    <p className="text-[10px] text-autronis-text-secondary font-medium mb-1.5">{cmd.plan.beschrijving}</p>
                    <TaskList tasks={cmd.plan.taken} />
                  </div>
                )}

                {!cmd.plan && cmd.status === "planning" && (
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    <span className="text-[10px] text-blue-400">Theo & Jones maken plan...</span>
                  </div>
                )}

                {rejectId === `db-${cmd.id}` ? (
                  <div className="space-y-2">
                    <input type="text" value={feedback} onChange={(e) => setFeedback(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleDbReject(cmd.id, feedback)}
                      placeholder="Feedback..." className="w-full px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border/50 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none" autoFocus />
                    <div className="flex gap-2">
                      <button onClick={() => handleDbReject(cmd.id, feedback)} className="px-3 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-medium hover:bg-red-500/25">Afwijzen</button>
                      <button onClick={() => { setRejectId(null); setFeedback(""); }} className="px-3 py-1 rounded-lg bg-autronis-border/30 text-autronis-text-tertiary text-[11px] hover:bg-autronis-border/50">Annuleer</button>
                    </div>
                  </div>
                ) : cmd.plan ? (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      // Approve via Zustand if available (triggers executePlan), otherwise DB-only
                      if (zustandApproval) {
                        approveApproval(zustandApproval.id);
                      }
                      handleDbApprove(cmd.id);
                    }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-[11px] font-medium hover:bg-green-500/25 transition-colors">
                      <Check className="w-3 h-3" />Goedkeuren
                    </button>
                    <button onClick={() => setRejectId(`db-${cmd.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors">
                      <X className="w-3 h-3" />Afwijzen
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* === RECENTLY COMPLETED — shows "klaar" clearly === */}
          {recentlyCompleted.map((cmd) => {
            const tasks = cmd.plan?.taken ?? [];
            const done = tasks.filter((t) => t.status === "completed").length;
            const total = tasks.length;

            return (
              <div key={`done-${cmd.id}`} className="p-3 rounded-lg bg-green-500/5 border border-green-500/15 opacity-80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">
                    {done}/{total} klaar
                  </span>
                  <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(cmd.aangemaakt)}</span>
                </div>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}
