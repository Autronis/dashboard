import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

// ---------- helpers ----------

interface PlanTask {
  id: string;
  titel: string;
  beschrijving: string;
  bestanden: string[];
  agentId: string | null;
  specialisatie: string;
  status: string; // queued | in_progress | completed | blocked
  afhankelijkVan: string[];
  resultaat: string | null;
  reviewStatus: string | null;
}

interface Plan {
  beschrijving: string;
  taken: PlanTask[];
}

interface WorkerRun {
  id: number;
  command_id: number;
  status: string;
  worker_token: string;
  huidige_taak_id: string | null;
  poging: number;
  max_pogingen: number;
  laatste_heartbeat: string;
  fout: string | null;
}

interface OrchestratorCommand {
  id: number;
  opdracht: string;
  status: string;
  plan_json: string;
  project_id: number | null;
}

async function ensureTable() {
  await db.run(sql`CREATE TABLE IF NOT EXISTS worker_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    huidige_taak_id TEXT,
    poging INTEGER DEFAULT 0,
    max_pogingen INTEGER DEFAULT 3,
    worker_token TEXT NOT NULL,
    laatste_heartbeat TEXT DEFAULT (datetime('now')),
    fout TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);
}

/** Fire-and-forget self-call to continue the chain */
function selfCall(commandId: number, workerToken: string, action: "step") {
  fetch(`${BASE_URL}/api/ops-room/worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
    body: JSON.stringify({ commandId, workerToken, action }),
  }).catch(() => {/* fire-and-forget */});
}

