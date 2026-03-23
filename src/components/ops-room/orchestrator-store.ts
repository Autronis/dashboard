import { create } from "zustand";
import type { Command, Plan, PlanTask, ApprovalRequest, CommandStatus, TheoQueueItem, PermissionLevel, TaskStatus } from "./orchestrator-types";
import { playNotification, playSuccess, playError, playApproval } from "./sounds";

interface TaskResult {
  taskId: string;
  agentId: string;
  output: Record<string, unknown>;
  reviewResult: Record<string, unknown> | null;
  tokensUsed: number;
}

interface CostTracker {
  totalTokens: number;
  totalCost: number; // EUR, approximate
}

export interface LogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  type: "info" | "task_start" | "task_complete" | "review" | "error" | "approval";
  message: string;
}

interface OrchestratorState {
  commands: Command[];
  approvals: ApprovalRequest[];
  activeCommandId: string | null;
  isProcessing: boolean;
  taskResults: TaskResult[];
  executingTaskId: string | null;
  logs: LogEntry[];
  costs: CostTracker;
  theoQueue: TheoQueueItem[];
  activeAgents: Set<string>; // agents currently executing tasks
  abortControllers: Map<string, AbortController>; // per-command abort controllers
  autoApproveTimers: Map<string, ReturnType<typeof setTimeout>>; // yellow auto-approve timers

  // Actions
  submitCommand: (opdracht: string) => Promise<void>;
  answerIntake: (commandId: string, antwoorden: string[]) => Promise<void>;
  updateCommandStatus: (id: string, status: CommandStatus) => void;
  approveApproval: (id: string) => void;
  rejectApproval: (id: string, feedback: string) => void;
  setActiveCommand: (id: string | null) => void;
  executePlan: (commandId: string) => Promise<void>;
  killExecution: (commandId?: string) => void;
}

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

function addLog(set: (fn: (s: OrchestratorState) => Partial<OrchestratorState>) => void, agentId: string, type: LogEntry["type"], message: string) {
  set((s) => ({
    logs: [{ id: genId("log"), timestamp: new Date().toISOString(), agentId, type, message }, ...s.logs].slice(0, 100),
  }));
}

