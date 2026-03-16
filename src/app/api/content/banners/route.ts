import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentBanners, contentPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import type { BannerTemplateType, BannerFormaat, BannerData } from "@/types/content";

export async function GET() {
  try {
    await requireAuth();

    const rows = await db
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
      .orderBy(desc(contentBanners.aangemaaktOp));

    const banners = rows.map((row) => ({
      ...row,
      data: JSON.parse(row.data) as BannerData,
    }));

    return NextResponse.json({ banners });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

interface CreateBannerBody {
  postId?: number;
  templateType: BannerTemplateType;
  templateVariant?: number;
  formaat: BannerFormaat;
  data: BannerData;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as CreateBannerBody;
    const { postId, templateType, templateVariant, formaat, data } = body;

    const VALID_TYPES: BannerTemplateType[] = ["quote", "stat", "tip", "case_study"];
    const VALID_FORMAATS: BannerFormaat[] = ["instagram", "linkedin"];

    if (!VALID_TYPES.includes(templateType)) {
      return NextResponse.json({ fout: "Ongeldig templateType" }, { status: 400 });
    }
    if (!VALID_FORMAATS.includes(formaat)) {
      return NextResponse.json({ fout: "Ongeldig formaat" }, { status: 400 });
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json({ fout: "Data is verplicht" }, { status: 400 });
    }

    const result = await db
      .insert(contentBanners)
      .values({
        postId: postId ?? null,
        templateType,
        templateVariant: templateVariant ?? 0,
        formaat,
        data: JSON.stringify(data),
        status: "concept",
      })
      .returning()
      .get();

    return NextResponse.json({
      banner: {
        ...result,
        data: JSON.parse(result.data) as BannerData,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
