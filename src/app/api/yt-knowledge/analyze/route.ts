import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { YoutubeTranscript } from "youtube-transcript";

// Increase timeout for long Claude API calls
export const maxDuration = 60;

const SYSTEM_PROMPT = `Je bent een expert in het analyseren van YouTube video's over Claude Code.
Je ontvangt een transcript van een video en produceert een gestructureerde analyse.

Context over de gebruiker:
Autronis is een Nederlands bedrijf dat werkt met: Next.js, Turso (SQLite), Vercel, Python tooling, n8n automation workflows, en een dashboard voor projectbeheer. Score hoger als de video direct toepasbaar is voor deze stack.

Antwoord ALLEEN met valid JSON in exact dit format:
{
  "summary": "Korte TL;DR, 2-3 zinnen",
  "features": [
    {"name": "Feature naam", "description": "Wat het doet", "category": "core | workflow | integration | tips"}
  ],
  "steps": [
    {"order": 1, "title": "Stap titel", "description": "Wat je moet doen", "code_snippet": "optioneel code"}
  ],
  "tips": [
    {"tip": "De tip zelf", "context": "Wanneer/waarom nuttig"}
  ],
  "relevance_score": 8,
  "relevance_reason": "Uitleg waarom deze score"
}

Regels:
- summary: max 3 zinnen, Nederlands
- features: alle Claude Code mogelijkheden die genoemd worden
- steps: concreet stappenplan om de getoonde technieken zelf toe te passen
- tips: handige tips en tricks die genoemd worden
- relevance_score: 1-10, gebaseerd op hoe nuttig dit is voor de gebruiker's stack
- relevance_reason: korte uitleg van de score
- Als de video niet over Claude Code gaat, geef relevance_score 1 en leg uit waarom`;

async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    if (!transcript.length) return null;
    return transcript.map((t) => t.text).join(" ").trim();
  } catch {
    // Try without language preference
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      if (!transcript.length) return null;
      return transcript.map((t) => t.text).join(" ").trim();
    } catch {
      return null;
    }
  }
}

export async function POST(request: NextRequest) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ error: "No Turso" }, { status: 500 });

  const { videoId: dbVideoId } = await request.json();
  if (!dbVideoId) return NextResponse.json({ error: "videoId is verplicht" }, { status: 400 });

  // Get video from DB
  const videoResult = await tursoClient.execute({
    sql: "SELECT id, youtube_id, status FROM ytk_videos WHERE id = ?",
    args: [dbVideoId],
  });
  if (!videoResult.rows.length) {
    return NextResponse.json({ error: "Video niet gevonden" }, { status: 404 });
  }

  const video = videoResult.rows[0];
  const youtubeId = video.youtube_id as string;

  // Fetch title from YouTube
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`);
    const pageHtml = await pageRes.text();
    const titleMatch = pageHtml.match(/<title>(.+?)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1].replace(" - YouTube", "").trim();
      await tursoClient.execute({
        sql: "UPDATE ytk_videos SET title = ? WHERE id = ? AND (title IS NULL OR title = '')",
        args: [title, dbVideoId],
      });
    }
  } catch { /* title is optional */ }

  // Update status to processing
  await tursoClient.execute({
    sql: "UPDATE ytk_videos SET status = 'processing' WHERE id = ?",
    args: [dbVideoId],
  });

  // Fetch transcript
  const transcript = await fetchTranscript(youtubeId);
  if (!transcript) {
    await tursoClient.execute({
      sql: "UPDATE ytk_videos SET status = 'failed' WHERE id = ?",
      args: [dbVideoId],
    });
    return NextResponse.json({ error: "Geen transcript gevonden" }, { status: 422 });
  }

  // Truncate if needed
  const maxLen = 100_000;
  const truncated = transcript.length > maxLen
    ? transcript.slice(0, maxLen) + "\n\n[TRANSCRIPT TRUNCATED]"
    : transcript;

  // Analyze with Claude
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Analyseer dit transcript:\n\n${truncated}` }],
    });

    let raw = response.content[0].type === "text" ? response.content[0].text : "";
    // Strip markdown code fences if present
    raw = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const data = JSON.parse(raw);

    // Write analysis to Turso
    const analysisId = crypto.randomUUID();
    await tursoClient.execute({
      sql: "INSERT INTO ytk_analyses (id, video_id, summary, features, steps, tips, relevance_score, relevance_reason, raw_transcript, model_used, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
      args: [
        analysisId,
        dbVideoId,
        data.summary,
        JSON.stringify(data.features),
        JSON.stringify(data.steps),
        JSON.stringify(data.tips),
        data.relevance_score,
        data.relevance_reason,
        truncated,
        "claude-sonnet-4-20250514",
      ],
    });

    // Mark as done
    await tursoClient.execute({
      sql: "UPDATE ytk_videos SET status = 'done', processed_at = datetime('now') WHERE id = ?",
      args: [dbVideoId],
    });

    return NextResponse.json({
      status: "done",
      analysis: {
        summary: data.summary,
        features: data.features,
        steps: data.steps,
        tips: data.tips,
        relevance_score: data.relevance_score,
        relevance_reason: data.relevance_reason,
      },
    });
  } catch (e) {
    await tursoClient.execute({
      sql: "UPDATE ytk_videos SET status = 'failed' WHERE id = ?",
      args: [dbVideoId],
    });
    console.error("YTK analyze error:", e);
    return NextResponse.json({ error: "Analyse mislukt", detail: String(e) }, { status: 500 });
  }
}
