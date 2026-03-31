import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/bank/transacties/[id] — Update category or match to factuur
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const transactieId = parseInt(id);
    const body = await req.json();

    const { categorie, gekoppeldFactuurId, fiscaalType, bonPad } = body;

    const updateData: Record<string, unknown> = {};

    if (categorie !== undefined) {
      updateData.categorie = categorie;
      updateData.status = "gecategoriseerd";
    }

    if (gekoppeldFactuurId !== undefined) {
      updateData.gekoppeldFactuurId = gekoppeldFactuurId;
      updateData.status = "gematcht";
    }

    if (fiscaalType !== undefined) {
      updateData.fiscaalType = fiscaalType;
    }

    if (bonPad !== undefined) {
      updateData.bonPad = bonPad;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken." }, { status: 400 });
    }

    const [bijgewerkt] = await db
      .update(bankTransacties)
      .set(updateData)
      .where(eq(bankTransacties.id, transactieId))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Transactie niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ transactie: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
