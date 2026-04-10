import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { locatieAliassen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const aliassen = await db
      .select()
      .from(locatieAliassen)
      .where(eq(locatieAliassen.gebruikerId, gebruiker.id))
      .all();
    return NextResponse.json({ aliassen });
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
    const { alias, genormaliseerdeNaam } = await req.json();

    if (!alias?.trim() || !genormaliseerdeNaam?.trim()) {
      return NextResponse.json({ fout: "Alias en genormaliseerde naam zijn verplicht" }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(locatieAliassen)
      .values({
        gebruikerId: gebruiker.id,
        alias: alias.trim().toLowerCase(),
        genormaliseerdeNaam: genormaliseerdeNaam.trim(),
      })
      .returning();

    return NextResponse.json({ alias: nieuw }, { status: 201 });
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
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "");
    if (!id) return NextResponse.json({ fout: "ID is verplicht" }, { status: 400 });

    await db
      .delete(locatieAliassen)
      .where(and(eq(locatieAliassen.id, id), eq(locatieAliassen.gebruikerId, gebruiker.id)))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
