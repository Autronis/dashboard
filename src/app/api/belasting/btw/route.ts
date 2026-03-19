import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { btwAangiftes, facturen, uitgaven } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

function getQuarterDateRange(kwartaal: number, jaar: number): { start: string; end: string } {
  switch (kwartaal) {
    case 1:
      return { start: `${jaar}-01-01`, end: `${jaar}-03-31` };
    case 2:
      return { start: `${jaar}-04-01`, end: `${jaar}-06-30` };
    case 3:
      return { start: `${jaar}-07-01`, end: `${jaar}-09-30` };
    case 4:
      return { start: `${jaar}-10-01`, end: `${jaar}-12-31` };
    default:
      return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
  }
}

// GET /api/belasting/btw?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    const aangiftes = await db
      .select()
      .from(btwAangiftes)
      .where(eq(btwAangiftes.jaar, jaar))
      .orderBy(btwAangiftes.kwartaal)
      .all();

    // Auto-calculate BTW from facturen and uitgaven per quarter
    const enrichedAangiftes = await Promise.all(aangiftes.map(async (aangifte) => {
      const { start, end } = getQuarterDateRange(aangifte.kwartaal, aangifte.jaar);

      // BTW ontvangen: from betaalde facturen within quarter
      const facturenResult = await db
        .select({
          totaalBtw: sql<number>`COALESCE(SUM(${facturen.btwBedrag}), 0)`,
        })
        .from(facturen)
        .where(
          and(
            eq(facturen.status, "betaald"),
            eq(facturen.isActief, 1),
            gte(facturen.betaaldOp, start),
            lte(facturen.betaaldOp, end)
          )
        )
        .get();

      // BTW betaald: from uitgaven within quarter
      const uitgavenResult = await db
        .select({
          totaalBtw: sql<number>`COALESCE(SUM(${uitgaven.btwBedrag}), 0)`,
        })
        .from(uitgaven)
        .where(
          and(
            gte(uitgaven.datum, start),
            lte(uitgaven.datum, end)
          )
        )
        .get();

      const btwOntvangen = Math.round((facturenResult?.totaalBtw ?? 0) * 100) / 100;
      const btwBetaald = Math.round((uitgavenResult?.totaalBtw ?? 0) * 100) / 100;
      const btwAfdragen = Math.round((btwOntvangen - btwBetaald) * 100) / 100;

      return {
        ...aangifte,
        btwOntvangen,
        btwBetaald,
        btwAfdragen,
      };
    }));

    return NextResponse.json({ aangiftes: enrichedAangiftes });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/belasting/btw — seed BTW aangiftes for a given year
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const jaar = body.jaar ?? new Date().getFullYear();

    // Check if aangiftes already exist for this year
    const bestaande = await db
      .select()
      .from(btwAangiftes)
      .where(eq(btwAangiftes.jaar, jaar))
      .all();

    if (bestaande.length > 0) {
      return NextResponse.json(
        { fout: `BTW aangiftes voor ${jaar} bestaan al.` },
        { status: 409 }
      );
    }

    for (let kwartaal = 1; kwartaal <= 4; kwartaal++) {
      await db.insert(btwAangiftes).values({
        kwartaal,
        jaar,
        btwOntvangen: 0,
        btwBetaald: 0,
        btwAfdragen: 0,
        status: "open",
      }).run();
    }

    const aangiftes = await db
      .select()
      .from(btwAangiftes)
      .where(eq(btwAangiftes.jaar, jaar))
      .orderBy(btwAangiftes.kwartaal)
      .all();

    return NextResponse.json({ aangiftes }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
