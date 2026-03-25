import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return NextResponse.json({ error: "taskId verplicht." }, { status: 400 });

  const res = await fetch(
    `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
    { headers: { "Authorization": `Bearer ${process.env.KIE_API_KEY}` } }
  );

  const data = await res.json() as {
    code: number;
    msg: string;
    data?: {
      state: string;
      failMsg?: string;
      resultJson?: string;
    };
  };

  if (data.code !== 200 || !data.data) {
    return NextResponse.json({ error: data.msg ?? "Status opvragen mislukt." }, { status: 500 });
  }

  const { state, failMsg, resultJson } = data.data;

  if (state === "success" && resultJson) {
    const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
    const imageUrl = parsed.resultUrls?.[0];
    if (imageUrl) {
      return NextResponse.json({ status: "done", imageUrl });
    }
  }

  if (state === "fail" || state === "failed") {
    return NextResponse.json({ status: "failed", error: failMsg ?? "Generatie mislukt." });
  }

  return NextResponse.json({ status: "processing" });
}
