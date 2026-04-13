import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, like, sql, desc } from "drizzle-orm";

// GET /api/leads
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const zoek = searchParams.get("zoek");

    const conditions = [eq(leads.isActief, 1)];
    if (status && status !== "alle") {
      conditions.push(eq(leads.status, status as "nieuw" | "contact" | "offerte" | "gewonnen" | "verloren"));
    }
    if (zoek) {
      conditions.push(
        sql`(${leads.bedrijfsnaam} LIKE ${"%" + zoek + "%"} OR ${leads.contactpersoon} LIKE ${"%" + zoek + "%"})`
      );
    }

    const rows = await db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${leads.status} WHEN 'nieuw' THEN 0 WHEN 'contact' THEN 1 WHEN 'offerte' THEN 2 WHEN 'gewonnen' THEN 3 WHEN 'verloren' THEN 4 END`,
        desc(leads.aangemaaktOp)
      );

    // KPIs
    const totaal = rows.length;
    const nieuw = rows.filter((l) => l.status === "nieuw").length;
    const contact = rows.filter((l) => l.status === "contact").length;
    const offerte = rows.filter((l) => l.status === "offerte").length;
    const gewonnen = rows.filter((l) => l.status === "gewonnen").length;
    const verloren = rows.filter((l) => l.status === "verloren").length;
    const pipelineWaarde = rows
      .filter((l) => l.status !== "verloren" && l.status !== "gewonnen")
      .reduce((sum, l) => sum + (l.waarde || 0), 0);
    const gewonnenWaarde = rows
      .filter((l) => l.status === "gewonnen")
      .reduce((sum, l) => sum + (l.waarde || 0), 0);

    return NextResponse.json({
      leads: rows,
      kpis: { totaal, nieuw, contact, offerte, gewonnen, verloren, pipelineWaarde, gewonnenWaarde },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/leads
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    if (!body.bedrijfsnaam?.trim()) {
      return NextResponse.json({ fout: "Bedrijfsnaam is verplicht." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(leads)
      .values({
        bedrijfsnaam: body.bedrijfsnaam.trim(),
        contactpersoon: body.contactpersoon?.trim() || null,
        email: body.email?.trim() || null,
        telefoon: body.telefoon?.trim() || null,
        waarde: body.waarde ?? null,
        status: body.status || "nieuw",
        bron: body.bron?.trim() || null,
        notities: body.notities?.trim() || null,
        volgendeActie: body.volgendeActie?.trim() || null,
        volgendeActieDatum: body.volgendeActieDatum || null,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ lead: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
