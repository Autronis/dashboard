import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentVideos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";
import type { Scene } from "@/types/content";

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

    let scenes: Scene[];
    try {
      scenes = JSON.parse(video.script) as Scene[];
    } catch {
      return NextResponse.json({ fout: "Script kan niet worden gelezen" }, { status: 400 });
    }

    // Set status to rendering
    await db
      .update(contentVideos)
      .set({ status: "rendering" })
      .where(eq(contentVideos.id, videoId));

    try {
      const { bundle } = await import("@remotion/bundler");
      const { renderMedia, selectComposition } = await import("@remotion/renderer");

      const videosDir = path.join(process.cwd(), "public", "videos");
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }

      const outputPath = path.join(videosDir, `${videoId}.mp4`);
      const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");

      const bundled = await bundle({
        entryPoint,
        onProgress: () => undefined,
      });

      const inputProps = { scenes };

      const composition = await selectComposition({
        serveUrl: bundled,
        id: "AutronisVideo",
        inputProps,
      });

      await renderMedia({
        composition,
        serveUrl: bundled,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        onProgress: () => undefined,
      });

      const totalSeconds = scenes.reduce((sum, scene) => sum + (scene.duur ?? 3), 0);

      await db
        .update(contentVideos)
        .set({
          status: "klaar",
          videoPath: `/videos/${videoId}.mp4`,
          duurSeconden: totalSeconds,
        })
        .where(eq(contentVideos.id, videoId));

      return NextResponse.json({
        ok: true,
        videoPath: `/videos/${videoId}.mp4`,
        duurSeconden: totalSeconds,
      });
    } catch (renderError) {
      await db
        .update(contentVideos)
        .set({ status: "fout" })
        .where(eq(contentVideos.id, videoId));

      throw renderError;
    }
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
