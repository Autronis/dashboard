import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId verplicht." }, { status: 400 });

  const res = await fetch(
    `https://api.kie.ai/api/v1/runway/record-detail?taskId=${taskId}`,
    { headers: { "Authorization": `Bearer ${process.env.KIE_API_KEY}` } }
  );

  const data = await res.json() as {
    code: number;
    msg: string;
    data?: {
      state: string;
      failMsg?: string;
      videoInfo?: { videoUrl: string; imageUrl: string };
    };
  };

  if (data.code !== 200 || !data.data) {
    return NextResponse.json({ error: data.msg ?? "Status opvragen mislukt." }, { status: 500 });
  }

  const { state, failMsg, videoInfo } = data.data;

  if (state === "success" && videoInfo) {
    return NextResponse.json({ status: "done", videoUrl: videoInfo.videoUrl, thumbnailUrl: videoInfo.imageUrl });
  }
  if (state === "fail" || state === "failed") {
    return NextResponse.json({ status: "failed", error: failMsg ?? "Generatie mislukt." });
  }

  return NextResponse.json({ status: "processing" });
}
