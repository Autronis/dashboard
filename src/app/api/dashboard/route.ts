import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  gebruikers,
  projecten,
  klanten,
  taken,
  screenTimeEntries,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, isNull, ne, desc, or } from "drizzle-orm";
import { berekenActieveUren, berekenOmzet, berekenUrenPerDag } from "@/lib/screen-time-uren";

function getWeekRange(): { van: string; tot: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { van: monday.toISOString(), tot: sunday.toISOString() };
}

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(d);
}

// GET /api/dashboard
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    // Find teamgenoot (the other user)
    const [teamgenoot] = await db
      .select({ id: gebruikers.id, naam: gebruikers.naam, email: gebruikers.email })
      .from(gebruikers)
      .where(ne(gebruikers.id, gebruiker.id))
      .limit(1);

    const week = getWeekRange();

    // === KPIs ===

    // Omzet deze maand: productieve screen-time × klant.uurtarief
    const nu = new Date();
    const maandVanDatum = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-01`;
    const maandLastDay = new Date(nu.getFullYear(), nu.getMonth() + 1, 0).getDate();
    const maandTotDatum = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-${String(maandLastDay).padStart(2, "0")}`;
    const omzetDezeMaand = await berekenOmzet(maandVanDatum, maandTotDatum);

    // Uren deze week — NL-timezone week boundaries (ma 00:00 — zo 23:59 NL)
    const NL_TZ = "Europe/Amsterdam";
    const nlFmt = new Intl.DateTimeFormat("en-CA", { timeZone: NL_TZ });
    const vandaagNl = nlFmt.format(new Date());
    // Use noon UTC to safely determine NL day-of-week (avoids DST edge cases)
    const noonNl = new Date(vandaagNl + "T12:00:00Z");
    const dowNl = noonNl.getUTCDay(); // 0=Sun, 1=Mon
    const diffToMonday = dowNl === 0 ? -6 : 1 - dowNl;
    const mondayNl = new Date(noonNl);
    mondayNl.setUTCDate(noonNl.getUTCDate() + diffToMonday);
    const sundayNl = new Date(mondayNl);
    sundayNl.setUTCDate(mondayNl.getUTCDate() + 6);
    const weekVanDatum = nlFmt.format(mondayNl);
    const weekTotDatum = nlFmt.format(sundayNl);

    const eigenScreenUren = await berekenActieveUren(gebruiker.id, weekVanDatum, weekTotDatum);
    const eigenUrenTotaal = Math.round(eigenScreenUren * 60); // convert to minutes for consistency

    // Splitsing Autronis (intern werk) vs Klant (declarabel) — gebaseerd op
    // ruwe screen-time entries deze week. Een entry telt als "autronis"
    // wanneer er geen project is, het project geen klant heeft, of de
    // klantnaam "autronis" bevat. We schalen daarna naar `eigenUrenTotaal`
    // zodat de som van de twee buckets exact gelijk is aan de canonical
    // berekenActieveUren waarde (voorkomt afrondingsverschillen tussen het
    // Uren KPI getal en de subbalkjes).
    const projectInfo = await db
      .select({
        projectId: projecten.id,
        klantId: projecten.klantId,
        klantBedrijfsnaam: klanten.bedrijfsnaam,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id));
    const isAutronisMap = new Map<number, boolean>();
    for (const p of projectInfo) {
      isAutronisMap.set(
        p.projectId,
        p.klantId === null ||
          p.klantBedrijfsnaam === null ||
          p.klantBedrijfsnaam.toLowerCase().includes("autronis")
      );
    }

    const ruweEntries = await db
      .select({
        projectId: screenTimeEntries.projectId,
        duurSeconden: screenTimeEntries.duurSeconden,
      })
      .from(screenTimeEntries)
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          ne(screenTimeEntries.categorie, "afleiding"),
          ne(screenTimeEntries.categorie, "inactief"),
          gte(screenTimeEntries.startTijd, weekVanDatum),
          lte(screenTimeEntries.startTijd, weekTotDatum + "T23:59:59")
        )
      );
    let autronisSec = 0;
    let klantSec = 0;
    for (const e of ruweEntries) {
      const sec = e.duurSeconden ?? 0;
      if (e.projectId === null || (isAutronisMap.get(e.projectId) ?? true)) {
        autronisSec += sec;
      } else {
        klantSec += sec;
      }
    }
    const totaalRawSec = autronisSec + klantSec;
    const schaal = totaalRawSec > 0 ? eigenUrenTotaal / (totaalRawSec / 60) : 0;
    const autronisMin = Math.round((autronisSec / 60) * schaal);
    const klantMin = Math.max(0, eigenUrenTotaal - autronisMin);

    // Uren deze week - teamgenoot (ook screen time)
    let teamgenootUren = 0;
    if (teamgenoot) {
      const teamScreenUren = await berekenActieveUren(teamgenoot.id, weekVanDatum, weekTotDatum);
      teamgenootUren = Math.round(teamScreenUren * 60);
    }

    // Actieve projecten
    const [actieveProjectenCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projecten)
      .where(and(eq(projecten.isActief, 1), eq(projecten.status, "actief")));

    // Deadlines deze week
    const deadlinesDezeWeek = await db
      .select({
        projectId: projecten.id,
        projectNaam: projecten.naam,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        deadline: projecten.deadline,
      })
      .from(projecten)
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(projecten.isActief, 1),
          sql`${projecten.deadline} IS NOT NULL`,
          lte(projecten.deadline, week.tot.slice(0, 10)),
          or(eq(klanten.isDemo, 0), isNull(klanten.isDemo))
        )
      )
      .orderBy(projecten.deadline);

    // Omzet vorige maand (voor trend)
    const vorigeMaand = new Date();
    vorigeMaand.setMonth(vorigeMaand.getMonth() - 1);
    const vmFirstDay = new Date(vorigeMaand.getFullYear(), vorigeMaand.getMonth(), 1);
    const vmLastDay = new Date(vorigeMaand.getFullYear(), vorigeMaand.getMonth() + 1, 0);
    const omzetVorigeMaand = await berekenOmzet(ymd(vmFirstDay), ymd(vmLastDay));

    // Uren vorige week (voor trend) — ook NL-timezone screen time
    const prevMondayNl = new Date(mondayNl);
    prevMondayNl.setUTCDate(mondayNl.getUTCDate() - 7);
    const prevSundayNl = new Date(mondayNl);
    prevSundayNl.setUTCDate(mondayNl.getUTCDate() - 1);
    const vwVanDatum = nlFmt.format(prevMondayNl);
    const vwTotDatum = nlFmt.format(prevSundayNl);
    const eigenUrenVorigeWeek = await berekenActieveUren(gebruiker.id, vwVanDatum, vwTotDatum);
    const eigenUrenVorigeWeekMin = Math.round(eigenUrenVorigeWeek * 60);

    // Taken afgerond vandaag
    const vandaag = new Date().toISOString().slice(0, 10);
    const [takenAfgerondResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(taken)
      .where(and(
        eq(taken.toegewezenAan, gebruiker.id),
        eq(taken.status, "afgerond"),
        gte(taken.bijgewerktOp, vandaag)
      ));
    const takenAfgerondVandaag = takenAfgerondResult?.count ?? 0;

    // === Mijn Taken ===
    const mijnTaken = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        omschrijving: taken.omschrijving,
        status: taken.status,
        deadline: taken.deadline,
        prioriteit: taken.prioriteit,
        fase: taken.fase,
        projectId: taken.projectId,
        projectNaam: projecten.naam,
        klantId: klanten.id,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(taken.toegewezenAan, gebruiker.id),
          ne(taken.status, "afgerond")
        )
      )
      .orderBy(
        sql`CASE ${taken.prioriteit} WHEN 'hoog' THEN 0 WHEN 'normaal' THEN 1 WHEN 'laag' THEN 2 END`,
        taken.deadline
      )
      .limit(5);

    // === Aankomende deadlines (alle projecten) ===
    const aankomendDeadlines = await db
      .select({
        projectId: projecten.id,
        projectNaam: projecten.naam,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        deadline: projecten.deadline,
        voortgang: projecten.voortgangPercentage,
      })
      .from(projecten)
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(projecten.isActief, 1),
          sql`${projecten.deadline} IS NOT NULL`,
          or(eq(klanten.isDemo, 0), isNull(klanten.isDemo))
        )
      )
      .orderBy(projecten.deadline)
      .limit(5);

    // === Teamgenoot data ===
    let teamgenootData = null;
    if (teamgenoot) {
      // Recente screen-time entry (laatste 5 min) → "tracking nu"
      const vijfMinGeleden = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const [recenteEntry] = await db
        .select({
          startTijd: screenTimeEntries.startTijd,
          projectNaam: projecten.naam,
        })
        .from(screenTimeEntries)
        .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
        .where(
          and(
            eq(screenTimeEntries.gebruikerId, teamgenoot.id),
            sql`${screenTimeEntries.eindTijd} >= ${vijfMinGeleden}`,
            ne(screenTimeEntries.categorie, "inactief")
          )
        )
        .orderBy(desc(screenTimeEntries.eindTijd))
        .limit(1);
      const actieveTimer = recenteEntry
        ? { id: 0, omschrijving: null, startTijd: recenteEntry.startTijd, projectNaam: recenteEntry.projectNaam }
        : null;

      // Uren per dag deze week (ma-vr) — uit screen-time
      const weekStart = new Date(week.van);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4); // vr
      const urenPerDagMap = await berekenUrenPerDag(teamgenoot.id, ymd(weekStart), ymd(weekEnd));
      const urenPerDag: number[] = [];
      for (let i = 0; i < 5; i++) {
        const dag = new Date(weekStart);
        dag.setDate(weekStart.getDate() + i);
        const u = urenPerDagMap.get(ymd(dag)) ?? 0;
        urenPerDag.push(Math.round(u * 60)); // minuten voor consistency met bestaande UI
      }

      // Taken
      const teamgenootTaken = await db
        .select({
          id: taken.id,
          titel: taken.titel,
          projectNaam: projecten.naam,
        })
        .from(taken)
        .leftJoin(projecten, eq(taken.projectId, projecten.id))
        .where(
          and(
            eq(taken.toegewezenAan, teamgenoot.id),
            ne(taken.status, "afgerond")
          )
        )
        .orderBy(desc(taken.aangemaaktOp))
        .limit(5);

      teamgenootData = {
        id: teamgenoot.id,
        naam: teamgenoot.naam,
        email: teamgenoot.email,
        actieveTimer,
        urenPerDag,
        urenTotaal: teamgenootUren,
        taken: teamgenootTaken,
      };
    }

    // === Actielijsten (projectloze taken gegroepeerd op fase) ===
    const actielijsten = await db
      .select({
        fase: taken.fase,
        totaal: sql<number>`count(*)`,
        afgerond: sql<number>`sum(case when ${taken.status} = 'afgerond' then 1 else 0 end)`,
        hoog: sql<number>`sum(case when ${taken.prioriteit} = 'hoog' and ${taken.status} != 'afgerond' then 1 else 0 end)`,
      })
      .from(taken)
      .where(
        and(
          isNull(taken.projectId),
          eq(taken.toegewezenAan, gebruiker.id),
          sql`${taken.fase} IS NOT NULL AND ${taken.fase} != ''`
        )
      )
      .groupBy(taken.fase)
      .all();

    // === Projecten voor timer dropdown ===
    const projectenLijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        voortgang: projecten.voortgangPercentage,
        status: projecten.status,
      })
      .from(projecten)
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(eq(projecten.isActief, 1), eq(projecten.status, "actief"), or(eq(klanten.isDemo, 0), isNull(klanten.isDemo))))
      .orderBy(projecten.naam);

    return NextResponse.json({
      gebruiker: { id: gebruiker.id, naam: gebruiker.naam },
      kpis: {
        omzetDezeMaand: Math.round(omzetDezeMaand * 100) / 100,
        omzetVorigeMaand: Math.round(omzetVorigeMaand * 100) / 100,
        urenDezeWeek: {
          totaal: eigenUrenTotaal + teamgenootUren,
          eigen: eigenUrenTotaal,
          teamgenoot: teamgenootUren,
          autronis: autronisMin,
          klant: klantMin,
        },
        urenVorigeWeek: eigenUrenVorigeWeekMin,
        actieveProjecten: actieveProjectenCount?.count || 0,
        deadlinesDezeWeek: deadlinesDezeWeek.length,
        takenAfgerondVandaag,
      },
      mijnTaken,
      actielijsten,
      deadlines: aankomendDeadlines,
      teamgenoot: teamgenootData,
      projecten: projectenLijst,
    }, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=60" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
