import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, isNull, sql } from "drizzle-orm";

// POST /api/projecten/fix-lege-fases
// Body: { dryRun?: boolean, projectId?: number }
// Zet alle taken zonder fase op "Lopend werk" (per project of globaal)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default true voor veiligheid
    const projectId = body.projectId as number | undefined;

    const whereClause = projectId
      ? and(isNull(taken.fase), eq(taken.projectId, projectId))
      : isNull(taken.fase);

    // Count taken zonder fase
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(taken)
      .where(whereClause)
      .get();
    const totaal = Number(countResult?.count ?? 0);

    // Per project overzicht
    const perProjectRows = await db
      .select({
        projectId: taken.projectId,
        projectNaam: projecten.naam,
        count: sql<number>`COUNT(*)`,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(whereClause)
      .groupBy(taken.projectId, projecten.naam);

    const perProject = perProjectRows.map((r) => ({
      projectId: r.projectId,
      projectNaam: r.projectNaam ?? "(geen project)",
      count: Number(r.count),
    }));

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totaal,
        perProject,
        message: `Dry run: ${totaal} taken zonder fase gevonden. Stuur dryRun:false om te fixen.`,
      });
    }

    // Apply: zet fase = "Lopend werk"
    const result = await db
      .update(taken)
      .set({
        fase: "Lopend werk",
        bijgewerktOp: sql`(datetime('now'))`,
      })
      .where(whereClause)
      .run();

    return NextResponse.json({
      dryRun: false,
      bijgewerkt: result.changes ?? totaal,
      perProject,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
