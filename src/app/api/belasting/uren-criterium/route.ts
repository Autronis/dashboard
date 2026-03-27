import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { urenCriterium } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

// GET /api/belasting/uren-criterium?jaar=2026
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaarParam = searchParams.get("jaar");
    const jaar = jaarParam ? parseInt(jaarParam, 10) : new Date().getFullYear();

    // Get or create uren criterium record
    let record = await db
      .select()
      .from(urenCriterium)
      .where(
        and(
          eq(urenCriterium.gebruikerId, gebruiker.id),
          eq(urenCriterium.jaar, jaar)
        )
      )
      .get();

    if (!record) {
      const [nieuw] = await db
        .insert(urenCriterium)
        .values({
          gebruikerId: gebruiker.id,
          jaar,
          doelUren: 1225,
          behaaldUren: 0,
        })
        .returning()
        ;
      record = nieuw;
    }

    // Auto-calculate behaald uren from screen time (actieve uren)
    const behaaldUren = await berekenActieveUren(gebruiker.id, `${jaar}-01-01`, `${jaar}-12-31`);
    const doelUren = record.doelUren ?? 1225;
    const voldoet = behaaldUren >= doelUren;

    // Zelfstandigenaftrek 2026: roughly 3750 EUR (simplified)
    const zelfstandigenaftrek = voldoet ? 3750 : 0;
    // MKB-winstvrijstelling: 13.31% of winst (simplified flag)
    const mkbVrijstelling = voldoet ? 1 : 0;

    return NextResponse.json({
      urenCriterium: {
        ...record,
        behaaldUren,
        zelfstandigenaftrek,
        mkbVrijstelling,
        voldoet,
        doelUren,
        voortgangPercentage: Math.min(Math.round((behaaldUren / doelUren) * 100), 100),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/belasting/uren-criterium
export async function PUT(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const jaar = body.jaar ?? new Date().getFullYear();

    if (!body.doelUren || typeof body.doelUren !== "number" || body.doelUren < 0) {
      return NextResponse.json({ fout: "Ongeldig doeluren." }, { status: 400 });
    }

    // Get or create record
    const bestaand = await db
      .select()
      .from(urenCriterium)
      .where(
        and(
          eq(urenCriterium.gebruikerId, gebruiker.id),
          eq(urenCriterium.jaar, jaar)
        )
      )
      .get();

    if (bestaand) {
      const [bijgewerkt] = await db
        .update(urenCriterium)
        .set({ doelUren: body.doelUren })
        .where(eq(urenCriterium.id, bestaand.id))
        .returning()
        ;
      return NextResponse.json({ urenCriterium: bijgewerkt });
    } else {
      const [nieuw] = await db
        .insert(urenCriterium)
        .values({
          gebruikerId: gebruiker.id,
          jaar,
          doelUren: body.doelUren,
        })
        .returning()
        ;
      return NextResponse.json({ urenCriterium: nieuw }, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
