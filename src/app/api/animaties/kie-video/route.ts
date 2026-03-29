import { NextRequest, NextResponse } from "next/server";

// Words/phrases that trigger Kie.ai content policy flags
const BLOCKED_WORDS = [
  "explosion", "explode", "exploding", "exploded", "blow up", "blowing up",
  "destroy", "destruction", "shatter", "shattering", "smash", "smashing",
  "crash", "crashing", "break apart", "breaking apart", "rip apart",
  "tear apart", "burst", "bursting", "detonate", "detonation",
  "weapon", "gun", "knife", "blood", "gore", "violence", "violent",
  "kill", "death", "dead", "murder", "attack", "bomb", "bombing",
  "fire", "burning", "flames", "smoke",
  "nude", "naked", "nsfw", "sexual", "explicit",
];

function sanitizePrompt(prompt: string): string {
  let clean = prompt;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    // Replace with safe alternatives
    if (["explosion", "explode", "exploding", "exploded"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "separation");
    } else if (["shatter", "shattering"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "divide into pieces");
    } else if (["destroy", "destruction"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "transform");
    } else if (["break apart", "breaking apart", "rip apart", "tear apart"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "separate");
    } else if (["burst", "bursting"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "expand");
    } else if (["crash", "crashing", "smash", "smashing"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "impact");
    } else if (["fire", "burning", "flames"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "glow");
    } else if (["smoke"].includes(word.toLowerCase())) {
      clean = clean.replace(regex, "mist");
    } else {
      clean = clean.replace(regex, "");
    }
  }
  // Clean up double spaces
  return clean.replace(/\s{2,}/g, " ").trim();
}

export async function POST(req: NextRequest) {
  const { prompt, imageUrl, duration } = await req.json() as {
    prompt?: string;
    imageUrl?: string;
    duration?: number;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is verplicht." }, { status: 400 });
  }

  const body: Record<string, string | number> = {
    prompt: sanitizePrompt(prompt.slice(0, 500)),
    duration: duration && [5, 10].includes(duration) ? duration : 5,
    quality: "720p",
  };

  // imageUrl makes it image-to-video (start frame)
  if (imageUrl) {
    body.imageUrl = imageUrl;
  }

  const res = await fetch("https://api.kie.ai/api/v1/runway/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

  if (data.code !== 200 || !data.data?.taskId) {
    return NextResponse.json({ error: data.msg ?? "Kie.ai fout." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
