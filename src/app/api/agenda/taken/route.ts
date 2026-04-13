import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, externeKalenders } from "@/lib/db/schema";
import { eq, or, and, isNotNull, isNull, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// GET /api/agenda/taken - Haal open/bezig taken op voor kalender
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        prioriteit: taken.prioriteit,
        deadline: taken.deadline,
        geschatteDuur: taken.geschatteDuur,
        ingeplandStart: taken.ingeplandStart,
        ingeplandEind: taken.ingeplandEind,
        toegewezenAanId: taken.toegewezenAan,
        uitvoerder: taken.uitvoerder,
        fase: taken.fase,
        omschrijving: taken.omschrijving,
        projectMap: taken.projectMap,
        projectNaam: projecten.naam,
        kalenderId: taken.kalenderId,
        kalenderNaam: externeKalenders.naam,
        kalenderKleur: externeKalenders.kleur,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .leftJoin(externeKalenders, eq(taken.kalenderId, externeKalenders.id))
      .where(
        and(
          or(
            eq(taken.toegewezenAan, gebruiker.id),
            isNull(taken.toegewezenAan)
          ),
          or(
            eq(taken.status, "open"),
            eq(taken.status, "bezig"),
            and(eq(taken.status, "afgerond"), isNotNull(taken.ingeplandStart))
          )
        )
      )
      .orderBy(
        sql`CASE ${taken.prioriteit} WHEN 'hoog' THEN 0 WHEN 'normaal' THEN 1 ELSE 2 END`,
        taken.deadline
      );

    return NextResponse.json({ taken: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const isAuth = message === "Niet geauthenticeerd";
    return NextResponse.json({ fout: message }, { status: isAuth ? 401 : 500 });
  }
}
