import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { urenCriterium, tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";

/**
 * Calculate total hours from tijdregistraties for a user in a given year.
 * This uses actual time registrations, not screen time.
 */
async function berekenUrenUitRegistraties(
  gebruikerId: number,
  jaar: number
): Promise<{ totaalUren: number; perCategorie: Record<string, number>; aantalRegistraties: number }> {
  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar}-12-31`;

  const registraties = await db
    .select({
      duurMinuten: tijdregistraties.duurMinuten,
      categorie: tijdregistraties.categorie,
      startTijd: tijdregistraties.startTijd,
      eindTijd: tijdregistraties.eindTijd,
    })
    .from(tijdregistraties)
    .where(
      and(
        eq(tijdregistraties.gebruikerId, gebruikerId),
        sql`SUBSTR(${tijdregistraties.startTijd}, 1, 10) >= ${jaarStart}`,
        sql`SUBSTR(${tijdregistraties.startTijd}, 1, 10) <= ${jaarEind}`,
        sql`${tijdregistraties.eindTijd} IS NOT NULL`
      )
    )
    .all();

  let totaalMinuten = 0;
  const perCategorie: Record<string, number> = {};

  for (const reg of registraties) {
    const minuten = reg.duurMinuten ?? 0;
    totaalMinuten += minuten;
    const cat = reg.categorie ?? "overig";
    perCategorie[cat] = (perCategorie[cat] ?? 0) + minuten;
  }

  // Convert categorie minutes to hours
  const perCategorieUren: Record<string, number> = {};
  for (const [cat, min] of Object.entries(perCategorie)) {
    perCategorieUren[cat] = Math.round((min / 60) * 100) / 100;
  }

  return {
    totaalUren: Math.round((totaalMinuten / 60) * 100) / 100,
    perCategorie: perCategorieUren,
    aantalRegistraties: registraties.length,
  };
}

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

    // Calculate uren from tijdregistraties (actual work hours, not screen time)
    const urenData = await berekenUrenUitRegistraties(gebruiker.id, jaar);
    const behaaldUren = urenData.totaalUren;
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
        perCategorie: urenData.perCategorie,
        aantalRegistraties: urenData.aantalRegistraties,
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
