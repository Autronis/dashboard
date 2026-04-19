import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, klanten, projecten, leadActiviteiten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/klant-leads/[id]/start-project
// Promoveert een Turso klant-lead naar een echt project bij klant-akkoord:
//   1. Klant aanmaken (of hergebruiken op bedrijfsnaam match)
//   2. Project aanmaken met klantId + leadId FK
//   3. Lead status -> "gewonnen" + activiteit-log
//
// Body:
//   eigenaar: "sem" | "syb" | "team" | "vrij"   (verplicht)
//   naam?:    string                             (default = lead.bedrijfsnaam)
//   omschrijving?: string
//   uurtarief?: number                           (default 95 bij nieuwe klant)
//
// Response:
//   { lead, klant, project }
//
// Sales-artefacten (scans, outreach, pitch-mail) blijven op leadId en zijn
// vanaf het project te joinen via projecten.leadId = leads.id.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { id } = await params;
    const leadId = Number(id);
    if (!leadId) {
      return NextResponse.json({ fout: "Ongeldige lead id." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const eigenaar = body.eigenaar as "sem" | "syb" | "team" | "vrij" | undefined;
    if (!eigenaar || !["sem", "syb", "team", "vrij"].includes(eigenaar)) {
      return NextResponse.json(
        { fout: "Eigenaar is verplicht: sem | syb | team | vrij." },
        { status: 400 }
      );
    }

    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!lead) {
      return NextResponse.json({ fout: "Lead niet gevonden." }, { status: 404 });
    }

    // Guard: lead al gepromoveerd?
    const bestaand = await db
      .select({ id: projecten.id, naam: projecten.naam })
      .from(projecten)
      .where(eq(projecten.leadId, leadId));
    if (bestaand.length > 0) {
      return NextResponse.json(
        { fout: `Lead is al gepromoveerd naar project '${bestaand[0].naam}' (id ${bestaand[0].id}).`, projectId: bestaand[0].id },
        { status: 409 }
      );
    }

    // Klant: match op bedrijfsnaam, anders nieuw aanmaken
    let klant = await db
      .select()
      .from(klanten)
      .where(eq(klanten.bedrijfsnaam, lead.bedrijfsnaam))
      .get();

    if (!klant) {
      const [nieuw] = await db
        .insert(klanten)
        .values({
          bedrijfsnaam: lead.bedrijfsnaam,
          contactpersoon: lead.contactpersoon ?? null,
          email: lead.email ?? null,
          telefoon: lead.telefoon ?? null,
          uurtarief: typeof body.uurtarief === "number" ? body.uurtarief : 95,
          aangemaaktDoor: gebruiker.id,
        })
        .returning();
      klant = nieuw;
    }

    if (!klant) {
      return NextResponse.json({ fout: "Kon klant niet aanmaken." }, { status: 500 });
    }

    const projectNaam = (body.naam as string | undefined)?.trim() || lead.bedrijfsnaam;
    const omschrijving =
      (body.omschrijving as string | undefined)?.trim() ||
      lead.notities ||
      `Project gestart vanuit lead #${lead.id} (${lead.bedrijfsnaam}).`;

    const [project] = await db
      .insert(projecten)
      .values({
        klantId: klant.id,
        leadId: lead.id,
        naam: projectNaam,
        omschrijving,
        status: "actief",
        eigenaar,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    await db
      .update(leads)
      .set({
        status: "gewonnen",
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(leads.id, lead.id));

    await db.insert(leadActiviteiten).values({
      leadId: lead.id,
      gebruikerId: gebruiker.id,
      type: "notitie",
      inhoud: `Gepromoveerd naar project '${projectNaam}' (id ${project.id}). Klant: ${klant.bedrijfsnaam} (id ${klant.id}).`,
    });

    return NextResponse.json(
      { lead: { ...lead, status: "gewonnen" }, klant, project },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
