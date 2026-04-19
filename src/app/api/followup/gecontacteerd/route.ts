import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notities, leadActiviteiten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

// POST /api/followup/gecontacteerd — one-click "Ik heb ze gecontacteerd".
// Klant → logt een notitie. Lead → logt een lead-activiteit.
// De follow-up tracker ziet dit bij de volgende render als recent contact en haalt de rij uit dringend.
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { contactType, contactId, opmerking, via } = await req.json();

    if (!contactType || !contactId) {
      return NextResponse.json({ fout: "contactType en contactId zijn verplicht." }, { status: 400 });
    }
    if (contactType !== "klant" && contactType !== "lead") {
      return NextResponse.json({ fout: "contactType moet 'klant' of 'lead' zijn." }, { status: 400 });
    }

    const kanaal = typeof via === "string" && via.trim() ? via.trim() : "dashboard";
    const extra = typeof opmerking === "string" && opmerking.trim() ? ` — ${opmerking.trim()}` : "";

    if (contactType === "klant") {
      const [rij] = await db
        .insert(notities)
        .values({
          klantId: Number(contactId),
          gebruikerId: gebruiker.id,
          inhoud: `Follow-up bijgewerkt via ${kanaal}${extra}`,
          type: "notitie",
        })
        .returning();
      return NextResponse.json({ succes: true, notitieId: rij.id });
    }

    const [rij] = await db
      .insert(leadActiviteiten)
      .values({
        leadId: Number(contactId),
        gebruikerId: gebruiker.id,
        type: "notitie_toegevoegd",
        titel: "Follow-up bijgewerkt",
        omschrijving: `via ${kanaal}${extra}`,
      })
      .returning();
    return NextResponse.json({ succes: true, activiteitId: rij.id });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
