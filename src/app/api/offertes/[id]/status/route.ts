import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { offertes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

const GELDIGE_STATUSSEN = ["concept", "verzonden", "geaccepteerd", "verlopen", "afgewezen"] as const;
type OfferteStatus = (typeof GELDIGE_STATUSSEN)[number];

// PUT /api/offertes/[id]/status
// Body: { status: "verzonden" | "geaccepteerd" | "afgewezen" | ... }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const { status } = (await req.json()) as { status: string };

    if (!GELDIGE_STATUSSEN.includes(status as OfferteStatus)) {
      return NextResponse.json({ fout: "Ongeldige status" }, { status: 400 });
    }

    const [bestaand] = await db
      .select({ id: offertes.id, status: offertes.status })
      .from(offertes)
      .where(eq(offertes.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Offerte niet gevonden" }, { status: 404 });
    }

    const [bijgewerkt] = await db
      .update(offertes)
      .set({
        status: status as OfferteStatus,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(offertes.id, Number(id)))
      .returning();

    return NextResponse.json({ offerte: bijgewerkt });
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
