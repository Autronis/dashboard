import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });
  const { id } = await ctx.params;
  await tursoClient.execute({ sql: "DELETE FROM isk_analyses WHERE item_id = ?", args: [id] });
  await tursoClient.execute({ sql: "DELETE FROM isk_items WHERE id = ?", args: [id] });
  return NextResponse.json({ succes: true });
}
