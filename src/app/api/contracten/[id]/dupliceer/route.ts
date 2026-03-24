import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contracten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// POST /api/contracten/[id]/dupliceer
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [origineel] = await db
      .select()
      .from(contracten)
      .where(eq(contracten.id, Number(id)))
      .all();

    if (!origineel) {
      return NextResponse.json({ fout: "Contract niet gevonden." }, { status: 404 });
    }

    const [nieuw] = await db
      .insert(contracten)
      .values({
        klantId: origineel.klantId,
        offerteId: origineel.offerteId,
        titel: `${origineel.titel} (kopie)`,
        type: origineel.type,
        inhoud: origineel.inhoud,
        status: "concept",
        verloopdatum: origineel.verloopdatum,
        isActief: 1,
        aangemaaktDoor: gebruiker.id,
      })
      .returning()
      .all();

    return NextResponse.json({ contract: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Dupliceren mislukt" },
      { status: 500 }
    );
  }
}
