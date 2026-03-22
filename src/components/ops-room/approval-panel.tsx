"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, ChevronDown, ChevronUp, User, FileCode } from "lucide-react";
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

export function ApprovalPanel() {
  const { commands: localCommands, approvals, approveApproval, rejectApproval } = useOrchestrator();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  // Poll database for commands (catches commands from API/Ideeën)
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
    refetchInterval: 5000,
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

  // Merge local Zustand commands with DB commands
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const activeLocalCommands = localCommands.filter((c) => c.status !== "completed" && c.status !== "rejected");
  const pendingDbCommands = (dbCommands ?? []).filter((c) => c.status === "awaiting_approval");

  const handleReject = (id: string) => {
    rejectApproval(id, feedback);
    setRejectId(null);
    setFeedback("");
  };

  if (pendingApprovals.length === 0 && activeLocalCommands.length === 0 && pendingDbCommands.length === 0) return null;

  return (
    <div className="rounded-xl border border-autronis-border/50 bg-autronis-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-autronis-card-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-autronis-text-primary">Goedkeuring</span>
          {pendingApprovals.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">
              {pendingApprovals.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-autronis-text-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Active commands with status */}
          {activeCommands.map((cmd) => (
            <div key={cmd.id} className="p-3 rounded-lg bg-autronis-bg border border-autronis-border/30">
              <p className="text-xs text-autronis-text-primary font-medium">{cmd.opdracht}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                  cmd.status === "pending" && "bg-gray-500/15 text-gray-400",
                  cmd.status === "planning" && "bg-blue-500/15 text-blue-400",
                  cmd.status === "awaiting_approval" && "bg-amber-500/15 text-amber-400",
                  cmd.status === "in_progress" && "bg-green-500/15 text-green-400",
                  cmd.status === "review" && "bg-purple-500/15 text-purple-400",
                  cmd.status === "rejected" && "bg-red-500/15 text-red-400",
                )}>
                  {cmd.status === "pending" && "Wacht op Theo..."}
                  {cmd.status === "planning" && "Theo & Jones maken plan..."}
                  {cmd.status === "awaiting_approval" && "Wacht op jouw goedkeuring"}
                  {cmd.status === "approved" && "Goedgekeurd — wordt gestart"}
                  {cmd.status === "in_progress" && "Agents aan het werk"}
                  {cmd.status === "review" && "Toby reviewt"}
                  {cmd.status === "completed" && "Afgerond ✓"}
                  {cmd.status === "rejected" && "Afgewezen"}
                </span>
                <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(cmd.aangemaakt)}</span>
              </div>

              {/* Show plan tasks if available */}
              {cmd.plan && cmd.plan.taken.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] text-autronis-text-secondary font-medium">{cmd.plan.beschrijving}</p>
                  {cmd.plan.taken.map((task, i) => (
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
                        "text-autronis-text-tertiary"
                      )}>
                        {task.status === "completed" ? "✓" : task.status === "in_progress" ? "▶" : task.status === "review" ? "⟳" : `${i + 1}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-autronis-text-primary font-medium">{task.titel}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.agentId && (
                            <span className="flex items-center gap-0.5 text-[9px] text-autronis-accent">
                              <User className="w-2.5 h-2.5" />
                              {task.agentId}
                            </span>
                          )}
                          <span className="text-[9px] text-autronis-text-tertiary">
                            {SPECIALIZATION_LABELS[task.specialisatie as AgentSpecialization] ?? task.specialisatie}
                          </span>
                          {task.bestanden.length > 0 && (
                            <span className="flex items-center gap-0.5 text-[9px] text-autronis-text-tertiary">
                              <FileCode className="w-2.5 h-2.5" />
                              {task.bestanden.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cmd.feedback && cmd.status === "rejected" && (
                <p className="mt-2 text-[10px] text-red-400 italic">{cmd.feedback}</p>
              )}
            </div>
          ))}

          {/* Pending approval actions */}
          {pendingApprovals.map((approval) => (
            <div key={approval.id} className={cn(
              "p-3 rounded-lg border",
              approval.permissie === "red" ? "bg-red-500/5 border-red-500/20" :
              approval.permissie === "yellow" ? "bg-amber-500/5 border-amber-500/20" :
              "bg-green-500/5 border-green-500/20"
            )}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  approval.permissie === "red" ? "bg-red-400" :
                  approval.permissie === "yellow" ? "bg-amber-400" : "bg-green-400"
                )} />
                <p className="text-xs font-semibold text-autronis-text-primary">{approval.titel}</p>
                <span className={cn(
                  "text-[8px] px-1.5 py-0.5 rounded font-semibold",
                  approval.permissie === "red" ? "bg-red-500/15 text-red-400" :
                  approval.permissie === "yellow" ? "bg-amber-500/15 text-amber-400" :
                  "bg-green-500/15 text-green-400"
                )}>
                  {approval.permissie === "red" ? "GOEDKEURING VEREIST" :
                   approval.permissie === "yellow" ? "MELDING" : "AUTOMATISCH"}
                </span>
              </div>

              {rejectId === approval.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReject(approval.id)}
                    placeholder="Feedback voor het team..."
                    className="w-full px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border/50 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(approval.id)}
                      className="px-3 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-medium hover:bg-red-500/25">
                      Afwijzen
                    </button>
                    <button onClick={() => { setRejectId(null); setFeedback(""); }}
                      className="px-3 py-1 rounded-lg bg-autronis-border/30 text-autronis-text-tertiary text-[11px] hover:bg-autronis-border/50">
                      Annuleer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => approveApproval(approval.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-[11px] font-medium hover:bg-green-500/25 transition-colors">
                    <Check className="w-3 h-3" />
                    Goedkeuren
                  </button>
                  <button onClick={() => setRejectId(approval.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors">
                    <X className="w-3 h-3" />
                    Afwijzen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
