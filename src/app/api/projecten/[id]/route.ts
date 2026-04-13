import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, klanten, taken, tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

interface Fase {
  naam: string;
  taken: FaseTaak[];
  totaal: number;
  afgerond: number;
}

interface FaseTaak {
  id: number;
  titel: string;
  status: string;
  prioriteit: string;
  deadline: string | null;
  uitvoerder: string | null;
  bijgewerktOp: string | null;
}

// GET /api/projecten/[id] — Single project with tasks grouped by fase
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const projectId = parseInt(id, 10);

    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    // Fetch project with client name
    const project = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        omschrijving: projecten.omschrijving,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        status: projecten.status,
        voortgangPercentage: projecten.voortgangPercentage,
        deadline: projecten.deadline,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        aangemaaktOp: projecten.aangemaaktOp,
        bijgewerktOp: projecten.bijgewerktOp,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(eq(projecten.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    // Fetch all tasks for this project
    const alleTaken = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        fase: taken.fase,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        uitvoerder: taken.uitvoerder,
        volgorde: taken.volgorde,
        bijgewerktOp: taken.bijgewerktOp,
      })
      .from(taken)
      .where(eq(taken.projectId, projectId))
      .orderBy(taken.volgorde)
      .all();

    // Group tasks by fase
    const faseMap = new Map<string, FaseTaak[]>();
    for (const taak of alleTaken) {
      const faseNaam = taak.fase || "Overig";
      if (!faseMap.has(faseNaam)) faseMap.set(faseNaam, []);
      faseMap.get(faseNaam)!.push({
        id: taak.id,
        titel: taak.titel,
        status: taak.status ?? "open",
        prioriteit: taak.prioriteit ?? "normaal",
        deadline: taak.deadline,
        uitvoerder: taak.uitvoerder,
        bijgewerktOp: taak.bijgewerktOp,
      });
    }

    const fases: Fase[] = Array.from(faseMap.entries()).map(([naam, faseTaken]) => ({
      naam,
      taken: faseTaken,
      totaal: faseTaken.length,
      afgerond: faseTaken.filter((t) => t.status === "afgerond").length,
    }));

    // Get total time tracked
    const urenStats = await db
      .select({
        totaalMinuten: sql<number>`COALESCE(SUM(${tijdregistraties.duurMinuten}), 0)`,
      })
      .from(tijdregistraties)
      .where(eq(tijdregistraties.projectId, projectId))
      .get();

    // Task stats
    const totaalTaken = alleTaken.length;
    const afgerondTaken = alleTaken.filter((t) => t.status === "afgerond").length;
    const voortgang = totaalTaken > 0 ? Math.round((afgerondTaken / totaalTaken) * 100) : 0;

    return NextResponse.json({
      project: {
        ...project,
        totaalTaken,
        afgerondTaken,
        voortgang,
        totaalMinuten: urenStats?.totaalMinuten ?? 0,
      },
      fases,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/projecten/[id] — Update project (status, isActief, naam, etc.)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if ("naam" in body && typeof body.naam === "string") updates.naam = body.naam.trim();
    if ("omschrijving" in body) updates.omschrijving = body.omschrijving;
    if ("status" in body) updates.status = body.status;
    if ("isActief" in body) updates.isActief = body.isActief ? 1 : 0;
    if ("klantId" in body) updates.klantId = body.klantId;
    if ("deadline" in body) updates.deadline = body.deadline;
    if ("voortgangPercentage" in body) updates.voortgangPercentage = body.voortgangPercentage;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken" }, { status: 400 });
    }

    updates.bijgewerktOp = new Date().toISOString();

    const [bijgewerkt] = await db
      .update(projecten)
      .set(updates)
      .where(eq(projecten.id, projectId))
      .returning();

    return NextResponse.json({ project: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/projecten/[id] — Soft delete (isActief=0) or hard delete with ?hard=true
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ fout: "Ongeldig project ID" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";

    // Get project info for the response (local folder cleanup hint)
    const project = await db
      .select({ id: projecten.id, naam: projecten.naam })
      .from(projecten)
      .where(eq(projecten.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    if (hard) {
      // Hard delete: remove tasks and time entries first, then project
      await db.delete(taken).where(eq(taken.projectId, projectId)).run();
      await db.delete(tijdregistraties).where(eq(tijdregistraties.projectId, projectId)).run();
      await db.delete(projecten).where(eq(projecten.id, projectId)).run();
    } else {
      // Soft delete: just flip isActief
      await db
        .update(projecten)
        .set({ isActief: 0, status: "afgerond", bijgewerktOp: new Date().toISOString() })
        .where(eq(projecten.id, projectId))
        .run();
    }

    return NextResponse.json({
      succes: true,
      hardDelete: hard,
      project: { id: project.id, naam: project.naam },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
