import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AGENT_SPECIALIZATIONS, SPECIALIZATION_LABELS } from "@/components/ops-room/orchestrator-types";
import type { PlanTask } from "@/components/ops-room/orchestrator-types";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// Ensure table exists
async function ensureTable() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS orchestrator_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opdracht TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      plan_json TEXT,
      bron TEXT DEFAULT 'ui',
      project_id INTEGER,
      feedback TEXT,
      aangemaakt TEXT DEFAULT (datetime('now')),
      bijgewerkt TEXT DEFAULT (datetime('now'))
    )
  `);
}

// Theo's system prompt — he is the manager who creates plans
const THEO_SYSTEM_PROMPT = `Je bent Theo, de Manager van Autronis. Je beheert een team van AI agents die samenwerken aan softwareprojecten.

Je taak: als je een opdracht krijgt van Sem (de CEO), maak je een uitvoeringsplan met concrete taken die je kunt toewijzen aan je teamleden.

TEAM SPECIALISATIES:
${Object.entries(AGENT_SPECIALIZATIONS).map(([id, spec]) => `- ${id}: ${SPECIALIZATION_LABELS[spec]}`).join("\n")}

REGELS:
- Splits de opdracht op in kleine, concrete taken (max 5-8 taken)
- Elke taak moet aan één agent toegewezen worden op basis van specialisatie
- Benoem welke bestanden elke taak raakt
- Geef afhankelijkheden aan (welke taak moet eerst af zijn)
- Jones (architect) moet altijd als eerste een spec/plan maken bij complexe features
- Toby (reviewer) moet altijd als laatste elke output reviewen
- Gebruik Nederlandse beschrijvingen

BELANGRIJK: Reageer ALLEEN met een JSON object in dit format:
{
  "beschrijving": "Korte samenvatting van het plan",
  "taken": [
    {
      "titel": "Korte titel",
      "beschrijving": "Wat moet er gebeuren",
      "bestanden": ["src/pad/naar/bestand.ts"],
      "agentId": "wout",
      "specialisatie": "frontend",
      "afhankelijkVan": []
    }
  ]
}

