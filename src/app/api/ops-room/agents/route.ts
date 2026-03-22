import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { db } from "@/lib/db";

// Inline session config to avoid importing @/lib/auth (which imports cookies())
const SESSION_SECRET = process.env.SESSION_SECRET ?? "autronis-dashboard-2026-geheim-minimaal-32-tekens!!";
const opsSessionOptions: SessionOptions = {
  cookieName: "autronis-session",
  password: SESSION_SECRET,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
  },
};

interface SessionData {
  gebruiker?: { id: number; naam: string; email: string; rol: string };
}

// Internal token for hooks/scripts
const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// ============ POST — Agent activity report ============
// Called by Claude Code hooks and desktop-agent via x-ops-token header
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Ongeldige token" }, { status: 401 });
    }

    const body = await req.json();
    const { agentId, agentType, project, actie, details, status, tokensGebruikt } = body;

    if (!agentId || !agentType || !project || !actie) {
      return NextResponse.json(
        { fout: "agentId, agentType, project en actie zijn verplicht" },
        { status: 400 }
      );
    }

    const validTypes = ["manager", "builder", "reviewer", "architect", "assistant", "automation"];
    if (!validTypes.includes(agentType)) {
      return NextResponse.json(
        { fout: `agentType moet een van ${validTypes.join(", ")} zijn` },
        { status: 400 }
      );
    }

    const validStatuses = ["actief", "inactief", "offline", "error"];
    const agentStatus = status && validStatuses.includes(status) ? status : "actief";

    const now = new Date().toISOString();

    // Use raw SQL to avoid Drizzle sending columns that don't exist on remote DB (team, verdieping)
    const rows = await db.all(sql`
      SELECT id FROM agent_activiteit WHERE agent_id = ${agentId} LIMIT 1
    `);
    const existing = (rows.length > 0 ? rows[0] : undefined) as { id: number } | undefined;

    if (existing) {
      if (tokensGebruikt) {
        await db.run(sql`
          UPDATE agent_activiteit
          SET laatste_actie = ${actie}, details = ${details ?? null}, status = ${agentStatus},
              project = ${project}, tokens_gebruikt = tokens_gebruikt + ${tokensGebruikt},
              laatst_gezien = ${now}
          WHERE id = ${existing.id}
        `);
      } else {
        await db.run(sql`
          UPDATE agent_activiteit
          SET laatste_actie = ${actie}, details = ${details ?? null}, status = ${agentStatus},
              project = ${project}, laatst_gezien = ${now}
          WHERE id = ${existing.id}
        `);
      }
    } else {
      await db.run(sql`
        INSERT INTO agent_activiteit (agent_id, agent_type, project, laatste_actie, details, status, tokens_gebruikt, laatst_gezien)
        VALUES (${agentId}, ${agentType}, ${project}, ${actie}, ${details ?? null}, ${agentStatus}, ${tokensGebruikt ?? 0}, ${now})
      `);
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}

// ============ GET — All agents for the Ops Room page ============
// Auth via session cookie using getIronSession with req (not cookies())
export async function GET(req: NextRequest) {
  try {
    // Auth: session cookie or internal token (session check is soft — proxy handles main auth)
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      try {
        const cookieStore = await cookies();
        const session = await getIronSession<SessionData>(cookieStore, opsSessionOptions);
        if (!session.gebruiker) {
          // Still allow — proxy middleware already handles auth redirect
        }
      } catch {
        // Session parsing failed — continue anyway, proxy guards this route
      }
    }

    const now = new Date();

    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    // Update stale agent statuses (use raw SQL to avoid column issues)
    try {
      await db.run(sql`UPDATE agent_activiteit SET status = 'offline' WHERE laatst_gezien < ${thirtyMinAgo} AND status = 'actief'`);
      await db.run(sql`UPDATE agent_activiteit SET status = 'offline' WHERE laatst_gezien < ${thirtyMinAgo} AND status = 'inactief'`);
      await db.run(sql`UPDATE agent_activiteit SET status = 'inactief' WHERE laatst_gezien < ${fiveMinAgo} AND status = 'actief'`);
    } catch {
      // Table might not exist yet — ignore
    }

    const vandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Raw SQL to avoid Drizzle sending columns that don't exist on remote DB
    const agents = await db.all(sql`
      SELECT id, agent_id as agentId, agent_type as agentType, project,
             laatste_actie as laatsteActie, details, status,
             tokens_gebruikt as tokensGebruikt,
             laatst_gezien as laatstGezien, aangemaakt_op as aangemaaktOp
      FROM agent_activiteit
      WHERE aangemaakt_op >= ${vandaag} OR status IN ('actief', 'inactief')
      ORDER BY laatst_gezien DESC
    `);

    // Screen-time: get recent activity for Sem and Syb
    let screenTime: { gebruiker: string; app: string; duur: number }[] = [];
    try {
      const stResult = await db.all(sql`
        SELECT g.naam as gebruiker, st.app, SUM(st.duur_seconden) as duur
        FROM screen_time_entries st
        JOIN gebruikers g ON g.id = st.gebruiker_id
        WHERE st.start_tijd >= ${vandaag}
        GROUP BY g.naam, st.app
        ORDER BY duur DESC
        LIMIT 10
      `);
      screenTime = stResult as { gebruiker: string; app: string; duur: number }[];
    } catch {
      // Screen time table might not exist
    }

    return NextResponse.json({ agents, screenTime });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
