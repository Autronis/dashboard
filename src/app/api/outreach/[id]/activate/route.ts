import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outreachSequenties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const seqId = parseInt(id, 10);

    const sequentie = db.select().from(outreachSequenties).where(eq(outreachSequenties.id, seqId)).get();
    if (!sequentie) {
      return NextResponse.json({ fout: "Sequentie niet gevonden" }, { status: 404 });
    }

    if (sequentie.status !== "draft" && sequentie.status !== "gepauzeerd") {
      return NextResponse.json({ fout: `Kan sequentie met status '${sequentie.status}' niet activeren` }, { status: 400 });
    }

    db.update(outreachSequenties)
      .set({ status: "actief", bijgewerktOp: new Date().toISOString() })
      .where(eq(outreachSequenties.id, seqId))
      .run();

    return NextResponse.json({ succes: true, status: "actief" });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
