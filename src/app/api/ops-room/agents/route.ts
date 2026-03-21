import { NextRequest, NextResponse } from "next/server";
import { eq, desc, sql, and, lt } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { db } from "@/lib/db";
import { agentActiviteit } from "@/lib/db/schema";

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

    const existing = await db
      .select({ id: agentActiviteit.id })
      .from(agentActiviteit)
      .where(eq(agentActiviteit.agentId, agentId))
      .get();

    if (existing) {
      await db
        .update(agentActiviteit)
        .set({
          laatsteActie: actie,
          details: details ?? null,
          status: agentStatus,
          project,
          tokensGebruikt: tokensGebruikt
            ? sql`${agentActiviteit.tokensGebruikt} + ${tokensGebruikt}`
            : undefined,
          laatstGezien: now,
        })
        .where(eq(agentActiviteit.id, existing.id))
        .run();
    } else {
      await db
        .insert(agentActiviteit)
        .values({
          agentId,
          agentType,
          project,
          laatsteActie: actie,
          details: details ?? null,
          status: agentStatus,
          tokensGebruikt: tokensGebruikt ?? 0,
          laatstGezien: now,
        })
        .run();
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
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(req, res, opsSessionOptions);
    if (!session.gebruiker) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const now = new Date();

    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

    await db
      .update(agentActiviteit)
      .set({ status: "offline" })
      .where(and(lt(agentActiviteit.laatstGezien, thirtyMinAgo), eq(agentActiviteit.status, "actief")))
      .run();

    await db
      .update(agentActiviteit)
      .set({ status: "offline" })
      .where(and(lt(agentActiviteit.laatstGezien, thirtyMinAgo), eq(agentActiviteit.status, "inactief")))
      .run();

    await db
      .update(agentActiviteit)
      .set({ status: "inactief" })
      .where(and(lt(agentActiviteit.laatstGezien, fiveMinAgo), eq(agentActiviteit.status, "actief")))
      .run();

    const vandaag = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Team filter from query param
    const teamParam = req.nextUrl.searchParams.get("team"); // "sem", "syb", or "all"
    const teamFilter = teamParam === "sem" || teamParam === "syb"
      ? sql`AND ${agentActiviteit.team} = ${teamParam}`
      : sql``;

    const agents = await db
      .select()
      .from(agentActiviteit)
      .where(sql`(${agentActiviteit.aangemaaktOp} >= ${vandaag} OR ${agentActiviteit.status} IN ('actief', 'inactief')) ${teamFilter}`)
      .orderBy(desc(agentActiviteit.laatstGezien))
      .all();

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
