import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { eq, isNotNull, and, sql } from "drizzle-orm";

// POST /api/agenda/cleanup-afgerond
// Verwijdert ingeplandStart/Eind voor alle taken met status='afgerond'.
// Body: { dryRun?: boolean } — default true voor veiligheid.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
    } else {
      await requireAuth();
    }
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    const where = and(
      eq(taken.status, "afgerond"),
      isNotNull(taken.ingeplandStart)
    );

    const stuk = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(taken)
      .where(where)
      .get();
    const totaal = Number(stuk?.count ?? 0);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totaal,
        message: `Dry run: ${totaal} afgeronde taken hebben nog een geplande tijd. Stuur dryRun:false om te wissen.`,
      });
    }

    const result = await db
      .update(taken)
      .set({
        ingeplandStart: null,
        ingeplandEind: null,
        bijgewerktOp: sql`(datetime('now'))`,
      })
      .where(where)
      .run();

    return NextResponse.json({
      dryRun: false,
      bijgewerkt: result.changes ?? totaal,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
