import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeActiesBridge } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// DELETE /api/slimme-acties-bridge/[id] — user dismisses a bridge-generated action.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (!Number.isFinite(idNum)) {
      return NextResponse.json({ fout: "Ongeldig id." }, { status: 400 });
    }
    const result = await db
      .delete(slimmeActiesBridge)
      .where(eq(slimmeActiesBridge.id, idNum))
      .returning({ id: slimmeActiesBridge.id });
    if (result.length === 0) {
      return NextResponse.json({ fout: "Niet gevonden." }, { status: 404 });
    }
    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
