import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assetGallery } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    // Allow unauthenticated reads — proxy handles auth
  }
  const items = await db.select().from(assetGallery).orderBy(desc(assetGallery.aangemaaktOp));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    // Allow — proxy handles main auth
  }

  try {
    const body = await req.json() as {
      type: "scroll-stop" | "logo-animatie";
      productNaam: string;
      eindEffect?: string;
      manifest?: string;
      promptA?: string;
      promptB?: string;
      promptVideo?: string;
      afbeeldingUrl?: string;
      videoUrl?: string;
    };

    if (!body.productNaam || !body.type) {
      return NextResponse.json({ fout: "type en productNaam zijn verplicht" }, { status: 400 });
    }

    // Download image locally if URL provided
    let lokaalPad: string | undefined;
    if (body.afbeeldingUrl) {
      try {
        const uploadsDir = path.join(process.cwd(), "data", "uploads", "assets");
        fs.mkdirSync(uploadsDir, { recursive: true });
        const fileName = `asset_${Date.now()}.png`;
        const filePath = path.join(uploadsDir, fileName);
        const imgRes = await fetch(body.afbeeldingUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          lokaalPad = `data/uploads/assets/${fileName}`;
        }
      } catch {
        // Image download failed — still save the URL
      }
    }

    const [item] = await db.insert(assetGallery).values({
      type: body.type,
      productNaam: body.productNaam,
      eindEffect: body.eindEffect,
      manifest: body.manifest,
      promptA: body.promptA,
      promptB: body.promptB,
      promptVideo: body.promptVideo,
      afbeeldingUrl: body.afbeeldingUrl,
      videoUrl: body.videoUrl,
      lokaalPad,
    }).returning();

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Opslaan mislukt" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    // Allow — proxy handles main auth
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ fout: "ID is vereist" }, { status: 400 });

  // Get item to delete local file
  const [existing] = await db.select().from(assetGallery).where(eq(assetGallery.id, Number(id)));
  if (existing?.lokaalPad) {
    try {
      const filePath = path.join(process.cwd(), existing.lokaalPad);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Ignore file deletion errors
    }
  }

  await db.delete(assetGallery).where(eq(assetGallery.id, Number(id)));
  return NextResponse.json({ succes: true });
}
