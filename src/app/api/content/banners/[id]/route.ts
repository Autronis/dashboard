import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentBanners, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { join } from "path";
import type { BannerData, BannerStatus } from "@/types/content";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const bannerId = parseInt(id, 10);

    if (isNaN(bannerId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const row = await db
      .select({
        id: contentBanners.id,
        postId: contentBanners.postId,
        templateType: contentBanners.templateType,
        templateVariant: contentBanners.templateVariant,
        formaat: contentBanners.formaat,
        data: contentBanners.data,
        imagePath: contentBanners.imagePath,
        status: contentBanners.status,
        gridPositie: contentBanners.gridPositie,
        aangemaaktOp: contentBanners.aangemaaktOp,
        postTitel: contentPosts.titel,
      })
      .from(contentBanners)
      .leftJoin(contentPosts, eq(contentBanners.postId, contentPosts.id))
      .where(eq(contentBanners.id, bannerId))
      .get();

    if (!row) {
      return NextResponse.json({ fout: "Banner niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({
      banner: { ...row, data: JSON.parse(row.data) as BannerData },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

interface PatchBannerBody {
  data?: BannerData;
  templateVariant?: number;
  gridPositie?: number;
  status?: BannerStatus;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const bannerId = parseInt(id, 10);

    if (isNaN(bannerId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json() as PatchBannerBody;
    const { data, templateVariant, gridPositie, status } = body;

    const updateValues: Record<string, unknown> = {};
    if (data !== undefined) updateValues.data = JSON.stringify(data);
    if (templateVariant !== undefined) updateValues.templateVariant = templateVariant;
    if (gridPositie !== undefined) updateValues.gridPositie = gridPositie;
    if (status !== undefined) updateValues.status = status;

    if (Object.keys(updateValues).length === 0) {
      return NextResponse.json({ fout: "Geen wijzigingen opgegeven" }, { status: 400 });
    }

    const result = await db
      .update(contentBanners)
      .set(updateValues)
      .where(eq(contentBanners.id, bannerId))
      .returning()
      .get();

    return NextResponse.json({
      banner: { ...result, data: JSON.parse(result.data) as BannerData },
    });
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
    const bannerId = parseInt(id, 10);

    if (isNaN(bannerId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const banner = await db
      .select({ imagePath: contentBanners.imagePath })
      .from(contentBanners)
      .where(eq(contentBanners.id, bannerId))
      .get();

    if (banner?.imagePath) {
      try {
        const filePath = join(process.cwd(), "public", banner.imagePath);
        await unlink(filePath);
      } catch {
        // File may already be gone; proceed with DB deletion
      }
    }

    await db.delete(contentBanners).where(eq(contentBanners.id, bannerId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