/** Update agent_activiteit so the SSE stream picks it up */
async function reportAgentActivity(agentId: string, actie: string, status: string, project?: string) {
  try {
    await fetch(`${BASE_URL}/api/ops-room/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({
        agentId,
        agentType: "builder",
        project: project ?? "ops-room",
        actie,
        status,
      }),
    });
  } catch {/* best effort */}
}

/** Sync task status to orchestrator_commands via PATCH */
async function syncTaskToDb(dbId: number, taskId: string, status: string, commandStatus?: string) {
  await fetch(`${BASE_URL}/api/ops-room/orchestrate`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
    body: JSON.stringify({
      id: dbId,
      taskUpdates: [{ taskId, status }],
      ...(commandStatus ? { commandStatus } : {}),
    }),
  }).catch(() => {});
}

// ---------- actions ----------

async function handleStart(commandId: number): Promise<NextResponse> {
  await ensureTable();

  // Invalidate old workers for this command
  await db.run(sql`
    UPDATE worker_runs SET status = 'stopped', bijgewerkt_op = datetime('now')
    WHERE command_id = ${commandId} AND status = 'running'
  `);

  const workerToken = randomUUID();

  await db.run(sql`
    INSERT INTO worker_runs (command_id, status, worker_token)
    VALUES (${commandId}, 'running', ${workerToken})
  `);

  // Create git branch (same logic as orchestrator-store)
  const cmd = await db.get<OrchestratorCommand>(sql`
    SELECT id, opdracht, status, plan_json, project_id FROM orchestrator_commands WHERE id = ${commandId}
  `);

  if (!cmd?.plan_json) {
    return NextResponse.json({ fout: "Command niet gevonden of geen plan" }, { status: 404 });
  }

  const slug = cmd.opdracht
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const branchName = `sem/${slug}`;

  // Create branch via git endpoint
  await fetch(`${BASE_URL}/api/ops-room/git`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
    body: JSON.stringify({ actie: "create-branch", branch: branchName }),
  }).catch(() => {});

  // Mark command as in_progress
  await db.run(sql`
    UPDATE orchestrator_commands SET status = 'in_progress', bijgewerkt = datetime('now')
    WHERE id = ${commandId}
  `);

  // Fire first step
  selfCall(commandId, workerToken, "step");

  return NextResponse.json({ succes: true, workerToken, branch: branchName });
}

async function handleStep(commandId: number, workerToken: string): Promise<NextResponse> {
  await ensureTable();

  // Validate worker token — if status is not 'running', stop
  const worker = await db.get<WorkerRun>(sql`
    SELECT * FROM worker_runs
    WHERE command_id = ${commandId} AND worker_token = ${workerToken}
  `);

  if (!worker || worker.status !== "running") {
    return NextResponse.json({ gestopt: true, reden: "Worker niet meer actief" });
  }

  // Update heartbeat
  await db.run(sql`
    UPDATE worker_runs SET laatste_heartbeat = datetime('now'), bijgewerkt_op = datetime('now')
    WHERE worker_token = ${workerToken}
  `);

  // Load command + plan
  const cmd = await db.get<OrchestratorCommand>(sql`
    SELECT id, opdracht, status, plan_json, project_id FROM orchestrator_commands WHERE id = ${commandId}
  `);

  if (!cmd?.plan_json) {
    await db.run(sql`UPDATE worker_runs SET status = 'failed', fout = 'Geen plan gevonden' WHERE worker_token = ${workerToken}`);
    return NextResponse.json({ fout: "Geen plan" }, { status: 404 });
  }

  const plan: Plan = JSON.parse(cmd.plan_json);
  const taken = plan.taken;

  // Find tasks that are ready: queued, all dependencies completed, no file lock conflicts
  const completedIds = new Set(taken.filter((t) => t.status === "completed").map((t) => t.id));
  const inProgressIds = new Set(taken.filter((t) => t.status === "in_progress").map((t) => t.id));
  const blockedIds = new Set(taken.filter((t) => t.status === "blocked").map((t) => t.id));

  const queuedTasks = taken.filter((t) => t.status === "queued");

  const readyTasks = queuedTasks.filter((t) =>
    t.afhankelijkVan.every((depId) => completedIds.has(depId))
  );

  // Check file conflicts with in-progress tasks
  const lockedFiles = new Set<string>();
  taken.filter((t) => t.status === "in_progress").forEach((t) => t.bestanden.forEach((f) => lockedFiles.add(f)));

  const launchable = readyTasks.filter((t) =>
    !t.bestanden.some((f) => lockedFiles.has(f))
  );

  // No ready tasks and nothing in progress → done or stuck
  if (launchable.length === 0 && inProgressIds.size === 0) {
    const allDone = taken.every((t) => t.status === "completed" || blockedIds.has(t.id));

    if (allDone || queuedTasks.length === 0) {
      // Completion: git commit, push, PR
      await handleCompletion(commandId, workerToken, cmd, plan);
      return NextResponse.json({ succes: true, status: "completed" });
    }

    // Deadlock — nothing launchable, nothing in progress, but queued tasks remain
    await db.run(sql`
      UPDATE worker_runs SET status = 'failed', fout = 'Deadlock: taken geblokkeerd', bijgewerkt_op = datetime('now')
      WHERE worker_token = ${workerToken}
    `);
    await db.run(sql`
      UPDATE orchestrator_commands SET status = 'review', bijgewerkt = datetime('now') WHERE id = ${commandId}
    `);
    return NextResponse.json({ fout: "Deadlock" }, { status: 500 });
  }

  // If nothing launchable but tasks in progress (from parallel fan-out), wait and retry
  if (launchable.length === 0 && inProgressIds.size > 0) {
    // Re-check in 3 seconds via self-call
    setTimeout(() => selfCall(commandId, workerToken, "step"), 3000);
    return NextResponse.json({ succes: true, status: "waiting", inProgress: inProgressIds.size });
  }

  // Pick first task to execute in this invocation
  const task = launchable[0];

  // Mark task as in_progress in DB
  task.status = "in_progress";
  await updatePlanInDb(commandId, plan);
  await syncTaskToDb(commandId, task.id, "in_progress");

  // Update current task in worker_runs
  await db.run(sql`
    UPDATE worker_runs SET huidige_taak_id = ${task.id}, bijgewerkt_op = datetime('now')
    WHERE worker_token = ${workerToken}
  `);

  const agentId = task.agentId ?? "wout";
  await reportAgentActivity(agentId, `Start: ${task.titel}`, "actief");

  // Fan out parallel tasks: launch additional self-calls for other launchable tasks
  for (let i = 1; i < launchable.length; i++) {
    const parallelTask = launchable[i];
    parallelTask.status = "in_progress";
    await updatePlanInDb(commandId, plan);
    await syncTaskToDb(commandId, parallelTask.id, "in_progress");
    selfCall(commandId, workerToken, "step");
  }

  // Acquire cross-team file locks
  if (task.bestanden.length > 0) {
    await fetch(`${BASE_URL}/api/ops-room/locks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ bestanden: task.bestanden, team: "sem", agentId, commandId: String(commandId) }),
    }).catch(() => {});
  }

  try {
    // Build context from completed task outputs
    const completedOutputs = taken
      .filter((t) => t.status === "completed" && t.resultaat)
      .map((t) => `${t.agentId}: ${t.resultaat}`)
      .join("\n---\n");

    const context = `Opdracht: ${cmd.opdracht}\nPlan: ${plan.beschrijving}\n\nEerdere output:\n${completedOutputs}`;

    // Execute via Claude API
    const execRes = await fetch(`${BASE_URL}/api/ops-room/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ task, context, mode: "execute", projectId: cmd.project_id }),
    });

    if (!execRes.ok) {
      const errBody = await execRes.text();
      throw new Error(`Uitvoering mislukt (${execRes.status}): ${errBody}`);
    }

    const execData = await execRes.json();
    const result = execData.result as Record<string, unknown>;

    // Write files
    if (result.bestanden && Array.isArray(result.bestanden)) {
      await fetch(`${BASE_URL}/api/ops-room/write-files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
        body: JSON.stringify({ bestanden: result.bestanden }),
      });
    }

    // Release locks
    if (task.bestanden.length > 0) {
      fetch(`${BASE_URL}/api/ops-room/locks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
        body: JSON.stringify({ bestanden: task.bestanden, team: "sem" }),
      }).catch(() => {});
    }

    // Mark task completed in plan
    task.status = "completed";
    task.resultaat = JSON.stringify(result).slice(0, 500);
    task.reviewStatus = "pending";
    await updatePlanInDb(commandId, plan);
    await syncTaskToDb(commandId, task.id, "completed");

    await reportAgentActivity(agentId, `Klaar: ${task.titel}`, "inactief");

    // Fire-and-forget review
    fetch(`${BASE_URL}/api/ops-room/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ task, context: JSON.stringify(result), mode: "review" }),
    }).catch(() => {});

    // Continue chain — next step
    selfCall(commandId, workerToken, "step");

    return NextResponse.json({
      succes: true,
      taak: task.titel,
      status: "completed",
      tokens: execData.tokens,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "onbekend";

    // Release locks on error
    if (task.bestanden.length > 0) {
      fetch(`${BASE_URL}/api/ops-room/locks`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
        body: JSON.stringify({ bestanden: task.bestanden, team: "sem" }),
      }).catch(() => {});
    }

    // Retry logic
    const poging = (worker.poging ?? 0) + 1;
    await db.run(sql`
      UPDATE worker_runs SET poging = ${poging}, bijgewerkt_op = datetime('now')
      WHERE worker_token = ${workerToken}
    `);

    if (poging < (worker.max_pogingen ?? 3)) {
      // Retry: reset task to queued
      task.status = "queued";
      await updatePlanInDb(commandId, plan);
      await syncTaskToDb(commandId, task.id, "queued");
      selfCall(commandId, workerToken, "step");
    } else {
      // Max retries reached — mark blocked
      task.status = "blocked";
      await updatePlanInDb(commandId, plan);
      await syncTaskToDb(commandId, task.id, "blocked");

      // Check if other tasks can still run
      const remaining = plan.taken.filter((t) => t.status === "queued");
      if (remaining.length > 0) {
        selfCall(commandId, workerToken, "step");
      } else {
        await db.run(sql`
          UPDATE worker_runs SET status = 'failed', fout = ${msg}, bijgewerkt_op = datetime('now')
          WHERE worker_token = ${workerToken}
        `);
      }
    }

    await reportAgentActivity(agentId, `Fout: ${task.titel}`, "error");

    return NextResponse.json({ fout: msg, poging }, { status: 500 });
  }
}

