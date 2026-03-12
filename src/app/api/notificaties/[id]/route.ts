import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificaties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// PUT /api/notificaties/[id] — markeer als gelezen
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [bijgewerkt] = await db
      .update(notificaties)
      .set({ gelezen: 1 })
      .where(
        and(
          eq(notificaties.id, Number(id)),
          eq(notificaties.gebruikerId, gebruiker.id)
        )
      )
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Notificatie niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ notificatie: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
