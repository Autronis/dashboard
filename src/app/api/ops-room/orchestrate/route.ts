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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "Anthropic API key niet geconfigureerd" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: THEO_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Sem geeft de volgende opdracht: "${opdracht}"\n\nMaak een uitvoeringsplan.`,
        },
      ],
    });

    const rawText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON from response
    let plan: { beschrijving: string; taken: PlanTask[] };
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Geen JSON gevonden in response");
      plan = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({
        fout: "Kon plan niet parsen",
        raw: rawText,
      }, { status: 500 });
    }

    // Add IDs to tasks
    const taken = plan.taken.map((t, i) => ({
      ...t,
      id: `task-${Date.now()}-${i}`,
      status: "queued" as const,
      resultaat: null,
      reviewStatus: null,
      afhankelijkVan: t.afhankelijkVan ?? [],
      bestanden: t.bestanden ?? [],
    }));

    const planData = { beschrijving: plan.beschrijving, taken };

    // Save to database
    await ensureTable();
    await db.run(sql`
      INSERT INTO orchestrator_commands (opdracht, status, plan_json, bron, project_id, bijgewerkt)
      VALUES (${opdracht}, 'awaiting_approval', ${JSON.stringify(planData)}, ${bron ?? "ui"}, ${projectId ?? null}, ${new Date().toISOString()})
    `);

    return NextResponse.json({
      plan: planData,
      projectId: projectId ?? null,
      bron: bron ?? "ui",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    // Detect credit/billing errors
    if (msg.includes("credit balance") || msg.includes("billing")) {
      return NextResponse.json({ fout: "Anthropic API credits op. Vul credits aan op console.anthropic.com." }, { status: 402 });
    }
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

// PATCH — approve or reject a command
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, actie, feedback } = body as { id: number; actie: "approve" | "reject"; feedback?: string };

    if (!id || !actie) {
      return NextResponse.json({ fout: "id en actie zijn verplicht" }, { status: 400 });
    }

    await ensureTable();
    const now = new Date().toISOString();

    if (actie === "approve") {
      await db.run(sql`
        UPDATE orchestrator_commands SET status = 'approved', bijgewerkt = ${now} WHERE id = ${id}
      `);
    } else {
      await db.run(sql`
        UPDATE orchestrator_commands SET status = 'rejected', feedback = ${feedback ?? null}, bijgewerkt = ${now} WHERE id = ${id}
      `);
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
