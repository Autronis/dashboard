import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

const HEARTBEAT_TIMEOUT_MIN = 5;

// GET /api/ops-room/worker-cron
// Called by Vercel cron every 5 minutes to recover dead workers
export async function GET(req: NextRequest) {
  try {
    // Vercel crons send Authorization header, also accept x-ops-token
    const token = req.headers.get("x-ops-token") ?? req.headers.get("authorization")?.replace("Bearer ", "");
    // Allow Vercel cron (no auth) or ops token
    if (token && token !== OPS_TOKEN && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    // Ensure table exists
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

    const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MIN * 60 * 1000).toISOString();

    // Find dead workers: status=running but heartbeat too old
    const deadWorkers = await db.all(sql`
      SELECT id, command_id, worker_token FROM worker_runs
      WHERE status = 'running' AND laatste_heartbeat < ${cutoff}
    `) as { id: number; command_id: number; worker_token: string }[];

    const restarted: number[] = [];

    for (const dead of deadWorkers) {
      // Mark old worker as failed
      await db.run(sql`
        UPDATE worker_runs SET status = 'failed', fout = 'Heartbeat timeout — herstart door cron', bijgewerkt_op = datetime('now')
        WHERE id = ${dead.id}
      `);

      // Check if command is still in_progress
      const cmd = await db.get<{ id: number; status: string }>(sql`
        SELECT id, status FROM orchestrator_commands WHERE id = ${dead.command_id}
      `);

      if (cmd && cmd.status === "in_progress") {
        // Restart worker for this command
        try {
          const res = await fetch(`${BASE_URL}/api/ops-room/worker`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-ops-token": OPS_TOKEN },
            body: JSON.stringify({ commandId: dead.command_id, action: "start" }),
          });
          if (res.ok) {
            restarted.push(dead.command_id);
          }
        } catch {/* restart failed */}
      }
    }

    return NextResponse.json({
      succes: true,
      dodeWorkers: deadWorkers.length,
      herstart: restarted,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
