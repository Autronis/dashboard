import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq, and } from "drizzle-orm";
import type { ContentStatus, ContentPlatform } from "@/types/content";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") as ContentStatus | null;
    const platformParam = searchParams.get("platform") as ContentPlatform | null;
    const batchWeekParam = searchParams.get("batchWeek");

    const conditions = [];

    if (statusParam) {
      conditions.push(eq(contentPosts.status, statusParam));
    }
    if (platformParam) {
      conditions.push(eq(contentPosts.platform, platformParam));
    }
    if (batchWeekParam) {
      conditions.push(eq(contentPosts.batchWeek, batchWeekParam));
    }

    const rows = await db
      .select()
      .from(contentPosts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contentPosts.aangemaaktOp));

    const posts = rows.map((row) => ({
      ...row,
      hashtags: (() => {
        try {
          return JSON.parse(row.gegenereerdeHashtags ?? "[]") as string[];
        } catch {
          return [];
        }
      })(),
    }));

    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
