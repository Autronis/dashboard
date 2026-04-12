import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers, tijdregistraties, projecten, klanten, taken, focusSessies } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, isNull, isNotNull, desc } from "drizzle-orm";

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
        // ---- Deep work (focus) sessies deze week (voltooid) ----
        // Alleen tijdregistraties die gekoppeld zijn aan een voltooide focus sessie tellen mee.
        const tijdDezeWeek = await db
          .select({
            duurMinuten: tijdregistraties.duurMinuten,
            projectId: tijdregistraties.projectId,
          })
          .from(tijdregistraties)
          .innerJoin(focusSessies, eq(focusSessies.tijdregistratieId, tijdregistraties.id))
          .where(
            and(
              eq(tijdregistraties.gebruikerId, user.id),
              eq(focusSessies.status, "voltooid"),
              isNotNull(tijdregistraties.eindTijd),
              gte(tijdregistraties.startTijd, maandag),
              lte(tijdregistraties.startTijd, zondag + "T23:59:59")
            )
          );

        // ---- Deep work vorige week ----
        const tijdVorigeWeek = await db
          .select({ duurMinuten: tijdregistraties.duurMinuten })
          .from(tijdregistraties)
          .innerJoin(focusSessies, eq(focusSessies.tijdregistratieId, tijdregistraties.id))
          .where(
            and(
              eq(tijdregistraties.gebruikerId, user.id),
              eq(focusSessies.status, "voltooid"),
              isNotNull(tijdregistraties.eindTijd),
              gte(tijdregistraties.startTijd, vorigeWeek.maandag),
              lte(tijdregistraties.startTijd, vorigeWeek.zondag + "T23:59:59")
            )
          );

        // ---- Berekeningen ----
        const minutenDezeWeek = tijdDezeWeek.reduce((sum, r) => sum + (r.duurMinuten ?? 0), 0);
        const minutenVorigeWeek = tijdVorigeWeek.reduce((sum, r) => sum + (r.duurMinuten ?? 0), 0);
        const urenDezeWeek = Math.round((minutenDezeWeek / 60) * 10) / 10;
        const urenVorigeWeek = Math.round((minutenVorigeWeek / 60) * 10) / 10;

        // ---- Autronis vs klant splitsing ----
        let autronisMinuten = 0;
        let klantMinuten = 0;

        const projectUrenMap = new Map<number, number>();

        for (const entry of tijdDezeWeek) {
          const minuten = entry.duurMinuten ?? 0;
          if (entry.projectId === null) {
            autronisMinuten += minuten;
            continue;
          }
          const info = projectMap.get(entry.projectId);
          if (!info || info.isAutronis) {
            autronisMinuten += minuten;
          } else {
            klantMinuten += minuten;
          }
          projectUrenMap.set(entry.projectId, (projectUrenMap.get(entry.projectId) ?? 0) + minuten);
        }

        const autronisUren = Math.round((autronisMinuten / 60) * 10) / 10;
        const klantUren = Math.round((klantMinuten / 60) * 10) / 10;

        // ---- Top 3 projecten ----
        const topProjecten: TopProject[] = [...projectUrenMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([pid, minuten]) => ({
            naam: projectMap.get(pid)?.naam ?? "Onbekend project",
            uren: Math.round((minuten / 60) * 10) / 10,
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
