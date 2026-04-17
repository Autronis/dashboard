import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agendaItems, taken, projecten, gebruikers } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, gte, lte, or, isNull, sql, inArray } from "drizzle-orm";

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

    return NextResponse.json({
      datum: today,
      tijd: now.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }),
      agenda,
      taken: openTaken,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message.includes("API key") ? 401 : 500 }
    );
  }
}
