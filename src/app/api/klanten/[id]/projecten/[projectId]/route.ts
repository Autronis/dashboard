import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, taken, tijdregistraties, notities, documenten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, desc } from "drizzle-orm";

// GET /api/klanten/[id]/projecten/[projectId] — Project detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    await requireAuth();
    const { id, projectId } = await params;

    const [project] = await db
      .select()
      .from(projecten)
      .where(and(eq(projecten.id, Number(projectId)), eq(projecten.klantId, Number(id))));

    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden." }, { status: 404 });
    }

    // Klant naam
    const [klant] = await db
      .select({ bedrijfsnaam: klanten.bedrijfsnaam })
      .from(klanten)
      .where(eq(klanten.id, Number(id)));

    // Taken
    const takenLijst = await db
      .select()
      .from(taken)
      .where(eq(taken.projectId, Number(projectId)))
      .orderBy(desc(taken.aangemaaktOp));

    // Tijdregistraties
    const tijdLijst = await db
      .select()
      .from(tijdregistraties)
      .where(eq(tijdregistraties.projectId, Number(projectId)))
      .orderBy(desc(tijdregistraties.startTijd));

    // Notities
    const notitiesLijst = await db
      .select()
      .from(notities)
      .where(eq(notities.projectId, Number(projectId)))
      .orderBy(desc(notities.aangemaaktOp));

    // Documenten
    const documentenLijst = await db
      .select()
      .from(documenten)
      .where(eq(documenten.projectId, Number(projectId)))
      .orderBy(desc(documenten.aangemaaktOp));

    // KPIs
    const [totaalUren] = await db
      .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .where(eq(tijdregistraties.projectId, Number(projectId)));

    const takenTotaal = takenLijst.length;
    const takenAfgerond = takenLijst.filter((t) => t.status === "afgerond").length;

    return NextResponse.json({
      project,
      klantNaam: klant?.bedrijfsnaam || "Onbekend",
      taken: takenLijst,
      tijdregistraties: tijdLijst,
      notities: notitiesLijst,
      documenten: documentenLijst,
      kpis: {
        totaalMinuten: totaalUren?.totaal || 0,
        takenTotaal,
        takenAfgerond,
        voortgang: project.voortgangPercentage || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/klanten/[id]/projecten/[projectId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    await requireAuth();
    const { projectId } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (body.naam !== undefined) updateData.naam = body.naam.trim();
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.geschatteUren !== undefined) updateData.geschatteUren = body.geschatteUren || null;
    if (body.deadline !== undefined) updateData.deadline = body.deadline || null;
    if (body.voortgangPercentage !== undefined) updateData.voortgangPercentage = body.voortgangPercentage;

    const [bijgewerkt] = await db
      .update(projecten)
      .set(updateData)
      .where(eq(projecten.id, Number(projectId)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Project niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ project: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/klanten/[id]/projecten/[projectId] — Soft-delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; projectId: string }> }
) {
  try {
    await requireAuth();
    const { projectId } = await params;

    await db
      .update(projecten)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(projecten.id, Number(projectId)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
