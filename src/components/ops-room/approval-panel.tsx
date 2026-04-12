"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Clock, ChevronDown, ChevronUp, User, FileCode, Loader2, CheckCircle2, MessageCircleQuestion, Timer, Lightbulb, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrchestrator } from "./orchestrator-store";
import { SPECIALIZATION_LABELS } from "./orchestrator-types";
import type { AgentSpecialization } from "./orchestrator-types";

interface DbTask {
  id: string;
  titel: string;
  beschrijving: string;
  agentId: string | null;
  specialisatie: string;
  bestanden: string[];
  status: string;
  afhankelijkVan?: string[];
}

interface DbCommand {
  id: number;
  opdracht: string;
  status: string;
  plan: { beschrijving: string; taken: DbTask[] } | null;
  bron: string;
  feedback: string | null;
  aangemaakt: string;
}

// Toby score progress ring
function ScoreRing({ score }: { score: number }) {
  const R = 10;
  const circ = 2 * Math.PI * R;
  const fill = (score / 10) * circ;
  const color = score >= 8 ? "#4ade80" : score >= 6 ? "#fb923c" : "#f87171";
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6 shrink-0" title={`Toby score: ${score}/10`}>
      <svg width={24} height={24} viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={12} cy={12} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
        <circle cx={12} cy={12} r={R} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[7px] font-bold" style={{ color }}>{score}</span>
    </span>
  );
}

