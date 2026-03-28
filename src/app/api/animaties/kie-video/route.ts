import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt, imageUrl } = await req.json() as {
    prompt?: string;
    imageUrl?: string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is verplicht." }, { status: 400 });
  }

  const body: Record<string, string | number> = {
    prompt: prompt.slice(0, 500),
    duration: 10,
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
