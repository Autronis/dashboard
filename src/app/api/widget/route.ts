import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems, taken, projecten, gebruikers, screenTimeEntries } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, gte, lte, or, isNull, sql, inArray, desc } from "drizzle-orm";

// GET /api/widget — Gecombineerde data voor Scriptable/widget
// Auth via Bearer token (API key of SESSION_SECRET)
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);

    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
    const tomorrow = new Date(now.getTime() + 86400000)
      .toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

    // Agenda items vandaag
    const agenda = await db
      .select({
        id: agendaItems.id,
        titel: agendaItems.titel,
        type: agendaItems.type,
        startDatum: agendaItems.startDatum,
        eindDatum: agendaItems.eindDatum,
        heleDag: agendaItems.heleDag,
      })
      .from(agendaItems)
      .where(
        and(
          gte(agendaItems.startDatum, today),
          lte(agendaItems.startDatum, tomorrow + "T00:00:00")
        )
      )
      .orderBy(agendaItems.startDatum);

    // Open/bezig taken (top 10, prioriteit-gesorteerd)
    const openTaken = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        geschatteDuur: taken.geschatteDuur,
        projectNaam: projecten.naam,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(
        and(
          or(
            eq(taken.toegewezenAan, gebruiker.id),
            isNull(taken.toegewezenAan)
          ),
          or(eq(taken.status, "open"), eq(taken.status, "bezig")),
          or(
            isNull(taken.projectId),
            and(
              sql`(${projecten.isActief} = 1 OR ${projecten.isActief} IS NULL)`,
              gebruiker.id === 2
                ? inArray(projecten.eigenaar, ["syb", "team", "vrij"])
                : or(
                    inArray(projecten.eigenaar, ["sem", "team", "vrij"]),
                    isNull(projecten.eigenaar)
                  )
            )!
          )!
        )
      )
      .orderBy(
        sql`CASE ${taken.prioriteit} WHEN 'hoog' THEN 0 WHEN 'normaal' THEN 1 ELSE 2 END`,
        taken.deadline
      )
      .limit(10);

    // Uren deze week (maandag t/m zondag, NL-local)
    const dayOfWeek = now.getDay(); // 0=zo, 1=ma, ..
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMonday);
    const weekStartStr = weekStart.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

    // Uren uit screen_time_entries (actieve tijd zoals op /tijd pagina)
    // Excludeer inactief en afleiding voor "productieve" uren
    const urenRows = await db
      .select({
        startTijd: screenTimeEntries.startTijd,
        duurSeconden: screenTimeEntries.duurSeconden,
        categorie: screenTimeEntries.categorie,
        projectNaam: projecten.naam,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          gte(sql`substr(${screenTimeEntries.startTijd}, 1, 10)`, weekStartStr),
          lte(sql`substr(${screenTimeEntries.startTijd}, 1, 10)`, today),
          sql`${screenTimeEntries.categorie} != 'inactief'`
        )
      );

    const totaalMinuten = Math.round(
      urenRows.reduce((sum, r) => sum + (r.duurSeconden || 0), 0) / 60
    );

    // Per dag totaal (voor bar-chart)
    const perDag: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dStr = d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
      perDag[dStr] = 0;
    }
    for (const r of urenRows) {
      const dag = (r.startTijd || "").slice(0, 10);
      if (perDag[dag] !== undefined) perDag[dag] += Math.round((r.duurSeconden || 0) / 60);
    }

    // Per project/categorie totaal (top 5)
    const perProjectMap: Record<string, number> = {};
    for (const r of urenRows) {
      const key = r.projectNaam || r.categorie || "Overig";
      perProjectMap[key] = (perProjectMap[key] || 0) + Math.round((r.duurSeconden || 0) / 60);
    }
    const perKlant = Object.entries(perProjectMap)
      .map(([naam, minuten]) => ({ naam, minuten }))
      .sort((a, b) => b.minuten - a.minuten)
      .slice(0, 5);

    return NextResponse.json({
      datum: today,
      tijd: now.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }),
      agenda,
      taken: openTaken,
      uren: {
        totaalMinuten,
        weekStart: weekStartStr,
        perDag: Object.entries(perDag).map(([datum, minuten]) => ({ datum, minuten })),
        perKlant,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("API key") ? 401 : 500 }
    );
  }
}
