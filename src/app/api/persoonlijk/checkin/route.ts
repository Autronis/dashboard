import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persoonlijkeCheckins } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// POST /api/persoonlijk/checkin
// Body: { habitId: number, gedaan: boolean }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    if (gebruiker.id !== 1) {
      return NextResponse.json({ fout: "Geen toegang" }, { status: 403 });
    }

    const body = await req.json();
    const { habitId, gedaan } = body;

    if (typeof habitId !== "number") {
      return NextResponse.json({ fout: "habitId is verplicht" }, { status: 400 });
    }

    const datum = new Date().toISOString().slice(0, 10);
    const gedaanInt = gedaan ? 1 : 0;

    // Upsert: check if exists, update or insert
    const [bestaand] = await db
      .select()
      .from(persoonlijkeCheckins)
      .where(and(eq(persoonlijkeCheckins.habitId, habitId), eq(persoonlijkeCheckins.datum, datum)))
      .limit(1);

    let checkin;
    if (bestaand) {
      [checkin] = await db
        .update(persoonlijkeCheckins)
        .set({ gedaan: gedaanInt })
        .where(eq(persoonlijkeCheckins.id, bestaand.id))
        .returning();
    } else {
      [checkin] = await db
        .insert(persoonlijkeCheckins)
        .values({ habitId, datum, gedaan: gedaanInt })
        .returning();
    }

    return NextResponse.json({ checkin });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
