import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten, gebruikers, taken, screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

interface GebruikerVergelijk {
  id: number;
  naam: string;
  urenDezeMaand: number;
  omzetDezeMaand: number;
  takenAfgerond: number;
  actieveProjecten: number;
}

// GET /api/analytics/vergelijk — team comparison for current month
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const maandStart = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-01T00:00:00`;
    const maandEind = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}-31T23:59:59`;

    // Get all users
    const alleGebruikers = await db
      .select({ id: gebruikers.id, naam: gebruikers.naam })
      .from(gebruikers);

    const result: GebruikerVergelijk[] = [];

    for (const gebruiker of alleGebruikers) {
      // Screen time uren deze maand
      const screenResult = await db
        .select({
          totaal: sql<number>`COALESCE(SUM(${screenTimeEntries.duurSeconden}), 0)`.as("totaal"),
        })
        .from(screenTimeEntries)
        .where(
          and(
            eq(screenTimeEntries.gebruikerId, gebruiker.id),
            gte(screenTimeEntries.startTijd, maandStart),
            lte(screenTimeEntries.startTijd, maandEind),
            sql`${screenTimeEntries.categorie} != 'inactief'`
          )
        );

      const urenDezeMaand = (screenResult[0]?.totaal || 0) / 3600;

      // Omzet uit tijdregistraties
      const omzetEntries = await db
        .select({
          duurMinuten: tijdregistraties.duurMinuten,
          uurtarief: klanten.uurtarief,
        })
        .from(tijdregistraties)
        .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
        .innerJoin(klanten, eq(projecten.klantId, klanten.id))
        .where(
          and(
            eq(tijdregistraties.gebruikerId, gebruiker.id),
            gte(tijdregistraties.startTijd, maandStart),
            lte(tijdregistraties.startTijd, maandEind),
            sql`${tijdregistraties.eindTijd} IS NOT NULL`
          )
        );

      let omzetDezeMaand = 0;
      for (const e of omzetEntries) {
        omzetDezeMaand += ((e.duurMinuten || 0) / 60) * (e.uurtarief || 0);
      }

      // Tasks completed this month
      const takenResult = await db
        .select({ count: sql<number>`COUNT(*)`.as("count") })
        .from(taken)
        .where(
          and(
            eq(taken.toegewezenAan, gebruiker.id),
            eq(taken.status, "afgerond"),
            gte(taken.bijgewerktOp, maandStart),
            lte(taken.bijgewerktOp, maandEind)
          )
        );

      // Active projects (from screen time)
      const actieveProjectenResult = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${screenTimeEntries.projectId})`.as("count"),
        })
        .from(screenTimeEntries)
        .where(
          and(
            eq(screenTimeEntries.gebruikerId, gebruiker.id),
            sql`${screenTimeEntries.projectId} IS NOT NULL`,
            sql`${screenTimeEntries.categorie} != 'inactief'`
          )
        );

      result.push({
        id: gebruiker.id,
        naam: gebruiker.naam,
        urenDezeMaand: Math.round(urenDezeMaand * 100) / 100,
        omzetDezeMaand: Math.round(omzetDezeMaand * 100) / 100,
        takenAfgerond: takenResult[0]?.count || 0,
        actieveProjecten: actieveProjectenResult[0]?.count || 0,
      });
    }

    return NextResponse.json({ gebruikers: result });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
