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

    // Uren via 30-min sessie timespans (matcht /tijd pagina berekening)
    // Entries worden gegroepeerd in 30-min slots; per slot tellen we (eindTijd - startTijd)
    // van eerste tot laatste entry, exclusief inactief entries.
    const urenRows = await db
      .select({
        startTijd: screenTimeEntries.startTijd,
        eindTijd: screenTimeEntries.eindTijd,
        duurSeconden: screenTimeEntries.duurSeconden,
        categorie: screenTimeEntries.categorie,
        app: screenTimeEntries.app,
        projectNaam: projecten.naam,
      })
      .from(screenTimeEntries)
      .leftJoin(projecten, eq(screenTimeEntries.projectId, projecten.id))
      .where(
        and(
          eq(screenTimeEntries.gebruikerId, gebruiker.id),
          gte(sql`substr(${screenTimeEntries.startTijd}, 1, 10)`, weekStartStr),
          lte(sql`substr(${screenTimeEntries.startTijd}, 1, 10)`, today)
        )
      );

    // Filter active entries zoals /tijd doet
    const SKIP_APPS = new Set(["LockApp", "SearchHost", "ShellHost", "ShellExperienceHost", "Inactief"]);
    const actieveEntries = urenRows.filter(
      (r) => !SKIP_APPS.has(r.app || "") && r.categorie !== "inactief"
    );

    // Groepeer per (datum, 30-min slot) en bereken timespan per slot
    const SLOT_MS = 30 * 60 * 1000;
    const perDagSec: Record<string, number> = {};
    const perProjectSec: Record<string, number> = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dStr = d.toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
      perDagSec[dStr] = 0;
    }

    // Slot-bucket van entries per dag
    const slotsPerDag: Record<string, Map<number, typeof actieveEntries>> = {};
    for (const e of actieveEntries) {
      const dag = (e.startTijd || "").slice(0, 10);
      if (!(dag in perDagSec)) continue;
      const t = new Date(e.startTijd).getTime();
      const slotKey = Math.floor(t / SLOT_MS);
      if (!slotsPerDag[dag]) slotsPerDag[dag] = new Map();
      const arr = slotsPerDag[dag].get(slotKey) || [];
      arr.push(e);
      slotsPerDag[dag].set(slotKey, arr);
    }

    // Per slot: timespan van eerste tot laatste entry
    for (const [dag, slots] of Object.entries(slotsPerDag)) {
      for (const slotEntries of slots.values()) {
        const starts = slotEntries.map((e) => new Date(e.startTijd).getTime());
        const eindes = slotEntries.map((e) => new Date(e.eindTijd).getTime());
        const span = (Math.max(...eindes) - Math.min(...starts)) / 1000;
        if (span > 0) perDagSec[dag] += span;

        // Per project totaal (sum duur_seconden per project/categorie)
        for (const e of slotEntries) {
          const key = e.projectNaam || e.categorie || "Overig";
          perProjectSec[key] = (perProjectSec[key] || 0) + (e.duurSeconden || 0);
        }
      }
    }

    const totaalMinuten = Math.round(
      Object.values(perDagSec).reduce((s, v) => s + v, 0) / 60
    );

    const perKlant = Object.entries(perProjectSec)
      .map(([naam, sec]) => ({ naam, minuten: Math.round(sec / 60) }))
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
        perDag: Object.entries(perDagSec).map(([datum, sec]) => ({ datum, minuten: Math.round(sec / 60) })),
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
