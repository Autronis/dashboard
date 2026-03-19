import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentBanners } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { desc } from "drizzle-orm";
import type { BannerFormaat, BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_ICONS, BANNER_ILLUSTRATIONS, BANNER_FORMAAT_SIZES } from "@/types/content";

export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: contentBanners.id,
        data: contentBanners.data,
        formaat: contentBanners.formaat,
        imagePath: contentBanners.imagePath,
        status: contentBanners.status,
        aangemaaktOp: contentBanners.aangemaaktOp,
      })
      .from(contentBanners)
      .orderBy(desc(contentBanners.aangemaaktOp));

    const banners = rows.map((row) => {
      const parsed = JSON.parse(row.data) as {
        onderwerp?: string;
        icon?: string;
        illustration?: string;
      };
      return {
        id: row.id,
        onderwerp: parsed.onderwerp ?? "",
        icon: parsed.icon ?? "cog",
        illustration: parsed.illustration ?? "gear",
        formaat: row.formaat,
        imagePath: row.imagePath ?? undefined,
        status: row.status ?? "concept",
        aangemaaktOp: row.aangemaaktOp ?? new Date().toISOString(),
      };
    });

    return NextResponse.json({ banners });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

interface SaveBannerBody {
  onderwerp: string;
  icon: BannerIcon;
  illustration: BannerIllustration;
  formaat: BannerFormaat;
  illustrationScale?: number;
  illustrationOffsetX?: number;
  illustrationOffsetY?: number;
  aiBgUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as SaveBannerBody;
    const { onderwerp, icon, illustration, formaat, illustrationScale, illustrationOffsetX, illustrationOffsetY, aiBgUrl } = body;

    if (!onderwerp || typeof onderwerp !== "string" || onderwerp.trim().length === 0) {
      return NextResponse.json({ fout: "Onderwerp is verplicht" }, { status: 400 });
    }
    if (!(BANNER_ICONS as readonly string[]).includes(icon)) {
      return NextResponse.json({ fout: "Ongeldig icon" }, { status: 400 });
    }
    if (!(BANNER_ILLUSTRATIONS as readonly string[]).includes(illustration)) {
      return NextResponse.json({ fout: "Ongeldige illustratie" }, { status: 400 });
    }
    if (!(formaat in BANNER_FORMAAT_SIZES)) {
      return NextResponse.json({ fout: "Ongeldig formaat" }, { status: 400 });
    }

    const data = JSON.stringify({
      onderwerp: onderwerp.trim(),
      icon,
      illustration,
      illustrationScale: illustrationScale ?? 1.0,
      illustrationOffsetX: illustrationOffsetX ?? 0,
      illustrationOffsetY: illustrationOffsetY ?? 0,
      ...(aiBgUrl ? { aiBgUrl } : {}),
    });

    const result = await db
      .insert(contentBanners)
      .values({
        templateType: "capsule",
        templateVariant: 0,
        formaat,
        data,
        status: "concept",
      })
      .returning()
      .get();

    return NextResponse.json({
      banner: {
        id: result.id,
        onderwerp: onderwerp.trim(),
        icon,
        illustration,
        formaat: result.formaat,
        imagePath: result.imagePath ?? undefined,
        status: result.status ?? "concept",
        aangemaaktOp: result.aangemaaktOp ?? new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
