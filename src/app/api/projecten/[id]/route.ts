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
