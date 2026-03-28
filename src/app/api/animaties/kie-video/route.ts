import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { prompt, firstFrameImage, lastFrameImage, duration } = await req.json() as {
    prompt: string;
    firstFrameImage?: string;
    lastFrameImage?: string;
    duration?: number;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is verplicht." }, { status: 400 });
  }

  // Kie.ai has a prompt length limit — truncate to essentials
  // Keep START FRAME, END FRAME, TRANSITION, STYLE, DURATION sections but shorten
  let videoPrompt = prompt;
  if (videoPrompt.length > 1500) {
    // Try to extract key sections
    const sections = {
      start: videoPrompt.match(/START FRAME:([^]*?)(?=END FRAME:|$)/i)?.[1]?.trim().slice(0, 200) ?? "",
      end: videoPrompt.match(/END FRAME:([^]*?)(?=TRANSITION:|$)/i)?.[1]?.trim().slice(0, 200) ?? "",
      transition: videoPrompt.match(/TRANSITION:([^]*?)(?=STYLE:|$)/i)?.[1]?.trim().slice(0, 400) ?? "",
      style: videoPrompt.match(/STYLE:([^]*?)(?=DURATION:|$)/i)?.[1]?.trim().slice(0, 150) ?? "",
    };
    videoPrompt = `START FRAME: ${sections.start}\nEND FRAME: ${sections.end}\nTRANSITION: ${sections.transition}\nSTYLE: ${sections.style}\nDURATION: ${duration ?? 5} seconds. 16:9. High fidelity.`;
  }

  const res = await fetch("https://api.kie.ai/api/v1/runway/generate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: videoPrompt,
      duration: duration ?? 5,
      quality: "720p",
      ...(firstFrameImage && { firstFrameImage }),
      ...(lastFrameImage && { lastFrameImage }),
    }),
  });

  const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

  if (data.code !== 200 || !data.data?.taskId) {
    return NextResponse.json({ error: data.msg ?? "Kie.ai fout." }, { status: 500 });
  }

  return NextResponse.json({ taskId: data.data.taskId });
}