export const useOrchestrator = create<OrchestratorState>((set, get) => ({
  commands: [],
  approvals: [],
  activeCommandId: null,
  isProcessing: false,
  taskResults: [],
  executingTaskId: null,
  logs: [],
  costs: { totalTokens: 0, totalCost: 0 } as CostTracker,
  theoQueue: [],
  activeAgents: new Set<string>(),
  abortControllers: new Map<string, AbortController>(),
  autoApproveTimers: new Map<string, ReturnType<typeof setTimeout>>(),

  submitCommand: async (opdracht: string) => {
    const cmdId = genId("cmd");
    const command: Command = {
      id: cmdId,
      dbId: null,
      opdracht,
      status: "pending",
      plan: null,
      aangemaakt: new Date().toISOString(),
      feedback: null,
      intakeVragen: null,
      intakeAntwoorden: null,
    };

    set((s) => ({
      commands: [command, ...s.commands],
      activeCommandId: cmdId,
      isProcessing: true,
    }));

    addLog(set, "theo", "info", `Opdracht ontvangen: "${opdracht.slice(0, 60)}"`);

    // === DAAN INTAKE CHECK ===
    // Quick check if the command is clear enough to plan
    try {
      const intakeRes = await fetch("/api/ops-room/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opdracht, mode: "intake" }),
      });

      if (intakeRes.ok) {
        const intakeData = await intakeRes.json();
        if (intakeData.needsIntake && intakeData.vragen?.length > 0) {
          // DAAN needs more info — pause and ask questions
          addLog(set, "daan", "info", `Opdracht onduidelijk — ${intakeData.vragen.length} vervolgvragen`);
          set((s) => ({
            commands: s.commands.map((c) => c.id === cmdId ? {
              ...c,
              status: "intake" as const,
              intakeVragen: intakeData.vragen as string[],
            } : c),
            isProcessing: false,
          }));
          playNotification();
          return; // Wait for answerIntake()
        }
      }
    } catch {
      // Intake check failed — proceed with planning anyway
    }

    // === PLANNING ===
    await get()._planCommand(cmdId, opdracht);
  },

  // Called when user answers DAAN's intake questions
  answerIntake: async (commandId: string, antwoorden: string[]) => {
    const cmd = get().commands.find((c) => c.id === commandId);
    if (!cmd || cmd.status !== "intake") return;

    set((s) => ({
      commands: s.commands.map((c) => c.id === commandId ? {
        ...c,
        intakeAntwoorden: antwoorden,
        status: "planning" as const,
      } : c),
      isProcessing: true,
    }));

    // Build enriched command from original + Q&A
    const qaContext = (cmd.intakeVragen ?? []).map((q, i) => `V: ${q}\nA: ${antwoorden[i] ?? "—"}`).join("\n");
    const enrichedOpdracht = `${cmd.opdracht}\n\nExtra context:\n${qaContext}`;

    addLog(set, "daan", "task_complete", "Intake afgerond, door naar planning");
    await get()._planCommand(commandId, enrichedOpdracht);
  },

  updateCommandStatus: (id, status) => {
    set((s) => ({
      commands: s.commands.map((c) => c.id === id ? { ...c, status } : c),
    }));
  },

  approveApproval: (id) => {
    const state = get();
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval) return;

    set((s) => ({
      approvals: s.approvals.map((a) =>
        a.id === id ? { ...a, status: "approved" as const } : a
      ),
    }));

    // If it's a plan approval, update the command and start execution
    if (approval.type === "plan") {
      set((s) => ({
        commands: s.commands.map((c) => {
          if (c.id !== approval.commandId) return c;
          const plan = c.plan;
          if (!plan) return c;
          return {
            ...c,
            status: "in_progress" as const,
            plan: { ...plan, goedgekeurd: true, goedgekeurdOp: new Date().toISOString() },
          };
        }),
      }));

      playApproval();

      // Immediately activate ALL agents from the plan in the office
      const cmd = get().commands.find((c) => c.id === approval.commandId);
      if (cmd?.plan) {
        const planAgents = new Set(cmd.plan.taken.map((t) => t.agentId).filter(Boolean) as string[]);
        set((s) => {
          const next = new Set(s.activeAgents);
          planAgents.forEach((a) => next.add(a));
          return { activeAgents: next };
        });
      }

      // Start executing the plan
      get().executePlan(approval.commandId);
    }
  },

  rejectApproval: (id, feedback) => {
    const state = get();
    const approval = state.approvals.find((a) => a.id === id);
    if (!approval) return;

    set((s) => ({
      approvals: s.approvals.map((a) =>
        a.id === id ? { ...a, status: "rejected" as const, feedback } : a
      ),
    }));

    // If plan rejected, update command
    if (approval.type === "plan") {
      set((s) => ({
        commands: s.commands.map((c) =>
          c.id === approval.commandId ? { ...c, status: "rejected" as const, feedback } : c
        ),
      }));
    }
  },

  setActiveCommand: (id) => set({ activeCommandId: id }),

  executePlan: async (commandId: string) => {
    const state = get();
    const cmd = state.commands.find((c) => c.id === commandId);
    if (!cmd?.plan || !cmd.plan.goedgekeurd) return;

    const controller = new AbortController();
    set({ abortController: controller });

    const completedOutputs: string[] = [];
    const lockedFiles = new Set<string>();
    const completedTaskIds = new Set<string>();
    const failedTaskIds = new Set<string>();
    const inFlightTaskIds = new Set<string>();

    // Helper: sync task status to DB (fire-and-forget)
    const dbId = cmd.dbId;
    function syncTaskToDb(taskId: string, status: string, commandStatus?: string) {
      if (!dbId) return;
      fetch("/api/ops-room/orchestrate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
        body: JSON.stringify({
          id: dbId,
          taskUpdates: [{ taskId, status }],
          commandStatus,
        }),
      }).catch(() => {/* best effort */});
    }

    // Mark command as in_progress in DB
    if (dbId) {
      fetch("/api/ops-room/orchestrate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
        body: JSON.stringify({ id: dbId, commandStatus: "in_progress" }),
      }).catch(() => {});
    }

    // Helper: get fresh task list from store
    function getFreshTasks(): PlanTask[] {
      const c = get().commands.find((c) => c.id === commandId);
      return c?.plan?.taken ?? [];
    }

    // Helper: update a single task status in store
    function updateTaskStatus(taskId: string, status: TaskStatus, extra?: Record<string, unknown>) {
      set((s) => ({
        commands: s.commands.map((c) => {
          if (c.id !== commandId || !c.plan) return c;
          return {
            ...c,
            plan: {
              ...c.plan,
              taken: c.plan.taken.map((t) =>
                t.id === taskId ? { ...t, status, ...extra } : t
              ),
            },
          };
        }),
      }));
    }

    // Execute a single task (returns promise)
    async function executeTask(task: PlanTask): Promise<void> {
      const agentId = task.agentId ?? "unknown";
      task.bestanden.forEach((f) => lockedFiles.add(f));
      inFlightTaskIds.add(task.id);

      addLog(set, agentId, "task_start", `Start: ${task.titel}`);

      // Activate agent in office
      set((s) => {
        const next = new Set(s.activeAgents);
        next.add(agentId);
        return { activeAgents: next };
      });

      // Mark task as in_progress
      updateTaskStatus(task.id, "in_progress");
      syncTaskToDb(task.id, "in_progress");

      try {
        const freshCmd = get().commands.find((c) => c.id === commandId);
        const context = `Opdracht: ${freshCmd?.opdracht ?? ""}\nPlan: ${freshCmd?.plan?.beschrijving ?? ""}\n\nEerdere output:\n${completedOutputs.join("\n---\n")}`;

        if (controller.signal.aborted) throw new Error("Gestopt");

        const execRes = await fetch("/api/ops-room/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ops-token": "autronis-ops-2026",
          },
          body: JSON.stringify({ task, context, mode: "execute" }),
          signal: controller.signal,
        });

        if (!execRes.ok) throw new Error("Uitvoering mislukt");
        const execData = await execRes.json();

        // Write files if output contains bestanden
        const result = execData.result as Record<string, unknown>;
        if (result.bestanden && Array.isArray(result.bestanden)) {
          addLog(set, agentId, "info", `Schrijft ${(result.bestanden as unknown[]).length} bestanden...`);
          await fetch("/api/ops-room/write-files", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
            body: JSON.stringify({ bestanden: result.bestanden }),
          });
        }

        const output = JSON.stringify(result);
        completedOutputs.push(`${agentId}: ${output.slice(0, 200)}`);

        // Unlock files immediately so dependent tasks can start
        task.bestanden.forEach((f) => lockedFiles.delete(f));

        // Track tokens
        const execTokens = (execData.tokens?.input_tokens ?? 0) + (execData.tokens?.output_tokens ?? 0);
        set((s) => ({
          costs: {
            totalTokens: s.costs.totalTokens + execTokens,
            totalCost: s.costs.totalCost + (execTokens / 1_000_000) * 15,
          },
        }));

        addLog(set, agentId, "task_complete", `Klaar: ${task.titel} (${execTokens} tokens)`);
        playSuccess();

        // Fire-and-forget review by Toby (non-blocking)
        fetch("/api/ops-room/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ops-token": "autronis-ops-2026",
          },
          body: JSON.stringify({ task, context: output, mode: "review" }),
        }).then(async (reviewRes) => {
          if (!reviewRes.ok) return;
          const reviewData = await reviewRes.json();
          const reviewResult = reviewData.result as Record<string, unknown> | null;
          if (reviewResult) {
            const approved = reviewResult.goedgekeurd;
            addLog(set, "toby", "review", `Review ${task.titel}: ${approved ? "✓ goedgekeurd" : "✗ changes requested"}`);
          }
        }).catch(() => {/* review is best-effort */});

        // Mark completed immediately (review runs in background)
        completedTaskIds.add(task.id);
        inFlightTaskIds.delete(task.id);
        set((s) => ({
          taskResults: [...s.taskResults, {
            taskId: task.id,
            agentId,
            output: execData.result,
            reviewResult: null,
            tokensUsed: execTokens,
          }],
        }));
        updateTaskStatus(task.id, "completed", {
          reviewStatus: "pending" as const,
        });
        syncTaskToDb(task.id, "completed");

        // Deactivate agent (only if no other in-flight task uses this agent)
        const stillBusy = [...inFlightTaskIds].some((tid) => {
          const t = getFreshTasks().find((tt) => tt.id === tid);
          return t?.agentId === agentId;
        });
        if (!stillBusy) {
          set((s) => {
            const next = new Set(s.activeAgents);
            next.delete(agentId);
            return { activeAgents: next };
          });
        }

      } catch (error) {
        playError();
        task.bestanden.forEach((f) => lockedFiles.delete(f));
        inFlightTaskIds.delete(task.id);
        failedTaskIds.add(task.id);

        set((s) => {
          const next = new Set(s.activeAgents);
          next.delete(agentId);
          return { activeAgents: next };
        });
        addLog(set, agentId, "error", `Fout bij ${task.titel}: ${error instanceof Error ? error.message : "onbekend"}`);
        updateTaskStatus(task.id, "blocked");
        syncTaskToDb(task.id, "blocked");
      }
    }

    // === Scheduler loop: run tasks in parallel waves ===
    let maxIterations = 50; // safety limit
    while (maxIterations-- > 0) {
      if (controller.signal.aborted) break;

      const freshTasks = getFreshTasks();
      const pendingTasks = freshTasks.filter((t) =>
        !completedTaskIds.has(t.id) && !failedTaskIds.has(t.id) && !inFlightTaskIds.has(t.id)
      );

      if (pendingTasks.length === 0 && inFlightTaskIds.size === 0) break;
      if (pendingTasks.length === 0 && inFlightTaskIds.size > 0) {
        // Wait for in-flight tasks to finish
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Find tasks whose dependencies are all completed
      const readyTasks = pendingTasks.filter((task) =>
        task.afhankelijkVan.every((depId) => completedTaskIds.has(depId))
      );

      // Filter out tasks with file conflicts
      const launchable = readyTasks.filter((task) =>
        !task.bestanden.some((f) => lockedFiles.has(f))
      );

      if (launchable.length === 0) {
        if (inFlightTaskIds.size > 0) {
          // Wait for in-flight tasks to free up dependencies/files
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        // No tasks can run and nothing in-flight — deadlock or all blocked
        break;
      }

      // Launch all launchable tasks in parallel
      const promises = launchable.map((task) => executeTask(task));
      await Promise.allSettled(promises);
    }

    // All tasks done — mark command as completed or review
    const updatedCmd = get().commands.find((c) => c.id === commandId);
    const allDone = updatedCmd?.plan?.taken.every((t) => t.status === "completed");

    if (allDone) {
      addLog(set, "theo", "task_complete", `Opdracht volledig afgerond! Agents gaan naar stand-by.`);
      playSuccess();
    }

    // Sync final status to DB
    if (dbId) {
      fetch("/api/ops-room/orchestrate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
        body: JSON.stringify({ id: dbId, commandStatus: allDone ? "completed" : "review" }),
      }).catch(() => {});
    }

    set((s) => ({
      executingTaskId: null,
      abortController: null,
      activeAgents: new Set<string>(),
      commands: s.commands.map((c) =>
        c.id === commandId ? { ...c, status: allDone ? "completed" as const : "review" as const } : c
      ),
    }));
  },

  killExecution: () => {
    const state = get();
    if (state.abortController) {
      state.abortController.abort();
    }
    playError();
    addLog(set, "theo", "error", "Uitvoering handmatig gestopt door Sem!");
    set((s) => ({
      isProcessing: false,
      executingTaskId: null,
      abortController: null,
      activeAgents: new Set<string>(),
      commands: s.commands.map((c) =>
        c.status === "in_progress" ? { ...c, status: "rejected" as const, feedback: "Handmatig gestopt" } : c
      ),
    }));
  },
}));
