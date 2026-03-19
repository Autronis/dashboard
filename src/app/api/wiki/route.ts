import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wikiArtikelen, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, like, or, desc, sql } from "drizzle-orm";

// GET /api/wiki — list articles with optional filters
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const categorie = searchParams.get("categorie");
    const zoek = searchParams.get("zoek");

    const conditions = [];
    if (categorie) {
      conditions.push(
        eq(wikiArtikelen.categorie, categorie as typeof wikiArtikelen.categorie.enumValues[number])
      );
    }
    if (zoek) {
      conditions.push(
        or(
          like(wikiArtikelen.titel, `%${zoek}%`),
          like(wikiArtikelen.inhoud, `%${zoek}%`)
        )
      );
    }

    const rows = await db
      .select({
        id: wikiArtikelen.id,
        titel: wikiArtikelen.titel,
        inhoud: wikiArtikelen.inhoud,
        categorie: wikiArtikelen.categorie,
        tags: wikiArtikelen.tags,
        gepubliceerd: wikiArtikelen.gepubliceerd,
        auteurId: wikiArtikelen.auteurId,
        auteurNaam: gebruikers.naam,
        aangemaaktOp: wikiArtikelen.aangemaaktOp,
        bijgewerktOp: wikiArtikelen.bijgewerktOp,
      })
      .from(wikiArtikelen)
      .leftJoin(gebruikers, eq(wikiArtikelen.auteurId, gebruikers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(wikiArtikelen.bijgewerktOp));

    // Category counts
    const categorieCounts = await db
      .select({
        categorie: wikiArtikelen.categorie,
        aantal: sql<number>`count(*)`,
      })
      .from(wikiArtikelen)
      .groupBy(wikiArtikelen.categorie);

    return NextResponse.json({ artikelen: rows, categorieCounts });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/wiki — create article
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { titel, inhoud, categorie, tags } = body;

    if (!titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }

    const [artikel] = await db
      .insert(wikiArtikelen)
      .values({
        titel: titel.trim(),
        inhoud: inhoud || "",
        categorie: categorie || "processen",
        tags: JSON.stringify(tags || []),
        auteurId: gebruiker.id,
        gepubliceerd: 1,
      })
      .returning();

    return NextResponse.json({ artikel }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
