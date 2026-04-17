import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klantUren, klanten, projecten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";

// GET /api/klanten/[id]/uren — List hours grouped by project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthOrApiKey(req);
    const { id } = await params;
    const klantId = Number(id);

    // Check klant exists
    const klantResult = await db.select({ id: klanten.id }).from(klanten).where(eq(klanten.id, klantId));
    const klant = klantResult[0];
    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    // All entries, most recent first
    const uren = await db
      .select({
        id: klantUren.id,
        klantId: klantUren.klantId,
        projectId: klantUren.projectId,
        projectNaam: projecten.naam,
        datum: klantUren.datum,
        duurMinuten: klantUren.duurMinuten,
        omschrijving: klantUren.omschrijving,
        bron: klantUren.bron,
        aangemaaktOp: klantUren.aangemaaktOp,
      })
      .from(klantUren)
      .leftJoin(projecten, eq(klantUren.projectId, projecten.id))
      .where(eq(klantUren.klantId, klantId))
      .orderBy(desc(klantUren.datum));

    // Summary per project
    const perProject = await db
      .select({
        projectId: klantUren.projectId,
        projectNaam: projecten.naam,
        totaalMinuten: sql<number>`sum(${klantUren.duurMinuten})`,
        aantalSessies: sql<number>`count(*)`,
      })
      .from(klantUren)
      .leftJoin(projecten, eq(klantUren.projectId, projecten.id))
      .where(eq(klantUren.klantId, klantId))
      .groupBy(klantUren.projectId);

    const totaalMinuten = uren.reduce((s, u) => s + u.duurMinuten, 0);

    return NextResponse.json({
      uren,
      perProject,
      totaalMinuten,
      aantalSessies: uren.length,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 }
    );
  }
}

// POST /api/klanten/[id]/uren — Log hours (from Claude /end skill or manual)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { id } = await params;
    const klantId = Number(id);
    const body = await req.json();

    // Check klant exists
    const klantCheck = await db.select({ id: klanten.id }).from(klanten).where(eq(klanten.id, klantId));
    if (!klantCheck[0]) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    const { projectId, datum, duurMinuten, omschrijving, bron, sessieId } = body;

    if (!duurMinuten || duurMinuten <= 0) {
      return NextResponse.json({ fout: "duurMinuten is verplicht en moet > 0 zijn." }, { status: 400 });
    }

    // Validate projectId belongs to this klant if provided
    if (projectId) {
      const projectCheck = await db
        .select({ id: projecten.id })
        .from(projecten)
        .where(and(eq(projecten.id, projectId), eq(projecten.klantId, klantId)));
      if (!projectCheck[0]) {
        return NextResponse.json({ fout: "Project behoort niet tot deze klant." }, { status: 400 });
      }
    }

    const entryResult = await db
      .insert(klantUren)
      .values({
        klantId,
        projectId: projectId || null,
        gebruikerId: gebruiker.id,
        datum: datum || new Date().toISOString().slice(0, 10),
        duurMinuten,
        omschrijving: omschrijving || null,
        bron: bron === "handmatig" ? "handmatig" : "claude-sessie",
        sessieId: sessieId || null,
      })
      .returning();

    return NextResponse.json({ uren: entryResult[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("geauthenticeerd") ? 401 : 500 }
    );
  }
}
