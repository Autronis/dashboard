import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { firstFrameImage, lastFrameImage, duration } = await req.json() as {
    prompt?: string;
    firstFrameImage?: string;
    lastFrameImage?: string;
    duration?: number;
  };

  if (!firstFrameImage || !lastFrameImage) {
    return NextResponse.json({ error: "Start- en eindframe afbeeldingen zijn verplicht." }, { status: 400 });
  }

  const res = await fetch("https://api.kie.ai/api/v1/runway/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: "smooth transition",
      duration: duration ?? 5,
      quality: "720p",
      firstFrameImage,
      lastFrameImage,
    }),
  });

  const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

  if (data.code !== 200 || !data.data?.taskId) {
    return NextResponse.json({ error: data.msg ?? "Kie.ai fout." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
