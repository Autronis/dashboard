import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, taken, screenTimeEntries, notities, documenten, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, desc, ne } from "drizzle-orm";

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

    // Screen-time activity (productive entries) voor dit project
    const PRODUCTIEF_SQL = sql`${screenTimeEntries.categorie} IN ('development','design','administratie','finance','communicatie')`;
    const tijdLijstRaw = await db
      .select({
        id: screenTimeEntries.id,
        gebruikerId: screenTimeEntries.gebruikerId,
        startTijd: screenTimeEntries.startTijd,
        eindTijd: screenTimeEntries.eindTijd,
        duurSeconden: screenTimeEntries.duurSeconden,
        categorie: screenTimeEntries.categorie,
        omschrijving: screenTimeEntries.vensterTitel,
      })
      .from(screenTimeEntries)
      .where(and(
        eq(screenTimeEntries.projectId, Number(projectId)),
        ne(screenTimeEntries.categorie, "inactief"),
        PRODUCTIEF_SQL,
      ))
      .orderBy(desc(screenTimeEntries.startTijd))
      .limit(100);
    const tijdLijst = tijdLijstRaw.map((t) => ({
      ...t,
      duurMinuten: Math.round(t.duurSeconden / 60),
    }));

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

    // KPIs — totaal uren via screen-time
    const [totaalUrenRow] = await db
      .select({ totaalSec: sql<number>`coalesce(sum(${screenTimeEntries.duurSeconden}), 0)` })
      .from(screenTimeEntries)
      .where(and(
        eq(screenTimeEntries.projectId, Number(projectId)),
        ne(screenTimeEntries.categorie, "inactief"),
        PRODUCTIEF_SQL,
      ));
    const totaalUren = { totaal: Math.round((totaalUrenRow?.totaalSec ?? 0) / 60) };

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

    // When a project is completed, delete all open tasks
    if (body.status === "afgerond") {
      await db
        .delete(taken)
        .where(
          and(
            eq(taken.projectId, Number(projectId)),
            eq(taken.status, "open")
          )
        );
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
