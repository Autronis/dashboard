import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { belastingTips } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

// GET /api/belasting/tips — Get all tips, optionally filtered by jaar
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const jaar = searchParams.get("jaar");

    const tips = await db
      .select()
      .from(belastingTips)
      .orderBy(sql`${belastingTips.toegepast} ASC, ${belastingTips.aangemaaktOp} DESC`);

    // Filter: show tips that are for this year or have no year set
    const filtered = jaar
      ? tips.filter((t) => t.jaar === null || t.jaar === parseInt(jaar))
      : tips;

    const toegepastCount = filtered.filter((t) => t.toegepast === 1).length;

    return NextResponse.json({
      tips: filtered,
      totaal: filtered.length,
      toegepast: toegepastCount,
    });
  } catch {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }
}

// POST /api/belasting/tips — Create a new tip
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const { categorie, titel, beschrijving, voordeel, bron, bronNaam, jaar, isAiGegenereerd } = body;

    if (!categorie || !titel || !beschrijving) {
      return NextResponse.json({ fout: "Categorie, titel en beschrijving zijn verplicht" }, { status: 400 });
    }

    const [tip] = await db.insert(belastingTips).values({
      categorie,
      titel,
      beschrijving,
      voordeel: voordeel || null,
      bron: bron || null,
      bronNaam: bronNaam || null,
      jaar: jaar || null,
      isAiGegenereerd: isAiGegenereerd ? 1 : 0,
    }).returning();

    return NextResponse.json({ tip });
  } catch {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }
}
