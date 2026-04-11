import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verdeelRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();
    const regels = await db.select().from(verdeelRegels).orderBy(verdeelRegels.type);
    return NextResponse.json({ regels });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { type, waarde, eigenaar, splitRatio } = body;

    if (!type || !waarde || !eigenaar || !splitRatio) {
      return NextResponse.json({ fout: "Alle velden zijn verplicht" }, { status: 400 });
    }

    if (!["leverancier", "categorie"].includes(type)) {
      return NextResponse.json({ fout: "Type moet 'leverancier' of 'categorie' zijn" }, { status: 400 });
    }

    if (!["sem", "syb", "gedeeld"].includes(eigenaar)) {
      return NextResponse.json({ fout: "Eigenaar moet 'sem', 'syb' of 'gedeeld' zijn" }, { status: 400 });
    }

    // Upsert: update if exists, insert if not
    const existing = await db
      .select()
      .from(verdeelRegels)
      .where(and(eq(verdeelRegels.type, type), eq(verdeelRegels.waarde, waarde)))
      .get();

    if (existing) {
      await db
        .update(verdeelRegels)
        .set({ eigenaar, splitRatio })
        .where(eq(verdeelRegels.id, existing.id));
      return NextResponse.json({ regel: { ...existing, eigenaar, splitRatio } });
    }

    const result = await db.insert(verdeelRegels).values({ type, waarde, eigenaar, splitRatio });
    return NextResponse.json({ regel: { id: Number(result.lastInsertRowid), type, waarde, eigenaar, splitRatio } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