async function handleStop(commandId: number): Promise<NextResponse> {
  await ensureTable();

  await db.run(sql`
    UPDATE worker_runs SET status = 'stopped', bijgewerkt_op = datetime('now')
    WHERE command_id = ${commandId} AND status = 'running'
  `);

  // Also update command status
  await db.run(sql`
    UPDATE orchestrator_commands SET status = 'rejected', feedback = 'Worker gestopt', bijgewerkt = datetime('now')
    WHERE id = ${commandId}
  `);

  return NextResponse.json({ succes: true, status: "stopped" });
}

// ---------- completion: git commit + push + PR ----------

async function handleCompletion(commandId: number, workerToken: string, cmd: OrchestratorCommand, plan: Plan) {
  const slug = cmd.opdracht
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const branchName = `sem/${slug}`;

  try {
    // Commit
    const commitMsg = `feat: ${cmd.opdracht.slice(0, 70)}`;
    await fetch(`${BASE_URL}/api/ops-room/git`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ actie: "commit", message: commitMsg }),
    });

    // Push
    await fetch(`${BASE_URL}/api/ops-room/git`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ actie: "push", branch: branchName }),
    });

    // PR
    const takenLijst = plan.taken.map((t) => `- [x] ${t.titel} (${t.agentId})`).join("\n");
    const prBody = `## ${plan.beschrijving}\n\n### Taken\n${takenLijst}\n\n---\nAutomatisch aangemaakt door Ops Room (server worker)`;
    await fetch(`${BASE_URL}/api/ops-room/git`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ actie: "create-pr", branch: branchName, title: cmd.opdracht.slice(0, 70), beschrijving: prBody }),
    });

    // Cleanup — back to main
    await fetch(`${BASE_URL}/api/ops-room/git`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
      body: JSON.stringify({ actie: "cleanup" }),
    });
  } catch {/* git errors are non-fatal */}

  // Mark worker + command as completed
  await db.run(sql`
    UPDATE worker_runs SET status = 'completed', huidige_taak_id = NULL, bijgewerkt_op = datetime('now')
    WHERE worker_token = ${workerToken}
  `);
  await db.run(sql`
    UPDATE orchestrator_commands SET status = 'completed', bijgewerkt = datetime('now')
    WHERE id = ${commandId}
  `);
}

