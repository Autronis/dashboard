import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, locatieAliassen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, like, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const zoekterm = new URL(req.url).searchParams.get("q")?.trim();

    if (!zoekterm || zoekterm.length < 2) {
      return NextResponse.json({ locaties: [] });
    }

    const pattern = `%${zoekterm}%`;

    const vanLocaties = await db
      .select({
        locatie: kilometerRegistraties.vanLocatie,
        aantal: sql<number>`COUNT(*)`.as("aantal"),
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          like(kilometerRegistraties.vanLocatie, pattern)
        )
      )
      .groupBy(kilometerRegistraties.vanLocatie)
      .all();

    const naarLocaties = await db
      .select({
        locatie: kilometerRegistraties.naarLocatie,
        aantal: sql<number>`COUNT(*)`.as("aantal"),
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          like(kilometerRegistraties.naarLocatie, pattern)
        )
      )
      .groupBy(kilometerRegistraties.naarLocatie)
      .all();

    // Merge and deduplicate
    const locatieMap = new Map<string, number>();
    for (const l of [...vanLocaties, ...naarLocaties]) {
      const bestaand = locatieMap.get(l.locatie) ?? 0;
      locatieMap.set(l.locatie, bestaand + l.aantal);
    }

    // Check aliases
    const aliassen = await db
      .select()
      .from(locatieAliassen)
      .where(
        and(
          eq(locatieAliassen.gebruikerId, gebruiker.id),
          like(locatieAliassen.alias, pattern)
        )
      )
      .all();

    for (const a of aliassen) {
      if (!locatieMap.has(a.genormaliseerdeNaam)) {
        locatieMap.set(a.genormaliseerdeNaam, 1);
      }
    }

    const locaties = Array.from(locatieMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([locatie, aantalGebruikt]) => ({ locatie, aantalGebruikt }));

    return NextResponse.json({ locaties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
