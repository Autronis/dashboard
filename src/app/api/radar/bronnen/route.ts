import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarBronnen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/radar/bronnen — Alle bronnen ophalen
export async function GET() {
  try {
    await requireAuth();

    const bronnen = await db
      .select()
      .from(radarBronnen)
      .orderBy(radarBronnen.naam)
      .all();

    return NextResponse.json({ bronnen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/radar/bronnen — Nieuwe bron toevoegen
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { naam, url, type } = body;

    if (!naam || !url || !type) {
      return NextResponse.json(
        { fout: "Naam, URL en type zijn verplicht" },
        { status: 400 }
      );
    }

    // Check URL uniciteit
    const bestaand = await db
      .select({ id: radarBronnen.id })
      .from(radarBronnen)
      .where(eq(radarBronnen.url, url))
      .get();

    if (bestaand) {
      return NextResponse.json(
        { fout: "Een bron met deze URL bestaat al" },
        { status: 409 }
      );
    }

    const result = await db
      .insert(radarBronnen)
      .values({ naam, url, type })
      .run();

    const bron = await db
      .select()
      .from(radarBronnen)
      .where(eq(radarBronnen.id, Number(result.lastInsertRowid)))
      .get();

    return NextResponse.json({ bron }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
