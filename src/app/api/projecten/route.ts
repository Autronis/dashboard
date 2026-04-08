import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projecten, klanten, taken, tijdregistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and, desc, gte } from "drizzle-orm";

// GET /api/projecten — All active projects with client name + task stats + activity
export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const statusFilter = req.nextUrl.searchParams.get("status");

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
        bijgewerktOp: projecten.bijgewerktOp,
        aangemaaktOp: projecten.aangemaaktOp,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(eq(projecten.isActief, 1));

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

    // Get total hours from tijdregistraties per project
    const urenStats = await db
      .select({
        projectId: tijdregistraties.projectId,
        totaalMinuten: sql<number>`sum(${tijdregistraties.duurMinuten})`,
      })
      .from(tijdregistraties)
      .groupBy(tijdregistraties.projectId);

    const urenMap = new Map(urenStats.map((u) => [u.projectId, u.totaalMinuten || 0]));

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

    // Build sparkline data per project (7 days)
    const sparklineMap = new Map<number, number[]>();
    for (const row of dagActiviteit) {
      if (!row.projectId) continue;
      if (!sparklineMap.has(row.projectId)) sparklineMap.set(row.projectId, []);
      sparklineMap.get(row.projectId)!.push(row.count);
    }

    // Generate 7-day sparkline with proper day alignment
    const vandaag = new Date();
    const projectSparklines = new Map<number, number[]>();
    for (const [projectId, activities] of sparklineMap) {
      const dagMap = new Map<string, number>();
      for (const row of dagActiviteit.filter((r) => r.projectId === projectId)) {
        dagMap.set(row.dag, row.count);
      }
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

      return {
        ...p,
        takenTotaal: stats.totaal,
        takenAfgerond: stats.afgerond,
        takenOpen: stats.open,
        takenVoortgang,
        takenDezeWeek: weekTakenMap.get(p.id) || 0,
        totaalMinuten,
        laatsteActiviteit,
        sparkline,
      };
    });

    // KPIs
    const totaal = lijst.length;
    const actief = lijst.filter((p) => p.status === "actief").length;
    const afgerond = lijst.filter((p) => p.status === "afgerond").length;
    const onHold = lijst.filter((p) => p.status === "on-hold").length;
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
