import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentVideos, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { generateVideoScript } from "@/lib/ai/video-script-generator";

export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: contentVideos.id,
        postId: contentVideos.postId,
        titel: contentVideos.titel,
        templateId: contentVideos.templateId,
        script: contentVideos.script,
        status: contentVideos.status,
        videoPath: contentVideos.videoPath,
        formaat: contentVideos.formaat,
        duurSeconden: contentVideos.duurSeconden,
        aangemaaktOp: contentVideos.aangemaaktOp,
        postTitel: contentPosts.titel,
        postPlatform: contentPosts.platform,
      })
      .from(contentVideos)
      .leftJoin(contentPosts, eq(contentVideos.postId, contentPosts.id))
      .orderBy(desc(contentVideos.aangemaaktOp));

    return NextResponse.json({ videos: rows });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as {
      postId?: number;
      titel?: string;
      script?: string;
      formaat?: string;
    };

    // Mode 1: Direct script from Video Studio (no postId needed)
    if (body.script && body.titel) {
      const scriptData = typeof body.script === "string" ? JSON.parse(body.script) : body.script;
      const scenes = scriptData.scenes ?? scriptData;
      const totaalSeconden = (Array.isArray(scenes) ? scenes : []).reduce(
        (sum: number, scene: { duur?: number }) => sum + (scene.duur ?? 3), 0
      );

      const validFormaat = ["square", "reels", "feed", "youtube"].includes(body.formaat ?? "")
        ? (body.formaat as "square" | "reels" | "feed" | "youtube")
        : "square";

      const result = await db
        .insert(contentVideos)
        .values({
          titel: body.titel,
          script: typeof body.script === "string" ? body.script : JSON.stringify(body.script),
          status: "script",
          formaat: validFormaat,
          duurSeconden: totaalSeconden,
        })
        .returning()
        .get();

      return NextResponse.json({
        video: {
          id: result.id,
          script: scenes,
          status: result.status,
          duurSeconden: result.duurSeconden,
          formaat: result.formaat,
          aangemaaktOp: result.aangemaaktOp,
        },
      });
    }

    // Mode 2: Generate from post (existing flow)
    const { postId } = body;

    if (!postId || typeof postId !== "number") {
      return NextResponse.json({ fout: "postId of titel+script is verplicht" }, { status: 400 });
    }

    const post = await db
      .select()
      .from(contentPosts)
      .where(eq(contentPosts.id, postId))
      .get();

    if (!post) {
      return NextResponse.json({ fout: "Post niet gevonden" }, { status: 404 });
    }

    const inhoud = post.bewerkteInhoud ?? post.inhoud;
    const scenes = await generateVideoScript(inhoud, post.titel);

    const totaalSeconden = scenes.reduce((sum, scene) => sum + (scene.duur ?? 3), 0);

    const result = await db
      .insert(contentVideos)
      .values({
        postId: post.id,
        script: JSON.stringify(scenes),
        status: "script",
        duurSeconden: totaalSeconden,
      })
      .returning()
      .get();

    return NextResponse.json({
      video: {
        id: result.id,
        script: scenes,
        status: result.status,
        duurSeconden: result.duurSeconden,
        postId: result.postId,
        aangemaaktOp: result.aangemaaktOp,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
