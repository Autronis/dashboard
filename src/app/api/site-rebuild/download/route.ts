import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import archiver from "archiver";
import { buildScaffoldFiles } from "@/lib/site-rebuild-scaffold";

// POST /api/site-rebuild/download
// Body: { brandName: string, accent: string, jsxBody: string }
// Response: application/zip stream with a full Next.js project
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const brandName: string = (body?.brandName ?? "").trim();
    const accent: string = (body?.accent ?? "#17B8A5").trim();
    const jsxBody: string = body?.jsxBody ?? "";

    if (!brandName || !jsxBody) {
      return NextResponse.json(
        { fout: "brandName en jsxBody zijn verplicht" },
        { status: 400 }
      );
    }

    const files = buildScaffoldFiles({ brandName, accent, pageContent: jsxBody });

    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    // Collect zip output into buffer
    const done = new Promise<void>((resolve, reject) => {
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      archive.on("end", () => resolve());
      archive.on("error", (err) => reject(err));
    });

    for (const [path, content] of Object.entries(files)) {
      archive.append(content, { name: path });
    }
    await archive.finalize();
    await done;

    const buffer = Buffer.concat(chunks);
    const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "site";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-site.zip"`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: msg },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
