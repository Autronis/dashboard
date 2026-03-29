import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = (await req.json()) as {
      onderwerp?: string;
      illustration?: string;
      formaat?: string;
    };

    const { onderwerp, formaat } = body;

    if (!onderwerp || typeof onderwerp !== "string") {
      return NextResponse.json({ fout: "Onderwerp is verplicht" }, { status: 400 });
    }

    // Build Kie.ai prompt — dark teal tech background matching Autronis brand
    const prompt = `Abstract dark tech background illustration for "${onderwerp}". Dark background (#0B1A1F to #081215 gradient). Subtle teal (#2DD4A8) glowing elements: thin circuit lines, flowing data streams, geometric shapes, node connections, or mechanical outlines. Very subtle, low opacity — must work as a background behind text. No solid objects, no 3D renders, no text. Think: dark abstract wallpaper with faint teal tech patterns. Cinematic, moody, minimal. The illustration should suggest the theme "${onderwerp}" through abstract shapes, not literal icons.`;

    // Determine aspect ratio
    let aspectRatio = "4:5"; // Instagram default
    if (formaat === "instagram_square") aspectRatio = "1:1";
    else if (formaat === "instagram_story") aspectRatio = "9:16";
    else if (formaat === "linkedin") aspectRatio = "16:9";

    // Generate via Kie.ai
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
          aspect_ratio: aspectRatio,
          resolution: "1K",
          output_format: "jpg",
        },
      }),
    });

    const data = await res.json() as { code: number; msg: string; data?: { taskId: string } };

    if (data.code !== 200 || !data.data?.taskId) {
      return NextResponse.json({ fout: data.msg ?? "Kie.ai fout" }, { status: 500 });
    }

    // Poll for result (max 60 seconds)
    const taskId = data.data.taskId;
    let imageUrl: string | null = null;

    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 4000));

      const pollRes = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: { "Authorization": `Bearer ${process.env.KIE_API_KEY}` },
      });
      const pollData = await pollRes.json() as {
        code: number;
        data?: { state: string; resultJson?: string; failMsg?: string };
      };

      if (pollData.data?.state === "success" && pollData.data.resultJson) {
        const result = JSON.parse(pollData.data.resultJson) as { resultUrls?: string[] };
        imageUrl = result.resultUrls?.[0] ?? null;
        break;
      }
      if (pollData.data?.state === "fail" || pollData.data?.state === "failed") {
        return NextResponse.json({ fout: pollData.data.failMsg ?? "Generatie mislukt" }, { status: 500 });
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ fout: "Timeout — probeer opnieuw" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      imagePath: imageUrl,
      prompt: prompt.substring(0, 200) + "...",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI achtergrond genereren mislukt";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
