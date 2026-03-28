import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const requestId = req.nextUrl.searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId is verplicht." }, { status: 400 });
  }

  const falKey = process.env.FAL_API_KEY;
  if (!falKey) {
    return NextResponse.json({ error: "FAL API key niet geconfigureerd." }, { status: 500 });
  }

  // Check status
  const statusRes = await fetch(
    `https://queue.fal.run/fal-ai/kling-video/o3/pro/image-to-video/requests/${requestId}/status`,
    { headers: { "Authorization": `Key ${falKey}` } }
  );
  const statusData = await statusRes.json();

  if (statusData.status === "COMPLETED") {
    // Get the result
    const resultRes = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/o3/pro/image-to-video/requests/${requestId}`,
      { headers: { "Authorization": `Key ${falKey}` } }
    );
    const resultData = await resultRes.json();
    const videoUrl = resultData.video?.url;

    if (videoUrl) {
      return NextResponse.json({ status: "done", videoUrl });
    }
    return NextResponse.json({ status: "done", error: "Geen video URL in response." });
  }

  if (statusData.status === "FAILED") {
    return NextResponse.json({
      status: "failed",
      error: statusData.error || "Video generatie mislukt.",
    });
  }

  // Still processing
  return NextResponse.json({
    status: "processing",
    queuePosition: statusData.queue_position,
  });
}
