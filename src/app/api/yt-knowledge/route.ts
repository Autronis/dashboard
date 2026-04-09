import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ error: "No Turso connection" }, { status: 500 });

  const [videosResult, statsResult] = await Promise.all([
    tursoClient.execute("SELECT v.id, v.youtube_id, v.title, v.channel_name, v.url, v.status, v.discovered_at, a.summary, a.features, a.steps, a.tips, a.relevance_score, a.relevance_reason FROM ytk_videos v LEFT JOIN ytk_analyses a ON v.id = a.video_id ORDER BY v.discovered_at DESC LIMIT 100"),
    tursoClient.execute("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as processed, AVG(CASE WHEN a.relevance_score IS NOT NULL THEN a.relevance_score END) as avg_score FROM ytk_videos v LEFT JOIN ytk_analyses a ON v.id = a.video_id"),
  ]);

  const videos = videosResult.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    youtube_id: r.youtube_id,
    title: r.title,
    channel_name: r.channel_name,
    url: r.url,
    status: r.status,
    discovered_at: r.discovered_at,
    analysis: r.summary ? {
      summary: r.summary,
      features: JSON.parse((r.features as string) || "[]"),
      steps: JSON.parse((r.steps as string) || "[]"),
      tips: JSON.parse((r.tips as string) || "[]"),
      relevance_score: r.relevance_score,
      relevance_reason: r.relevance_reason,
    } : null,
  }));

  const s = statsResult.rows[0] || {};
  const stats = {
    total_videos: Number(s.total) || 0,
    processed: Number(s.processed) || 0,
    avg_relevance_score: Math.round((Number(s.avg_score) || 0) * 10) / 10,
  };

  return NextResponse.json({ videos, stats });
}

export async function POST(request: NextRequest) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ error: "No Turso connection" }, { status: 500 });

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "URL is verplicht" }, { status: 400 });

  // Extract video ID
  let videoId: string | null = null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      videoId = parsed.searchParams.get("v");
    }
  } catch {
    return NextResponse.json({ error: "Ongeldige URL" }, { status: 400 });
  }

  if (!videoId) return NextResponse.json({ error: "Geen YouTube video ID gevonden" }, { status: 400 });

  // Check if exists
  const existing = await tursoClient.execute({ sql: "SELECT id, status FROM ytk_videos WHERE youtube_id = ?", args: [videoId] });
  if (existing.rows.length > 0) {
    return NextResponse.json({ id: existing.rows[0].id, youtube_id: videoId, status: existing.rows[0].status });
  }

  // Insert as pending
  const id = crypto.randomUUID();
  await tursoClient.execute({
    sql: "INSERT INTO ytk_videos (id, youtube_id, title, url, discovered_at, status) VALUES (?, ?, '', ?, datetime('now'), 'pending')",
    args: [id, videoId, url],
  });

  return NextResponse.json({ id, youtube_id: videoId, status: "pending" }, { status: 201 });
}
