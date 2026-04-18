import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { processItem } from "@/lib/insta-knowledge/worker";

export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });
  const { id } = await ctx.params;

  const upd = await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'pending', failure_reason = NULL WHERE id = ? AND status IN ('failed','done')",
    args: [id],
  });
  if (upd.rowsAffected === 0) {
    return NextResponse.json({ fout: "Item niet gevonden of al pending/processing" }, { status: 409 });
  }

  after(async () => { try { await processItem(id); } catch { /* noop */ } });
  return NextResponse.json({ succes: true, id, status: "pending" });
}