Geen extra tekst, alleen het JSON object.`;

export async function POST(req: NextRequest) {
  try {
    // Auth: proxy middleware handles session, accept any authenticated request
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      // Soft auth — proxy guards this route, don't block if session check fails
    }

    const body = await req.json();
    const { opdracht, projectId, bron } = body;

    if (!opdracht || typeof opdracht !== "string") {
      return NextResponse.json({ fout: "Opdracht is verplicht" }, { status: 400 });
    }

    // Always save command to DB first (so it shows up in ApprovalPanel even if plan fails)
    await ensureTable();
    const now = new Date().toISOString();
    await db.run(sql`
      INSERT INTO orchestrator_commands (opdracht, status, plan_json, bron, project_id, bijgewerkt)
      VALUES (${opdracht}, 'planning', ${null}, ${bron ?? "ui"}, ${projectId ?? null}, ${now})
    `);

    // Get the inserted command ID
    const inserted = await db.all(sql`
      SELECT id FROM orchestrator_commands ORDER BY id DESC LIMIT 1
    `) as { id: number }[];
    const cmdId = inserted[0]?.id;

    // Try to generate plan via Claude API
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      if (cmdId) await db.run(sql`UPDATE orchestrator_commands SET status = 'awaiting_approval', feedback = 'Plan kon niet gemaakt worden: API key niet geconfigureerd' WHERE id = ${cmdId}`);
      return NextResponse.json({ fout: "Anthropic API key niet geconfigureerd", commandId: cmdId }, { status: 500 });
    }

    let planData: { beschrijving: string; taken: PlanTask[] } | null = null;

    // Check which agents are already busy (live sessions)
    let busyAgentIds: string[] = [];
    try {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const busyRows = await db.all(sql`
        SELECT agent_id FROM agent_activiteit
        WHERE status = 'actief' AND laatst_gezien >= ${fiveMinAgo}
      `) as { agent_id: string }[];
      busyAgentIds = busyRows.map((r) => r.agent_id);
    } catch {
      // Table might not exist yet
    }

    const busyNote = busyAgentIds.length > 0
      ? `\n\nBELANGRIJK: De volgende agents zijn BEZIG met een andere taak en mogen NIET worden toegewezen: ${busyAgentIds.join(", ")}. Kies andere agents met dezelfde specialisatie.`
      : "";

    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: THEO_SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Sem geeft de volgende opdracht: "${opdracht}"${busyNote}\n\nMaak een uitvoeringsplan.` }],
      });

      const rawText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Geen JSON gevonden in response");
      const plan: { beschrijving: string; taken: PlanTask[] } = JSON.parse(jsonMatch[0]);

      const taken = plan.taken.map((t, i) => ({
        ...t,
        id: `task-${Date.now()}-${i}`,
        status: "queued" as const,
        resultaat: null,
        reviewStatus: null,
        afhankelijkVan: t.afhankelijkVan ?? [],
        bestanden: t.bestanden ?? [],
      }));

      planData = { beschrijving: plan.beschrijving, taken };

      // Update command with plan
      if (cmdId) {
        await db.run(sql`
          UPDATE orchestrator_commands SET status = 'awaiting_approval', plan_json = ${JSON.stringify(planData)}, bijgewerkt = ${new Date().toISOString()} WHERE id = ${cmdId}
        `);
      }
    } catch (planError) {
      const planMsg = planError instanceof Error ? planError.message : "Onbekend";
      // Command stays in DB with "awaiting_approval" but no plan — user can still see it
      if (cmdId) {
        const isCredits = planMsg.includes("credit balance") || planMsg.includes("billing");
        const errorNote = isCredits ? "API credits op — plan wordt gemaakt zodra credits zijn aangevuld" : `Plan maken mislukt: ${planMsg.slice(0, 100)}`;
        await db.run(sql`
          UPDATE orchestrator_commands SET status = 'awaiting_approval', feedback = ${errorNote}, bijgewerkt = ${new Date().toISOString()} WHERE id = ${cmdId}
        `);
      }
    }

    return NextResponse.json({
      plan: planData,
      commandId: cmdId,
      projectId: projectId ?? null,
      bron: bron ?? "ui",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

// GET — fetch all commands with their plans
export async function GET() {
  try {
    await ensureTable();
    const commands = await db.all(sql`
      SELECT id, opdracht, status, plan_json as planJson, bron, project_id as projectId,
             feedback, aangemaakt, bijgewerkt
      FROM orchestrator_commands
      ORDER BY aangemaakt DESC
      LIMIT 20
    `);

    const parsed = (commands as Record<string, unknown>[]).map((cmd) => ({
      ...cmd,
      plan: cmd.planJson ? JSON.parse(cmd.planJson as string) : null,
    }));

    return NextResponse.json({ commands: parsed });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}

// PATCH — approve, reject, or update task status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, actie, feedback, taskUpdates, commandStatus } = body as {
      id: number;
      actie?: "approve" | "reject";
      feedback?: string;
      taskUpdates?: { taskId: string; status: string }[];
      commandStatus?: string;
    };

    if (!id) {
      return NextResponse.json({ fout: "id is verplicht" }, { status: 400 });
    }

    await ensureTable();
    const now = new Date().toISOString();

    if (actie === "approve") {
      await db.run(sql`
        UPDATE orchestrator_commands SET status = 'approved', bijgewerkt = ${now} WHERE id = ${id}
      `);
    } else if (actie === "reject") {
      await db.run(sql`
        UPDATE orchestrator_commands SET status = 'rejected', feedback = ${feedback ?? null}, bijgewerkt = ${now} WHERE id = ${id}
      `);
    }

    // Update individual task statuses within the plan JSON
    if (taskUpdates && taskUpdates.length > 0) {
      const row = await db.get<{ plan_json: string }>(sql`
        SELECT plan_json FROM orchestrator_commands WHERE id = ${id}
      `);
      if (row?.plan_json) {
        const plan = JSON.parse(row.plan_json);
        if (plan.taken && Array.isArray(plan.taken)) {
          for (const update of taskUpdates) {
            const task = plan.taken.find((t: { id: string }) => t.id === update.taskId);
            if (task) task.status = update.status;
          }
          const newStatus = commandStatus ?? (
            plan.taken.every((t: { status: string }) => t.status === "completed") ? "completed" : "in_progress"
          );
          await db.run(sql`
            UPDATE orchestrator_commands
            SET plan_json = ${JSON.stringify(plan)}, status = ${newStatus}, bijgewerkt = ${now}
            WHERE id = ${id}
          `);
        }
      }
    } else if (commandStatus) {
      await db.run(sql`
        UPDATE orchestrator_commands SET status = ${commandStatus}, bijgewerkt = ${now} WHERE id = ${id}
      `);
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
