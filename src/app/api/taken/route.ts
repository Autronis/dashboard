import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, projecten, klanten, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, ne, sql, like, desc } from "drizzle-orm";

// GET /api/taken — alle taken met filters
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const prioriteit = searchParams.get("prioriteit");
    const zoek = searchParams.get("zoek");
    const toegewezenAan = searchParams.get("toegewezenAan");

    const conditions = [];
    if (status && status !== "alle") conditions.push(eq(taken.status, status as "open" | "bezig" | "afgerond"));
    if (prioriteit && prioriteit !== "alle") conditions.push(eq(taken.prioriteit, prioriteit as "laag" | "normaal" | "hoog"));
    if (toegewezenAan) conditions.push(eq(taken.toegewezenAan, Number(toegewezenAan)));
    if (zoek) conditions.push(like(taken.titel, `%${zoek}%`));

    const rows = await db
      .select({
        id: taken.id,
        titel: taken.titel,
        omschrijving: taken.omschrijving,
        status: taken.status,
        deadline: taken.deadline,
        prioriteit: taken.prioriteit,
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

    return NextResponse.json({
      taken: rows,
      kpis: { totaal, open, bezig, afgerond, verlopen },
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
    const { projectId, titel, omschrijving, status, deadline, prioriteit } = body;

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
        status: status || "open",
        deadline: deadline || null,
        prioriteit: prioriteit || "normaal",
      })
      .returning();

    return NextResponse.json({ taak: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
