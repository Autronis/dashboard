import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten, gebruikers } from "@/lib/db/schema";
import { requireAuth, requireAuthOrApiKey } from "@/lib/auth";
import { eq, and, or, inArray, sql, like, desc, asc } from "drizzle-orm";
import { pushEventToGoogle } from "@/lib/google-calendar";
import { inferClusterOwner } from "@/lib/cluster";

// GET /api/taken — alle taken met filters, gegroepeerd per project/fase
export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const prioriteit = searchParams.get("prioriteit");
    const zoek = searchParams.get("zoek");
    const toegewezenAan = searchParams.get("toegewezenAan");
    const projectIdFilter = searchParams.get("projectId");
    const faseFilter = searchParams.get("fase");
    const scope = searchParams.get("scope"); // mij | sem | syb | team | vrij | alle

    // Filter taken op project-eigenaarschap. Sem ziet projecten zonder
    // eigenaar (legacy NULL) plus sem/team/vrij. Syb ziet syb/team/vrij.
    // Taken zonder gekoppeld project blijven ook zichtbaar.
    const visibleCodes: ("sem" | "syb" | "team" | "vrij")[] =
      gebruiker.id === 2 ? ["syb", "team", "vrij"] : ["sem", "team", "vrij"];

    // Scope reduceert de zichtbare set verder op basis van de tab-knop.
    // Mij = mijn solo + samen, Syb = Syb solo + samen, Team = alleen samen,
    // Vrij = alleen open backlog. Alle = alle voor jou zichtbare projecten.
    let scopeCodes: ("sem" | "syb" | "team" | "vrij")[] | null = null;
    if (scope === "mij") {
      scopeCodes = gebruiker.id === 2 ? ["syb", "team"] : ["sem", "team"];
    } else if (scope === "sem") {
      scopeCodes = ["sem", "team"];
    } else if (scope === "syb") {
      scopeCodes = ["syb", "team"];
    } else if (scope === "team") {
      scopeCodes = ["team"];
    } else if (scope === "vrij") {
      scopeCodes = ["vrij"];
    }

    // Expliciete user-scopes ("sem" of "syb") overriden de privacy default,
    // anders zou Syb's "Sem" tab niks laten zien. Andere scopes blijven
    // door visibleCodes filteren zodat Syb niet per ongeluk via "alle"
    // Sem's solo werk ziet.
    const explicitUserScope = scope === "sem" || scope === "syb";
    const effectiveCodes = scopeCodes
      ? explicitUserScope
        ? scopeCodes
        : scopeCodes.filter((c) => visibleCodes.includes(c))
      : visibleCodes;

    const conditions = [
      sql`(${projecten.isActief} = 1 OR ${projecten.isActief} IS NULL)`,
      or(
        // Taak HEEFT een project: filter op project-eigenaar
        and(
          sql`${taken.projectId} IS NOT NULL`,
          or(
            inArray(projecten.eigenaar, effectiveCodes),
            // Backward compat voor projecten zonder eigenaar (NULL = legacy Sem)
            gebruiker.id === 1 && (scope === null || scope === "alle" || scope === "mij")
              ? sql`${projecten.eigenaar} IS NULL`
              : sql`1=0`
          )
        )!,
        // Taak heeft GEEN project: filter op taken.eigenaar zelf
        and(
          sql`${taken.projectId} IS NULL`,
          or(
            inArray(taken.eigenaar, effectiveCodes),
            gebruiker.id === 1 && (scope === null || scope === "alle" || scope === "mij")
              ? sql`${taken.eigenaar} IS NULL`
              : sql`1=0`
          )
        )!,
        // Slimme acties (vrij om te pakken) zijn altijd zichtbaar, ongeacht
        // scope — de UI toont ze in een apart "Slimme acties" blok bovenaan
        // zodat iedereen ze kan oppakken.
        and(
          sql`${taken.projectId} IS NULL`,
          eq(taken.uitvoerder, "claude"),
          eq(taken.eigenaar, "vrij"),
          or(
            eq(taken.fase, "Slimme taken"),
            eq(taken.fase, "Slimme taken (recurring)")
          )
        )!
      )!,
    ];
    if (status && status !== "alle") {
      const statussen = status.split(",").map(s => s.trim()).filter(Boolean);
      if (statussen.length === 1) {
        conditions.push(eq(taken.status, statussen[0] as "open" | "bezig" | "afgerond"));
      } else if (statussen.length > 1) {
        conditions.push(inArray(taken.status, statussen as ("open" | "bezig" | "afgerond")[]));
      }
    }
    if (prioriteit && prioriteit !== "alle") conditions.push(eq(taken.prioriteit, prioriteit as "laag" | "normaal" | "hoog"));
    if (toegewezenAan === "geen") conditions.push(sql`${taken.toegewezenAan} IS NULL`);
    else if (toegewezenAan) conditions.push(eq(taken.toegewezenAan, Number(toegewezenAan)));
    if (zoek) conditions.push(like(taken.titel, `%${zoek}%`));
    if (projectIdFilter && projectIdFilter !== "alle") conditions.push(eq(taken.projectId, Number(projectIdFilter)));
    if (faseFilter && faseFilter !== "alle") conditions.push(eq(taken.fase, faseFilter));

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        omschrijving: taken.omschrijving,
        fase: taken.fase,
        cluster: taken.cluster,
        volgorde: taken.volgorde,
        status: taken.status,
        deadline: taken.deadline,
        prioriteit: taken.prioriteit,
        uitvoerder: taken.uitvoerder,
        prompt: taken.prompt,
        projectMap: taken.projectMap,
        aangemaaktOp: taken.aangemaaktOp,
        projectId: taken.projectId,
        projectNaam: projecten.naam,
        projectEigenaar: projecten.eigenaar,
        klantNaam: klanten.bedrijfsnaam,
        toegewezenAanId: taken.toegewezenAan,
        toegewezenAanNaam: gebruikers.naam,
        eigenaar: taken.eigenaar,
      })
      .from(taken)
      .leftJoin(projecten, eq(taken.projectId, projecten.id))
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .leftJoin(gebruikers, eq(taken.toegewezenAan, gebruikers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        asc(projecten.naam),
        asc(taken.fase),
        asc(taken.volgorde),
        sql`CASE ${taken.status} WHEN 'open' THEN 0 WHEN 'bezig' THEN 1 WHEN 'afgerond' THEN 2 END`,
        sql`CASE ${taken.prioriteit} WHEN 'hoog' THEN 0 WHEN 'normaal' THEN 1 WHEN 'laag' THEN 2 END`,
        desc(taken.aangemaaktOp)
      );

    // KPIs
    const totaal = rows.length;
    const open = rows.filter((t) => t.status === "open").length;
    const bezig = rows.filter((t) => t.status === "bezig").length;
    const afgerond = rows.filter((t) => t.status === "afgerond").length;
    const vandaag = new Date().toISOString().slice(0, 10);
    const verlopen = rows.filter((t) => t.deadline && t.deadline < vandaag && t.status !== "afgerond").length;

    // Voortgang per project + fase
    const projectMap = new Map<number, {
      projectId: number;
      projectNaam: string;
      totaal: number;
      afgerond: number;
      faseMap: Map<string, { totaal: number; afgerond: number }>;
    }>();

    for (const t of rows) {
      const pId = t.projectId ?? 0;
      const pNaam = t.projectNaam ?? (t.fase || "Zonder project");
      let proj = projectMap.get(pId);
      if (!proj) {
        proj = {
          projectId: pId,
          projectNaam: pNaam,
          totaal: 0,
          afgerond: 0,
          faseMap: new Map(),
        };
        projectMap.set(pId, proj);
      }
      proj.totaal++;
      if (t.status === "afgerond") proj.afgerond++;

      const faseKey = t.fase || "Backlog";
      let fase = proj.faseMap.get(faseKey);
      if (!fase) {
        fase = { totaal: 0, afgerond: 0 };
        proj.faseMap.set(faseKey, fase);
      }
      fase.totaal++;
      if (t.status === "afgerond") fase.afgerond++;
    }

    const projectVoortgang = Array.from(projectMap.values()).map((p) => ({
      projectId: p.projectId,
      projectNaam: p.projectNaam,
      totaal: p.totaal,
      afgerond: p.afgerond,
      fases: Array.from(p.faseMap.entries()).map(([fase, stats]) => ({
        fase,
        totaal: stats.totaal,
        afgerond: stats.afgerond,
      })),
    }));

    return NextResponse.json({
      taken: rows,
      kpis: { totaal, open, bezig, afgerond, verlopen },
      projecten: projectVoortgang,
    }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/taken
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { projectId, titel, omschrijving, status, deadline, prioriteit, fase, cluster, volgorde, uitvoerder, prompt, projectMap } = body;

    if (!titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }

    const cleanCluster = typeof cluster === "string" && cluster.trim() ? cluster.trim() : null;

    // Historische cluster-ownership: als iemand eerder in dit (project, cluster)
    // tuple werk heeft gedaan, erft de nieuwe taak diens toegewezenAan. Zo
    // "blijft" een cluster binnen een project bij degene die de context heeft.
    let initieleToegewezen: number = gebruiker.id;
    if (cleanCluster && projectId) {
      const historischEigenaar = await inferClusterOwner(projectId, cleanCluster);
      if (historischEigenaar) initieleToegewezen = historischEigenaar;
    }

    const [nieuw] = await db
      .insert(taken)
      .values({
        projectId: projectId || null,
        aangemaaktDoor: gebruiker.id,
        toegewezenAan: initieleToegewezen,
        titel: titel.trim(),
        omschrijving: omschrijving?.trim() || null,
        fase: fase || null,
        cluster: cleanCluster,
        volgorde: volgorde ?? 0,
        status: status || "open",
        deadline: deadline || null,
        prioriteit: prioriteit || "normaal",
        uitvoerder: uitvoerder || "handmatig",
        prompt: prompt?.trim() || null,
        projectMap: projectMap || null,
      })
      .returning();

    // Push to Google Calendar if task has deadline
    if (deadline) {
      pushEventToGoogle(gebruiker.id, {
        summary: titel.trim(),
        description: omschrijving?.trim() || undefined,
        start: deadline,
        allDay: true,
      })
        .then(async (event) => {
          if (event?.id) {
            await db.update(taken)
              .set({ googleEventId: event.id })
              .where(eq(taken.id, nieuw.id))
              .execute();
          }
        })
        .catch(() => {});
    }

    // Auto-update project status: new open task → project back to "actief"
    if (nieuw.projectId && (nieuw.status === "open" || nieuw.status === "bezig")) {
      await db
        .update(projecten)
        .set({
          status: "actief",
          bijgewerktOp: sql`(datetime('now'))`,
        })
        .where(eq(projecten.id, nieuw.projectId))
        .run();
    }

    return NextResponse.json({ taak: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
