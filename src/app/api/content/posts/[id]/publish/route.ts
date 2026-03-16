import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json({ fout: "Ongeldig post-ID" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: contentPosts.id })
      .from(contentPosts)
      .where(eq(contentPosts.id, postId));

    if (!existing) {
      return NextResponse.json({ fout: "Post niet gevonden" }, { status: 404 });
    }

    const now = new Date().toISOString();

    await db
      .update(contentPosts)
      .set({
        status: "gepubliceerd",
        gepubliceerdOp: now,
        bijgewerktOp: now,
      })
      .where(eq(contentPosts.id, postId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
