import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamActiviteit, gebruikers, taken, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq, sql } from "drizzle-orm";

// GET /api/team/live — wie werkt waaraan + recente activiteit
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    // Wie is waar bezig? (taken met status "bezig" en toegewezen)
    const bezigMet = await db
      .select({
        taakId: taken.id,
        taakTitel: taken.titel,
        status: taken.status,
        gebruikerId: taken.toegewezenAan,
        gebruikerNaam: gebruikers.naam,
        projectNaam: projecten.naam,
        projectId: taken.projectId,
        bijgewerktOp: taken.bijgewerktOp,
      })
      .from(taken)
      .innerJoin(gebruikers, eq(taken.toegewezenAan, gebruikers.id))
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(eq(taken.status, "bezig"))
      .orderBy(desc(taken.bijgewerktOp))
      .limit(20);

    // Recente activiteit (laatste 10)
    const recenteActiviteit = await db
      .select({
        id: teamActiviteit.id,
        gebruikerId: teamActiviteit.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        type: teamActiviteit.type,
        taakId: teamActiviteit.taakId,
        projectId: teamActiviteit.projectId,
        bericht: teamActiviteit.bericht,
        aangemaaktOp: teamActiviteit.aangemaaktOp,
      })
      .from(teamActiviteit)
      .innerJoin(gebruikers, eq(teamActiviteit.gebruikerId, gebruikers.id))
      .orderBy(desc(teamActiviteit.aangemaaktOp))
      .limit(10);

    // Per project: wie werkt eraan
    const projectStatus = new Map<number, { projectNaam: string; medewerkers: Array<{ naam: string; taak: string }> }>();
    for (const t of bezigMet) {
      if (!t.projectId) continue;
      const existing = projectStatus.get(t.projectId) || { projectNaam: t.projectNaam || "Onbekend", medewerkers: [] };
      existing.medewerkers.push({ naam: t.gebruikerNaam, taak: t.taakTitel });
      projectStatus.set(t.projectId, existing);
    }

    // Gedeelde projecten: projecten waar BEIDE gebruikers taken in hebben
    const gedeeldeProjecten = [...projectStatus.values()].filter(
      (p) => {
        const unieke = new Set(p.medewerkers.map((m) => m.naam));
        return unieke.size > 1;
      }
    );

    return NextResponse.json({
      bezigMet,
      recenteActiviteit,
      projectStatus: [...projectStatus.entries()].map(([id, v]) => ({ projectId: id, ...v })),
      gedeeldeProjecten,
      huidigeGebruiker: { id: gebruiker.id, naam: gebruiker.naam },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
