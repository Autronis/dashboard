import { NextRequest, NextResponse } from "next/server";

const BLOCKED_WORDS = [
  "explosion", "explode", "exploding", "exploded", "blow up",
  "destroy", "destruction", "shatter", "shattering", "smash",
  "crash", "break apart", "rip apart", "tear apart", "burst",
  "weapon", "gun", "knife", "blood", "gore", "violence", "violent",
  "kill", "death", "murder", "attack", "bomb", "fire", "burning", "flames",
  "nude", "naked", "nsfw", "sexual", "explicit",
];

function sanitizePrompt(text: string): string {
  let clean = text;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    if (word.includes("explo")) clean = clean.replace(regex, "separation");
    else if (word.includes("shatter")) clean = clean.replace(regex, "divided into pieces");
    else if (word.includes("fire") || word.includes("burn") || word.includes("flame")) clean = clean.replace(regex, "glow");
    else clean = clean.replace(regex, "");
  }
  return clean.replace(/\s{2,}/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const { prompt, referenceImageUrl, refStrength } = await req.json() as {
    prompt: string;
    referenceImageUrl?: string;
    refStrength?: number;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is verplicht." }, { status: 400 });
  }

  const input: Record<string, string | number> = {
    prompt: sanitizePrompt(prompt),
    aspect_ratio: "16:9",
    resolution: "1K",
    output_format: "jpg",
  };

  // If a reference image URL is provided, use img2img mode
  // image_url = img2img (transforms the input image), strength controls how much to change
  if (referenceImageUrl) {
    let publicRefUrl = referenceImageUrl;
    if (referenceImageUrl.startsWith("/api/") || referenceImageUrl.startsWith("/data/")) {
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://dashboard.autronis.nl";
      publicRefUrl = `${baseUrl}${referenceImageUrl}`;
    }
    input.image_url = publicRefUrl;
    // strength: 0 = exact copy, 1 = ignore image completely
    // Lower = more like original, Higher = more creative
    input.strength = 1 - (refStrength ?? 0.6); // Invert: UI 0.85 ref = 0.15 strength (very close to original)
  }

  // Debug: log what we're sending
  console.log("[KIE-IMAGE] Sending to Kie.ai:", JSON.stringify({ model: "nano-banana-2", input: { ...input, prompt: input.prompt.toString().slice(0, 50) + "..." } }, null, 2));

  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana-2",
      input,
    }),
  });

  const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

  if (data.code !== 200 || !data.data?.taskId) {
    return NextResponse.json({ error: data.msg ?? "Kie.ai fout." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