/** Write updated plan JSON back to orchestrator_commands */
async function updatePlanInDb(commandId: number, plan: Plan) {
  const now = new Date().toISOString();
  await db.run(sql`
    UPDATE orchestrator_commands SET plan_json = ${JSON.stringify(plan)}, bijgewerkt = ${now}
    WHERE id = ${commandId}
  `);
}

// ---------- route handler ----------

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const body = await req.json();
    const { commandId, workerToken, action } = body as {
      commandId: number;
      workerToken?: string;
      action: "start" | "step" | "stop";
    };

    if (!commandId || !action) {
      return NextResponse.json({ fout: "commandId en action zijn verplicht" }, { status: 400 });
    }

    switch (action) {
      case "start":
        return handleStart(commandId);
      case "step":
        if (!workerToken) {
          return NextResponse.json({ fout: "workerToken is verplicht voor step" }, { status: 400 });
        }
        return handleStep(commandId, workerToken);
      case "stop":
        return handleStop(commandId);
      default:
        return NextResponse.json({ fout: `Onbekende actie: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

// GET: fetch worker status for a command
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token") ?? req.nextUrl.searchParams.get("token");
    if (token !== OPS_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }

    await ensureTable();
    const commandId = req.nextUrl.searchParams.get("commandId");

    if (commandId) {
      const worker = await db.get<WorkerRun>(sql`
        SELECT * FROM worker_runs WHERE command_id = ${Number(commandId)} ORDER BY id DESC LIMIT 1
      `);
      return NextResponse.json({ worker: worker ?? null });
    }

    // All active workers
    const workers = await db.all(sql`
      SELECT * FROM worker_runs WHERE status = 'running' ORDER BY id DESC
    `);
    return NextResponse.json({ workers });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
