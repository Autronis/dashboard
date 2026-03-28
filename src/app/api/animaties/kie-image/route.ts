import { NextRequest, NextResponse } from "next/server";

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
    prompt,
    aspect_ratio: "16:9",
    resolution: "1K",
    output_format: "jpg",
  };

  // If a reference image URL is provided (e.g. image A for generating B),
  // include it as reference for style/content consistency
  if (referenceImageUrl) {
    input.ref_image = referenceImageUrl;
    input.ref_strength = refStrength ?? 0.6;
  }

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
