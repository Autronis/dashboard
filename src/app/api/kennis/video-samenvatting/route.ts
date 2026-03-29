import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoSamenvattingen } from "@/lib/db/schema";
import { desc, eq, like, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { YoutubeTranscript } from "youtube-transcript";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchYoutubeMetadata(videoId: string): Promise<{ title: string; channel: string; thumbnail: string }> {
  // Use oEmbed API (no API key needed)
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (res.ok) {
      const data = await res.json() as { title: string; author_name: string };
      return {
        title: data.title,
        channel: data.author_name,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      };
    }
  } catch { /* fallback */ }
  return {
    title: "Onbekende video",
    channel: "Onbekend",
    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

async function fetchTranscript(videoId: string): Promise<string> {
  const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" })
    .catch(() => YoutubeTranscript.fetchTranscript(videoId, { lang: "nl" }))
    .catch(() => YoutubeTranscript.fetchTranscript(videoId));

  return segments.map(s => s.text).join(" ").slice(0, 30000);
}

async function analyseTranscript(transcript: string, title: string): Promise<{
  samenvatting: string;
  keyTakeaways: string[];
  stappenplan: string[] | null;
  tags: string[];
  relevantieScore: "hoog" | "midden" | "laag";
}> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Analyseer dit YouTube video transcript voor een AI- en automatiseringsbureau (Autronis).

Video titel: ${title}

Transcript (eerste 30.000 tekens):
${transcript.slice(0, 25000)}

Geef:
1. samenvatting: 3-5 zinnen in het Nederlands, wat is de kern van de video
2. keyTakeaways: 5-8 bullet points met de belangrijkste inzichten (Nederlands)
3. stappenplan: als het een tutorial/how-to is, geef genummerde stappen met details. null als het geen tutorial is.
4. tags: 3-6 relevante tags in het Engels (bijv. "AI", "automation", "marketing", "development", "SaaS", "productivity")
5. relevantieScore: "hoog" (direct toepasbaar voor AI/automation bureau), "midden" (indirect nuttig), "laag" (niet relevant)

Antwoord ALLEEN als JSON:
{
  "samenvatting": "...",
  "keyTakeaways": ["...", "..."],
  "stappenplan": ["Stap 1: ...", "Stap 2: ..."] of null,
  "tags": ["AI", "automation"],
  "relevantieScore": "hoog"|"midden"|"laag"
}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { samenvatting: "", keyTakeaways: [], stappenplan: null, tags: [], relevantieScore: "midden" };
  }

  return JSON.parse(jsonMatch[0]) as {
    samenvatting: string;
    keyTakeaways: string[];
    stappenplan: string[] | null;
    tags: string[];
    relevantieScore: "hoog" | "midden" | "laag";
  };
}

// GET: List all video summaries
export async function GET(req: NextRequest) {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");
  const tag = searchParams.get("tag");
  const relevantie = searchParams.get("relevantie");

  let query = db.select().from(videoSamenvattingen).orderBy(desc(videoSamenvattingen.aangemaaktOp)).$dynamic();

  if (search) {
    query = query.where(like(videoSamenvattingen.titel, `%${search}%`));
  }
  if (relevantie) {
    query = query.where(eq(videoSamenvattingen.relevantieScore, relevantie as "hoog" | "midden" | "laag"));
  }

  const items = await query;

  // Client-side tag filter (tags is JSON array string)
  const filtered = tag
    ? items.filter(item => {
        try { return (JSON.parse(item.tags ?? "[]") as string[]).some(t => t.toLowerCase() === tag.toLowerCase()); }
        catch { return false; }
      })
    : items;

  // Collect all unique tags
  const allTags = new Set<string>();
  for (const item of items) {
    try { (JSON.parse(item.tags ?? "[]") as string[]).forEach(t => allTags.add(t)); }
    catch { /* ignore */ }
  }

  return NextResponse.json({
    items: filtered.map(item => ({
      ...item,
      keyTakeaways: item.keyTakeaways ? JSON.parse(item.keyTakeaways) : [],
      stappenplan: item.stappenplan ? JSON.parse(item.stappenplan) : null,
      tags: item.tags ? JSON.parse(item.tags) : [],
      transcript: undefined, // Don't send full transcript to client
    })),
    allTags: Array.from(allTags).sort(),
  });
}

// POST: Add new video and generate summary
export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const { youtubeUrl } = await req.json() as { youtubeUrl: string };

  if (!youtubeUrl?.trim()) {
    return NextResponse.json({ fout: "YouTube URL is verplicht" }, { status: 400 });
  }

  const videoId = extractYoutubeId(youtubeUrl.trim());
  if (!videoId) {
    return NextResponse.json({ fout: "Ongeldige YouTube URL" }, { status: 400 });
  }

  // Check if already exists
  const [existing] = await db.select({ id: videoSamenvattingen.id })
    .from(videoSamenvattingen)
    .where(eq(videoSamenvattingen.youtubeId, videoId))
    .limit(1);

  if (existing) {
    return NextResponse.json({ fout: "Deze video is al opgeslagen", bestaandId: existing.id }, { status: 409 });
  }

  // Fetch metadata + transcript in parallel
  const [metadata, transcript] = await Promise.all([
    fetchYoutubeMetadata(videoId),
    fetchTranscript(videoId).catch(() => ""),
  ]);

  if (!transcript) {
    return NextResponse.json({ fout: "Kon geen transcript ophalen. De video heeft mogelijk geen ondertiteling." }, { status: 400 });
  }

  // AI analysis
  const analyse = await analyseTranscript(transcript, metadata.title);

  // Save
  const [item] = await db.insert(videoSamenvattingen).values({
    youtubeUrl: youtubeUrl.trim(),
    youtubeId: videoId,
    titel: metadata.title,
    kanaal: metadata.channel,
    thumbnailUrl: metadata.thumbnail,
    transcript,
    samenvatting: analyse.samenvatting,
    keyTakeaways: JSON.stringify(analyse.keyTakeaways),
    stappenplan: analyse.stappenplan ? JSON.stringify(analyse.stappenplan) : null,
    tags: JSON.stringify(analyse.tags),
    relevantieScore: analyse.relevantieScore,
    aangemaaktDoor: session.id,
  }).returning();

  return NextResponse.json({
    item: {
      ...item,
      keyTakeaways: analyse.keyTakeaways,
      stappenplan: analyse.stappenplan,
      tags: analyse.tags,
      transcript: undefined,
    },
  });
}

// DELETE
export async function DELETE(req: NextRequest) {
  await requireAuth();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ fout: "ID is vereist" }, { status: 400 });
  await db.delete(videoSamenvattingen).where(eq(videoSamenvattingen.id, Number(id)));
  return NextResponse.json({ succes: true });
}
