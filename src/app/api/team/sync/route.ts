import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, teamActiviteit, gebruikers, projecten } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

// API key auth voor Claude/agents (geen cookie-sessie nodig)
function requireApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return key === process.env.SESSION_SECRET;
}

// GET /api/team/sync?projectId=5
// Claude/agents roepen dit aan VOORDAT ze beginnen
// Geeft terug: wie werkt aan wat, welke taken zijn vrij, recente activiteit
export async function GET(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  const conditions = [
    sql`${taken.status} IN ('open', 'bezig')`,
  ];
  if (projectId) {
    conditions.push(eq(taken.projectId, Number(projectId)));
  }

  // Alle open/bezig taken met toewijzing
  const takenLijst = await db
    .select({
      id: taken.id,
      titel: taken.titel,
      status: taken.status,
      fase: taken.fase,
      prioriteit: taken.prioriteit,
      toegewezenAanId: taken.toegewezenAan,
      toegewezenAanNaam: gebruikers.naam,
      projectId: taken.projectId,
      projectNaam: projecten.naam,
      bijgewerktOp: taken.bijgewerktOp,
    })
    .from(taken)
    .leftJoin(gebruikers, eq(taken.toegewezenAan, gebruikers.id))
    .leftJoin(projecten, eq(taken.projectId, projecten.id))
    .where(and(...conditions))
    .orderBy(
      sql`CASE ${taken.prioriteit} WHEN 'hoog' THEN 0 WHEN 'normaal' THEN 1 ELSE 2 END`,
      taken.fase
    );

  // Recente team activiteit (laatste 20)
  const activiteit = await db
    .select({
      gebruikerNaam: gebruikers.naam,
      type: teamActiviteit.type,
      bericht: teamActiviteit.bericht,
      aangemaaktOp: teamActiviteit.aangemaaktOp,
    })
    .from(teamActiviteit)
    .innerJoin(gebruikers, eq(teamActiviteit.gebruikerId, gebruikers.id))
    .where(projectId ? eq(teamActiviteit.projectId, Number(projectId)) : undefined)
    .orderBy(desc(teamActiviteit.aangemaaktOp))
    .limit(20);

  // Samenvatting
  const bezigTaken = takenLijst.filter((t) => t.status === "bezig");
  const vrijeTaken = takenLijst.filter((t) => t.status === "open" && !t.toegewezenAanId);
  const toegewezenTaken = takenLijst.filter((t) => t.toegewezenAanId);

  return NextResponse.json({
    samenvatting: {
      totaalOpen: takenLijst.filter((t) => t.status === "open").length,
      totaalBezig: bezigTaken.length,
      vrij: vrijeTaken.length,
      toegewezen: toegewezenTaken.length,
    },
    bezigMet: bezigTaken.map((t) => ({
      taakId: t.id,
      titel: t.titel,
      fase: t.fase,
      door: t.toegewezenAanNaam,
      sinds: t.bijgewerktOp,
    })),
    vrijeTaken: vrijeTaken.map((t) => ({
      taakId: t.id,
      titel: t.titel,
      fase: t.fase,
      prioriteit: t.prioriteit,
      project: t.projectNaam,
    })),
    openTaken: takenLijst.map((t) => ({
      id: t.id,
      titel: t.titel,
      status: t.status,
      fase: t.fase,
      prioriteit: t.prioriteit,
      toegewezenAan: t.toegewezenAanNaam,
      project: t.projectNaam,
    })),
    recenteActiviteit: activiteit,
  });
}

// POST /api/team/sync
// Claude/agents posten updates: taak gepakt, voortgang, afgerond
export async function POST(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const body = await req.json() as {
    gebruikerId: number;
    type: "taak_gepakt" | "taak_afgerond" | "taak_update" | "status_wijziging" | "bezig_met";
    taakId?: number;
    projectId?: number;
    bericht: string;
    // Optioneel: update de taak status direct
    taakStatus?: "open" | "bezig" | "afgerond";
  };

  if (!body.gebruikerId || !body.type || !body.bericht) {
    return NextResponse.json({ fout: "gebruikerId, type en bericht zijn verplicht" }, { status: 400 });
  }

  // Log activiteit
  await db.insert(teamActiviteit).values({
    gebruikerId: body.gebruikerId,
    type: body.type,
    taakId: body.taakId ?? null,
    projectId: body.projectId ?? null,
    bericht: body.bericht,
  });

  // Update taak als gevraagd
  if (body.taakId && body.taakStatus) {
    const [huidigeTaak] = await db.select().from(taken).where(eq(taken.id, body.taakId)).limit(1);

    // Check lock: als taak al aan iemand anders is toegewezen, blokkeer
    if (huidigeTaak?.toegewezenAan && huidigeTaak.toegewezenAan !== body.gebruikerId && body.taakStatus === "bezig") {
      return NextResponse.json(
        { fout: `Taak "${huidigeTaak.titel}" is al opgepakt door iemand anders.`, gelockt: true },
        { status: 409 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: body.taakStatus,
      bijgewerktOp: new Date().toISOString(),
    };

    // Auto-assign bij "bezig"
    if (body.taakStatus === "bezig" && !huidigeTaak?.toegewezenAan) {
      updateData.toegewezenAan = body.gebruikerId;
    }

    await db.update(taken).set(updateData).where(eq(taken.id, body.taakId));
  }

  return NextResponse.json({ succes: true });
}
