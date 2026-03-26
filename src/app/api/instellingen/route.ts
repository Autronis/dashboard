import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bedrijfsinstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/instellingen — haal bedrijfsgegevens op
export async function GET() {
  try {
    await requireAuth();
    const [bedrijf] = await db.select().from(bedrijfsinstellingen).limit(1);

    return NextResponse.json({
      bedrijf: bedrijf || {
        id: null,
        bedrijfsnaam: "Autronis",
        adres: null,
        kvkNummer: null,
        btwNummer: null,
        iban: null,
        email: null,
        telefoon: null,
        logoPad: null,
        standaardBtw: 21,
        betalingstermijnDagen: 30,
        herinneringNaDagen: 7,
      },
    }, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=1800" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/instellingen — bedrijfsgegevens bijwerken
export async function PUT(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    const data = {
      bedrijfsnaam: body.bedrijfsnaam || "Autronis",
      adres: body.adres || null,
      kvkNummer: body.kvkNummer || null,
      btwNummer: body.btwNummer || null,
      iban: body.iban || null,
      email: body.email || null,
      telefoon: body.telefoon || null,
      standaardBtw: body.standaardBtw ?? 21,
      betalingstermijnDagen: body.betalingstermijnDagen ?? 30,
      herinneringNaDagen: body.herinneringNaDagen ?? 7,
    };

    // Check if row exists
    const [existing] = await db.select().from(bedrijfsinstellingen).limit(1);

    if (existing) {
      await db
        .update(bedrijfsinstellingen)
        .set(data)
        .where(eq(bedrijfsinstellingen.id, existing.id));
    } else {
      await db.insert(bedrijfsinstellingen).values({ id: 1, ...data });
    }

    const [updated] = await db.select().from(bedrijfsinstellingen).limit(1);
    return NextResponse.json({ bedrijf: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
