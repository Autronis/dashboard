import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { autoInstellingen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/kilometers/instellingen
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    let [inst] = await db
      .select()
      .from(autoInstellingen)
      .where(eq(autoInstellingen.gebruikerId, gebruiker.id))
      .limit(1);

    // Create default if not exists
    if (!inst) {
      [inst] = await db
        .insert(autoInstellingen)
        .values({ gebruikerId: gebruiker.id })
        .returning();
    }

    return NextResponse.json({
      instellingen: {
        zakelijkPercentage: inst.zakelijkPercentage ?? 75,
        tariefPerKm: inst.tariefPerKm ?? 0.23,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/kilometers/instellingen
export async function PUT(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { zakelijkPercentage, tariefPerKm } = await req.json();

    if (zakelijkPercentage != null && (zakelijkPercentage < 0 || zakelijkPercentage > 100)) {
      return NextResponse.json({ fout: "Zakelijk percentage moet tussen 0 en 100 liggen." }, { status: 400 });
    }

    if (tariefPerKm != null && tariefPerKm < 0) {
      return NextResponse.json({ fout: "Tarief per km kan niet negatief zijn." }, { status: 400 });
    }

    // Upsert
    const [bestaand] = await db
      .select({ id: autoInstellingen.id })
      .from(autoInstellingen)
      .where(eq(autoInstellingen.gebruikerId, gebruiker.id))
      .limit(1);

    const updates: Record<string, number | string> = { bijgewerktOp: new Date().toISOString() };
    if (zakelijkPercentage != null) updates.zakelijkPercentage = zakelijkPercentage;
    if (tariefPerKm != null) updates.tariefPerKm = tariefPerKm;

    if (bestaand) {
      const [updated] = await db
        .update(autoInstellingen)
        .set(updates)
        .where(eq(autoInstellingen.id, bestaand.id))
        .returning();
      return NextResponse.json({ instellingen: updated });
    }

    const [nieuw] = await db
      .insert(autoInstellingen)
      .values({
        gebruikerId: gebruiker.id,
        zakelijkPercentage: zakelijkPercentage ?? 75,
        tariefPerKm: tariefPerKm ?? 0.23,
      })
      .returning();

    return NextResponse.json({ instellingen: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
