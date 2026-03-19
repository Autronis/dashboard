import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { opgeslagenRoutes, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const routes = db
      .select({
        id: opgeslagenRoutes.id,
        naam: opgeslagenRoutes.naam,
        vanLocatie: opgeslagenRoutes.vanLocatie,
        naarLocatie: opgeslagenRoutes.naarLocatie,
        kilometers: opgeslagenRoutes.kilometers,
        klantId: opgeslagenRoutes.klantId,
        projectId: opgeslagenRoutes.projectId,
        doelType: opgeslagenRoutes.doelType,
        aantalKeerGebruikt: opgeslagenRoutes.aantalKeerGebruikt,
        klantNaam: klanten.bedrijfsnaam,
        projectNaam: projecten.naam,
      })
      .from(opgeslagenRoutes)
      .leftJoin(klanten, eq(opgeslagenRoutes.klantId, klanten.id))
      .leftJoin(projecten, eq(opgeslagenRoutes.projectId, projecten.id))
      .where(eq(opgeslagenRoutes.gebruikerId, gebruiker.id))
      .orderBy(desc(opgeslagenRoutes.aantalKeerGebruikt))
      .all();

    return NextResponse.json({ routes });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { naam, vanLocatie, naarLocatie, kilometers, klantId, projectId, doelType } = body;

    if (!naam?.trim() || !vanLocatie?.trim() || !naarLocatie?.trim() || !kilometers) {
      return NextResponse.json(
        { fout: "Naam, van, naar en kilometers zijn verplicht." },
        { status: 400 }
      );
    }

    const [nieuw] = db
      .insert(opgeslagenRoutes)
      .values({
        gebruikerId: gebruiker.id,
        naam: naam.trim(),
        vanLocatie: vanLocatie.trim(),
        naarLocatie: naarLocatie.trim(),
        kilometers: parseFloat(kilometers),
        klantId: klantId || null,
        projectId: projectId || null,
        doelType: doelType || null,
      })
      .returning()
      .all();

    return NextResponse.json({ route: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ fout: "ID is verplicht" }, { status: 400 });
    }

    db.delete(opgeslagenRoutes)
      .where(and(eq(opgeslagenRoutes.id, Number(id)), eq(opgeslagenRoutes.gebruikerId, gebruiker.id)))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// Increment usage count when a saved route is used
export async function PATCH(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ fout: "ID is verplicht" }, { status: 400 });
    }

    db.update(opgeslagenRoutes)
      .set({ aantalKeerGebruikt: sql`${opgeslagenRoutes.aantalKeerGebruikt} + 1` })
      .where(and(eq(opgeslagenRoutes.id, Number(id)), eq(opgeslagenRoutes.gebruikerId, gebruiker.id)))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
