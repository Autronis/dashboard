// src/lib/insta-knowledge/transcribe.ts
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB (buffer under Whisper's 25MB limit)

export class MediaTooLargeError extends Error {
  constructor() { super("media_too_large"); }
}

export async function transcribeReelFromUrl(mediaUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY niet geconfigureerd");

  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) throw new Error(`media_fetch_${mediaRes.status}`);

  const contentLength = Number(mediaRes.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) throw new MediaTooLargeError();

  const blob = await mediaRes.blob();
  if (blob.size > MAX_BYTES) throw new MediaTooLargeError();

  const formData = new FormData();
  formData.append("file", blob, "reel.mp4");
  formData.append("model", "whisper-1");

  const whisperRes = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!whisperRes.ok) {
    const body = await whisperRes.text().catch(() => "");
    throw new Error(`whisper_${whisperRes.status}: ${body.slice(0, 200)}`);
  }
  const data = (await whisperRes.json()) as { text?: string };
  return data.text ?? "";
}
