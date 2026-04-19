import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gtmRitmeSlots } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/gtm-ritme — alle actieve slots voor bridge-context.
export async function GET(req: NextRequest) {
  try {
    await requireAuthOrApiKey(req);
    const slots = await db
      .select()
      .from(gtmRitmeSlots)
      .where(eq(gtmRitmeSlots.actief, 1));
    return NextResponse.json({ slots });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
