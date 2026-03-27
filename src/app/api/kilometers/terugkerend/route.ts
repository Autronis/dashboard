import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { terugkerendeRitten, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// GET /api/kilometers/terugkerend
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const lijst = await db
      .select({
        id: terugkerendeRitten.id,
        naam: terugkerendeRitten.naam,
        vanLocatie: terugkerendeRitten.vanLocatie,
        naarLocatie: terugkerendeRitten.naarLocatie,
        kilometers: terugkerendeRitten.kilometers,
        isRetour: terugkerendeRitten.isRetour,
        doelType: terugkerendeRitten.doelType,
        klantId: terugkerendeRitten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        projectId: terugkerendeRitten.projectId,
        frequentie: terugkerendeRitten.frequentie,
        dagVanWeek: terugkerendeRitten.dagVanWeek,
        dagVanMaand: terugkerendeRitten.dagVanMaand,
        startDatum: terugkerendeRitten.startDatum,
        eindDatum: terugkerendeRitten.eindDatum,
        isActief: terugkerendeRitten.isActief,
        laatsteGeneratie: terugkerendeRitten.laatsteGeneratie,
      })
      .from(terugkerendeRitten)
      .leftJoin(klanten, eq(terugkerendeRitten.klantId, klanten.id))
      .leftJoin(projecten, eq(terugkerendeRitten.projectId, projecten.id))
      .where(eq(terugkerendeRitten.gebruikerId, gebruiker.id))
      .orderBy(terugkerendeRitten.naam);

    return NextResponse.json({ ritten: lijst });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/kilometers/terugkerend
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { naam, vanLocatie, naarLocatie, kilometers, isRetour, doelType, klantId, projectId, frequentie, dagVanWeek, dagVanMaand, startDatum, eindDatum } = body;

    if (!naam?.trim() || !vanLocatie?.trim() || !naarLocatie?.trim() || !kilometers || !frequentie || !startDatum) {
      return NextResponse.json({ fout: "Naam, van, naar, kilometers, frequentie en startdatum zijn verplicht." }, { status: 400 });
    }

    if (frequentie === "wekelijks" && dagVanWeek == null) {
      return NextResponse.json({ fout: "Dag van de week is verplicht bij wekelijkse frequentie." }, { status: 400 });
    }

    if (frequentie === "maandelijks" && dagVanMaand == null) {
      return NextResponse.json({ fout: "Dag van de maand is verplicht bij maandelijkse frequentie." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(terugkerendeRitten)
      .values({
        gebruikerId: gebruiker.id,
        naam: naam.trim(),
        vanLocatie: vanLocatie.trim(),
        naarLocatie: naarLocatie.trim(),
        kilometers: parseFloat(kilometers),
        isRetour: isRetour ? 1 : 0,
        doelType: doelType || null,
        klantId: klantId || null,
        projectId: projectId || null,
        frequentie,
        dagVanWeek: dagVanWeek ?? null,
        dagVanMaand: dagVanMaand ?? null,
        startDatum,
        eindDatum: eindDatum || null,
        laatsteGeneratie: null,
      })
      .returning();

    return NextResponse.json({ rit: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/kilometers/terugkerend?id=X
export async function PUT(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ fout: "ID is verplicht." }, { status: 400 });

    const body = await req.json();

    // Verify ownership
    const [bestaand] = await db
      .select({ id: terugkerendeRitten.id })
      .from(terugkerendeRitten)
      .where(and(eq(terugkerendeRitten.id, id), eq(terugkerendeRitten.gebruikerId, gebruiker.id)))
      .limit(1);

    if (!bestaand) return NextResponse.json({ fout: "Rit niet gevonden." }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.naam != null) updates.naam = body.naam.trim();
    if (body.vanLocatie != null) updates.vanLocatie = body.vanLocatie.trim();
    if (body.naarLocatie != null) updates.naarLocatie = body.naarLocatie.trim();
    if (body.kilometers != null) updates.kilometers = parseFloat(body.kilometers);
    if (body.isRetour != null) updates.isRetour = body.isRetour ? 1 : 0;
    if (body.doelType !== undefined) updates.doelType = body.doelType || null;
    if (body.klantId !== undefined) updates.klantId = body.klantId || null;
    if (body.projectId !== undefined) updates.projectId = body.projectId || null;
    if (body.frequentie != null) updates.frequentie = body.frequentie;
    if (body.dagVanWeek !== undefined) updates.dagVanWeek = body.dagVanWeek ?? null;
    if (body.dagVanMaand !== undefined) updates.dagVanMaand = body.dagVanMaand ?? null;
    if (body.startDatum != null) updates.startDatum = body.startDatum;
    if (body.eindDatum !== undefined) updates.eindDatum = body.eindDatum || null;
    if (body.isActief != null) updates.isActief = body.isActief ? 1 : 0;

    const [updated] = await db
      .update(terugkerendeRitten)
      .set(updates)
      .where(eq(terugkerendeRitten.id, id))
      .returning();

    return NextResponse.json({ rit: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/kilometers/terugkerend?id=X
export async function DELETE(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ fout: "ID is verplicht." }, { status: 400 });

    const [bestaand] = await db
      .select({ id: terugkerendeRitten.id })
      .from(terugkerendeRitten)
      .where(and(eq(terugkerendeRitten.id, id), eq(terugkerendeRitten.gebruikerId, gebruiker.id)))
      .limit(1);

    if (!bestaand) return NextResponse.json({ fout: "Rit niet gevonden." }, { status: 404 });

    await db.delete(terugkerendeRitten).where(eq(terugkerendeRitten.id, id));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
