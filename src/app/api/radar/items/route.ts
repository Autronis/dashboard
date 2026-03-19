import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { radarItems, radarBronnen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, gte, and, sql } from "drizzle-orm";

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
      })
      .from(radarItems)
      .leftJoin(radarBronnen, eq(radarItems.bronId, radarBronnen.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(radarItems.gepubliceerdOp))
      .limit(limit)
      .all();

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
