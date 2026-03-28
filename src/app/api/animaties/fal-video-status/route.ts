import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const statusUrl = req.nextUrl.searchParams.get("statusUrl");
  const responseUrl = req.nextUrl.searchParams.get("responseUrl");

  if (!statusUrl) {
    return NextResponse.json({ error: "statusUrl is verplicht." }, { status: 400 });
  }

  const falKey = process.env.FAL_API_KEY;
  if (!falKey) {
    return NextResponse.json({ error: "FAL API key niet geconfigureerd." }, { status: 500 });
  }

  try {
    const statusRes = await fetch(statusUrl, {
      headers: { "Authorization": `Key ${falKey}` },
    });

    if (!statusRes.ok) {
      return NextResponse.json({ status: "processing" });
    }

    const statusData = await statusRes.json();

    if (statusData.status === "COMPLETED" && responseUrl) {
      // Fetch the actual result
      const resultRes = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${falKey}` },
      });
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
      falStatus: statusData.status,
    });
  } catch {
    return NextResponse.json({ status: "processing" });
  }
}
