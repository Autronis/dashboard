import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { opsHeartbeats } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Shared token voor hooks op Sem/Syb machines. Internal-only endpoint.
const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// Max leeftijd voor "nog zichtbaar" (in minuten). Ouder = verdwijnt uit GET.
const TTL_MINUTES = 10;

async function ensureTable() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS ops_heartbeats (
      session_id TEXT PRIMARY KEY,
      gebruiker TEXT NOT NULL,
      chat_tag TEXT,
      huidige_taak TEXT,
      active_skill TEXT,
      laatste_tool TEXT,
      project TEXT,
      tijdstip TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.run(sql`
    CREATE INDEX IF NOT EXISTS idx_ops_heartbeats_tijdstip
    ON ops_heartbeats (tijdstip)
  `);
}

interface HeartbeatBody {
  sessionId: string;
  user: "sem" | "syb";
  chatTag?: string | null;
  huidigeTaak?: string | null;
  activeSkill?: string | null;
  laatsteTool?: string | null;
  project?: string | null;
}

// POST — upsert heartbeat. Hook stuurt dit bij elke tool-call.
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-ops-token");
  if (token !== OPS_TOKEN) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  let body: HeartbeatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ fout: "Geen geldige JSON" }, { status: 400 });
  }

  if (!body.sessionId || typeof body.sessionId !== "string") {
    return NextResponse.json({ fout: "sessionId verplicht" }, { status: 400 });
  }
  if (body.user !== "sem" && body.user !== "syb") {
    return NextResponse.json({ fout: "user moet 'sem' of 'syb' zijn" }, { status: 400 });
  }

  await ensureTable();

  const now = new Date().toISOString();
  await db.run(sql`
    INSERT INTO ops_heartbeats
      (session_id, gebruiker, chat_tag, huidige_taak, active_skill, laatste_tool, project, tijdstip)
    VALUES
      (${body.sessionId}, ${body.user}, ${body.chatTag ?? null},
       ${body.huidigeTaak ?? null}, ${body.activeSkill ?? null},
       ${body.laatsteTool ?? null}, ${body.project ?? null}, ${now})
    ON CONFLICT(session_id) DO UPDATE SET
      gebruiker = excluded.gebruiker,
      chat_tag = excluded.chat_tag,
      huidige_taak = excluded.huidige_taak,
      active_skill = excluded.active_skill,
      laatste_tool = excluded.laatste_tool,
      project = excluded.project,
      tijdstip = excluded.tijdstip
  `);

  return NextResponse.json({ succes: true });
}

// GET — alle heartbeats jonger dan TTL_MINUTES.
// Public binnen dashboard (session-auth via middleware); geen ops-token nodig
// zodat de UI zonder secret kan pollen.
export async function GET() {
  await ensureTable();

  const cutoff = new Date(Date.now() - TTL_MINUTES * 60_000).toISOString();
  const rows = await db.all(sql`
    SELECT session_id, gebruiker, chat_tag, huidige_taak, active_skill,
           laatste_tool, project, tijdstip
    FROM ops_heartbeats
    WHERE tijdstip >= ${cutoff}
    ORDER BY tijdstip DESC
  `) as Array<{
    session_id: string;
    gebruiker: string;
    chat_tag: string | null;
    huidige_taak: string | null;
    active_skill: string | null;
    laatste_tool: string | null;
    project: string | null;
    tijdstip: string;
  }>;

  const heartbeats = rows.map((r) => {
    const ageMs = Date.now() - new Date(r.tijdstip).getTime();
    const ageMin = ageMs / 60_000;
    const status: "actief" | "idle" = ageMin < 2 ? "actief" : "idle";
    return {
      sessionId: r.session_id,
      user: r.gebruiker as "sem" | "syb",
      chatTag: r.chat_tag,
      huidigeTaak: r.huidige_taak,
      activeSkill: r.active_skill,
      laatsteTool: r.laatste_tool,
      project: r.project,
      tijdstip: r.tijdstip,
      status,
    };
  });

  return NextResponse.json({ heartbeats });
}

// DELETE — expliciet een sessie opruimen (bv. bij Claude Code exit).
export async function DELETE(req: NextRequest) {
  const token = req.headers.get("x-ops-token");
  if (token !== OPS_TOKEN) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ fout: "sessionId verplicht" }, { status: 400 });
  }

  await ensureTable();
  await db.run(sql`DELETE FROM ops_heartbeats WHERE session_id = ${sessionId}`);
  return NextResponse.json({ succes: true });
}
