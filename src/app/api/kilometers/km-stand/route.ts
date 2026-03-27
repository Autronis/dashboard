import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kmStanden } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

// GET /api/kilometers/km-stand?jaar=2026
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = parseInt(searchParams.get("jaar") || String(new Date().getFullYear()));

    const standen = await db
      .select()
      .from(kmStanden)
      .where(and(eq(kmStanden.gebruikerId, gebruiker.id), eq(kmStanden.jaar, jaar)))
      .orderBy(kmStanden.maand);

    // Get the latest eindStand across all years for current stand
    const [laatste] = await db
      .select({ eindStand: kmStanden.eindStand })
      .from(kmStanden)
      .where(eq(kmStanden.gebruikerId, gebruiker.id))
      .orderBy(desc(kmStanden.jaar), desc(kmStanden.maand))
      .limit(1);

    return NextResponse.json({
      standen: standen.map((s) => ({
        id: s.id,
        maand: s.maand,
        jaar: s.jaar,
        beginStand: s.beginStand,
        eindStand: s.eindStand,
        totaalKm: s.eindStand - s.beginStand,
      })),
      huidigeStand: laatste?.eindStand ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/kilometers/km-stand — Upsert km-stand for a month
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { jaar, maand, beginStand, eindStand } = await req.json();

    if (!jaar || !maand || beginStand == null || eindStand == null) {
      return NextResponse.json({ fout: "Jaar, maand, beginstand en eindstand zijn verplicht." }, { status: 400 });
    }

    if (eindStand <= beginStand) {
      return NextResponse.json({ fout: "Eindstand moet hoger zijn dan beginstand." }, { status: 400 });
    }

    if (beginStand < 0 || eindStand < 0) {
      return NextResponse.json({ fout: "Km-stand kan niet negatief zijn." }, { status: 400 });
    }

    // Validate continuity: beginStand should match previous month's eindStand
    const prevMaand = maand === 1 ? 12 : maand - 1;
    const prevJaar = maand === 1 ? jaar - 1 : jaar;
    const [vorige] = await db
      .select({ eindStand: kmStanden.eindStand })
      .from(kmStanden)
      .where(
        and(
          eq(kmStanden.gebruikerId, gebruiker.id),
          eq(kmStanden.jaar, prevJaar),
          eq(kmStanden.maand, prevMaand)
        )
      )
      .limit(1);

    if (vorige && Math.abs(vorige.eindStand - beginStand) > 0.5) {
      return NextResponse.json(
        { fout: `Beginstand (${beginStand}) sluit niet aan op vorige maand eindstand (${vorige.eindStand}).` },
        { status: 400 }
      );
    }

    // Upsert
    const [bestaand] = await db
      .select({ id: kmStanden.id })
      .from(kmStanden)
      .where(
        and(
          eq(kmStanden.gebruikerId, gebruiker.id),
          eq(kmStanden.jaar, jaar),
          eq(kmStanden.maand, maand)
        )
      )
      .limit(1);

    if (bestaand) {
      const [updated] = await db
        .update(kmStanden)
        .set({ beginStand, eindStand })
        .where(eq(kmStanden.id, bestaand.id))
        .returning();
      return NextResponse.json({ stand: updated });
    }

    const [nieuw] = await db
      .insert(kmStanden)
      .values({ gebruikerId: gebruiker.id, jaar, maand, beginStand, eindStand })
      .returning();

    return NextResponse.json({ stand: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
