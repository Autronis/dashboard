// src/app/api/proposals/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { fout: "BLOB_READ_WRITE_TOKEN niet ingesteld in env." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ fout: "Geen bestand ontvangen." }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { fout: `Bestandstype niet toegestaan (${file.type}). Alleen JPEG, PNG of WebP.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { fout: `Bestand te groot (max ${MAX_BYTES / 1024 / 1024}MB).` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "bin";
    const filename = `proposals/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Upload mislukt" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
