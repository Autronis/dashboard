import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/facturen/[id]/betaald
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [factuur] = await db.select().from(facturen).where(eq(facturen.id, Number(id)));
    if (!factuur) {
      return NextResponse.json({ fout: "Factuur niet gevonden." }, { status: 404 });
    }

    const [bijgewerkt] = await db
      .update(facturen)
      .set({
        status: "betaald",
        betaaldOp: new Date().toISOString(),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(facturen.id, Number(id)))
      .returning();

    return NextResponse.json({ factuur: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
