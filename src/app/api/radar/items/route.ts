import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarItems, radarBronnen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, gte, lte, and, or, like, sql, count } from "drizzle-orm";

// GET /api/radar/items — Items ophalen met filters
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get("categorie");
    const minScore = searchParams.get("minScore");
    const bewaard = searchParams.get("bewaard");
    const bronId = searchParams.get("bronId");
    const nietRelevant = searchParams.get("nietRelevant");
    const zoek = searchParams.get("zoek");
    const vanDatum = searchParams.get("vanDatum");
    const totDatum = searchParams.get("totDatum");
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const conditions = [];

    if (categorie) {
      conditions.push(eq(radarItems.categorie, categorie as "ai_tools" | "api_updates" | "automation" | "business" | "competitors" | "tutorials" | "trends" | "kansen" | "must_reads"));
    }

    if (minScore) {
      conditions.push(gte(radarItems.score, parseInt(minScore, 10)));
    }

    if (bewaard === "1") {
      conditions.push(eq(radarItems.bewaard, 1));
    }

    if (bronId) {
      conditions.push(eq(radarItems.bronId, parseInt(bronId, 10)));
    }

    // Default: hide niet-relevant items unless explicitly requested
    if (nietRelevant !== "1") {
      conditions.push(eq(radarItems.nietRelevant, 0));
    }

    // Search in titel, beschrijving, aiSamenvatting
    if (zoek) {
      const zoekTerm = `%${zoek}%`;
      conditions.push(
        or(
          like(radarItems.titel, zoekTerm),
          like(radarItems.beschrijving, zoekTerm),
          like(radarItems.aiSamenvatting, zoekTerm)
        )!
      );
    }

    // Date range filters
    if (vanDatum) {
      conditions.push(gte(radarItems.gepubliceerdOp, vanDatum));
    }
    if (totDatum) {
      conditions.push(lte(radarItems.gepubliceerdOp, totDatum));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const [{ totaal }] = await db
      .select({ totaal: count() })
      .from(radarItems)
      .leftJoin(radarBronnen, eq(radarItems.bronId, radarBronnen.id))
      .where(whereClause)
      .all();

    const items = await db
      .select({
        id: radarItems.id,
        bronId: radarItems.bronId,
        titel: radarItems.titel,
        url: radarItems.url,
        beschrijving: radarItems.beschrijving,
        auteur: radarItems.auteur,
        gepubliceerdOp: radarItems.gepubliceerdOp,
        score: radarItems.score,
        scoreRedenering: radarItems.scoreRedenering,
        aiSamenvatting: radarItems.aiSamenvatting,
        relevantie: radarItems.relevantie,
        leesMinuten: radarItems.leesMinuten,
        categorie: radarItems.categorie,
        bewaard: radarItems.bewaard,
        nietRelevant: radarItems.nietRelevant,
        aangemaaktOp: radarItems.aangemaaktOp,
        bronNaam: sql<string>`${radarBronnen.naam}`.as("bron_naam"),
        bronType: sql<string>`${radarBronnen.type}`.as("bron_type"),
      })
      .from(radarItems)
      .leftJoin(radarBronnen, eq(radarItems.bronId, radarBronnen.id))
      .where(whereClause)
      .orderBy(desc(radarItems.score), desc(radarItems.gepubliceerdOp))
      .limit(limit)
      .offset(offset)
      .all();

    return NextResponse.json({ items, totaal });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
