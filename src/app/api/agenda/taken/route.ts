import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, externeKalenders } from "@/lib/db/schema";
import { eq, or, and, isNull, sql, inArray } from "drizzle-orm";
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
        cluster: taken.cluster,
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
          // Afgerond taken horen niet in de agenda — die clutteren de dag-view.
          // Voor historische weergave is er de taken pagina.
          or(
            eq(taken.status, "open"),
            eq(taken.status, "bezig")
          ),
          // Privacy + actief filter op project.
          // Sem ziet sem/team/vrij + projecten zonder eigenaar (legacy NULL).
          // Syb ziet syb/team/vrij. Inactieve projecten worden weggefilterd.
          // Taken zonder gekoppeld project blijven altijd zichtbaar.
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
      );

    return NextResponse.json({ taken: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const isAuth = message === "Niet geauthenticeerd";
    return NextResponse.json({ fout: message }, { status: isAuth ? 401 : 500 });
  }
}
