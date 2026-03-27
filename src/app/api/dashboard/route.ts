import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  gebruikers,
  projecten,
  klanten,
  tijdregistraties,
  taken,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, isNull, ne, desc } from "drizzle-orm";

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

function getMonthRange(): { van: string; tot: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { van: firstDay.toISOString(), tot: lastDay.toISOString() };
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
    const maand = getMonthRange();

    // === KPIs ===

    // Omzet deze maand: sum(duurMinuten) per klant × klant.uurtarief
    const omzetData = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        uurtarief: klanten.uurtarief,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, maand.van),
          lte(tijdregistraties.startTijd, maand.tot),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );

    const omzetDezeMaand = omzetData.reduce((sum, r) => {
      return sum + ((r.duurMinuten || 0) / 60) * (r.uurtarief || 0);
    }, 0);

    // Uren deze week uit tijdregistraties (eigen)
    const [eigenUrenResult] = await db
      .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .where(
        and(
          eq(tijdregistraties.gebruikerId, gebruiker.id),
          gte(tijdregistraties.startTijd, week.van),
          lte(tijdregistraties.startTijd, week.tot),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );
    const eigenUrenTotaal = eigenUrenResult?.totaal || 0;

    // Uren deze week - teamgenoot
    let teamgenootUren = 0;
    if (teamgenoot) {
      const [tu] = await db
        .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
        .from(tijdregistraties)
        .where(
          and(
            eq(tijdregistraties.gebruikerId, teamgenoot.id),
            gte(tijdregistraties.startTijd, week.van),
            lte(tijdregistraties.startTijd, week.tot),
            sql`${tijdregistraties.eindTijd} IS NOT NULL`
          )
        );
      teamgenootUren = tu?.totaal || 0;
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
          lte(projecten.deadline, week.tot.slice(0, 10))
        )
      )
      .orderBy(projecten.deadline);

    // Omzet vorige maand (voor trend)
    const vorigeMaand = new Date();
    vorigeMaand.setMonth(vorigeMaand.getMonth() - 1);
    const vmFirstDay = new Date(vorigeMaand.getFullYear(), vorigeMaand.getMonth(), 1);
    const vmLastDay = new Date(vorigeMaand.getFullYear(), vorigeMaand.getMonth() + 1, 0, 23, 59, 59, 999);
    const omzetVmData = await db
      .select({ duurMinuten: tijdregistraties.duurMinuten, uurtarief: klanten.uurtarief })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(
        gte(tijdregistraties.startTijd, vmFirstDay.toISOString()),
        lte(tijdregistraties.startTijd, vmLastDay.toISOString()),
        sql`${tijdregistraties.eindTijd} IS NOT NULL`
      ));
    const omzetVorigeMaand = omzetVmData.reduce((sum, r) => sum + ((r.duurMinuten || 0) / 60) * (r.uurtarief || 0), 0);

    // Uren vorige week (voor trend) uit tijdregistraties
    const weekVanDate = new Date(week.van);
    const prevMonday = new Date(weekVanDate);
    prevMonday.setDate(weekVanDate.getDate() - 7);
    const prevSunday = new Date(weekVanDate);
    prevSunday.setDate(weekVanDate.getDate() - 1);
    prevSunday.setHours(23, 59, 59, 999);
    const vwVan = prevMonday.toISOString();
    const vwTot = prevSunday.toISOString();
    const [vwResult] = await db
      .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .where(
        and(
          eq(tijdregistraties.gebruikerId, gebruiker.id),
          gte(tijdregistraties.startTijd, vwVan),
          lte(tijdregistraties.startTijd, vwTot),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );
    const eigenUrenVorigeWeekMin = vwResult?.totaal || 0;

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
          sql`${projecten.deadline} IS NOT NULL`
        )
      )
      .orderBy(projecten.deadline)
      .limit(5);

    // === Teamgenoot data ===
    let teamgenootData = null;
    if (teamgenoot) {
      // Active timer
      const [actieveTimer] = await db
        .select({
          id: tijdregistraties.id,
          omschrijving: tijdregistraties.omschrijving,
          startTijd: tijdregistraties.startTijd,
          projectNaam: projecten.naam,
        })
        .from(tijdregistraties)
        .leftJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
        .where(
          and(
            eq(tijdregistraties.gebruikerId, teamgenoot.id),
            isNull(tijdregistraties.eindTijd)
          )
        )
        .limit(1);

      // Uren per dag deze week
      const urenPerDagRaw = await db
        .select({
          dag: sql<string>`date(${tijdregistraties.startTijd})`,
          totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)`,
        })
        .from(tijdregistraties)
        .where(
          and(
            eq(tijdregistraties.gebruikerId, teamgenoot.id),
            gte(tijdregistraties.startTijd, week.van),
            lte(tijdregistraties.startTijd, week.tot),
            sql`${tijdregistraties.eindTijd} IS NOT NULL`
          )
        )
        .groupBy(sql`date(${tijdregistraties.startTijd})`);

      // Map to weekdays (ma-vr)
      const weekStart = new Date(week.van);
      const urenPerDag: number[] = [];
      for (let i = 0; i < 5; i++) {
        const dag = new Date(weekStart);
        dag.setDate(weekStart.getDate() + i);
        const dagStr = dag.toISOString().slice(0, 10);
        const found = urenPerDagRaw.find((r) => r.dag === dagStr);
        urenPerDag.push(found?.totaal || 0);
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
        actieveTimer: actieveTimer || null,
        urenPerDag,
        urenTotaal: teamgenootUren,
        taken: teamgenootTaken,
      };
    }

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
      .where(and(eq(projecten.isActief, 1), eq(projecten.status, "actief")))
      .orderBy(projecten.naam);

    return NextResponse.json({
      gebruiker: { id: gebruiker.id, naam: gebruiker.naam },
      kpis: {
        omzetDezeMaand: Math.round(omzetDezeMaand * 100) / 100,
        omzetVorigeMaand: Math.round(omzetVorigeMaand * 100) / 100,
        urenDezeWeek: {
          totaal: eigenUrenTotaal,
          eigen: eigenUrenTotaal,
          teamgenoot: teamgenootUren,
        },
        urenVorigeWeek: eigenUrenVorigeWeekMin,
        actieveProjecten: actieveProjectenCount?.count || 0,
        deadlinesDezeWeek: deadlinesDezeWeek.length,
        takenAfgerondVandaag,
      },
      mijnTaken,
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
