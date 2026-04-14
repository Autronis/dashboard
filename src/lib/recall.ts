// Strip whitespace/newlines defensively — Vercel env var copy-paste often leaves trailing \n,
// which makes the Authorization header invalid and surfaces as a generic "fetch failed" error.
const RECALL_API_KEY = process.env.RECALL_API_KEY?.trim();
const RECALL_REGION = (process.env.RECALL_API_REGION || "eu-central-1").trim();
const RECALL_BASE = `https://${RECALL_REGION}.recall.ai/api/v1`;

function headers() {
  return {
    Authorization: `Token ${RECALL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// Stringifies an unknown error including its `cause` chain. Native fetch failures hide
// the actual reason inside `error.cause` (often a TypeError or DNS error); we expose it
// so the caller can show a useful message to the user instead of "fetch failed".
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const parts: string[] = [err.message];
  let cause: unknown = (err as Error & { cause?: unknown }).cause;
  while (cause) {
    if (cause instanceof Error) {
      parts.push(`caused by: ${cause.message}`);
      cause = (cause as Error & { cause?: unknown }).cause;
    } else {
      parts.push(`caused by: ${String(cause)}`);
      break;
    }
  }
  return parts.join(" — ");
}

export interface RecallBot {
  id: string;
  meeting_url: string;
  status_changes: Array<{ code: string; created_at: string }>;
  video_url: string | null;
  transcript: Array<{ speaker: string; words: Array<{ text: string; start_time: number; end_time: number }> }> | null;
}

// Create a bot that joins a meeting.
// If `joinAt` is in the future, schedule the bot to join at that exact time.
// Otherwise the bot joins immediately.
export async function createRecallBot(
  meetingUrl: string,
  meetingTitle: string,
  joinAt?: Date
): Promise<{ id: string }> {
  const webhookUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/api/meetings/recall-webhook`
    : null;

  const body: Record<string, unknown> = {
    meeting_url: meetingUrl,
    bot_name: "Autronis Notulist",
    recording_config: {
      transcript: {
        provider: {
          deepgram_streaming: {
            language: "nl",
            model: "nova-3",
          },
        },
      },
    },
    metadata: {
      meeting_title: meetingTitle,
    },
  };

  // Schedule bot to join at a future time (Recall.ai supports up to ~7 days ahead).
  // We only set this if the meeting is more than 60 seconds in the future, otherwise
  // we let the bot join immediately to avoid clock-skew edge cases.
  if (joinAt) {
    const nowPlus60 = Date.now() + 60_000;
    if (joinAt.getTime() > nowPlus60) {
      body.join_at = joinAt.toISOString();
    }
  }

  // Add webhook for status changes
  if (webhookUrl) {
    body.status_changes_webhook_url = webhookUrl;
  }

  let res: Response;
  try {
    res = await fetch(`${RECALL_BASE}/bot/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Native fetch buries the actual reason in `cause`. Surface it.
    throw new Error(
      `Recall bot fetch transport failure (${RECALL_BASE}/bot/): ${describeError(err)}`
    );
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Recall bot creation failed: ${res.status} ${err}`);
  }

  return res.json();
}

// Get bot status and transcript
export async function getRecallBot(botId: string): Promise<RecallBot> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/`, {
    headers: headers(),
  });

  if (!res.ok) throw new Error(`Recall bot fetch failed: ${res.status}`);
  return res.json();
}

// Get transcript from bot via recording artifacts
export async function getRecallTranscript(botId: string): Promise<string> {
  // First get bot details to find transcript artifact
  const botRes = await fetch(`${RECALL_BASE}/bot/${botId}/`, { headers: headers() });
  if (!botRes.ok) throw new Error(`Recall bot fetch failed: ${botRes.status}`);
  const bot = await botRes.json();

  const recording = bot.recordings?.[0];
  if (!recording) throw new Error("Geen recording gevonden");

  const transcriptArtifact = recording.media_shortcuts?.transcript;
  if (!transcriptArtifact?.id) throw new Error("Geen transcript beschikbaar");

  // Use the pre-signed download_url from the artifact data
  const downloadUrl = transcriptArtifact.data?.download_url;
  if (!downloadUrl) throw new Error("Geen transcript download URL beschikbaar");

  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Transcript ophalen mislukt: ${res.status}`);
  const data = await res.json();

  // Format transcript segments — Recall returns participant-based segments with words
  if (Array.isArray(data)) {
    return data
      .map((seg: { participant?: { name?: string }; speaker?: string; speaker_id?: number; words?: Array<{ text: string }>; text?: string }) => {
        const text = seg.text || seg.words?.map((w) => w.text).join(" ") || "";
        const speaker = seg.participant?.name || seg.speaker || `Spreker ${seg.speaker_id ?? "?"}`;
        return text.trim() ? `${speaker}: ${text.trim()}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return typeof data === "string" ? data : JSON.stringify(data);
}

export function isRecallConfigured(): boolean {
  return Boolean(RECALL_API_KEY);
}
