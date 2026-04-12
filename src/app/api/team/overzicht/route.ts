import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers, tijdregistraties, projecten, klanten, taken, screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, isNull, desc, notInArray } from "drizzle-orm";

// ============ HELPERS ============

function getMondayAndSunday(date: Date): { maandag: string; zondag: string } {
  const d = new Date(date);
  const day = d.getDay() || 7; // 1=Ma, 7=Zo
  d.setDate(d.getDate() - day + 1);
  const maandag = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6);
  const zondag = d.toISOString().slice(0, 10);
  return { maandag, zondag };
}

function getPreviousWeek(date: Date): { maandag: string; zondag: string } {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return getMondayAndSunday(d);
}

// ============ TYPES ============

interface TopProject {
  naam: string;
  uren: number;
}

interface ActieveTimer {
  projectNaam: string;
  omschrijving: string | null;
  startTijd: string;
}

interface UserOverzicht {
  id: number;
  naam: string;
  urenDezeWeek: number;
  urenVorigeWeek: number;
  autronisUren: number;
  klantUren: number;
  topProjecten: TopProject[];
  actieveTimer: ActieveTimer | null;
  takenAfgerondDezeWeek: number;
}

// GET /api/team/overzicht
export async function GET(_req: NextRequest) {
  try {
    await requireAuth();

    const now = new Date();
    const { maandag, zondag } = getMondayAndSunday(now);
    const vorigeWeek = getPreviousWeek(now);

    const users = await db
      .select({ id: gebruikers.id, naam: gebruikers.naam })
      .from(gebruikers)
      .orderBy(gebruikers.id);

    // Pre-fetch all project+klant info once (shared across all users)
    const allProjectInfo = await db
      .select({
        projectId: projecten.id,
        projectNaam: projecten.naam,
        klantBedrijfsnaam: klanten.bedrijfsnaam,
        klantId: projecten.klantId,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id));

    const projectMap = new Map<number, { naam: string; isAutronis: boolean }>();
    for (const p of allProjectInfo) {
      const isAutronis =
        p.klantId === null ||
        p.klantBedrijfsnaam === null ||
        p.klantBedrijfsnaam.toLowerCase().includes("autronis");
      projectMap.set(p.projectId, { naam: p.projectNaam, isAutronis });
    }

    const result: UserOverzicht[] = await Promise.all(
      users.map(async (user) => {
        // ---- Deep work deze week ----
        // Deep work = alle screen_time entries MINUS afleiding + inactief.
        // Volgens Sem: "alle uren van screen registratie, maar dan minus afleiding".
        const tijdDezeWeek = await db
          .select({
            duurSeconden: screenTimeEntries.duurSeconden,
            projectId: screenTimeEntries.projectId,
          })
          .from(screenTimeEntries)
          .where(
            and(
              eq(screenTimeEntries.gebruikerId, user.id),
              notInArray(screenTimeEntries.categorie, ["afleiding", "inactief"]),
              gte(screenTimeEntries.startTijd, maandag),
              lte(screenTimeEntries.startTijd, zondag + "T23:59:59")
            )
          );

        // ---- Deep work vorige week ----
        const tijdVorigeWeek = await db
          .select({ duurSeconden: screenTimeEntries.duurSeconden })
          .from(screenTimeEntries)
          .where(
            and(
              eq(screenTimeEntries.gebruikerId, user.id),
              notInArray(screenTimeEntries.categorie, ["afleiding", "inactief"]),
              gte(screenTimeEntries.startTijd, vorigeWeek.maandag),
              lte(screenTimeEntries.startTijd, vorigeWeek.zondag + "T23:59:59")
            )
          );

        // ---- Berekeningen (screen_time gebruikt seconden) ----
        const secondenDezeWeek = tijdDezeWeek.reduce((sum, r) => sum + (r.duurSeconden ?? 0), 0);
        const secondenVorigeWeek = tijdVorigeWeek.reduce((sum, r) => sum + (r.duurSeconden ?? 0), 0);
        const urenDezeWeek = Math.round((secondenDezeWeek / 3600) * 10) / 10;
        const urenVorigeWeek = Math.round((secondenVorigeWeek / 3600) * 10) / 10;

        // ---- Autronis vs klant splitsing ----
        let autronisSeconden = 0;
        let klantSeconden = 0;

        const projectSecondenMap = new Map<number, number>();

        for (const entry of tijdDezeWeek) {
          const seconden = entry.duurSeconden ?? 0;
          if (entry.projectId === null) {
            autronisSeconden += seconden;
            continue;
          }
          const info = projectMap.get(entry.projectId);
          if (!info || info.isAutronis) {
            autronisSeconden += seconden;
          } else {
            klantSeconden += seconden;
          }
          projectSecondenMap.set(entry.projectId, (projectSecondenMap.get(entry.projectId) ?? 0) + seconden);
        }

        const autronisUren = Math.round((autronisSeconden / 3600) * 10) / 10;
        const klantUren = Math.round((klantSeconden / 3600) * 10) / 10;

        // ---- Top 3 projecten ----
        const topProjecten: TopProject[] = [...projectSecondenMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([pid, seconden]) => ({
            naam: projectMap.get(pid)?.naam ?? "Onbekend project",
            uren: Math.round((seconden / 3600) * 10) / 10,
          }));

        // ---- Actieve timer ----
        const actieveRows = await db
          .select({
            startTijd: tijdregistraties.startTijd,
            omschrijving: tijdregistraties.omschrijving,
            projectId: tijdregistraties.projectId,
          })
          .from(tijdregistraties)
          .where(
            and(
              eq(tijdregistraties.gebruikerId, user.id),
              isNull(tijdregistraties.eindTijd)
            )
          )
          .orderBy(desc(tijdregistraties.startTijd))
          .limit(1);

        let actieveTimer: ActieveTimer | null = null;
        if (actieveRows.length > 0) {
          const actief = actieveRows[0];
          const projectNaam =
            actief.projectId !== null
              ? (projectMap.get(actief.projectId)?.naam ?? "Onbekend project")
              : "Geen project";
          actieveTimer = {
            projectNaam,
            omschrijving: actief.omschrijving,
            startTijd: actief.startTijd,
          };
        }

        // ---- Taken afgerond deze week ----
        const takenAfgerond = await db
          .select({ id: taken.id })
          .from(taken)
          .where(
            and(
              eq(taken.toegewezenAan, user.id),
              eq(taken.status, "afgerond"),
              gte(taken.bijgewerktOp, maandag),
              lte(taken.bijgewerktOp, zondag + "T23:59:59")
            )
          );

        return {
          id: user.id,
          naam: user.naam,
          urenDezeWeek,
          urenVorigeWeek,
          autronisUren,
          klantUren,
          topProjecten,
          actieveTimer,
          takenAfgerondDezeWeek: takenAfgerond.length,
        };
      })
    );

    return NextResponse.json({ users: result, maandag, zondag });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
