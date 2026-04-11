import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { db } from "@/lib/db";
import { ideeen, gebruikers } from "@/lib/db/schema";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { eq, and, asc, sql } from "drizzle-orm";

// GET /api/ideeen — lijst met optionele filters
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    // Ensure new columns exist
    try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN bron TEXT`); } catch { /* exists */ }
    try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN bron_tekst TEXT`); } catch { /* exists */ }
    try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN confidence_breakdown TEXT`); } catch { /* exists */ }
    try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN confidence_bijgewerkt_op TEXT`); } catch { /* exists */ }
    try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN geparkeerd INTEGER DEFAULT 0`); } catch { /* exists */ }

    // One-time migration: scale existing aiScore from 1-10 to 0-100
    try {
      await db.run(sql`UPDATE ideeen SET ai_score = ai_score * 10 WHERE ai_score IS NOT NULL AND ai_score <= 10`);
    } catch { /* already migrated */ }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const categorie = searchParams.get("categorie");
    const prioriteit = searchParams.get("prioriteit");

    const conditions = [];
    if (status) conditions.push(eq(ideeen.status, status as "idee" | "uitgewerkt" | "actief" | "gebouwd"));
    if (categorie) conditions.push(eq(ideeen.categorie, categorie as "dashboard" | "klant_verkoop" | "intern" | "dev_tools" | "content_media" | "geld_groei" | "experimenteel" | "website" | "inzicht"));
    if (prioriteit) conditions.push(eq(ideeen.prioriteit, prioriteit as "laag" | "normaal" | "hoog"));

    const rows = await db
      .select()
      .from(ideeen)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(ideeen.nummer))
      .all();

    return NextResponse.json({ ideeen: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/ideeen — nieuw idee aanmaken
export async function POST(req: NextRequest) {
  try {
    // Support both session auth and API key auth (for Claude Code / YTK pipeline)
    const authHeader = req.headers.get("authorization");
    let gebruiker;
    if (authHeader?.startsWith("Bearer ")) {
      await requireApiKey(req);
      const defaultUser = await db.select().from(gebruikers).limit(1).get();
      gebruiker = defaultUser ?? { id: 1, naam: "Claude" };
    } else {
      gebruiker = await requireAuth();
    }
    const body = await req.json();
    const { naam, nummer, categorie, status, omschrijving, uitwerking, prioriteit } = body;

    if (!naam?.trim()) {
      return NextResponse.json({ fout: "Naam is verplicht." }, { status: 400 });
    }

    let notionPageId: string | null = null;

    const notionDbId = process.env.NOTION_DB_IDEEEN;
    if (notionDbId && process.env.NOTION_API_KEY) {
      try {
        const notion = new Client({ auth: process.env.NOTION_API_KEY });
        const page = await notion.pages.create({
          parent: { database_id: notionDbId },
          properties: {
            Naam: { title: [{ text: { content: naam.trim() } }] },
            Status: { select: { name: status || "Idee" } },
            Categorie: { select: { name: categorie || "intern" } },
            Omschrijving: { rich_text: [{ text: { content: omschrijving || "" } }] },
            Prioriteit: { select: { name: prioriteit || "normaal" } },
            Nummer: { number: nummer || null },
          },
        });
        notionPageId = page.id;
      } catch {
        // Notion sync mislukt — idee wordt alsnog opgeslagen in DB
      }
    }

    const [nieuw] = await db
      .insert(ideeen)
      .values({
        naam: naam.trim(),
        nummer: nummer || null,
        categorie: categorie || null,
        status: status || "idee",
        omschrijving: omschrijving?.trim() || null,
        uitwerking: uitwerking?.trim() || null,
        prioriteit: prioriteit || "normaal",
        notionPageId,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ idee: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
