import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentBanners, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { generateBannerData } from "@/lib/ai/banner-generator";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as { postId: number; formaat?: "instagram" | "linkedin" };
    const { postId, formaat = "instagram" } = body;

    if (!postId || typeof postId !== "number") {
      return NextResponse.json({ fout: "postId is verplicht" }, { status: 400 });
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
    const { templateType, data } = await generateBannerData(inhoud, post.titel);

    const result = await db
      .insert(contentBanners)
      .values({
        postId: post.id,
        templateType,
        templateVariant: 0,
        formaat,
        data: JSON.stringify(data),
        status: "concept",
      })
      .returning()
      .get();

    // Trigger render
    const renderUrl = new URL(`/api/content/banners/${result.id}/render`, req.url);
    await fetch(renderUrl, { method: "POST" }).catch(() => undefined);

    const updated = await db
      .select()
      .from(contentBanners)
      .where(eq(contentBanners.id, result.id))
      .get();

    return NextResponse.json({
      banner: {
        ...(updated ?? result),
        data,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
