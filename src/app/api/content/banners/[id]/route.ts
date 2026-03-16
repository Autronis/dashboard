import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentBanners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { join } from "path";
import type { BannerStatus } from "@/types/content";

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

interface PatchBannerBody {
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
    const { status } = body;

    if (!status) {
      return NextResponse.json({ fout: "Geen wijzigingen opgegeven" }, { status: 400 });
    }

    await db
      .update(contentBanners)
      .set({ status })
      .where(eq(contentBanners.id, bannerId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
