// src/app/api/proposals/[id]/accepteren/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const naam: string | undefined = body.naam;

    const [bestaand] = await db
      .select({ id: proposals.id, status: proposals.status })
      .from(proposals)
      .where(eq(proposals.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Proposal niet gevonden." }, { status: 404 });
    }

    await db
      .update(proposals)
      .set({
        status: "ondertekend",
        ondertekendOp: new Date().toISOString(),
        ondertekendDoor: naam ?? null,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(proposals.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
