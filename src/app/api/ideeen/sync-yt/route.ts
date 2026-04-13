import { NextResponse } from "next/server";
import { db, tursoClient } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { sql, eq, and, like } from "drizzle-orm";

/**
 * Backfill / sync endpoint that pulls every ytk_analyses row with
 * relevance_score >= 9 and creates an idee for it (if none exists yet).
 *
 * Dedup: an idee is considered "existing" if there is a row with
 * bron = 'yt-knowledge' AND bron_tekst contains the youtube_id.
 *
 * Idempotent: safe to call on every Ideeën pageload.
 */
export async function POST() {
  try {
    const gebruiker = await requireAuth();
    if (!tursoClient) {
      return NextResponse.json({ fout: "Geen Turso connectie" }, { status: 500 });
    }

    // Pull all top-tier analyses joined with their video metadata.
    const result = await tursoClient.execute(
      `SELECT
         a.id           AS analysis_id,
         a.video_id     AS video_id,
         a.summary      AS summary,
         a.features     AS features,
         a.steps        AS steps,
         a.tips         AS tips,
         a.links        AS links,
         a.relevance_score AS relevance_score,
         a.relevance_reason AS relevance_reason,
         v.youtube_id   AS youtube_id,
         v.title        AS video_title,
         v.channel_name AS channel_name,
         v.url          AS video_url
       FROM ytk_analyses a
       JOIN ytk_videos v ON v.id = a.video_id
       WHERE a.relevance_score >= 9
       ORDER BY a.relevance_score DESC, a.created_at DESC`
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ aangemaakt: 0, overgeslagen: 0 });
    }

    // Get next idee nummer once to avoid races inside the loop.
    const maxNummer = await db
      .select({ max: sql<number>`MAX(nummer)` })
      .from(ideeen)
      .get();
    let nextNummer = (maxNummer?.max ?? 0) + 1;

    let aangemaakt = 0;
    let overgeslagen = 0;

    for (const row of result.rows as unknown as Array<Record<string, unknown>>) {
      const youtubeId = String(row.youtube_id ?? "");
      const videoUrl = (row.video_url as string) || `https://youtube.com/watch?v=${youtubeId}`;
      const channelName = (row.channel_name as string) || "";
      const videoTitle = (row.video_title as string) || youtubeId;
      const summary = (row.summary as string) || "";
      const reason = (row.relevance_reason as string) || "";
      const score = Number(row.relevance_score) || 0;

      // --- Dedup: skip if already imported (matches by youtube_id in bronTekst).
      const existing = await db
        .select({ id: ideeen.id })
        .from(ideeen)
        .where(
          and(
            eq(ideeen.bron, "yt-knowledge"),
            like(ideeen.bronTekst, `%"youtubeId":"${youtubeId}"%`)
          )
        )
        .get();
      if (existing) {
        overgeslagen++;
        continue;
      }

      // --- Build description + uitwerking from the analysis JSON blobs.
      const features = parseJsonArray<{ name: string; description: string }>(row.features);
      const steps = parseJsonArray<{ order: number; title: string; description: string; code_snippet?: string }>(row.steps);
      const tips = parseJsonArray<{ tip: string; context: string }>(row.tips);
      const links = parseJsonArray<{ url: string; label: string; type: string }>(row.links);

      const omschrijving = `${summary}\n\n**Relevantie:** ${score}/10 — ${reason}\n\n[Bekijk video](${videoUrl})`;

      const featuresText = features.map((f) => `- **${f.name}**: ${f.description}`).join("\n");
      const stepsText = steps
        .map((s) => `${s.order}. **${s.title}**\n   ${s.description}${s.code_snippet ? `\n   \`${s.code_snippet}\`` : ""}`)
        .join("\n");
      const tipsText = tips.map((t) => `- ${t.tip} — _${t.context}_`).join("\n");
      const linksText = links.map((l) => `- [${l.label}](${l.url}) _(${l.type})_`).join("\n");

      const uitwerking =
        `## Features\n${featuresText}\n\n` +
        `## Stappenplan\n${stepsText}\n\n` +
        `## Tips\n${tipsText}` +
        (linksText ? `\n\n## Links\n${linksText}` : "") +
        `\n\n---\n_Bron: [${videoTitle}](${videoUrl})${channelName ? ` — ${channelName}` : ""} — YT Knowledge Pipeline_`;

      const bronTekst = JSON.stringify({
        youtubeId,
        videoTitle,
        videoUrl,
        channelName,
        analysisId: String(row.analysis_id ?? ""),
        relevanceScore: score,
      });

      await db.insert(ideeen).values({
        nummer: nextNummer++,
        naam: videoTitle,
        categorie: "content_media",
        status: "idee",
        omschrijving,
        uitwerking,
        prioriteit: "normaal",
        doelgroep: "persoonlijk",
        aiScore: score,
        isAiSuggestie: 1,
        gepromoveerd: 0,
        bron: "yt-knowledge",
        bronTekst,
        aangemaaktDoor: gebruiker.id,
      });

      aangemaakt++;
    }

    return NextResponse.json({ aangemaakt, overgeslagen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd"
            ? 401
            : 500,
      }
    );
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}
