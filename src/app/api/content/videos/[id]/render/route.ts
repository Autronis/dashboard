import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentVideos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const videoId = parseInt(id, 10);

    if (isNaN(videoId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
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

    // Set status to rendering
    await db
      .update(contentVideos)
      .set({ status: "rendering" })
      .where(eq(contentVideos.id, videoId));

    const outputPath = path.join(videosDir, `${videoId}.mp4`);
    const propsPath = path.join(videosDir, `${videoId}-props.json`);

    // Write props to temp file
    fs.writeFileSync(propsPath, video.script);

    // Spawn Remotion CLI render as child process (avoids bundling issues with Next.js)
    const cmd = `npx remotion render src/remotion/index.ts AutronisVideo "${outputPath}" --props="${propsPath}"`;

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

        const scenes = JSON.parse(video.script);
        const totalSeconds = scenes.reduce((sum: number, s: { duur?: number }) => sum + (s.duur ?? 3), 0);

        await db
          .update(contentVideos)
          .set({
            status: "klaar",
            videoPath: `/videos/${videoId}.mp4`,
            duurSeconden: totalSeconds,
          })
          .where(eq(contentVideos.id, videoId));

        resolve(NextResponse.json({
          succes: true,
          videoPath: `/videos/${videoId}.mp4`,
          duurSeconden: totalSeconds,
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
