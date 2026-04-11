import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verdeelRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const regelId = parseInt(id, 10);

    if (isNaN(regelId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    await db.delete(verdeelRegels).where(eq(verdeelRegels.id, regelId));
    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
