import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { YoutubeTranscript } from "youtube-transcript";

// Increase timeout for long Claude API calls
export const maxDuration = 60;

const SYSTEM_PROMPT = `Je bent een expert-analist die YouTube video's diepgaand analyseert over AI coding tools, Claude Code, AI agents, en automation.

Je doel: extraheer ALLES wat bruikbaar is uit het transcript. Wees uitgebreid en compleet — dit wordt een kennisbank waar de gebruiker later in zoekt. Mis niets.

Context over de gebruiker:
Autronis is een Nederlands tech-bedrijf (Sem & Syb) dat werkt met: Next.js, Turso (SQLite), Vercel, Python, Claude Code, n8n automation, en een custom dashboard. Ze bouwen AI-gestuurde tools en automatisering voor klanten. Score hoger als de video direct toepasbaar is voor hun stack en werkwijze.

Antwoord ALLEEN met valid JSON (geen markdown fences) in exact dit format:
{
  "summary": "Uitgebreide samenvatting van 4-6 zinnen. Beschrijf het hoofdonderwerp, de key insights, en waarom dit relevant is.",
  "features": [
    {"name": "Feature naam", "description": "Uitgebreide beschrijving van wat deze feature doet, hoe het werkt, en wanneer je het zou gebruiken. Minimaal 2 zinnen.", "category": "core | workflow | integration | tips"}
  ],
  "steps": [
    {"order": 1, "title": "Duidelijke stap titel", "description": "Gedetailleerde uitleg van wat je moet doen in deze stap. Inclusief context, waarom deze stap belangrijk is, en mogelijke valkuilen. Minimaal 2-3 zinnen.", "code_snippet": "Exacte code, commando's, of configuratie als die genoemd worden. Laat leeg als er geen code bij hoort."}
  ],
  "tips": [
    {"tip": "De volledige tip uitgeschreven", "context": "Wanneer en waarom dit nuttig is, en wat er misgaat als je het niet doet"}
  ],
  "relevance_score": 8,
  "relevance_reason": "Gedetailleerde uitleg van 2-3 zinnen waarom deze score. Noem specifiek welke onderdelen relevant zijn voor de Autronis stack."
}

Regels:
- summary: 4-6 zinnen, Nederlands, geef een compleet beeld van de video
- features: ELKE tool, feature, techniek, of concept dat genoemd wordt. Wees uitgebreid in de beschrijving. Typisch 5-15 features per video.
- steps: Maak een compleet, reproduceerbaar stappenplan van ALLES wat de spreker demonstreert of uitlegt. Alsof je het zelf na wilt doen. Typisch 5-15 stappen. Neem altijd code/commando's mee als die genoemd worden.
- tips: ELKE tip, best practice, waarschuwing, of advies. Ook impliciete tips die de spreker terloops noemt. Typisch 5-10 tips.
- relevance_score: 1-10. Score 8+ als het direct toepasbaar is voor Claude Code / AI coding / automation. Score 5-7 als het indirect nuttig is. Score 1-4 als het niet relevant is.
- relevance_reason: Wees specifiek over welke delen van de video waardevol zijn
- Als de video niet over AI/coding/automation gaat, geef relevance_score 1

BELANGRIJK: Wees UITGEBREID. Dit is een kennisbank — meer detail is altijd beter. Sla niets over.`;

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
      max_tokens: 8192,
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
