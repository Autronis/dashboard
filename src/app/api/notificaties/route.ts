import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificaties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";

// GET /api/notificaties — alle notificaties voor huidige gebruiker
export async function GET() {
  try {
    const gebruiker = await requireAuth();

    const rows = await db
      .select()
      .from(notificaties)
      .where(eq(notificaties.gebruikerId, gebruiker.id))
      .orderBy(desc(notificaties.aangemaaktOp));

    const [ongelezen] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notificaties)
      .where(
        and(
          eq(notificaties.gebruikerId, gebruiker.id),
          eq(notificaties.gelezen, 0)
        )
      );

    return NextResponse.json({
      notificaties: rows,
      ongelezen: ongelezen?.count || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/notificaties — alles als gelezen markeren
export async function PUT() {
  try {
    const gebruiker = await requireAuth();

    await db
      .update(notificaties)
      .set({ gelezen: 1 })
      .where(
        and(
          eq(notificaties.gebruikerId, gebruiker.id),
          eq(notificaties.gelezen, 0)
        )
      );

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
