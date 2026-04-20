import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gebruikers } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { inArray } from "drizzle-orm";

// GET /api/team/avatars
// Returnt compact avatar-info voor Sem + Syb zodat de agenda swim-lane headers
// hun foto kunnen tonen (valt terug op initial als avatarUrl null is).
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const rows = await db
      .select({
        id: gebruikers.id,
        naam: gebruikers.naam,
        avatarUrl: gebruikers.avatarUrl,
      })
      .from(gebruikers)
      .where(inArray(gebruikers.id, [1, 2]));

    const avatars: Record<string, { naam: string; avatarUrl: string | null }> = {};
    for (const row of rows) {
      const key = row.id === 1 ? "sem" : row.id === 2 ? "syb" : null;
      if (key) avatars[key] = { naam: row.naam, avatarUrl: row.avatarUrl };
    }
    return NextResponse.json({ avatars });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
