// src/app/api/insta-knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { parseInstagramUrl } from "@/lib/insta-knowledge/scrape";
import { processItem } from "@/lib/insta-knowledge/worker";

export const maxDuration = 60;

export async function GET() {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

  const [itemsRes, statsRes] = await Promise.all([
    tursoClient.execute(
      "SELECT i.id, i.instagram_id, i.type, i.url, i.caption, i.author_handle, i.status, i.failure_reason, i.discovered_at, i.processed_at, a.summary, a.features, a.steps, a.tips, a.links, a.relevance_score, a.relevance_reason FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id ORDER BY i.discovered_at DESC LIMIT 200"
    ),
    tursoClient.execute(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS processed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, AVG(a.relevance_score) AS avg_score FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id"
    ),
  ]);

  const items = itemsRes.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    instagram_id: r.instagram_id,
    type: r.type,
    url: r.url,
    caption: r.caption,
    author_handle: r.author_handle,
    status: r.status,
    failure_reason: r.failure_reason,
    discovered_at: r.discovered_at,
    processed_at: r.processed_at,
    analysis: r.summary ? {
      summary: r.summary,
      features: JSON.parse((r.features as string) || "[]"),
      steps: JSON.parse((r.steps as string) || "[]"),
      tips: JSON.parse((r.tips as string) || "[]"),
      links: JSON.parse((r.links as string) || "[]"),
      relevance_score: r.relevance_score,
      relevance_reason: r.relevance_reason,
    } : null,
  }));

  const s = statsRes.rows[0] || {};
  const stats = {
    total: Number(s.total) || 0,
    processed: Number(s.processed) || 0,
    failed: Number(s.failed) || 0,
    avg_score: Math.round((Number(s.avg_score) || 0) * 10) / 10,
  };

  return NextResponse.json({ items, stats });
}

export async function POST(request: NextRequest) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

  const { url } = await request.json();
  if (!url || typeof url !== "string") return NextResponse.json({ fout: "url is verplicht" }, { status: 400 });

  const parsed = parseInstagramUrl(url);
  if (!parsed) return NextResponse.json({ fout: "Geen geldige Instagram reel/post URL" }, { status: 400 });

  const existing = await tursoClient.execute({
    sql: "SELECT id, status FROM isk_items WHERE instagram_id = ?",
    args: [parsed.instagramId],
  });
  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    return NextResponse.json({ id: r.id, status: r.status, duplicate: true });
  }

  const id = crypto.randomUUID();
  await tursoClient.execute({
    sql: "INSERT INTO isk_items (id, instagram_id, type, url, status) VALUES (?, ?, ?, ?, 'pending')",
    args: [id, parsed.instagramId, parsed.type, url],
  });

  after(async () => {
    try { await processItem(id); } catch { /* failure is in DB status */ }
  });

  return NextResponse.json({ id, status: "pending" }, { status: 201 });
}
