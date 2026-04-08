import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamActiviteit, gebruikers, taken, projecten, sessies } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq, sql, and, inArray } from "drizzle-orm";

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

    // Also get assigned open tasks (todo/bezig) grouped by project + user
    const toegewezenTaken = await db
      .select({
        gebruikerId: taken.toegewezenAan,
        gebruikerNaam: gebruikers.naam,
        projectId: taken.projectId,
        projectNaam: projecten.naam,
        taakTitel: taken.titel,
        status: taken.status,
      })
      .from(taken)
      .innerJoin(gebruikers, eq(taken.toegewezenAan, gebruikers.id))
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(
        and(
          inArray(taken.status, ["open", "bezig"]),
          sql`${taken.toegewezenAan} IS NOT NULL`,
          sql`${taken.projectId} IS NOT NULL`,
        )
      )
      .orderBy(desc(taken.bijgewerktOp))
      .limit(50);

    // Get active sessions (last activity within 30 minutes)
    const activeSessions = await db
      .select({
        gebruikerId: sessies.gebruikerId,
        gebruikerNaam: gebruikers.naam,
        laatsteActiviteit: sessies.laatsteActiviteit,
      })
      .from(sessies)
      .innerJoin(gebruikers, eq(sessies.gebruikerId, gebruikers.id))
      .where(
        sql`${sessies.laatsteActiviteit} > datetime('now', '-30 minutes')`
      )
      .all();

    const onlineUserIds = new Set(activeSessions.map(s => s.gebruikerId));

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

    // Per project: wie werkt eraan (from bezig tasks)
    const projectStatus = new Map<number, { projectNaam: string; medewerkers: Array<{ naam: string; taak: string; online: boolean }> }>();

    // First add "bezig" tasks
    for (const t of bezigMet) {
      if (!t.projectId) continue;
      const existing = projectStatus.get(t.projectId) || { projectNaam: t.projectNaam || "Onbekend", medewerkers: [] };
      if (!existing.medewerkers.find(m => m.naam === t.gebruikerNaam)) {
        existing.medewerkers.push({
          naam: t.gebruikerNaam,
          taak: t.taakTitel,
          online: onlineUserIds.has(t.gebruikerId),
        });
      }
      projectStatus.set(t.projectId, existing);
    }

    // Then add assigned tasks (only for online users who aren't already listed)
    for (const t of toegewezenTaken) {
      if (!t.projectId || !t.gebruikerId) continue;
      if (!onlineUserIds.has(t.gebruikerId)) continue; // only show if online

      const existing = projectStatus.get(t.projectId) || { projectNaam: t.projectNaam || "Onbekend", medewerkers: [] };
      if (!existing.medewerkers.find(m => m.naam === t.gebruikerNaam)) {
        existing.medewerkers.push({
          naam: t.gebruikerNaam,
          taak: t.taakTitel,
          online: true,
        });
      }
      projectStatus.set(t.projectId, existing);
    }

    // Gedeelde projecten: projecten waar BEIDE gebruikers taken in hebben
    const gedeeldeProjecten = [...projectStatus.values()].filter(
      (p) => {
        const unieke = new Set(p.medewerkers.map((m) => m.naam));
        return unieke.size > 1;
      }
    );

    // Online users list
    const onlineGebruikers = activeSessions.map(s => ({
      id: s.gebruikerId,
      naam: s.gebruikerNaam,
      laatsteActiviteit: s.laatsteActiviteit,
    }));

    return NextResponse.json({
      bezigMet,
      recenteActiviteit,
      projectStatus: [...projectStatus.entries()].map(([id, v]) => ({ projectId: id, ...v })),
      gedeeldeProjecten,
      huidigeGebruiker: { id: gebruiker.id, naam: gebruiker.naam },
      onlineGebruikers,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
