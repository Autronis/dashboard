import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ error: "No Turso" }, { status: 500 });

  const { url, name } = await request.json();
  if (!url) return NextResponse.json({ error: "URL is verplicht" }, { status: 400 });

  // Extract channel handle or ID from URL
  let channelId = "";
  let channelName = name || "";

  // Try to extract from URL patterns
  const handleMatch = url.match(/@([\w-]+)/);
  const channelIdMatch = url.match(/channel\/(UC[\w-]+)/);

  if (channelIdMatch) {
    channelId = channelIdMatch[1];
  } else if (handleMatch) {
    // We need to resolve handle to channel ID — store the handle for now
    // The Python CLI will resolve it via yt-dlp
    channelId = `@${handleMatch[1]}`;
    if (!channelName) channelName = handleMatch[1];
  } else {
    return NextResponse.json({ error: "Geen geldig YouTube kanaal gevonden" }, { status: 400 });
  }

  // Check if exists
  const existing = await tursoClient.execute({
    sql: "SELECT id FROM ytk_channels WHERE channel_id = ?",
    args: [channelId],
  });
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: "Kanaal bestaat al" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await tursoClient.execute({
    sql: "INSERT INTO ytk_channels (id, channel_id, name, active) VALUES (?, ?, ?, 1)",
    args: [id, channelId, channelName],
  });

  return NextResponse.json({ id, channel_id: channelId, name: channelName, active: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ error: "No Turso" }, { status: 500 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id is verplicht" }, { status: 400 });

  await tursoClient.execute({ sql: "DELETE FROM ytk_channels WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
