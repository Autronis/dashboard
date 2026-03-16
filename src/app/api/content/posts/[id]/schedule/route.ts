import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

interface PatchBody {
  geplandOp: string;
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

    if (!body.geplandOp) {
      return NextResponse.json({ fout: "geplandOp is verplicht" }, { status: 400 });
    }

    const [existing] = await db
      .select({ status: contentPosts.status })
      .from(contentPosts)
      .where(eq(contentPosts.id, postId));

    if (!existing) {
      return NextResponse.json({ fout: "Post niet gevonden" }, { status: 404 });
    }

    if (existing.status !== "goedgekeurd" && existing.status !== "bewerkt") {
      return NextResponse.json(
        { fout: "Alleen goedgekeurde of bewerkte posts kunnen worden ingepland" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(contentPosts)
      .set({
        geplandOp: body.geplandOp,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(contentPosts.id, postId))
      .returning();

    return NextResponse.json({ succes: true, geplandOp: updated.geplandOp });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
