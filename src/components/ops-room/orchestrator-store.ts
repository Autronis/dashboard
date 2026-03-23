import { create } from "zustand";
import type { Command, Plan, PlanTask, ApprovalRequest, CommandStatus, TheoQueueItem, PermissionLevel } from "./orchestrator-types";
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
  abortController: AbortController | null;

  // Actions
  submitCommand: (opdracht: string) => Promise<void>;
  updateCommandStatus: (id: string, status: CommandStatus) => void;
  approveApproval: (id: string) => void;
  rejectApproval: (id: string, feedback: string) => void;
  setActiveCommand: (id: string | null) => void;
  executePlan: (commandId: string) => Promise<void>;
  killExecution: () => void;
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
  abortController: null,

  submitCommand: async (opdracht: string) => {
    const cmdId = genId("cmd");
    const command: Command = {
      id: cmdId,
      opdracht,
      status: "pending",
      plan: null,
      aangemaakt: new Date().toISOString(),
      feedback: null,
    };

    set((s) => ({
      commands: [command, ...s.commands],
      activeCommandId: cmdId,
      isProcessing: true,
    }));

    // Update to "planning" — Theo sends to Jones
    addLog(set, "theo", "info", `Opdracht ontvangen: "${opdracht.slice(0, 60)}"`);
    set((s) => ({
      commands: s.commands.map((c) => c.id === cmdId ? { ...c, status: "planning" as const } : c),
    }));
    addLog(set, "jones", "info", "Plan wordt opgesteld...");

    try {
      // Call Theo's API to create a plan
      const res = await fetch("/api/ops-room/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opdracht }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout ?? "Plan maken mislukt");
      }

      const data = await res.json();
      const plan: Plan = {
        id: genId("plan"),
        commandId: cmdId,
        beschrijving: data.plan.beschrijving,
        taken: data.plan.taken as PlanTask[],
        goedgekeurd: null,
        goedgekeurdOp: null,
      };

      // Update command with plan, set to awaiting_approval
      set((s) => ({
        commands: s.commands.map((c) => c.id === cmdId ? { ...c, plan, status: "awaiting_approval" as const } : c),
        isProcessing: false,
      }));

      addLog(set, "jones", "task_complete", `Plan klaar: ${plan.beschrijving.slice(0, 60)}`);
      addLog(set, "theo", "approval", `Plan wacht op goedkeuring van Sem (${plan.taken.length} taken)`);
      playNotification();

      // Create approval request for Sem
      // Determine permission level based on what the plan involves
      const hasDbChanges = plan.taken.some((t: PlanTask) => t.bestanden.some((f: string) => f.includes("schema") || f.includes("migration")));
      const hasDeployOrPush = opdracht.toLowerCase().includes("deploy") || opdracht.toLowerCase().includes("push");
      const permLevel: PermissionLevel = hasDbChanges || hasDeployOrPush ? "red" : "yellow";

      const approval: ApprovalRequest = {
        id: genId("apr"),
        type: "plan",
        permissie: permLevel,
        titel: `Plan: ${opdracht.slice(0, 50)}${opdracht.length > 50 ? "..." : ""}`,
        beschrijving: `${plan.beschrijving}\n\n${plan.taken.length} taken gepland voor ${new Set(plan.taken.map((t: PlanTask) => t.agentId)).size} agents.`,
        commandId: cmdId,
        taskId: null,
        agentId: "theo",
        status: "pending",
        feedback: null,
        aangemaakt: new Date().toISOString(),
      };

      set((s) => ({
        approvals: [approval, ...s.approvals],
      }));

    } catch (error) {
      const msg = error instanceof Error ? error.message : "Onbekend";
      set((s) => ({
        commands: s.commands.map((c) => c.id === cmdId ? { ...c, status: "rejected" as const, feedback: msg } : c),
        isProcessing: false,
      }));
    }
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

    const tasks = cmd.plan.taken;
    const completedOutputs: string[] = [];
    const lockedFiles = new Set<string>(); // file locking

    for (const task of tasks) {
      // Check dependencies
      const depsComplete = task.afhankelijkVan.every((depId) => {
        const depTask = tasks.find((t) => t.id === depId);
        return depTask?.status === "completed";
      });
      if (!depsComplete) continue;

      // File locking: check if any of this task's files are locked
      const hasConflict = task.bestanden.some((f) => lockedFiles.has(f));
      if (hasConflict) {
        // Mark as blocked, will retry on next pass
        set((s) => ({
          commands: s.commands.map((c) => {
            if (c.id !== commandId || !c.plan) return c;
            return { ...c, plan: { ...c.plan, taken: c.plan.taken.map((t) =>
              t.id === task.id ? { ...t, status: "blocked" as const } : t
            )}};
          }),
        }));
        continue;
      }

      // Lock files for this task
      task.bestanden.forEach((f) => lockedFiles.add(f));
      const agentId = task.agentId ?? "unknown";
      addLog(set, agentId, "task_start", `Start: ${task.titel}`);

      // Activate agent in office
      set((s) => {
        const next = new Set(s.activeAgents);
        next.add(agentId);
        return { activeAgents: next };
      });

      // Mark task as in_progress
      set((s) => ({
        executingTaskId: task.id,
        commands: s.commands.map((c) => {
          if (c.id !== commandId || !c.plan) return c;
          return {
            ...c,
            plan: {
              ...c.plan,
              taken: c.plan.taken.map((t) =>
                t.id === task.id ? { ...t, status: "in_progress" as const } : t
              ),
            },
          };
        }),
      }));

      try {
        // Execute task via Claude API
        const context = `Opdracht: ${cmd.opdracht}\nPlan: ${cmd.plan.beschrijving}\n\nEerdere output:\n${completedOutputs.join("\n---\n")}`;

        if (controller.signal.aborted) break;

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
          addLog(set, task.agentId ?? "unknown", "info", `Schrijft ${(result.bestanden as unknown[]).length} bestanden...`);
          await fetch("/api/ops-room/write-files", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-ops-token": "autronis-ops-2026" },
            body: JSON.stringify({ bestanden: result.bestanden }),
          });
        }

        // Store result
        const output = JSON.stringify(result);
        completedOutputs.push(`${task.agentId}: ${output.slice(0, 200)}`);

        // Review by Toby
        set((s) => ({
          commands: s.commands.map((c) => {
            if (c.id !== commandId || !c.plan) return c;
            return {
              ...c,
              plan: {
                ...c.plan,
                taken: c.plan.taken.map((t) =>
                  t.id === task.id ? { ...t, status: "review" as const, resultaat: output } : t
                ),
              },
            };
          }),
        }));

        const reviewRes = await fetch("/api/ops-room/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ops-token": "autronis-ops-2026",
          },
          body: JSON.stringify({ task, context: output, mode: "review" }),
          signal: controller.signal,
        });

        let reviewResult: Record<string, unknown> | null = null;
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          reviewResult = reviewData.result;
        }

        // Unlock files
        task.bestanden.forEach((f) => lockedFiles.delete(f));
        // Track tokens
        const execTokens = (execData.tokens?.input_tokens ?? 0) + (execData.tokens?.output_tokens ?? 0);
        set((s) => ({
          costs: {
            totalTokens: s.costs.totalTokens + execTokens,
            totalCost: s.costs.totalCost + (execTokens / 1_000_000) * 15, // ~$15/M tokens blended
          },
        }));

        // Deactivate agent
        set((s) => {
          const next = new Set(s.activeAgents);
          next.delete(agentId);
          return { activeAgents: next };
        });
        addLog(set, agentId, "task_complete", `Klaar: ${task.titel} (${execTokens} tokens)`);
        playSuccess();
        if (reviewResult) {
          const approved = (reviewResult as Record<string, unknown>).goedgekeurd;
          addLog(set, "toby", "review", `Review ${task.titel}: ${approved ? "✓ goedgekeurd" : "✗ changes requested"}`);
        }

        // Mark completed
        set((s) => ({
          taskResults: [...s.taskResults, {
            taskId: task.id,
            agentId: task.agentId ?? "unknown",
            output: execData.result,
            reviewResult,
            tokensUsed: execTokens,
          }],
          commands: s.commands.map((c) => {
            if (c.id !== commandId || !c.plan) return c;
            return {
              ...c,
              plan: {
                ...c.plan,
                taken: c.plan.taken.map((t) =>
                  t.id === task.id ? {
                    ...t,
                    status: "completed" as const,
                    reviewStatus: (reviewResult as Record<string, unknown>)?.goedgekeurd ? "approved" as const : "changes_requested" as const,
                  } : t
                ),
              },
            };
          }),
        }));

      } catch (error) {
        playError();
        set((s) => {
          const next = new Set(s.activeAgents);
          next.delete(agentId);
          return { activeAgents: next };
        });
        addLog(set, agentId, "error", `Fout bij ${task.titel}: ${error instanceof Error ? error.message : "onbekend"}`);
        // Mark task as blocked
        set((s) => ({
          commands: s.commands.map((c) => {
            if (c.id !== commandId || !c.plan) return c;
            return {
              ...c,
              plan: {
                ...c.plan,
                taken: c.plan.taken.map((t) =>
                  t.id === task.id ? { ...t, status: "blocked" as const } : t
                ),
              },
            };
          }),
        }));
      }
    }

    // All tasks done — mark command as completed or review
    const updatedCmd = get().commands.find((c) => c.id === commandId);
    const allDone = updatedCmd?.plan?.taken.every((t) => t.status === "completed");

    if (allDone) {
      addLog(set, "theo", "task_complete", `Opdracht volledig afgerond! Agents gaan naar stand-by.`);
      playSuccess();
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
