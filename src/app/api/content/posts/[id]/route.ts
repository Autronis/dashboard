import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import type { ContentStatus } from "@/types/content";

interface PatchBody {
  status?: ContentStatus;
  bewerkteInhoud?: string;
  afwijsReden?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json({ fout: "Ongeldig post-ID" }, { status: 400 });
    }

    const body = await req.json() as PatchBody;
    const update: Record<string, string> = {
      bijgewerktOp: new Date().toISOString(),
    };

    if (body.status !== undefined) {
      update.status = body.status;
    }

    if (body.bewerkteInhoud !== undefined) {
      update.bewerkteInhoud = body.bewerkteInhoud;
      update.status = "bewerkt";
    }

    if (body.afwijsReden !== undefined) {
      update.afwijsReden = body.afwijsReden;
      update.status = "afgewezen";
    }

    const [updated] = await db
      .update(contentPosts)
      .set(update)
      .where(eq(contentPosts.id, postId))
      .returning();

    if (!updated) {
      return NextResponse.json({ fout: "Post niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ post: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const postId = parseInt(id, 10);

    if (isNaN(postId)) {
      return NextResponse.json({ fout: "Ongeldig post-ID" }, { status: 400 });
    }

    await db.delete(contentPosts).where(eq(contentPosts.id, postId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
