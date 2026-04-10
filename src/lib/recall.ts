const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_REGION = process.env.RECALL_API_REGION || "eu-central-1";
const RECALL_BASE = `https://${RECALL_REGION}.recall.ai/api/v1`;

function headers() {
  return {
    Authorization: `Token ${RECALL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface RecallBot {
  id: string;
  meeting_url: string;
  status_changes: Array<{ code: string; created_at: string }>;
  video_url: string | null;
  transcript: Array<{ speaker: string; words: Array<{ text: string; start_time: number; end_time: number }> }> | null;
}

// Create a bot that joins a meeting
export async function createRecallBot(meetingUrl: string, meetingTitle: string): Promise<{ id: string }> {
  const webhookUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/api/meetings/recall-webhook`
    : null;

  const body: Record<string, unknown> = {
    meeting_url: meetingUrl,
    bot_name: "Autronis Notulist",
    metadata: {
      meeting_title: meetingTitle,
    },
  };

  // Add webhook for status changes
  if (webhookUrl) {
    body.status_changes_webhook_url = webhookUrl;
  }

  const res = await fetch(`${RECALL_BASE}/bot/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

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

// Get transcript from bot
export async function getRecallTranscript(botId: string): Promise<string> {
  const res = await fetch(`${RECALL_BASE}/bot/${botId}/transcript/`, {
    headers: headers(),
  });

  if (!res.ok) throw new Error(`Recall transcript fetch failed: ${res.status}`);
  const data = await res.json();

  // Format transcript: "Speaker: text"
  if (Array.isArray(data)) {
    return data
      .map((segment: { speaker: string; words: Array<{ text: string }> }) => {
        const text = segment.words.map((w) => w.text).join(" ");
        return segment.speaker ? `${segment.speaker}: ${text}` : text;
      })
      .join("\n\n");
  }

  return typeof data === "string" ? data : JSON.stringify(data);
}

export function isRecallConfigured(): boolean {
  return Boolean(RECALL_API_KEY);
}
