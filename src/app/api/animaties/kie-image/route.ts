import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json() as { prompt: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is verplicht." }, { status: 400 });
  }

  const res = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana-2",
      input: {
        prompt,
        aspect_ratio: "16:9",
        resolution: "1K",
        output_format: "jpg",
      },
    }),
  });

  const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

  if (data.code !== 200 || !data.data?.taskId) {
    return NextResponse.json({ error: data.msg ?? "Kie.ai fout." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
