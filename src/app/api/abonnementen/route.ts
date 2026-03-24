import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { abonnementen, projecten } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// GET /api/abonnementen
export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: abonnementen.id,
        naam: abonnementen.naam,
        leverancier: abonnementen.leverancier,
        bedrag: abonnementen.bedrag,
        frequentie: abonnementen.frequentie,
        categorie: abonnementen.categorie,
        startDatum: abonnementen.startDatum,
        volgendeBetaling: abonnementen.volgendeBetaling,
        projectId: abonnementen.projectId,
        projectNaam: projecten.naam,
        url: abonnementen.url,
        notities: abonnementen.notities,
        isActief: abonnementen.isActief,
      })
      .from(abonnementen)
      .leftJoin(projecten, eq(abonnementen.projectId, projecten.id))
      .where(eq(abonnementen.isActief, 1))
      .orderBy(desc(abonnementen.bedrag));

    // Bereken totalen
    let maandelijks = 0;
    let jaarlijks = 0;
    for (const row of rows) {
      const bedrag = row.bedrag ?? 0;
      if (row.frequentie === "maandelijks") {
        maandelijks += bedrag;
        jaarlijks += bedrag * 12;
      } else if (row.frequentie === "per_kwartaal") {
        maandelijks += bedrag / 3;
        jaarlijks += bedrag * 4;
      } else if (row.frequentie === "jaarlijks") {
        maandelijks += bedrag / 12;
        jaarlijks += bedrag;
      }
    }

    // Volgende betalingen (komende 7 dagen)
    const nu = new Date();
    const over7d = new Date(nu.getTime() + 7 * 86400000);
    const nuStr = nu.toISOString().slice(0, 10);
    const over7dStr = over7d.toISOString().slice(0, 10);
    const aankomend = rows.filter(
      (r) => r.volgendeBetaling && r.volgendeBetaling >= nuStr && r.volgendeBetaling <= over7dStr
    );

    return NextResponse.json({
      abonnementen: rows,
      totalen: {
        maandelijks: Math.round(maandelijks * 100) / 100,
        jaarlijks: Math.round(jaarlijks * 100) / 100,
        aantal: rows.length,
        aankomend: aankomend.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}

// POST /api/abonnementen
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    const { naam, leverancier, bedrag, frequentie, categorie, startDatum, volgendeBetaling, projectId, url, notities } = body as {
      naam: string;
      leverancier?: string;
      bedrag: number;
      frequentie?: string;
      categorie?: string;
      startDatum?: string;
      volgendeBetaling?: string;
      projectId?: number;
      url?: string;
      notities?: string;
    };

    if (!naam?.trim() || !bedrag) {
      return NextResponse.json({ fout: "Naam en bedrag zijn verplicht" }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(abonnementen)
      .values({
        naam: naam.trim(),
        leverancier: leverancier?.trim() || null,
        bedrag,
        frequentie: (frequentie as "maandelijks" | "jaarlijks" | "per_kwartaal") || "maandelijks",
        categorie: (categorie as "tools" | "hosting" | "ai" | "marketing" | "communicatie" | "opslag" | "design" | "overig") || "tools",
        startDatum: startDatum || null,
        volgendeBetaling: volgendeBetaling || null,
        projectId: projectId || null,
        url: url?.trim() || null,
        notities: notities?.trim() || null,
      })
      .returning();

    return NextResponse.json({ abonnement: nieuw });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}
