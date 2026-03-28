import { NextRequest, NextResponse } from "next/server";

// FAL.ai Kling O3 Pro — supports start frame + end frame image-to-video
const FAL_ENDPOINT = "https://queue.fal.run/fal-ai/kling-video/o3/pro/image-to-video";

export async function POST(req: NextRequest) {
  const { prompt, startFrameUrl, endFrameUrl, duration } = await req.json() as {
    prompt: string;
    startFrameUrl: string;
    endFrameUrl: string;
    duration?: string;
  };

  if (!startFrameUrl || !endFrameUrl) {
    return NextResponse.json({ error: "Start frame (B) en end frame (A) zijn verplicht." }, { status: 400 });
  }

  const falKey = process.env.FAL_API_KEY;
  if (!falKey) {
    return NextResponse.json({ error: "FAL API key niet geconfigureerd." }, { status: 500 });
  }

  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Key ${falKey}`,
    },
    body: JSON.stringify({
      prompt: (prompt || "smooth satisfying product assembly transition, white background").slice(0, 500),
      image_url: startFrameUrl,
      end_image_url: endFrameUrl,
      duration: duration || "5",
      aspect_ratio: "16:9",
    }),
  });

  if (res.status === 403) {
    const data = await res.json();
    return NextResponse.json({ error: data.detail || "FAL account heeft geen saldo. Top up op fal.ai/dashboard/billing." }, { status: 402 });
  }

  // FAL returns a request_id for async processing
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data.detail || data.message || "FAL fout." }, { status: res.status });
  }

  // FAL queue returns request_id for polling
  return NextResponse.json({
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  });
}
