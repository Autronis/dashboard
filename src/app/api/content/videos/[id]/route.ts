import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentVideos, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
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

    const row = await db
      .select({
        id: contentVideos.id,
        postId: contentVideos.postId,
        script: contentVideos.script,
        status: contentVideos.status,
        videoPath: contentVideos.videoPath,
        duurSeconden: contentVideos.duurSeconden,
        aangemaaktOp: contentVideos.aangemaaktOp,
        postTitel: contentPosts.titel,
        postPlatform: contentPosts.platform,
      })
      .from(contentVideos)
      .leftJoin(contentPosts, eq(contentVideos.postId, contentPosts.id))
      .where(eq(contentVideos.id, videoId))
      .get();

    if (!row) {
      return NextResponse.json({ fout: "Video niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ video: row });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(
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

    await db.delete(contentVideos).where(eq(contentVideos.id, videoId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
