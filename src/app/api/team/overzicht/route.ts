import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers, projecten, klanten, taken, screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, notInArray } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

// ============ HELPERS ============

function getMondayAndSunday(date: Date): { maandag: string; zondag: string } {
  const nlFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
  const vandaagNl = nlFmt.format(date);
  const noonNl = new Date(vandaagNl + "T12:00:00Z");
  const dowNl = noonNl.getUTCDay();
  const diffToMonday = dowNl === 0 ? -6 : 1 - dowNl;
  const mondayNl = new Date(noonNl);
  mondayNl.setUTCDate(noonNl.getUTCDate() + diffToMonday);
  const sundayNl = new Date(mondayNl);
  sundayNl.setUTCDate(mondayNl.getUTCDate() + 6);
  return { maandag: nlFmt.format(mondayNl), zondag: nlFmt.format(sundayNl) };
}

function getPreviousWeek(date: Date): { maandag: string; zondag: string } {
  const d = new Date(date);
  d.setDate(d.getDate() - 7);
  return getMondayAndSunday(d);
}

const DAG_NAMEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

// ============ TYPES ============

interface TopProject {
  naam: string;
  uren: number;
  klantId: number | null;
  klantNaam: string | null;
  takenAfgerond: number;
}

interface UserOverzicht {
  id: number;
  naam: string;
  avatarUrl: string | null;
  urenDezeWeek: number;
  urenVorigeWeek: number;
  autronisUren: number;
  klantUren: number;
  topProjecten: TopProject[];
  takenAfgerondDezeWeek: number;
  takenInProgress: number;
  aantalKlantenDezeWeek: number;
  aantalProjectenDezeWeek: number;
  productiefsteDag: { dagNaam: string; datum: string; uren: number } | null;
  gemiddeldePerWerkdag: number;
  billableEUR: number;
}

