import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// POST /api/ops-room/assign — Assign an agent to a project
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-ops-token");
  if (token !== OPS_TOKEN) {
    return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId, projectNaam } = await req.json();

    if (!agentId || !projectNaam) {
      return NextResponse.json(
        { fout: "agentId en projectNaam zijn verplicht" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update or create agent_activiteit record to reflect new project assignment
    const existing = await db.all(sql`
      SELECT id FROM agent_activiteit WHERE agent_id = ${agentId} LIMIT 1
    `);

    if ((existing as { id: number }[]).length > 0) {
      const row = existing[0] as { id: number };
      await db.run(sql`
        UPDATE agent_activiteit
        SET project = ${projectNaam}, status = 'actief', laatst_gezien = ${now},
            laatste_actie = ${'Toegewezen aan ' + projectNaam}
        WHERE id = ${row.id}
      `);
    } else {
      await db.run(sql`
        INSERT INTO agent_activiteit (agent_id, agent_type, project, laatste_actie, status, tokens_gebruikt, laatst_gezien)
        VALUES (${agentId}, 'builder', ${projectNaam}, ${'Toegewezen aan ' + projectNaam}, 'actief', 0, ${now})
      `);
    }

    // Also update agent_projecten if the table exists
    try {
      await db.run(sql`
        INSERT OR REPLACE INTO agent_projecten (agent_id, project_naam, status, toegewezen_op)
        VALUES (${agentId}, ${projectNaam}, 'actief', ${now})
      `);
    } catch {
      // Table might not exist
    }

    return NextResponse.json({ succes: true, agentId, projectNaam });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
