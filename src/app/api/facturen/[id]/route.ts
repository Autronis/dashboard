import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen, factuurRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/facturen/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [factuur] = await db
      .select({
        id: facturen.id,
        klantId: facturen.klantId,
        projectId: facturen.projectId,
        factuurnummer: facturen.factuurnummer,
        status: facturen.status,
        bedragExclBtw: facturen.bedragExclBtw,
        btwPercentage: facturen.btwPercentage,
        btwBedrag: facturen.btwBedrag,
        bedragInclBtw: facturen.bedragInclBtw,
        factuurdatum: facturen.factuurdatum,
        vervaldatum: facturen.vervaldatum,
        betaaldOp: facturen.betaaldOp,
        notities: facturen.notities,
        aangemaaktOp: facturen.aangemaaktOp,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
        klantAdres: klanten.adres,
        klantTaal: klanten.taal,
      })
      .from(facturen)
      .innerJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(eq(facturen.id, Number(id)));

    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden." }, { status: 404 });
    }

    const regels = await db
      .select()
      .from(factuurRegels)
      .where(eq(factuurRegels.factuurId, Number(id)));

    return NextResponse.json({ factuur, regels });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/facturen/[id] — Update (alleen concept)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [bestaand] = await db.select().from(facturen).where(eq(facturen.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Factuur niet gevonden." }, { status: 404 });
    }
    if (bestaand.status !== "concept") {
      return NextResponse.json({ fout: "Alleen conceptfacturen kunnen bewerkt worden." }, { status: 400 });
    }

    const { klantId, projectId, factuurnummer, factuurdatum, vervaldatum, btwPercentage, notities, regels,
      isTerugkerend, terugkeerAantal, terugkeerEenheid, volgendeFactuurdatum } = body;

    // Recalculate totals if regels provided
    let updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };

    if (klantId !== undefined) updateData.klantId = klantId;
    if (projectId !== undefined) updateData.projectId = projectId || null;
    if (factuurnummer !== undefined) updateData.factuurnummer = factuurnummer;
    if (factuurdatum !== undefined) updateData.factuurdatum = factuurdatum;
    if (vervaldatum !== undefined) updateData.vervaldatum = vervaldatum;
    if (btwPercentage !== undefined) updateData.btwPercentage = btwPercentage;
    if (notities !== undefined) updateData.notities = notities?.trim() || null;

    if (isTerugkerend !== undefined) {
      updateData.isTerugkerend = isTerugkerend ? 1 : 0;
      updateData.terugkeerAantal = isTerugkerend ? (terugkeerAantal || 1) : null;
      updateData.terugkeerEenheid = isTerugkerend ? terugkeerEenheid : null;
      updateData.terugkeerStatus = isTerugkerend ? "actief" : null;
      updateData.volgendeFactuurdatum = isTerugkerend ? volgendeFactuurdatum : null;
    }

    if (regels && regels.length > 0) {
      const btwPct = btwPercentage ?? bestaand.btwPercentage ?? 21;
      let subtotaal = 0;
      for (const regel of regels) {
        subtotaal += (regel.aantal || 1) * (regel.eenheidsprijs || 0);
      }
      const btwBedragVal = Math.round(subtotaal * (btwPct / 100) * 100) / 100;
      updateData.bedragExclBtw = Math.round(subtotaal * 100) / 100;
      updateData.btwBedrag = btwBedragVal;
      updateData.bedragInclBtw = Math.round((subtotaal + btwBedragVal) * 100) / 100;

      // Delete old regels and insert new ones
      await db.delete(factuurRegels).where(eq(factuurRegels.factuurId, Number(id)));
      for (const regel of regels) {
        const regelTotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
        await db.insert(factuurRegels).values({
          factuurId: Number(id),
          omschrijving: regel.omschrijving.trim(),
          aantal: regel.aantal || 1,
          eenheidsprijs: regel.eenheidsprijs,
          btwPercentage: regel.btwPercentage ?? btwPct,
          totaal: Math.round(regelTotaal * 100) / 100,
        });
      }
    }

    const [bijgewerkt] = await db
      .update(facturen)
      .set(updateData)
      .where(eq(facturen.id, Number(id)))
      .returning();

    return NextResponse.json({ factuur: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/facturen/[id] — Soft delete (alleen concept)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [bestaand] = await db.select().from(facturen).where(eq(facturen.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Factuur niet gevonden." }, { status: 404 });
    }
    if (bestaand.status !== "concept") {
      return NextResponse.json({ fout: "Alleen conceptfacturen kunnen verwijderd worden." }, { status: 400 });
    }

    await db
      .update(facturen)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(facturen.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
