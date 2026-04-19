import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeActiesBridge } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

// GET /api/cron/slimme-acties-cleanup — dagelijks 04:00 UTC via Vercel cron.
// Verwijdert rijen waar verloopt_op < nu (standaard set op start_of_tomorrow
// + 48h bij insert, dus actuele acties blijven bestaan).
export async function GET() {
  try {
    const nu = new Date().toISOString();
    const result = await db
      .delete(slimmeActiesBridge)
      .where(lt(slimmeActiesBridge.verlooptOp, nu))
      .returning({ id: slimmeActiesBridge.id });
    return NextResponse.json({ verwijderd: result.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
