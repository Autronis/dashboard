import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamActiviteit, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq, gte } from "drizzle-orm";

// GET /api/team/activiteit?limit=20&since=ISO
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const since = searchParams.get("since");

    const conditions = [];
    if (since) {
      conditions.push(gte(teamActiviteit.aangemaaktOp, since));
    }

    const rows = await db
      .select({
        id: teamActiviteit.id,
        gebruikerId: teamActiviteit.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        type: teamActiviteit.type,
        taakId: teamActiviteit.taakId,
        projectId: teamActiviteit.projectId,
        bericht: teamActiviteit.bericht,
        metadata: teamActiviteit.metadata,
        aangemaaktOp: teamActiviteit.aangemaaktOp,
      })
      .from(teamActiviteit)
      .innerJoin(gebruikers, eq(teamActiviteit.gebruikerId, gebruikers.id))
      .where(conditions.length > 0 ? conditions[0] : undefined)
      .orderBy(desc(teamActiviteit.aangemaaktOp))
      .limit(limit);

    return NextResponse.json({ activiteiten: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
