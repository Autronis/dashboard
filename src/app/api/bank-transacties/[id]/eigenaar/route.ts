import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const transactieId = parseInt(id, 10);

    if (isNaN(transactieId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json();
    const { eigenaar, splitRatio } = body;

    if (!eigenaar || !["sem", "syb", "gedeeld"].includes(eigenaar)) {
      return NextResponse.json({ fout: "Eigenaar moet 'sem', 'syb' of 'gedeeld' zijn" }, { status: 400 });
    }

    await db
      .update(bankTransacties)
      .set({ eigenaar, splitRatio: splitRatio ?? null })
      .where(eq(bankTransacties.id, transactieId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
