import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, externeKalenders } from "@/lib/db/schema";
import { eq, or, and, isNull, sql, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// In-memory cooldown: auto-uitplan loopt max 1x per uur per process.
// Voorkomt dat elke /agenda load een UPDATE triggert. Bij Vercel cold
// start wordt dit gereset (acceptable — dat is hooguit 1x per nieuwe
// instance). Op localhost holdt 'ie zolang de dev server runt.
let lastAutoUitplanRun = 0;
const AUTO_UITPLAN_COOLDOWN_MS = 60 * 60 * 1000; // 1 uur

// GET /api/agenda/taken - Haal open/bezig taken op voor kalender
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    // Auto-uitplan: open/bezig taken die in het verleden zijn ingepland
    // (en dus niet zijn afgerond) worden teruggezet naar 'niet ingepland'
    // zodat ze weer in 'Te plannen' verschijnen. Idempotent maar wel
    // een UPDATE — daarom achter een 1u cooldown. Vergelijking gebeurt
    // op NL-local datum: alles met ingepland_start vóór vandaag 00:00
    // lokaal wordt uitgepland.
    if (Date.now() - lastAutoUitplanRun > AUTO_UITPLAN_COOLDOWN_MS) {
      lastAutoUitplanRun = Date.now();
      const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });
      await db
        .update(taken)
        .set({ ingeplandStart: null, ingeplandEind: null })
        .where(
          and(
            or(eq(taken.status, "open"), eq(taken.status, "bezig")),
            sql`${taken.ingeplandStart} IS NOT NULL`,
            sql`substr(${taken.ingeplandStart}, 1, 10) < ${todayLocal}`
          )
        );
    }

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

    // Recent afgeronde taken (laatste 24u) — voor undo in de agenda sidebar
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentAfgerond = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        status: taken.status,
        projectNaam: projecten.naam,
        bijgewerktOp: taken.bijgewerktOp,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .where(
        and(
          eq(taken.status, "afgerond"),
          sql`${taken.bijgewerktOp} > ${oneDayAgo}`,
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
      .orderBy(sql`${taken.bijgewerktOp} DESC`)
      .limit(10);

    return NextResponse.json({ taken: rows, recentAfgerond });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const isAuth = message === "Niet geauthenticeerd";
    return NextResponse.json({ fout: message }, { status: isAuth ? 401 : 500 });
  }
}
