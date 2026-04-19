import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { featureFlags } from "@/lib/db/schema";
import { and, eq, or, isNull } from "drizzle-orm";

// GET /api/feature-flags — returns { flags: { [naam]: boolean } } for current user
export async function GET() {
  try {
    const gebruiker = await requireAuth();
    const rows = await db
      .select()
      .from(featureFlags)
      .where(
        and(
          eq(featureFlags.actief, 1),
          or(
            isNull(featureFlags.alleenVoorGebruikerId),
            eq(featureFlags.alleenVoorGebruikerId, gebruiker.id)
          )
        )
      );
    const flags: Record<string, boolean> = {};
    for (const r of rows) flags[r.naam] = true;
    return NextResponse.json({ flags }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
