import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { db } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/ideeen/[id] — enkel idee ophalen
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const idee = await db
      .select()
      .from(ideeen)
      .where(eq(ideeen.id, Number(id)))
      .get();

    if (!idee) {
      return NextResponse.json({ fout: "Idee niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ idee });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/ideeen/[id] — idee bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (body.naam !== undefined) updateData.naam = body.naam.trim();
    if (body.nummer !== undefined) updateData.nummer = body.nummer;
    if (body.categorie !== undefined) updateData.categorie = body.categorie;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.uitwerking !== undefined) updateData.uitwerking = body.uitwerking?.trim() || null;
    if (body.prioriteit !== undefined) updateData.prioriteit = body.prioriteit;
    if (body.impact !== undefined) updateData.impact = body.impact;
    if (body.effort !== undefined) updateData.effort = body.effort;
    if (body.revenuePotential !== undefined) updateData.revenuePotential = body.revenuePotential;

    // Recalculate aiScore if manual scores are set
    if (body.impact !== undefined || body.effort !== undefined || body.revenuePotential !== undefined) {
      const existing = await db.select().from(ideeen).where(eq(ideeen.id, Number(id))).get();
      const impact = body.impact ?? existing?.impact ?? 5;
      const effort = body.effort ?? existing?.effort ?? 5;
      const revenue = body.revenuePotential ?? existing?.revenuePotential ?? 5;
      // Priority score: high impact + high revenue + low effort = high score
      const effortInverted = 11 - Math.max(1, Math.min(10, effort));
      updateData.aiScore = Math.round((impact + revenue + effortInverted) / 3 * 10) / 10;
    }

    // Handle AI suggestion fields
    if (body.gepromoveerd !== undefined) updateData.gepromoveerd = body.gepromoveerd;
    if (body.isAiSuggestie !== undefined) updateData.isAiSuggestie = body.isAiSuggestie;

    // Handle confidence/parking fields
    if (body.bron !== undefined) updateData.bron = body.bron;
    if (body.bronTekst !== undefined) updateData.bronTekst = body.bronTekst;
    if (body.geparkeerd !== undefined) updateData.geparkeerd = body.geparkeerd;

    const [bijgewerkt] = await db
      .update(ideeen)
      .set(updateData)
      .where(eq(ideeen.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Idee niet gevonden." }, { status: 404 });
    }

    // Sync naar Notion als notionPageId bestaat
    if (bijgewerkt.notionPageId && process.env.NOTION_API_KEY) {
      try {
        const notion = new Client({ auth: process.env.NOTION_API_KEY });
        const properties: Record<string, unknown> = {};
        if (body.naam !== undefined) properties.Naam = { title: [{ text: { content: body.naam.trim() } }] };
        if (body.status !== undefined) properties.Status = { select: { name: body.status } };
        if (body.categorie !== undefined) properties.Categorie = { select: { name: body.categorie } };
        if (body.omschrijving !== undefined) properties.Omschrijving = { rich_text: [{ text: { content: body.omschrijving || "" } }] };
        if (body.prioriteit !== undefined) properties.Prioriteit = { select: { name: body.prioriteit } };
        if (body.nummer !== undefined) properties.Nummer = { number: body.nummer || null };

        if (Object.keys(properties).length > 0) {
          await notion.pages.update({
            page_id: bijgewerkt.notionPageId,
            properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
          });
        }
      } catch {
        // Notion sync mislukt — lokale update is al opgeslagen
      }
    }

    return NextResponse.json({ idee: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/ideeen/[id] — idee verwijderen (hard delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const idee = await db
      .select()
      .from(ideeen)
      .where(eq(ideeen.id, Number(id)))
      .get();

    if (!idee) {
      return NextResponse.json({ fout: "Idee niet gevonden." }, { status: 404 });
    }

    await db.delete(ideeen).where(eq(ideeen.id, Number(id))).run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
