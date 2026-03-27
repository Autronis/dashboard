import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { brandstofKosten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

// GET /api/kilometers/brandstof?jaar=2026
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = searchParams.get("jaar") || String(new Date().getFullYear());

    const conditions = [
      eq(brandstofKosten.gebruikerId, gebruiker.id),
      gte(brandstofKosten.datum, `${jaar}-01-01`),
      lte(brandstofKosten.datum, `${jaar}-12-31`),
    ];

    const kosten = await db
      .select()
      .from(brandstofKosten)
      .where(and(...conditions))
      .orderBy(sql`${brandstofKosten.datum} DESC`);

    const totaalBedrag = kosten.reduce((sum, k) => sum + k.bedrag, 0);
    const maandenMetData = new Set(kosten.map((k) => k.datum.slice(5, 7))).size;

    return NextResponse.json({
      kosten: kosten.map((k) => ({
        id: k.id,
        datum: k.datum,
        bedrag: k.bedrag,
        liters: k.liters,
        kmStand: k.kmStand,
        notitie: k.notitie,
        bankTransactieId: k.bankTransactieId,
        isAutomatisch: k.bankTransactieId != null,
      })),
      totaalBedrag,
      gemiddeldPerMaand: maandenMetData > 0 ? totaalBedrag / maandenMetData : 0,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/kilometers/brandstof
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { datum, bedrag, liters, kmStand, notitie } = await req.json();

    if (!datum || bedrag == null) {
      return NextResponse.json({ fout: "Datum en bedrag zijn verplicht." }, { status: 400 });
    }

    if (bedrag <= 0) {
      return NextResponse.json({ fout: "Bedrag moet positief zijn." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(brandstofKosten)
      .values({
        gebruikerId: gebruiker.id,
        datum,
        bedrag: parseFloat(bedrag),
        liters: liters ? parseFloat(liters) : null,
        kmStand: kmStand ? parseFloat(kmStand) : null,
        notitie: notitie?.trim() || null,
      })
      .returning();

    return NextResponse.json({ kost: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/kilometers/brandstof?id=X
export async function DELETE(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ fout: "ID is verplicht." }, { status: 400 });

    const [bestaand] = await db
      .select({ id: brandstofKosten.id })
      .from(brandstofKosten)
      .where(and(eq(brandstofKosten.id, id), eq(brandstofKosten.gebruikerId, gebruiker.id)))
      .limit(1);

    if (!bestaand) return NextResponse.json({ fout: "Brandstofkost niet gevonden." }, { status: 404 });

    await db.delete(brandstofKosten).where(eq(brandstofKosten.id, id));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
