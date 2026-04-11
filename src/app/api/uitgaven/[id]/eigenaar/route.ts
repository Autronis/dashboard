import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uitgaven } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const uitgaveId = parseInt(id, 10);

    if (isNaN(uitgaveId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json();
    const { eigenaar, splitRatio } = body;

    if (!eigenaar || !["sem", "syb", "gedeeld"].includes(eigenaar)) {
      return NextResponse.json({ fout: "Eigenaar moet 'sem', 'syb' of 'gedeeld' zijn" }, { status: 400 });
    }

    await db
      .update(uitgaven)
      .set({ eigenaar, splitRatio: splitRatio ?? null })
      .where(eq(uitgaven.id, uitgaveId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
