import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externeKalenders } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/agenda/kalenders — alle externe kalenders van de gebruiker
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const kalenders = await db
      .select()
      .from(externeKalenders)
      .where(eq(externeKalenders.isActief, 1));

    return NextResponse.json({ kalenders });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/agenda/kalenders — nieuwe kalender toevoegen
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json()) as {
      naam?: string;
      url?: string;
      bron?: string;
      kleur?: string;
    };

    if (!body.naam || !body.url || !body.bron) {
      return NextResponse.json({ fout: "Naam, URL en bron zijn verplicht" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ fout: "Ongeldige URL" }, { status: 400 });
    }

    const result = await db
      .insert(externeKalenders)
      .values({
        gebruikerId: gebruiker.id,
        naam: body.naam,
        url: body.url,
        bron: body.bron as "google" | "icloud" | "outlook" | "overig",
        kleur: body.kleur ?? "#17B8A5",
      })
      .returning()
      .get();

    return NextResponse.json({ kalender: result });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
