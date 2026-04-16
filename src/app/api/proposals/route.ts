import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals, proposalRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { slidesSchema } from "@/lib/proposal-schema";

// GET /api/proposals?status=concept
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const conditions = [];
    if (status) {
      conditions.push(
        eq(
          proposals.status,
          status as "concept" | "verzonden" | "bekeken" | "ondertekend" | "afgewezen"
        )
      );
    }

    const lijst = await db
      .select({
        id: proposals.id,
        klantId: proposals.klantId,
        klantNaam: klanten.bedrijfsnaam,
        titel: proposals.titel,
        status: proposals.status,
        totaalBedrag: proposals.totaalBedrag,
        geldigTot: proposals.geldigTot,
        token: proposals.token,
        ondertekendOp: proposals.ondertekendOp,
        aangemaaktOp: proposals.aangemaaktOp,
      })
      .from(proposals)
      .innerJoin(klanten, eq(proposals.klantId, klanten.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(proposals.aangemaaktOp));

    // KPIs
    const alle = await db
      .select({
        status: proposals.status,
        totaalBedrag: proposals.totaalBedrag,
        ondertekendOp: proposals.ondertekendOp,
      })
      .from(proposals);

    const nu = new Date();
    const eersteVanMaand = new Date(nu.getFullYear(), nu.getMonth(), 1).toISOString();

    const kpis = {
      openstaand: 0,
      verzonden: 0,
      ondertekendDezeMaand: 0,
      totaleWaarde: 0,
    };

    for (const p of alle) {
      if (p.status === "concept" || p.status === "verzonden" || p.status === "bekeken") {
        kpis.openstaand++;
      }
      if (p.status === "verzonden" || p.status === "bekeken") {
        kpis.verzonden++;
      }
      if (p.status === "ondertekend" && p.ondertekendOp && p.ondertekendOp >= eersteVanMaand) {
        kpis.ondertekendDezeMaand++;
      }
      kpis.totaleWaarde += p.totaalBedrag || 0;
    }

    return NextResponse.json({ proposals: lijst, kpis });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/proposals
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { klantId, titel, secties, geldigTot, regels } = body;

    if (!klantId) {
      return NextResponse.json({ fout: "Klant is verplicht." }, { status: 400 });
    }
    if (!titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }

    // Validate slides shape
    const slidesResult = slidesSchema.safeParse(secties ?? []);
    if (!slidesResult.success) {
      return NextResponse.json(
        { fout: "Ongeldige slide structuur: " + slidesResult.error.issues[0]?.message },
        { status: 400 }
      );
    }

    // Calculate total
    let totaalBedrag = 0;
    if (regels && Array.isArray(regels)) {
      for (const regel of regels) {
        totaalBedrag += (regel.aantal || 1) * (regel.eenheidsprijs || 0);
      }
    }
    totaalBedrag = Math.round(totaalBedrag * 100) / 100;

    const token = crypto.randomUUID();

    const [nieuw] = await db
      .insert(proposals)
      .values({
        klantId,
        titel: titel.trim(),
        status: "concept",
        secties: JSON.stringify(secties || []),
        totaalBedrag,
        geldigTot: geldigTot || null,
        token,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // Create regels
    if (regels && Array.isArray(regels)) {
      for (const regel of regels) {
        const regelTotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
        await db.insert(proposalRegels).values({
          proposalId: nieuw.id,
          omschrijving: (regel.omschrijving || "").trim(),
          aantal: regel.aantal || 1,
          eenheidsprijs: regel.eenheidsprijs || 0,
          totaal: Math.round(regelTotaal * 100) / 100,
        });
      }
    }

    return NextResponse.json({ proposal: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
