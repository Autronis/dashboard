import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openstaandeVerrekeningen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const verrekeningen = await db
      .select()
      .from(openstaandeVerrekeningen)
      .orderBy(openstaandeVerrekeningen.aangemaaktOp);
    return NextResponse.json({ verrekeningen });
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
    const { omschrijving, bedrag, vanGebruikerId, naarGebruikerId } = body;

    if (!omschrijving || bedrag == null || !vanGebruikerId || !naarGebruikerId) {
      return NextResponse.json({ fout: "Alle velden zijn verplicht" }, { status: 400 });
    }

    const result = await db.insert(openstaandeVerrekeningen).values({
      omschrijving,
      bedrag: Number(bedrag),
      vanGebruikerId: Number(vanGebruikerId),
      naarGebruikerId: Number(naarGebruikerId),
    });

    return NextResponse.json({
      verrekening: {
        id: Number(result.lastInsertRowid),
        omschrijving,
        bedrag: Number(bedrag),
        vanGebruikerId: Number(vanGebruikerId),
        naarGebruikerId: Number(naarGebruikerId),
        betaald: 0,
        betaaldOp: null,
      }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
