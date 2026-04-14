import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, klanten, taken, gebruikers } from "@/lib/db/schema";
import { requireAuth, requireApiKey, requireAuthOrApiKey } from "@/lib/auth";
import { eq, sql, and, or, desc, gte, inArray } from "drizzle-orm";
import { berekenUrenPerProject } from "@/lib/screen-time-uren";
import { createProjectRepo } from "@/lib/github";

type EigenaarCode = "sem" | "syb" | "team" | "vrij";

/** Eigenaar codes per gebruiker id. Sem=1, Syb=2.
 *  Beide users zien altijd 'team' en 'vrij' projecten. */
function visibleEigenaarCodes(userId: number): readonly EigenaarCode[] {
  if (userId === 2) return ["syb", "team", "vrij"] as const;
  // Default (Sem of onbekend → Sem's view)
  return ["sem", "team", "vrij"] as const;
}

// GET /api/projecten — All active projects with client name + task stats + activity
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const currentUserId = gebruiker.id;

    const statusFilter = req.nextUrl.searchParams.get("status");

    const visibleCodes = visibleEigenaarCodes(currentUserId);

    const lijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        omschrijving: projecten.omschrijving,
        klantId: klanten.id,
        klantNaam: klanten.bedrijfsnaam,
        status: projecten.status,
        voortgangPercentage: projecten.voortgangPercentage,
        deadline: projecten.deadline,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        eigenaar: projecten.eigenaar,
        bijgewerktOp: projecten.bijgewerktOp,
        aangemaaktOp: projecten.aangemaaktOp,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          eq(projecten.isActief, 1),
          or(
            inArray(projecten.eigenaar, visibleCodes),
            // Backward compat: projecten zonder eigenaar (NULL) zijn pre-migratie
            // en horen historisch bij Sem.
            currentUserId === 1 ? sql`${projecten.eigenaar} IS NULL` : sql`1=0`
          )
        )
      );

    // Filter by status if provided
    const filtered = statusFilter
      ? lijst.filter((p) => p.status === statusFilter)
      : lijst;

    // Get task counts per project (only from active projects, consistent with /api/taken)
    const takenStats = await db
      .select({
        projectId: taken.projectId,
        totaal: sql<number>`count(*)`,
        afgerond: sql<number>`sum(case when ${taken.status} = 'afgerond' then 1 else 0 end)`,
        open: sql<number>`sum(case when ${taken.status} != 'afgerond' then 1 else 0 end)`,
      })
      .from(taken)
      .innerJoin(projecten, eq(taken.projectId, projecten.id))
      .where(eq(projecten.isActief, 1))
      .groupBy(taken.projectId);

    const takenMap = new Map(
      takenStats.map((t) => [t.projectId, { totaal: t.totaal, afgerond: t.afgerond, open: t.open }])
    );

    // Get taken completed this week per project
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

    const weekTakenStats = await db
      .select({
        projectId: taken.projectId,
        afgerondDezeWeek: sql<number>`count(*)`,
      })
      .from(taken)
      .where(
        and(
          eq(taken.status, "afgerond"),
          gte(taken.bijgewerktOp, weekStartStr)
        )
      )
      .groupBy(taken.projectId);

    const weekTakenMap = new Map(weekTakenStats.map((t) => [t.projectId, t.afgerondDezeWeek]));

    // Get last activity per project (most recent task update or time registration)
    const laatsteActiviteiten = await db
      .select({
        projectId: taken.projectId,
        laatsteTaakUpdate: sql<string>`max(${taken.bijgewerktOp})`,
      })
      .from(taken)
      .where(eq(taken.status, "afgerond"))
      .groupBy(taken.projectId);

    const activiteitMap = new Map(
      laatsteActiviteiten.map((a) => [a.projectId, a.laatsteTaakUpdate])
    );

    // Total hours per project from screen-time entries (productive activity).
    // Range: alles wat ooit getrackt is — projectenlijst toont totale activiteit.
    const urenPerProject = await berekenUrenPerProject("2020-01-01", "2099-12-31");
    // Convert hours → minutes for compatibility with existing UI fields
    const urenMap = new Map<number, number>(
      [...urenPerProject.entries()].map(([id, uren]) => [id, Math.round(uren * 60)])
    );

    // Get concatenated task titles per project (for search)
    const taakTitelsData = await db
      .select({
        projectId: taken.projectId,
        titels: sql<string>`group_concat(${taken.titel}, ' | ')`,
      })
      .from(taken)
      .groupBy(taken.projectId);

    const taakTitelsMap = new Map(taakTitelsData.map((t) => [t.projectId, t.titels || ""]));

    // Get last 7 days activity per project (for sparkline)
    const zevenDagenGeleden = new Date();
    zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 7);
    const zevenDagenStr = zevenDagenGeleden.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");

    const dagActiviteit = await db
      .select({
        projectId: taken.projectId,
        dag: sql<string>`substr(${taken.bijgewerktOp}, 1, 10)`,
        count: sql<number>`count(*)`,
      })
      .from(taken)
      .where(
        and(
          eq(taken.status, "afgerond"),
          gte(taken.bijgewerktOp, zevenDagenStr)
        )
      )
      .groupBy(taken.projectId, sql`substr(${taken.bijgewerktOp}, 1, 10)`);

    // Build sparkline data per project (7 days, aligned by date)
    const vandaag = new Date();
    const projectSparklines = new Map<number, number[]>();
    const dagMapPerProject = new Map<number, Map<string, number>>();
    for (const row of dagActiviteit) {
      if (!row.projectId) continue;
      if (!dagMapPerProject.has(row.projectId)) dagMapPerProject.set(row.projectId, new Map());
      dagMapPerProject.get(row.projectId)!.set(row.dag, row.count);
    }
    for (const [projectId, dagMap] of dagMapPerProject) {
      const sparkline: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(vandaag);
        d.setDate(d.getDate() - i);
        const dagStr = d.toISOString().substring(0, 10);
        sparkline.push(dagMap.get(dagStr) || 0);
      }
      projectSparklines.set(projectId, sparkline);
    }

    const projectenMetTaken = filtered.map((p) => {
      const stats = takenMap.get(p.id) ?? { totaal: 0, afgerond: 0, open: 0 };
      const takenVoortgang = stats.totaal > 0 ? Math.round((stats.afgerond / stats.totaal) * 100) : 0;
      const totaalMinuten = urenMap.get(p.id) || 0;

      // Generate default sparkline if none exists
      let sparkline = projectSparklines.get(p.id);
      if (!sparkline) {
        sparkline = [0, 0, 0, 0, 0, 0, 0];
      }

      // Determine last meaningful activity
      const laatsteActiviteit = activiteitMap.get(p.id) || p.bijgewerktOp;

      // Auto-afgerond: als alle taken klaar zijn en het project niet handmatig
      // op on-hold staat, override de status zodat 'ie niet eeuwig op 'actief'
      // hangt. Persisteert niet in DB — alleen output.
      const isAutoAfgerond =
        stats.totaal > 0 && stats.afgerond === stats.totaal && p.status !== "on-hold";
      const effectieveStatus = isAutoAfgerond ? "afgerond" : (p.status ?? "actief");

      return {
        ...p,
        status: effectieveStatus,
        takenTotaal: stats.totaal,
        takenAfgerond: stats.afgerond,
        takenOpen: stats.open,
        takenVoortgang,
        takenDezeWeek: weekTakenMap.get(p.id) || 0,
        totaalMinuten,
        laatsteActiviteit,
        sparkline,
        taakTitels: taakTitelsMap.get(p.id) || "",
      };
    });

    // KPIs — gebruik effectieveStatus zodat auto-afgeronde projecten in de
    // juiste bucket terechtkomen.
    const totaal = projectenMetTaken.length;
    const actief = projectenMetTaken.filter((p) => p.status === "actief").length;
    const afgerond = projectenMetTaken.filter((p) => p.status === "afgerond").length;
    const onHold = projectenMetTaken.filter((p) => p.status === "on-hold").length;
    const takenOpenTotaal = projectenMetTaken.reduce((sum, p) => sum + p.takenOpen, 0);
    const totaleUren = projectenMetTaken.reduce((sum, p) => sum + p.totaalMinuten, 0);

    return NextResponse.json({
      projecten: projectenMetTaken,
      kpis: { totaal, actief, afgerond, onHold, takenOpen: takenOpenTotaal, totaleUren },
    }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/projecten — create project (or return existing)
// Supports both session auth and Bearer API key (for Claude Code)
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    let userId: number;
    if (authHeader?.startsWith("Bearer ")) {
      userId = await requireApiKey(req);
    } else {
      const gebruiker = await requireAuth();
      userId = gebruiker.id;
    }

    const body = (await req.json()) as {
      naam: string;
      omschrijving?: string;
      status?: "actief" | "afgerond" | "on-hold";
      klantId?: number;
      eigenaar?: "sem" | "syb" | "team" | "vrij";
    };

    if (!body.naam?.trim()) {
      return NextResponse.json({ fout: "naam is verplicht" }, { status: 400 });
    }

    // Check if project already exists (case-insensitive)
    const existing = await db
      .select()
      .from(projecten)
      .where(sql`LOWER(${projecten.naam}) = LOWER(${body.naam.trim()})`)
      .get();

    if (existing) {
      return NextResponse.json({ project: existing, bestaand: true });
    }

    // Eigenaar is verplicht bij aanmaken van een NIEUW project — niemand mag
    // anoniem projecten droppen. Vier opties: sem | syb | team | vrij.
    // Reden: zonder eigenaar staat een project default op NULL en is alleen
    // voor Sem zichtbaar — dat geeft chaos in een gedeeld dashboard.
    const VALID_EIGENAREN = ["sem", "syb", "team", "vrij"] as const;
    if (!body.eigenaar || !VALID_EIGENAREN.includes(body.eigenaar)) {
      return NextResponse.json(
        {
          fout:
            "eigenaar is verplicht bij aanmaken van een nieuw project. " +
            "Kies één van: sem (alleen Sem), syb (alleen Syb), team (beiden), vrij (niet toegewezen). " +
            "Vraag de gebruiker EERST voor wie het project is voordat je deze call opnieuw doet.",
          vereiste_velden: { eigenaar: "sem | syb | team | vrij" },
        },
        { status: 400 }
      );
    }

    // Create new project
    const [project] = await db
      .insert(projecten)
      .values({
        naam: body.naam.trim(),
        omschrijving: body.omschrijving || null,
        status: body.status || "actief",
        klantId: body.klantId || null,
        eigenaar: body.eigenaar,
        aangemaaktDoor: userId,
        isActief: 1,
        voortgangPercentage: 0,
      })
      .returning();

    // Auto-create GitHub repo onder Autronis org. No-op als GITHUB_TOKEN
    // ontbreekt — dashboard moet niet crashen op GH falen. De URL wordt
    // bewaard zodat desktop agents van zowel Sem als Syb hem kunnen klonen
    // bij hun volgende project_sync run.
    let projectMetUrl = project;
    try {
      const repo = await createProjectRepo(project.naam, project.omschrijving);
      if (repo) {
        const [updated] = await db
          .update(projecten)
          .set({ githubUrl: repo.url, bijgewerktOp: sql`(datetime('now'))` })
          .where(eq(projecten.id, project.id))
          .returning();
        if (updated) projectMetUrl = updated;
      }
    } catch (e) {
      console.error("[projecten/POST] github auto-create error:", e);
    }

    return NextResponse.json({ project: projectMetUrl, bestaand: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
