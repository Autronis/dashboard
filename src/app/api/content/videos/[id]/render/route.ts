import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentVideos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

type VideoFormaat = "square" | "reels" | "feed" | "youtube";

const FORMAAT_COMPOSITION: Record<VideoFormaat, string> = {
  square: "AutronisVideoSquare",
  reels: "AutronisVideoReels",
  feed: "AutronisVideoFeed",
  youtube: "AutronisVideoYouTube",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const videoId = parseInt(id, 10);

    if (isNaN(videoId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    // Parse optional formaat from request body
    let formaat: VideoFormaat = "square";
    try {
      const body = await req.json() as { formaat?: string };
      if (body.formaat && body.formaat in FORMAAT_COMPOSITION) {
        formaat = body.formaat as VideoFormaat;
      }
    } catch {
      // No body or invalid JSON — use default format
    }

    const video = await db
      .select()
      .from(contentVideos)
      .where(eq(contentVideos.id, videoId))
      .get();

    if (!video) {
      return NextResponse.json({ fout: "Video niet gevonden" }, { status: 404 });
    }

    // Ensure videos directory exists
    const videosDir = path.join(process.cwd(), "public", "videos");
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Set status to rendering and store format
    await db
      .update(contentVideos)
      .set({ status: "rendering", formaat })
      .where(eq(contentVideos.id, videoId));

    const suffix = formaat === "square" ? "" : `-${formaat}`;
    const outputPath = path.join(videosDir, `${videoId}${suffix}.mp4`);
    const propsPath = path.join(videosDir, `${videoId}-props.json`);

    // Write props to temp file
    fs.writeFileSync(propsPath, video.script);

    const compositionId = FORMAAT_COMPOSITION[formaat];

    // Spawn Remotion CLI render as child process (avoids bundling issues with Next.js)
    const cmd = `npx remotion render src/remotion/index.ts ${compositionId} "${outputPath}" --props="${propsPath}"`;

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { cwd: process.cwd(), timeout: 300000 }, async (error) => {
        // Clean up props file
        try { fs.unlinkSync(propsPath); } catch {}

        if (error) {
          await db
            .update(contentVideos)
            .set({ status: "fout" })
            .where(eq(contentVideos.id, videoId));

          resolve(NextResponse.json(
            { fout: "Video rendering mislukt" },
            { status: 500 }
          ));
          return;
        }

        const scenes = JSON.parse(video.script) as Array<{ duur?: number }>;
        const totalSeconds = scenes.reduce((sum: number, s) => sum + (s.duur ?? 3), 0);

        const publicPath = `/videos/${videoId}${suffix}.mp4`;

        await db
          .update(contentVideos)
          .set({
            status: "klaar",
            videoPath: publicPath,
            duurSeconden: totalSeconds,
            formaat,
          })
          .where(eq(contentVideos.id, videoId));

        resolve(NextResponse.json({
          succes: true,
          videoPath: publicPath,
          duurSeconden: totalSeconds,
          formaat,
        }));
      });
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
