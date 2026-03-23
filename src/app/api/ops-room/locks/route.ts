import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";
const LOCK_TTL_MINUTES = 30;

async function ensureTable() {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS file_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bestand_pad TEXT NOT NULL,
      team TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      command_id TEXT,
      locked_op TEXT DEFAULT (datetime('now')),
      verlopen_op TEXT NOT NULL
    )
  `);
  // Clean expired locks
  await db.run(sql`DELETE FROM file_locks WHERE verlopen_op < datetime('now')`);
}

// GET /api/ops-room/locks — all active locks
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    await ensureTable();
    const locks = await db.all(sql`
      SELECT id, bestand_pad as pad, team, agent_id as agentId, command_id as commandId,
             locked_op as lockedOp, verlopen_op as verlopenOp
      FROM file_locks
      WHERE verlopen_op >= datetime('now')
      ORDER BY locked_op DESC
    `);

    return NextResponse.json({ locks });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Onbekend" }, { status: 500 });
  }
}

// POST /api/ops-room/locks — acquire locks
// Body: { bestanden: string[], team: string, agentId: string, commandId?: string }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const body = await req.json();
    const { bestanden, team, agentId, commandId } = body as {
      bestanden: string[];
      team: string;
      agentId: string;
      commandId?: string;
    };

    if (!bestanden?.length || !team || !agentId) {
      return NextResponse.json({ fout: "bestanden, team en agentId zijn verplicht" }, { status: 400 });
    }

    await ensureTable();

    // Check for conflicts with OTHER team
    const conflicts: { pad: string; team: string; agentId: string }[] = [];
    for (const pad of bestanden) {
      const existing = await db.all(sql`
        SELECT bestand_pad as pad, team, agent_id as agentId
        FROM file_locks
        WHERE bestand_pad = ${pad} AND team != ${team} AND verlopen_op >= datetime('now')
      `) as { pad: string; team: string; agentId: string }[];

      if (existing.length > 0) {
        conflicts.push(...existing);
      }
    }

    if (conflicts.length > 0) {
      return NextResponse.json({
        succes: false,
        conflicts,
        message: `${conflicts.length} bestand(en) gelocked door team ${conflicts[0].team}`,
      });
    }

    // Acquire locks
    const verlopenOp = new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000).toISOString();
    for (const pad of bestanden) {
      // Upsert: remove own old lock, insert new
      await db.run(sql`DELETE FROM file_locks WHERE bestand_pad = ${pad} AND team = ${team}`);
      await db.run(sql`
        INSERT INTO file_locks (bestand_pad, team, agent_id, command_id, verlopen_op)
        VALUES (${pad}, ${team}, ${agentId}, ${commandId ?? null}, ${verlopenOp})
      `);
    }

    return NextResponse.json({ succes: true, locked: bestanden.length, verlopenOp });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Onbekend" }, { status: 500 });
  }
}

// DELETE /api/ops-room/locks — release locks
// Body: { bestanden?: string[], team: string, commandId?: string }
// If bestanden is empty/omitted, releases all locks for this team+command
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const body = await req.json();
    const { bestanden, team, commandId } = body as {
      bestanden?: string[];
      team: string;
      commandId?: string;
    };

    if (!team) {
      return NextResponse.json({ fout: "team is verplicht" }, { status: 400 });
    }

    await ensureTable();

    if (bestanden?.length) {
      for (const pad of bestanden) {
        await db.run(sql`DELETE FROM file_locks WHERE bestand_pad = ${pad} AND team = ${team}`);
      }
    } else if (commandId) {
      await db.run(sql`DELETE FROM file_locks WHERE command_id = ${commandId} AND team = ${team}`);
    } else {
      await db.run(sql`DELETE FROM file_locks WHERE team = ${team}`);
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Onbekend" }, { status: 500 });
  }
}
