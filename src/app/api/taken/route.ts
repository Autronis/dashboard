import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, like, desc, asc } from "drizzle-orm";
import { pushEventToGoogle } from "@/lib/google-calendar";

// GET /api/taken — alle taken met filters, gegroepeerd per project/fase
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const prioriteit = searchParams.get("prioriteit");
    const zoek = searchParams.get("zoek");
    const toegewezenAan = searchParams.get("toegewezenAan");
    const projectIdFilter = searchParams.get("projectId");
    const faseFilter = searchParams.get("fase");

    const conditions = [];
    if (status && status !== "alle") conditions.push(eq(taken.status, status as "open" | "bezig" | "afgerond"));
    if (prioriteit && prioriteit !== "alle") conditions.push(eq(taken.prioriteit, prioriteit as "laag" | "normaal" | "hoog"));
    if (toegewezenAan) conditions.push(eq(taken.toegewezenAan, Number(toegewezenAan)));
    if (zoek) conditions.push(like(taken.titel, `%${zoek}%`));
    if (projectIdFilter && projectIdFilter !== "alle") conditions.push(eq(taken.projectId, Number(projectIdFilter)));
    if (faseFilter && faseFilter !== "alle") conditions.push(eq(taken.fase, faseFilter));

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        omschrijving: taken.omschrijving,
        fase: taken.fase,
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
        klantNaam: klanten.bedrijfsnaam,
        toegewezenAanId: taken.toegewezenAan,
        toegewezenAanNaam: gebruikers.naam,
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
      if (!t.projectId || !t.projectNaam) continue;
      let proj = projectMap.get(t.projectId);
      if (!proj) {
        proj = {
          projectId: t.projectId,
          projectNaam: t.projectNaam,
          totaal: 0,
          afgerond: 0,
          faseMap: new Map(),
        };
        projectMap.set(t.projectId, proj);
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
    const { projectId, titel, omschrijving, status, deadline, prioriteit, fase, volgorde, uitvoerder, prompt, projectMap } = body;

    if (!titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ fout: "Project is verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(taken)
      .values({
        projectId,
        aangemaaktDoor: gebruiker.id,
        toegewezenAan: gebruiker.id,
        titel: titel.trim(),
        omschrijving: omschrijving?.trim() || null,
        fase: fase || null,
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
        summary: `📋 ${titel.trim()}`,
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

    return NextResponse.json({ taak: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