// Dependency graph view
function DependencyGraph({ tasks }: { tasks: DbTask[] }) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const levels = new Map<string, number>();

  function getLevel(id: string, depth = 0): number {
    if (depth > 10) return 0; // prevent infinite loops
    if (levels.has(id)) return levels.get(id)!;
    const task = taskMap.get(id);
    const deps = task?.afhankelijkVan ?? [];
    if (deps.length === 0) { levels.set(id, 0); return 0; }
    const maxDep = Math.max(...deps.map((d) => getLevel(d, depth + 1)));
    levels.set(id, maxDep + 1);
    return maxDep + 1;
  }

  tasks.forEach((t) => getLevel(t.id));
  const maxLevel = Math.max(0, ...Array.from(levels.values()));

  const byLevel: Map<number, DbTask[]> = new Map();
  tasks.forEach((t) => {
    const lvl = levels.get(t.id) ?? 0;
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(t);
  });

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-3 min-w-max">
        {Array.from({ length: maxLevel + 1 }, (_, lvl) => (
          <div key={lvl} className="flex flex-col gap-1.5">
            <div className="text-[8px] text-autronis-text-tertiary text-center px-1">
              {lvl === 0 ? "Start" : `Stap ${lvl + 1}`}
            </div>
            {(byLevel.get(lvl) ?? []).map((task) => (
              <div
                key={task.id}
                className={cn(
                  "px-2 py-1.5 rounded-lg border text-[10px] w-[110px]",
                  task.status === "completed" && "bg-emerald-500/10 border-green-500/25 text-emerald-400",
                  task.status === "in_progress" && "bg-blue-500/10 border-blue-500/25 text-blue-400",
                  task.status === "review" && "bg-purple-500/10 border-purple-500/25 text-purple-400",
                  task.status === "blocked" && "bg-red-500/10 border-red-500/25 text-red-400",
                  (!task.status || task.status === "queued" || task.status === "assigned") && "bg-autronis-bg border-autronis-border/25 text-autronis-text-secondary",
                )}
              >
                <p className="truncate font-medium leading-tight">{task.titel}</p>
                {task.agentId && (
                  <p className="text-[8px] opacity-60 mt-0.5 truncate">{task.agentId}</p>
                )}
                {(task.afhankelijkVan ?? []).length > 0 && (
                  <p className="text-[8px] opacity-40 mt-0.5">← {(task.afhankelijkVan ?? []).length} dep</p>
                )}
              </div>
            ))}
            {/* Arrow between columns */}
            {lvl < maxLevel && (
              <div className="flex items-center justify-center text-autronis-text-tertiary text-xs opacity-30 mt-1">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Agent load indicator — shows how many tasks each agent has in a plan
function AgentLoadRow({ tasks }: { tasks: DbTask[] }) {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.agentId) counts.set(t.agentId, (counts.get(t.agentId) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {Array.from(counts.entries()).map(([id, n]) => (
        <span
          key={id}
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold",
            n >= 3 ? "bg-red-500/15 text-red-400" :
            n === 2 ? "bg-amber-500/15 text-amber-400" :
            "bg-autronis-border/25 text-autronis-text-secondary"
          )}
          title={`${id}: ${n} ${n === 1 ? "taak" : "taken"}`}
        >
          {id} ×{n}
        </span>
      ))}
    </div>
  );
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "zojuist";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}u`;
}

// Shared task list renderer
function TaskList({ tasks, taskScores }: {
  tasks: DbTask[];
  taskScores?: Map<string, number>; // taskId → Toby score
}) {
  return (
    <div className="space-y-1.5">
      {tasks.map((task, i) => {
        const score = taskScores?.get(task.id);
        return (
          <div key={task.id ?? i} className={cn(
            "flex items-start gap-2 p-2 rounded border",
            task.status === "completed" && "bg-emerald-500/5 border-emerald-500/20",
            task.status === "in_progress" && "bg-blue-500/5 border-blue-500/20",
            task.status === "review" && "bg-purple-500/5 border-purple-500/20",
            task.status === "blocked" && "bg-red-500/5 border-red-500/20",
            (!task.status || task.status === "queued" || task.status === "assigned") && "bg-autronis-card/50 border-autronis-border/20",
          )}>
            <span className={cn(
              "text-[9px] mt-0.5 font-bold shrink-0",
              task.status === "completed" ? "text-emerald-400" :
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
            {/* Toby score ring — shown when review is done */}
            {score !== undefined && <ScoreRing score={score} />}
          </div>
        );
      })}
    </div>
  );
}

export function ApprovalPanel() {
  const { commands: localCommands, approvals, approveApproval, rejectApproval, answerIntake, answerIdee, taskResults } = useOrchestrator();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState(true);
  const [graphView, setGraphView] = useState<Record<number, boolean>>({});
  const queryClient = useQueryClient();

  // Build a map of taskId → Toby score from taskResults
  const taskScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const result of taskResults) {
      const score = (result.reviewResult as { score?: number } | null)?.score;
      if (score !== undefined) map.set(result.taskId, score);
    }
    return map;
  }, [taskResults]);

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
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const recentlyCompleted = mergedCommands.filter((c) =>
    c.status === "completed" && new Date(c.aangemaakt).getTime() > tenMinAgo
  ).slice(0, 3);

  // Zustand-only pending approvals (for the approve/reject buttons — these trigger executePlan)
  const pendingApprovalItems = approvals.filter((a) => a.status === "pending");

  // Intake commands (DAAN needs answers)
  const intakeCommands = localCommands.filter((c) => c.status === "intake" && c.intakeVragen?.length);
  const ideeCommands = localCommands.filter((c) => c.status === "intake_idee" && c.intakeVragen?.length);

  const handleReject = (id: string) => {
    rejectApproval(id, feedback);
    setRejectId(null);
    setFeedback("");
  };

  const totalVisible = pendingCommands.length + activeCommands.length + recentlyCompleted.length + pendingApprovalItems.length + intakeCommands.length + ideeCommands.length;
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
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
              {activeCommands.length} actief
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-autronis-text-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-autronis-text-tertiary" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">

          {/* === DAAN INTAKE — follow-up questions === */}
          {intakeCommands.map((cmd) => {
            const answers = intakeAnswers[cmd.id] ?? (cmd.intakeVragen ?? []).map(() => "");
            return (
              <div key={`intake-${cmd.id}`} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircleQuestion className="w-3.5 h-3.5 text-blue-400" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">
                    DAAN intake
                  </span>
                </div>
                <p className="text-[10px] text-autronis-text-secondary mb-3">
                  DAAN heeft een paar vragen om de opdracht te verduidelijken:
                </p>
                <div className="space-y-2 mb-3">
                  {(cmd.intakeVragen ?? []).map((vraag, i) => (
                    <div key={i}>
                      <p className="text-[11px] text-autronis-text-primary font-medium mb-1">{vraag}</p>
                      <input
                        type="text"
                        value={answers[i] ?? ""}
                        onChange={(e) => {
                          const next = [...answers];
                          next[i] = e.target.value;
                          setIntakeAnswers((prev) => ({ ...prev, [cmd.id]: next }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && answers.every((a) => a.trim())) {
                            answerIntake(cmd.id, answers);
                          }
                        }}
                        placeholder="Antwoord..."
                        className="w-full px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border/50 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => answerIntake(cmd.id, answers)}
                  disabled={!answers.every((a) => a.trim())}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-[11px] font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Check className="w-3 h-3" />Beantwoorden & doorgaan
                </button>
              </div>
            );
          })}

          {/* === DAAN IDEE INTAKE — idea sparring === */}
          {ideeCommands.map((cmd) => {
            const answers = intakeAnswers[cmd.id] ?? (cmd.intakeVragen ?? []).map(() => "");
            return (
              <div key={`idee-${cmd.id}`} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-medium">
                    DAAN idee-modus
                  </span>
                </div>
                <p className="text-[10px] text-autronis-text-secondary mb-3">
                  DAAN wil even sparren over dit idee:
                </p>
                <div className="space-y-2 mb-3">
                  {(cmd.intakeVragen ?? []).map((vraag, i) => (
                    <div key={i}>
                      <p className="text-[11px] text-autronis-text-primary font-medium mb-1">{vraag}</p>
                      <input
                        type="text"
                        value={answers[i] ?? ""}
                        onChange={(e) => {
                          const next = [...answers];
                          next[i] = e.target.value;
                          setIntakeAnswers((prev) => ({ ...prev, [cmd.id]: next }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && answers.every((a) => a.trim())) {
                            answerIdee(cmd.id, answers);
                          }
                        }}
                        placeholder="Antwoord..."
                        className="w-full px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border/50 text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => answerIdee(cmd.id, answers)}
                  disabled={!answers.every((a) => a.trim())}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-[11px] font-medium hover:bg-amber-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Lightbulb className="w-3 h-3" />Idee uitwerken & opslaan
                </button>
              </div>
            );
          })}

          {/* === ACTIVE COMMANDS — progress tracker === */}
          {activeCommands.map((cmd) => {
            const tasks = cmd.plan?.taken ?? [];
            const done = tasks.filter((t) => t.status === "completed").length;
            const total = tasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={`active-${cmd.id}`} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
                    {done}/{total} taken
                  </span>
                  <span className="text-[9px] text-autronis-text-tertiary">{timeAgo(cmd.aangemaakt)}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-autronis-border/30 mb-3 overflow-hidden">
                  <div className="h-full rounded-full bg-green-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                {tasks.length > 0 && <TaskList tasks={tasks} taskScores={taskScoreMap} />}
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
            const isGraphView = graphView[cmd.id] ?? false;
            const hasDeps = (cmd.plan?.taken ?? []).some((t) => (t.afhankelijkVan ?? []).length > 0);

            return (
              <div key={`pending-${cmd.id}`} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
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
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[10px] text-autronis-text-secondary font-medium flex-1">{cmd.plan.beschrijving}</p>
                      {hasDeps && (
                        <button
                          onClick={() => setGraphView((prev) => ({ ...prev, [cmd.id]: !prev[cmd.id] }))}
                          className={cn(
                            "flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors",
                            isGraphView
                              ? "bg-autronis-accent/20 text-autronis-accent"
                              : "bg-autronis-border/20 text-autronis-text-tertiary hover:text-autronis-text-secondary"
                          )}
                        >
                          <GitBranch className="w-2.5 h-2.5" />
                          {isGraphView ? "Lijst" : "Graph"}
                        </button>
                      )}
                    </div>
                    <AgentLoadRow tasks={cmd.plan.taken} />
                    {isGraphView
                      ? <DependencyGraph tasks={cmd.plan.taken} />
                      : <TaskList tasks={cmd.plan.taken} />
                    }
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
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      // Cancel auto-approve timer if exists
                      if (zustandApproval) {
                        const timer = useOrchestrator.getState().autoApproveTimers.get(zustandApproval.id);
                        if (timer) clearTimeout(timer);
                        approveApproval(zustandApproval.id);
                      }
                      handleDbApprove(cmd.id);
                    }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/25 transition-colors">
                      <Check className="w-3 h-3" />Goedkeuren
                    </button>
                    <button onClick={() => {
                      // Cancel auto-approve timer on reject
                      if (zustandApproval) {
                        const timer = useOrchestrator.getState().autoApproveTimers.get(zustandApproval.id);
                        if (timer) clearTimeout(timer);
                      }
                      setRejectId(`db-${cmd.id}`);
                    }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors">
                      <X className="w-3 h-3" />Afwijzen
                    </button>
                    {zustandApproval?.permissie === "yellow" && (
                      <span className="flex items-center gap-1 text-[9px] text-amber-400 ml-auto">
                        <Timer className="w-3 h-3" />auto-approve 10s
                      </span>
                    )}
                    {zustandApproval?.permissie === "red" && (
                      <span className="flex items-center gap-1 text-[9px] text-red-400 ml-auto">
                        handmatig vereist
                      </span>
                    )}
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
              <div key={`done-${cmd.id}`} className="p-3 rounded-lg bg-emerald-500/5 border border-green-500/15 opacity-80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-xs font-semibold text-autronis-text-primary flex-1">{cmd.opdracht}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
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
