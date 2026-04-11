import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openstaandeVerrekeningen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const verrekeningId = parseInt(id, 10);

    if (isNaN(verrekeningId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json();
    const betaald = body.betaald ? 1 : 0;
    const betaaldOp = betaald ? new Date().toISOString().split("T")[0] : null;

    await db
      .update(openstaandeVerrekeningen)
      .set({ betaald, betaaldOp })
      .where(eq(openstaandeVerrekeningen.id, verrekeningId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