// GET /api/team/overzicht
export async function GET(_req: NextRequest) {
  try {
    await requireAuth();

    const now = new Date();
    const { maandag, zondag } = getMondayAndSunday(now);
    const vorigeWeek = getPreviousWeek(now);

    const users = await db
      .select({ id: gebruikers.id, naam: gebruikers.naam, avatarUrl: gebruikers.avatarUrl })
      .from(gebruikers)
      .orderBy(gebruikers.id);

    const allProjectInfo = await db
      .select({
        projectId: projecten.id,
        projectNaam: projecten.naam,
        klantId: projecten.klantId,
        klantBedrijfsnaam: klanten.bedrijfsnaam,
        klantUurtarief: klanten.uurtarief,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id));

    interface ProjectInfo {
      naam: string;
      klantId: number | null;
      klantNaam: string | null;
      uurtarief: number;
      isAutronis: boolean;
    }
    const projectMap = new Map<number, ProjectInfo>();
    for (const p of allProjectInfo) {
      const isAutronis =
        p.klantId === null ||
        p.klantBedrijfsnaam === null ||
        p.klantBedrijfsnaam.toLowerCase().includes("autronis");
      projectMap.set(p.projectId, {
        naam: p.projectNaam,
        klantId: p.klantId,
        klantNaam: isAutronis ? null : p.klantBedrijfsnaam,
        uurtarief: p.klantUurtarief ?? 0,
        isAutronis,
      });
    }

    const result: UserOverzicht[] = await Promise.all(
      users.map(async (user) => {
        const urenDezeWeek = await berekenActieveUren(user.id, maandag, zondag);
        const urenVorigeWeek = await berekenActieveUren(user.id, vorigeWeek.maandag, vorigeWeek.zondag);

        const tijdDezeWeek = await db
          .select({
            duurSeconden: screenTimeEntries.duurSeconden,
            projectId: screenTimeEntries.projectId,
            startTijd: screenTimeEntries.startTijd,
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

        let autronisSeconden = 0;
        let klantSeconden = 0;
        let billableSecondenByRate = 0;
        const projectSecondenMap = new Map<number, number>();
        const klantIdsDezeWeek = new Set<number>();
        const dagSecondenMap = new Map<string, number>();

        for (const entry of tijdDezeWeek) {
          const seconden = entry.duurSeconden ?? 0;
          if (seconden <= 0) continue;

          // Per-dag aggregatie (op datum-prefix van ISO startTijd)
          const datum = (entry.startTijd ?? "").slice(0, 10);
          if (datum) dagSecondenMap.set(datum, (dagSecondenMap.get(datum) ?? 0) + seconden);

          if (entry.projectId === null) {
            autronisSeconden += seconden;
            continue;
          }
          const info = projectMap.get(entry.projectId);
          if (!info || info.isAutronis) {
            autronisSeconden += seconden;
          } else {
            klantSeconden += seconden;
            if (info.klantId !== null) klantIdsDezeWeek.add(info.klantId);
            // Billable raw — wordt later geschaald met zelfde factor
            billableSecondenByRate += seconden * info.uurtarief;
          }
          projectSecondenMap.set(entry.projectId, (projectSecondenMap.get(entry.projectId) ?? 0) + seconden);
        }

        const totaalRaw = autronisSeconden + klantSeconden;
        const schaalFactor = totaalRaw > 0 ? (urenDezeWeek * 3600) / totaalRaw : 0;
        const autronisUren = Math.round((autronisSeconden * schaalFactor / 3600) * 10) / 10;
        const klantUren = Math.round((klantSeconden * schaalFactor / 3600) * 10) / 10;
        const billableEUR = Math.round(billableSecondenByRate * schaalFactor / 3600);

        // ---- Taken afgerond + taken bezig deze week ----
        const [takenAfgerond, takenBezig, topProjectenRaw] = await Promise.all([
          db
            .select({ id: taken.id })
            .from(taken)
            .where(
              and(
                eq(taken.toegewezenAan, user.id),
                eq(taken.status, "afgerond"),
                gte(taken.bijgewerktOp, maandag),
                lte(taken.bijgewerktOp, zondag + "T23:59:59")
              )
            ),
          db
            .select({ id: taken.id })
            .from(taken)
            .where(
              and(
                eq(taken.toegewezenAan, user.id),
                eq(taken.status, "bezig")
              )
            ),
          // Taken afgerond per project deze week (voor in de project card)
          db
            .select({ projectId: taken.projectId })
            .from(taken)
            .where(
              and(
                eq(taken.toegewezenAan, user.id),
                eq(taken.status, "afgerond"),
                gte(taken.bijgewerktOp, maandag),
                lte(taken.bijgewerktOp, zondag + "T23:59:59")
              )
            ),
        ]);

        const takenPerProject = new Map<number, number>();
        for (const t of topProjectenRaw) {
          if (t.projectId === null) continue;
          takenPerProject.set(t.projectId, (takenPerProject.get(t.projectId) ?? 0) + 1);
        }

        const topProjecten: TopProject[] = [...projectSecondenMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([pid, seconden]) => {
            const info = projectMap.get(pid);
            return {
              naam: info?.naam ?? "Onbekend project",
              uren: Math.round((seconden * schaalFactor / 3600) * 10) / 10,
              klantId: info?.klantId ?? null,
              klantNaam: info?.klantNaam ?? null,
              takenAfgerond: takenPerProject.get(pid) ?? 0,
            };
          });

        // ---- Productiefste dag ----
        let productiefsteDag: UserOverzicht["productiefsteDag"] = null;
        if (dagSecondenMap.size > 0) {
          const [topDatum, topSeconden] = [...dagSecondenMap.entries()].sort(
            (a, b) => b[1] - a[1]
          )[0];
          const dow = new Date(topDatum + "T12:00:00Z").getUTCDay();
          productiefsteDag = {
            dagNaam: DAG_NAMEN[dow],
            datum: topDatum,
            uren: Math.round((topSeconden * schaalFactor / 3600) * 10) / 10,
          };
        }

        // ---- Gemiddelde per werkdag (alleen dagen met uren > 0) ----
        const werkdagenMetUren = [...dagSecondenMap.values()].filter((s) => s > 0).length;
        const gemiddeldePerWerkdag =
          werkdagenMetUren > 0
            ? Math.round((urenDezeWeek / werkdagenMetUren) * 10) / 10
            : 0;

        return {
          id: user.id,
          naam: user.naam,
          avatarUrl: user.avatarUrl ?? null,
          urenDezeWeek,
          urenVorigeWeek,
          autronisUren,
          klantUren,
          topProjecten,
          takenAfgerondDezeWeek: takenAfgerond.length,
          takenInProgress: takenBezig.length,
          aantalKlantenDezeWeek: klantIdsDezeWeek.size,
          aantalProjectenDezeWeek: projectSecondenMap.size,
          productiefsteDag,
          gemiddeldePerWerkdag,
          billableEUR,
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
