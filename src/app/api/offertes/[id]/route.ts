import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes, offerteRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/offertes/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [offerte] = await db
      .select({
        id: offertes.id,
        klantId: offertes.klantId,
        projectId: offertes.projectId,
        offertenummer: offertes.offertenummer,
        titel: offertes.titel,
        status: offertes.status,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
        bedragExclBtw: offertes.bedragExclBtw,
        btwPercentage: offertes.btwPercentage,
        btwBedrag: offertes.btwBedrag,
        bedragInclBtw: offertes.bedragInclBtw,
        notities: offertes.notities,
        aangemaaktOp: offertes.aangemaaktOp,
        bijgewerktOp: offertes.bijgewerktOp,
        geaccepteerdOp: offertes.geaccepteerdOp,
        herinneringVerstuurdOp: offertes.herinneringVerstuurdOp,
        klantNaam: klanten.bedrijfsnaam,
        klantContactpersoon: klanten.contactpersoon,
        klantEmail: klanten.email,
        klantAdres: klanten.adres,
      })
      .from(offertes)
      .innerJoin(klanten, eq(offertes.klantId, klanten.id))
      .where(eq(offertes.id, Number(id)));

    if (!offerte) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }

    const regels = await db
      .select()
      .from(offerteRegels)
      .where(eq(offerteRegels.offerteId, Number(id)));

    return NextResponse.json({ offerte, regels });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/offertes/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [bestaand] = await db.select().from(offertes).where(eq(offertes.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }
    if (bestaand.status !== "concept") {
      return NextResponse.json({ fout: "Alleen conceptoffertes kunnen bewerkt worden." }, { status: 400 });
    }

    const { klantId, projectId, titel, datum, geldigTot, notities, regels } = body;

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };

    if (klantId !== undefined) updateData.klantId = klantId;
    if (projectId !== undefined) updateData.projectId = projectId || null;
    if (titel !== undefined) updateData.titel = titel?.trim() || null;
    if (datum !== undefined) updateData.datum = datum;
    if (geldigTot !== undefined) updateData.geldigTot = geldigTot || null;
    if (notities !== undefined) updateData.notities = notities?.trim() || null;

    if (regels && regels.length > 0) {
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
      const avgBtw = subtotaal > 0 ? Math.round((totalBtw / subtotaal) * 10000) / 100 : 21;

      updateData.bedragExclBtw = subtotaal;
      updateData.btwPercentage = avgBtw;
      updateData.btwBedrag = totalBtw;
      updateData.bedragInclBtw = totaalInclBtw;

      // Delete old regels and insert new ones
      await db.delete(offerteRegels).where(eq(offerteRegels.offerteId, Number(id)));
      for (const regel of regels) {
        const regelTotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
        await db.insert(offerteRegels).values({
          offerteId: Number(id),
          omschrijving: regel.omschrijving.trim(),
          aantal: regel.aantal || 1,
          eenheidsprijs: regel.eenheidsprijs,
          btwPercentage: regel.btwPercentage ?? 21,
          totaal: Math.round(regelTotaal * 100) / 100,
        });
      }
    }

    const [bijgewerkt] = await db
      .update(offertes)
      .set(updateData)
      .where(eq(offertes.id, Number(id)))
      .returning();

    return NextResponse.json({ offerte: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/offertes/[id] — Soft delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [bestaand] = await db.select().from(offertes).where(eq(offertes.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }

    await db
      .update(offertes)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(offertes.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PATCH /api/offertes/[id] — Update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ fout: "Status is verplicht." }, { status: 400 });
    }

    const validStatuses = ["concept", "verzonden", "geaccepteerd", "verlopen", "afgewezen"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ fout: "Ongeldige status." }, { status: 400 });
    }

    const [bestaand] = await db.select().from(offertes).where(eq(offertes.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Offerte niet gevonden." }, { status: 404 });
    }

    const [bijgewerkt] = await db
      .update(offertes)
      .set({
        status: status as "concept" | "verzonden" | "geaccepteerd" | "verlopen" | "afgewezen",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(offertes.id, Number(id)))
      .returning();

    return NextResponse.json({ offerte: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
