import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes, offerteRegels, facturen, factuurRegels, klanten, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, like } from "drizzle-orm";

// POST /api/offertes/[id]/converteer — Convert offerte to factuur + project
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [offerte] = await db
      .select()
      .from(offertes)
      .where(eq(offertes.id, Number(id)));

    if (!offerte) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }

    if (offerte.status !== "geaccepteerd") {
      return NextResponse.json(
        { fout: "Alleen geaccepteerde offertes kunnen geconverteerd worden." },
        { status: 400 }
      );
    }

    // 1. Activate klant if not already active
    await db
      .update(klanten)
      .set({ isActief: 1, bijgewerktOp: new Date().toISOString() })
      .where(eq(klanten.id, offerte.klantId!));

    // 2. Create project based on offerte
    const projectNaam = offerte.titel || `Project ${offerte.offertenummer}`;
    const [nieuwProject] = await db
      .insert(projecten)
      .values({
        klantId: offerte.klantId,
        naam: projectNaam,
        omschrijving: offerte.scope || offerte.deliverables || undefined,
        status: "actief",
        voortgangPercentage: 0,
        geschatteUren: offerte.type === "per_uur" ? undefined : undefined,
        deadline: offerte.tijdlijn || undefined,
        isActief: 1,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // Update offerte with the new project ID
    await db
      .update(offertes)
      .set({ projectId: nieuwProject.id })
      .where(eq(offertes.id, Number(id)));

    // 3. Generate factuurnummer: AUT-YYYY-NNN
    const jaar = new Date().getFullYear();
    const [laatsteFactuur] = await db
      .select({ factuurnummer: facturen.factuurnummer })
      .from(facturen)
      .where(like(facturen.factuurnummer, `AUT-${jaar}-%`))
      .orderBy(desc(facturen.factuurnummer))
      .limit(1);

    let volgnummer = 1;
    if (laatsteFactuur) {
      const parts = laatsteFactuur.factuurnummer.split("-");
      volgnummer = parseInt(parts[2], 10) + 1;
    }
    const factuurnummer = `AUT-${jaar}-${volgnummer.toString().padStart(3, "0")}`;

    const vandaag = new Date().toISOString().slice(0, 10);
    const vervalDatum = new Date();
    vervalDatum.setDate(vervalDatum.getDate() + 30);

    // 4. Create factuur in concept status
    const [nieuweFactuur] = await db
      .insert(facturen)
      .values({
        klantId: offerte.klantId,
        projectId: nieuwProject.id,
        factuurnummer,
        status: "concept",
        bedragExclBtw: offerte.bedragExclBtw || 0,
        btwPercentage: offerte.btwPercentage,
        btwBedrag: offerte.btwBedrag,
        bedragInclBtw: offerte.bedragInclBtw,
        factuurdatum: vandaag,
        vervaldatum: vervalDatum.toISOString().slice(0, 10),
        notities: offerte.notities,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // 5. Copy offerte regels to factuur regels
    const regels = await db
      .select()
      .from(offerteRegels)
      .where(eq(offerteRegels.offerteId, Number(id)));

    for (const regel of regels) {
      await db.insert(factuurRegels).values({
        factuurId: nieuweFactuur.id,
        omschrijving: regel.omschrijving,
        aantal: regel.aantal,
        eenheidsprijs: regel.eenheidsprijs,
        btwPercentage: regel.btwPercentage,
        totaal: regel.totaal,
      });
    }

    return NextResponse.json(
      {
        projectId: nieuwProject.id,
        factuurId: nieuweFactuur.id,
        factuurnummer,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
