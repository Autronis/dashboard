import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt, firstFrameImage, lastFrameImage, duration } = await req.json() as {
    prompt?: string;
    firstFrameImage?: string;
    lastFrameImage?: string;
    duration?: number;
  };

  if (!firstFrameImage) {
    return NextResponse.json({ error: "Start frame afbeelding (A) is verplicht." }, { status: 400 });
  }

  // Kie.ai Runway supports ONE input image (start frame) via imageUrl.
  // The prompt guides the transition. Keep it short and focused on motion.
  const videoPrompt = prompt?.trim() || "smooth satisfying mechanical transition, white background, product photography";

  const res = await fetch("https://api.kie.ai/api/v1/runway/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: videoPrompt.slice(0, 200),
      duration: duration ?? 5,
      quality: "720p",
      imageUrl: firstFrameImage,
    }),
  });

  const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

  if (data.code !== 200 || !data.data?.taskId) {
    return NextResponse.json({ error: data.msg ?? "Kie.ai fout." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
