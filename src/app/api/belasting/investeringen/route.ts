import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { investeringen, belastingAuditLog } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql } from "drizzle-orm";

function berekenJaarlijkseAfschrijving(
  bedrag: number,
  restwaarde: number,
  termijn: number
): number {
  return Math.round(((bedrag - restwaarde) / termijn) * 100) / 100;
}

function berekenKIA(totaalInvestering: number): number {
  // KIA 2026 vereenvoudigd
  if (totaalInvestering < 2801 || totaalInvestering > 69764) return 0;
  // ~28% of investment amount within bounds
  return Math.round(totaalInvestering * 0.28 * 100) / 100;
}

// GET /api/belasting/investeringen
export async function GET() {
  try {
    await requireAuth();

    const alleInvesteringen = await db
      .select()
      .from(investeringen)
      .orderBy(sql`${investeringen.datum} DESC`)
      .all();

    const enriched = alleInvesteringen.map((inv) => ({
      ...inv,
      jaarlijkseAfschrijving: berekenJaarlijkseAfschrijving(
        inv.bedrag,
        inv.restwaarde ?? 0,
        inv.afschrijvingstermijn ?? 5
      ),
    }));

    // KIA berekening over huidige jaar investeringen
    const huidigJaar = new Date().getFullYear();
    const jaarStart = `${huidigJaar}-01-01`;
    const jaarEind = `${huidigJaar}-12-31`;

    const investeringenDitJaar = alleInvesteringen.filter(
      (inv) => inv.datum >= jaarStart && inv.datum <= jaarEind
    );

    const totaalInvesteringDitJaar = investeringenDitJaar.reduce(
      (sum, inv) => sum + inv.bedrag,
      0
    );

    const kiaAftrek = berekenKIA(totaalInvesteringDitJaar);

    return NextResponse.json({
      investeringen: enriched,
      totaalInvestering: Math.round(totaalInvesteringDitJaar * 100) / 100,
      kiaAftrek,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/belasting/investeringen
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { naam, bedrag, datum, categorie, afschrijvingstermijn, restwaarde, notities } = body as {
      naam: string;
      bedrag: number;
      datum: string;
      categorie?: string;
      afschrijvingstermijn?: number;
      restwaarde?: number;
      notities?: string;
    };

    if (!naam || !bedrag || !datum) {
      return NextResponse.json(
        { fout: "Naam, bedrag en datum zijn verplicht." },
        { status: 400 }
      );
    }

    const result = await db
      .insert(investeringen)
      .values({
        naam,
        bedrag,
        datum,
        categorie: categorie as "hardware" | "software" | "inventaris" | "vervoer" | "overig" | undefined,
        afschrijvingstermijn: afschrijvingstermijn ?? 5,
        restwaarde: restwaarde ?? 0,
        notities,
        aangemaaktDoor: gebruiker.id,
      })
      .returning()
      .all();

    // Audit log
    await db.insert(belastingAuditLog).values({
      gebruikerId: gebruiker.id,
      actie: "investering_aangemaakt",
      entiteitType: "investering",
      entiteitId: result[0]?.id,
      details: JSON.stringify({ naam, bedrag, datum }),
    }).run();

    return NextResponse.json({ investering: result[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
