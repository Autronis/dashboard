import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Upload base64 image and return a public URL
export async function POST(req: NextRequest) {
  const { base64, mediaType } = await req.json() as {
    base64: string;
    mediaType?: string;
  };

  if (!base64) {
    return NextResponse.json({ error: "base64 is verplicht" }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), "data", "uploads", "assets");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const ext = mediaType?.includes("png") ? ".png" : mediaType?.includes("webp") ? ".webp" : ".jpg";
  const fileName = `upload_${Date.now()}${ext}`;
  const filePath = path.join(uploadsDir, fileName);

  const buffer = Buffer.from(base64, "base64");
  fs.writeFileSync(filePath, buffer);

  const lokaalPad = `data/uploads/assets/${fileName}`;

  // Build public URL using the dashboard's public URL
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://dashboard.autronis.nl";
  const publicUrl = `${baseUrl}/api/assets/file?path=${encodeURIComponent(lokaalPad)}`;

  return NextResponse.json({ url: publicUrl, lokaalPad });
}
