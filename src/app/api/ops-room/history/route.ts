import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// GET /api/ops-room/history?agentId=wout&days=7
// Returns activity history for a specific agent
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-ops-token");
  if (token !== OPS_TOKEN) {
    return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get("agentId");
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10);

  if (!agentId) {
    return NextResponse.json({ fout: "agentId is verplicht" }, { status: 400 });
  }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get activity entries from orchestrator commands where this agent was involved
    const activities = await db.all(sql`
      SELECT
        oc.id,
        oc.opdracht,
        oc.status,
        oc.aangemaakt as timestamp,
        oc.bijgewerkt as updatedAt,
        json_extract(oc.plan_json, '$.beschrijving') as planBeschrijving
      FROM orchestrator_commands oc
      WHERE oc.plan_json LIKE ${'%' + agentId + '%'}
        AND oc.aangemaakt >= ${since}
      ORDER BY oc.aangemaakt DESC
      LIMIT 50
    `).catch(() => []);

    // Get the agent's own activity record for daily stats
    const dailyStats = await db.all(sql`
      SELECT
        DATE(aangemaakt_op) as datum,
        MAX(tokens_gebruikt) as tokens,
        COUNT(*) as acties,
        GROUP_CONCAT(DISTINCT project) as projecten
      FROM agent_activiteit
      WHERE agent_id = ${agentId}
        AND aangemaakt_op >= ${since}
      GROUP BY DATE(aangemaakt_op)
      ORDER BY datum DESC
    `).catch(() => []);

    return NextResponse.json({ activities, dailyStats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}