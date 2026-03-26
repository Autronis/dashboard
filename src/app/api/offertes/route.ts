import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes, offerteRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, like, or } from "drizzle-orm";

// GET /api/offertes?status=verzonden&zoek=AUT
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const zoek = searchParams.get("zoek");

    const conditions = [eq(offertes.isActief, 1)];
    if (status) {
      conditions.push(
        eq(offertes.status, status as "concept" | "verzonden" | "geaccepteerd" | "verlopen" | "afgewezen")
      );
    }

    let query = db
      .select({
        id: offertes.id,
        offertenummer: offertes.offertenummer,
        titel: offertes.titel,
        klantId: offertes.klantId,
        klantNaam: klanten.bedrijfsnaam,
        status: offertes.status,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
        bedragExclBtw: offertes.bedragExclBtw,
        btwBedrag: offertes.btwBedrag,
        bedragInclBtw: offertes.bedragInclBtw,
        aangemaaktOp: offertes.aangemaaktOp,
        bijgewerktOp: offertes.bijgewerktOp,
        herinneringVerstuurdOp: offertes.herinneringVerstuurdOp,
      })
      .from(offertes)
      .innerJoin(klanten, eq(offertes.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(desc(offertes.datum))
      .$dynamic();

    if (zoek) {
      query = query.where(
        and(
          ...conditions,
          or(
            like(offertes.offertenummer, `%${zoek}%`),
            like(klanten.bedrijfsnaam, `%${zoek}%`),
            like(offertes.titel, `%${zoek}%`)
          )
        )
      );
    }

    const lijst = await query;

    // KPIs
    const alleOffertes = await db
      .select({
        status: offertes.status,
        bedragInclBtw: offertes.bedragInclBtw,
        aangemaaktOp: offertes.aangemaaktOp,
      })
      .from(offertes)
      .where(eq(offertes.isActief, 1));

    const nu = new Date();
    const eersteVanMaand = new Date(nu.getFullYear(), nu.getMonth(), 1).toISOString();
    const eersteVanVorigeMaand = new Date(nu.getFullYear(), nu.getMonth() - 1, 1).toISOString();

    let openstaandCount = 0;
    let openstaandWaarde = 0;
    let geaccepteerdDezeMaand = 0;
    let totaalGeaccepteerd = 0;
    let totaalAfgewezen = 0;
    let vorigeGeaccepteerd = 0;
    let vorigeAfgewezen = 0;
    const statusCounts: Record<string, number> = {};

    for (const o of alleOffertes) {
      const st = o.status ?? "concept";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (o.status === "concept" || o.status === "verzonden") {
        openstaandCount++;
        openstaandWaarde += o.bedragInclBtw || 0;
      }
      if (o.status === "geaccepteerd") {
        totaalGeaccepteerd++;
        if (o.aangemaaktOp && o.aangemaaktOp >= eersteVanMaand) {
          geaccepteerdDezeMaand++;
        }
        if (o.aangemaaktOp && o.aangemaaktOp >= eersteVanVorigeMaand && o.aangemaaktOp < eersteVanMaand) {
          vorigeGeaccepteerd++;
        }
      }
      if (o.status === "afgewezen") {
        totaalAfgewezen++;
        if (o.aangemaaktOp && o.aangemaaktOp >= eersteVanVorigeMaand && o.aangemaaktOp < eersteVanMaand) {
          vorigeAfgewezen++;
        }
      }
    }

    const winRate =
      totaalGeaccepteerd + totaalAfgewezen > 0
        ? Math.round((totaalGeaccepteerd / (totaalGeaccepteerd + totaalAfgewezen)) * 100)
        : 0;

    const winRateVorigeMaand =
      vorigeGeaccepteerd + vorigeAfgewezen > 0
        ? Math.round((vorigeGeaccepteerd / (vorigeGeaccepteerd + vorigeAfgewezen)) * 100)
        : null;

    const kpis = {
      openstaandCount,
      openstaandWaarde,
      geaccepteerdDezeMaand,
      winRate,
      winRateVorigeMaand,
      totaalGeaccepteerd,
      totaalAfgewezen,
      statusCounts,
    };

    return NextResponse.json({ offertes: lijst, kpis });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/offertes
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const {
      klantId,
      projectId,
      titel,
      datum,
      geldigTot,
      notities,
      regels,
    } = body;

    if (!klantId) {
      return NextResponse.json({ fout: "Klant is verplicht." }, { status: 400 });
    }

    const [klant] = await db.select({ id: klanten.id }).from(klanten).where(eq(klanten.id, klantId));
    if (!klant) {
      return NextResponse.json({ fout: "Klant bestaat niet. Maak deze eerst aan via Klanten." }, { status: 400 });
    }

    if (!regels || regels.length === 0) {
      return NextResponse.json({ fout: "Minimaal een offerteregel is verplicht." }, { status: 400 });
    }

    // Generate offertenummer: AUT-OFF-YYYY-NNN
    const jaar = new Date().getFullYear();
    const [laatste] = await db
      .select({ offertenummer: offertes.offertenummer })
      .from(offertes)
      .where(like(offertes.offertenummer, `AUT-OFF-${jaar}-%`))
      .orderBy(desc(offertes.offertenummer))
      .limit(1);

    let volgnummer = 1;
    if (laatste) {
      const parts = laatste.offertenummer.split("-");
      volgnummer = parseInt(parts[3], 10) + 1;
    }
    const offertenummer = `AUT-OFF-${jaar}-${volgnummer.toString().padStart(3, "0")}`;

    // Calculate totals
    let subtotaal = 0;
    let totalBtw = 0;
    for (const regel of regels) {
      const regelSubtotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
      subtotaal += regelSubtotaal;
      totalBtw += regelSubtotaal * ((regel.btwPercentage ?? 21) / 100);
    }
    subtotaal = Math.round(subtotaal * 100) / 100;
    totalBtw = Math.round(totalBtw * 100) / 100;
    const totaalInclBtw = Math.round((subtotaal + totalBtw) * 100) / 100;

    // Determine weighted average BTW percentage
    const avgBtw = subtotaal > 0 ? Math.round((totalBtw / subtotaal) * 10000) / 100 : 21;

    // Create offerte
    const [nieuw] = await db
      .insert(offertes)
      .values({
        klantId,
        projectId: projectId || null,
        offertenummer,
        titel: titel?.trim() || null,
        status: "concept",
        datum: datum || new Date().toISOString().slice(0, 10),
        geldigTot: geldigTot || null,
        bedragExclBtw: subtotaal,
        btwPercentage: avgBtw,
        btwBedrag: totalBtw,
        bedragInclBtw: totaalInclBtw,
        notities: notities?.trim() || null,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // Create offerte regels
    for (const regel of regels) {
      const regelTotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
      await db.insert(offerteRegels).values({
        offerteId: nieuw.id,
        omschrijving: regel.omschrijving.trim(),
        aantal: regel.aantal || 1,
        eenheidsprijs: regel.eenheidsprijs,
        btwPercentage: regel.btwPercentage ?? 21,
        totaal: Math.round(regelTotaal * 100) / 100,
      });
    }

    return NextResponse.json({ offerte: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
