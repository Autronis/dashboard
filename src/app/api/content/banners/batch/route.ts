import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentBanners, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { notInArray, inArray } from "drizzle-orm";
import { generateBannerData } from "@/lib/ai/banner-generator";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    // Get all posts that are goedgekeurd or bewerkt
    const eligiblePosts = await db
      .select({ id: contentPosts.id, titel: contentPosts.titel, inhoud: contentPosts.inhoud, bewerkteInhoud: contentPosts.bewerkteInhoud })
      .from(contentPosts)
      .where(inArray(contentPosts.status, ["goedgekeurd", "bewerkt"]));

    if (eligiblePosts.length === 0) {
      return NextResponse.json({ generated: 0, failed: 0, bericht: "Geen geschikte posts gevonden" });
    }

    // Find posts that already have a banner
    const existingBannerPostIds = await db
      .select({ postId: contentBanners.postId })
      .from(contentBanners)
      .where(notInArray(contentBanners.postId, [0]));

    const banneredPostIds = new Set(
      existingBannerPostIds
        .map((r) => r.postId)
        .filter((id): id is number => id !== null)
    );

    const postsWithoutBanner = eligiblePosts.filter((p) => !banneredPostIds.has(p.id));

    if (postsWithoutBanner.length === 0) {
      return NextResponse.json({ generated: 0, failed: 0, bericht: "Alle posts hebben al een banner" });
    }

    let generated = 0;
    let failed = 0;

    for (const post of postsWithoutBanner) {
      try {
        const inhoud = post.bewerkteInhoud ?? post.inhoud;
        const { templateType, data } = await generateBannerData(inhoud, post.titel);

        const result = await db
          .insert(contentBanners)
          .values({
            postId: post.id,
            templateType,
            templateVariant: 0,
            formaat: "instagram",
            data: JSON.stringify(data),
            status: "concept",
          })
          .returning()
          .get();

        // Trigger render without waiting
        const renderUrl = new URL(`/api/content/banners/${result.id}/render`, req.url);
        fetch(renderUrl, { method: "POST" }).catch(() => undefined);

        generated++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ generated, failed });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
