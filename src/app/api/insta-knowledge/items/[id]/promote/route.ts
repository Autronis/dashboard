import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createIdeaFromItem } from "@/lib/insta-knowledge/idea";
import type { AnalysisResult } from "@/lib/insta-knowledge/types";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });
  const { id } = await ctx.params;

  const res = await tursoClient.execute({
    sql: `SELECT i.instagram_id, i.url, i.type, i.author_handle,
                 a.id AS analysis_id, a.summary, a.features, a.steps, a.tips, a.links,
                 a.relevance_score, a.relevance_reason
          FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id
          WHERE i.id = ?`,
    args: [id],
  });
  if (!res.rows.length) return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
  const r = res.rows[0];
  if (!r.summary) return NextResponse.json({ fout: "Nog geen analyse beschikbaar" }, { status: 409 });

  const analysis: AnalysisResult = {
    idea_title: (r.summary as string).split(/[.!?]/)[0].slice(0, 120) || "Idee uit Instagram",
    summary: r.summary as string,
    features: JSON.parse((r.features as string) || "[]"),
    steps: JSON.parse((r.steps as string) || "[]"),
    tips: JSON.parse((r.tips as string) || "[]"),
    links: JSON.parse((r.links as string) || "[]"),
    relevance_score: Number(r.relevance_score) || 0,
    relevance_reason: (r.relevance_reason as string) || "",
  };

  const result = await createIdeaFromItem(
    {
      instagramId: r.instagram_id as string,
      url: r.url as string,
      authorHandle: (r.author_handle as string) || "",
      type: r.type as "reel" | "post",
    },
    analysis,
    (r.analysis_id as string) || "",
  );

  return NextResponse.json({ succes: true, ...result });
}
