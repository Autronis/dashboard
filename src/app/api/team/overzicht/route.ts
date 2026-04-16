import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers, projecten, klanten, taken, screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, notInArray } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

// ============ HELPERS ============

function getMondayAndSunday(date: Date): { maandag: string; zondag: string } {
  // NL-tz aware week boundaries (matches dashboard)
  const nlFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" });
  const vandaagNl = nlFmt.format(date);
  const noonNl = new Date(vandaagNl + "T12:00:00Z");
  const dowNl = noonNl.getUTCDay(); // 0=Sun, 1=Mon
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

// ============ TYPES ============

interface TopProject {
  naam: string;
  uren: number;
}

interface UserOverzicht {
  id: number;
  naam: string;
  urenDezeWeek: number;
  urenVorigeWeek: number;
  autronisUren: number;
  klantUren: number;
  topProjecten: TopProject[];
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
      .select({ id: gebruikers.id, naam: gebruikers.naam, avatarUrl: gebruikers.avatarUrl })
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
        // ---- Deep work deze week & vorige week (canonical helper) ----
        // berekenActieveUren matcht /tijd page exact (slot-merged, niet-afleiding,
        // niet-inactief). Single source of truth.
        const urenDezeWeek = await berekenActieveUren(user.id, maandag, zondag);
        const urenVorigeWeek = await berekenActieveUren(user.id, vorigeWeek.maandag, vorigeWeek.zondag);

        // ---- Autronis vs klant splitsing (raw seconds, alle non-afleiding entries) ----
        // Note: deze percentages tonen WAARHEEN de tijd ging (raw), niet exact
        // hetzelfde getal als urenDezeWeek (slot-merged). Schaaling later toegepast.
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

        // Schaal raw splitsing zodat de som == urenDezeWeek (canonical number)
        const totaalRaw = autronisSeconden + klantSeconden;
        const schaalFactor = totaalRaw > 0 ? (urenDezeWeek * 3600) / totaalRaw : 0;
        const autronisUren = Math.round((autronisSeconden * schaalFactor / 3600) * 10) / 10;
        const klantUren = Math.round((klantSeconden * schaalFactor / 3600) * 10) / 10;

        // ---- Top 3 projecten (geschaald naar canonical urenDezeWeek) ----
        const topProjecten: TopProject[] = [...projectSecondenMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([pid, seconden]) => ({
            naam: projectMap.get(pid)?.naam ?? "Onbekend project",
            uren: Math.round((seconden * schaalFactor / 3600) * 10) / 10,
          }));

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
