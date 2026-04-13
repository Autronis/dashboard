import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals, proposalRegels, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { parseSlides, slidesSchema } from "@/lib/proposal-schema";

// GET /api/proposals/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [proposal] = await db
      .select({
        id: proposals.id,
        klantId: proposals.klantId,
        klantNaam: klanten.bedrijfsnaam,
        klantEmail: klanten.email,
        klantContactpersoon: klanten.contactpersoon,
        klantAdres: klanten.adres,
        titel: proposals.titel,
        status: proposals.status,
        secties: proposals.secties,
        totaalBedrag: proposals.totaalBedrag,
        geldigTot: proposals.geldigTot,
        token: proposals.token,
        ondertekendOp: proposals.ondertekendOp,
        ondertekendDoor: proposals.ondertekendDoor,
        ondertekening: proposals.ondertekening,
        aangemaaktDoor: proposals.aangemaaktDoor,
        aangemaaktOp: proposals.aangemaaktOp,
        bijgewerktOp: proposals.bijgewerktOp,
      })
      .from(proposals)
      .innerJoin(klanten, eq(proposals.klantId, klanten.id))
      .where(eq(proposals.id, Number(id)));

    if (!proposal) {
      return NextResponse.json({ fout: "Proposal niet gevonden." }, { status: 404 });
    }

    const regels = await db
      .select()
      .from(proposalRegels)
      .where(eq(proposalRegels.proposalId, Number(id)));

    const slides = parseSlides(proposal.secties);
    return NextResponse.json({
      proposal: {
        ...proposal,
        secties: slides, // now always the new shape
      },
      regels,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/proposals/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [bestaand] = await db
      .select({ status: proposals.status })
      .from(proposals)
      .where(eq(proposals.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Proposal niet gevonden." }, { status: 404 });
    }
    if (bestaand.status !== "concept") {
      return NextResponse.json(
        { fout: "Alleen concepten kunnen bewerkt worden." },
        { status: 400 }
      );
    }

    const { klantId, titel, secties, geldigTot, regels } = body;

    // Validate slides
    if (secties !== undefined) {
      const slidesResult = slidesSchema.safeParse(secties);
      if (!slidesResult.success) {
        return NextResponse.json(
          { fout: "Ongeldige slide structuur: " + slidesResult.error.issues[0]?.message },
          { status: 400 }
        );
      }
    }

    // Calculate total
    let totaalBedrag = 0;
    if (regels && Array.isArray(regels)) {
      for (const regel of regels) {
        totaalBedrag += (regel.aantal || 1) * (regel.eenheidsprijs || 0);
      }
    }
    totaalBedrag = Math.round(totaalBedrag * 100) / 100;

    await db
      .update(proposals)
      .set({
        klantId: klantId ?? undefined,
        titel: titel?.trim() ?? undefined,
        secties: secties ? JSON.stringify(secties) : undefined,
        totaalBedrag,
        geldigTot: geldigTot ?? undefined,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(proposals.id, Number(id)));

    // Replace regels
    if (regels && Array.isArray(regels)) {
      await db.delete(proposalRegels).where(eq(proposalRegels.proposalId, Number(id)));
      for (const regel of regels) {
        const regelTotaal = (regel.aantal || 1) * (regel.eenheidsprijs || 0);
        await db.insert(proposalRegels).values({
          proposalId: Number(id),
          omschrijving: (regel.omschrijving || "").trim(),
          aantal: regel.aantal || 1,
          eenheidsprijs: regel.eenheidsprijs || 0,
          totaal: Math.round(regelTotaal * 100) / 100,
        });
      }
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/proposals/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [bestaand] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(eq(proposals.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Proposal niet gevonden." }, { status: 404 });
    }

    await db.delete(proposalRegels).where(eq(proposalRegels.proposalId, Number(id)));
    await db.delete(proposals).where(eq(proposals.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
