import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, factuurRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, sql, like, or } from "drizzle-orm";

// GET /api/facturen?status=verzonden&zoek=AUT
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const zoek = searchParams.get("zoek");

    const conditions = [eq(facturen.isActief, 1)];
    if (status) {
      conditions.push(eq(facturen.status, status as "concept" | "verzonden" | "betaald" | "te_laat"));
    }

    let query = db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        klantId: facturen.klantId,
        klantNaam: klanten.bedrijfsnaam,
        status: facturen.status,
        bedragExclBtw: facturen.bedragExclBtw,
        btwBedrag: facturen.btwBedrag,
        bedragInclBtw: facturen.bedragInclBtw,
        factuurdatum: facturen.factuurdatum,
        vervaldatum: facturen.vervaldatum,
        betaaldOp: facturen.betaaldOp,
        aangemaaktOp: facturen.aangemaaktOp,
      })
      .from(facturen)
      .innerJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(and(...conditions))
      .orderBy(desc(facturen.factuurdatum))
      .$dynamic();

    if (zoek) {
      query = query.where(
        and(
          ...conditions,
          or(
            like(facturen.factuurnummer, `%${zoek}%`),
            like(klanten.bedrijfsnaam, `%${zoek}%`)
          )
        )
      );
    }

    const lijst = await query;

    // KPIs
    const alleFacturen = await db
      .select({
        status: facturen.status,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
        betaaldOp: facturen.betaaldOp,
      })
      .from(facturen)
      .where(eq(facturen.isActief, 1));

    const nu = new Date();
    const eersteVanMaand = new Date(nu.getFullYear(), nu.getMonth(), 1).toISOString();

    const kpis = {
      openstaand: 0,
      betaaldDezeMaand: 0,
      teLaat: 0,
      totaal: alleFacturen.length,
    };

    for (const f of alleFacturen) {
      if (f.status === "verzonden") {
        kpis.openstaand += f.bedragInclBtw || 0;
        if (f.vervaldatum && f.vervaldatum < nu.toISOString().slice(0, 10)) {
          kpis.teLaat++;
        }
      }
      if (f.status === "betaald" && f.betaaldOp && f.betaaldOp >= eersteVanMaand) {
        kpis.betaaldDezeMaand += f.bedragInclBtw || 0;
      }
    }

    return NextResponse.json({ facturen: lijst, kpis }, {
      headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=600" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/facturen
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const {
      klantId,
      projectId,
      factuurnummer,
      factuurdatum,
      vervaldatum,
      btwPercentage,
      notities,
      regels,
    } = body;

    if (!klantId) {
      return NextResponse.json({ fout: "Klant is verplicht." }, { status: 400 });
    }

    if (!regels || regels.length === 0) {
      return NextResponse.json({ fout: "Minimaal één factuurregel is verplicht." }, { status: 400 });
    }

    // Generate factuurnummer if not provided
    let nummer = factuurnummer;
    if (!nummer) {
      const jaar = new Date().getFullYear();
      const [laatste] = await db
        .select({ factuurnummer: facturen.factuurnummer })
        .from(facturen)
        .where(like(facturen.factuurnummer, `AUT-${jaar}-%`))
        .orderBy(desc(facturen.factuurnummer))
        .limit(1);

      let volgnummer = 1;
      if (laatste) {
        const parts = laatste.factuurnummer.split("-");
        volgnummer = parseInt(parts[2], 10) + 1;
      }
      nummer = `AUT-${jaar}-${volgnummer.toString().padStart(3, "0")}`;
    }

    // Calculate totals
    const btwPct = btwPercentage ?? 21;
    let subtotaal = 0;
    for (const regel of regels) {
      subtotaal += (regel.aantal || 1) * (regel.eenheidsprijs || 0);
    }
    const btwBedragVal = Math.round(subtotaal * (btwPct / 100) * 100) / 100;
    const totaalInclBtw = Math.round((subtotaal + btwBedragVal) * 100) / 100;

    // Create factuur
    const [nieuw] = await db
      .insert(facturen)
      .values({
        klantId,
        projectId: projectId || null,
        factuurnummer: nummer,
        status: "concept",
        bedragExclBtw: Math.round(subtotaal * 100) / 100,
        btwPercentage: btwPct,
        btwBedrag: btwBedragVal,
        bedragInclBtw: totaalInclBtw,
        factuurdatum: factuurdatum || new Date().toISOString().slice(0, 10),
        vervaldatum: vervaldatum || null,
        notities: notities?.trim() || null,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // Create factuurregels
    for (const regel of regels) {
      const regelTotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
      await db.insert(factuurRegels).values({
        factuurId: nieuw.id,
        omschrijving: regel.omschrijving.trim(),
        aantal: regel.aantal || 1,
        eenheidsprijs: regel.eenheidsprijs,
        btwPercentage: regel.btwPercentage ?? btwPct,
        totaal: Math.round(regelTotaal * 100) / 100,
      });
    }

    return NextResponse.json({ factuur: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
