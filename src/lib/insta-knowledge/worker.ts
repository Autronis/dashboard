// src/lib/insta-knowledge/worker.ts
import { tursoClient } from "@/lib/db";
import { manualAdapter } from "./adapters/manual";
import { transcribeReelFromUrl, MediaTooLargeError } from "./transcribe";
import { analyzeInstaContent, INSTA_MODEL } from "./analyze";
import { createIdeaIfRelevant } from "./idea";
import { fetchImagesAsBase64 } from "./vision";
import type { WorkerOutcome } from "./types";

async function markFailed(itemId: string, reason: string): Promise<void> {
  if (!tursoClient) return;
  await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'failed', failure_reason = ? WHERE id = ?",
    args: [reason, itemId],
  });
}

export async function processItem(itemId: string): Promise<WorkerOutcome> {
  if (!tursoClient) return { ok: false, reason: "no_db" };

  const itemRes = await tursoClient.execute({
    sql: "SELECT id, url, instagram_id, type FROM isk_items WHERE id = ?",
    args: [itemId],
  });
  if (!itemRes.rows.length) return { ok: false, reason: "not_found" };
  const row = itemRes.rows[0];
  const url = row.url as string;
  const instagramId = row.instagram_id as string;
  const type = row.type as "reel" | "post";

  await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'processing' WHERE id = ?",
    args: [itemId],
  });

  let rawItem;
  try {
    rawItem = await manualAdapter.fetchItem(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scrape_failed";
    await markFailed(itemId, msg.startsWith("instagram_fetch") ? "not_public" : "scrape_failed");
    return { ok: false, reason: "scrape_failed" };
  }

  await tursoClient.execute({
    sql: "UPDATE isk_items SET caption = ?, author_handle = ?, media_url = ? WHERE id = ?",
    args: [rawItem.caption, rawItem.authorHandle, rawItem.mediaUrl ?? null, itemId],
  });

  // Transcribe whenever a video is present — reels AND video-posts (IG serves
  // some reels under /p/ URLs). Image-only posts have no mediaUrl.
  let transcript: string | undefined;
  if (rawItem.mediaUrl) {
    try {
      transcript = await transcribeReelFromUrl(rawItem.mediaUrl);
    } catch (e) {
      if (e instanceof MediaTooLargeError) {
        await markFailed(itemId, "media_too_large");
        return { ok: false, reason: "media_too_large" };
      }
      await markFailed(itemId, "transcription_failed");
      return { ok: false, reason: "transcription_failed" };
    }
  } else if (type === "reel") {
    await markFailed(itemId, "no_media_url");
    return { ok: false, reason: "no_media_url" };
  }

  // Fetch available images (carousel slides OR video thumbnail) so Claude
  // can read overlay text / slide content as additional context.
  const images = rawItem.imageUrls?.length
    ? await fetchImagesAsBase64(rawItem.imageUrls)
    : [];

  let analysis;
  try {
    analysis = await analyzeInstaContent({ caption: rawItem.caption, transcript, images });
  } catch {
    await markFailed(itemId, "analysis_failed");
    return { ok: false, reason: "analysis_failed" };
  }

  // Clear any previous analyses for this item so retry produces one authoritative row.
  await tursoClient.execute({
    sql: "DELETE FROM isk_analyses WHERE item_id = ?",
    args: [itemId],
  });

  const analysisId = crypto.randomUUID();
  await tursoClient.execute({
    sql: `INSERT INTO isk_analyses
          (id, item_id, summary, features, steps, tips, links, relevance_score, relevance_reason, raw_transcript, raw_caption, model_used)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      analysisId, itemId,
      analysis.summary,
      JSON.stringify(analysis.features),
      JSON.stringify(analysis.steps),
      JSON.stringify(analysis.tips),
      JSON.stringify(analysis.links),
      analysis.relevance_score,
      analysis.relevance_reason,
      transcript ?? null,
      rawItem.caption,
      INSTA_MODEL,
    ],
  });

  await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'done', processed_at = datetime('now') WHERE id = ?",
    args: [itemId],
  });

  try {
    await createIdeaIfRelevant(
      { instagramId, url, authorHandle: rawItem.authorHandle, type },
      analysis, analysisId
    );
  } catch {
    // niet blokkerend
  }

  return { ok: true, analysisId, relevanceScore: analysis.relevance_score };
}
