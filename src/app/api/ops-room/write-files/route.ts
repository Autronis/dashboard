import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { existsSync } from "fs";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// POST /api/ops-room/write-files
// Body: { bestanden: [{ pad: string, actie: "create" | "edit", inhoud: string }], projectDir?: string }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const body = await req.json();
    const { bestanden, projectDir } = body as {
      bestanden: { pad: string; actie: string; inhoud: string }[];
      projectDir?: string;
    };

    if (!bestanden || !Array.isArray(bestanden)) {
      return NextResponse.json({ fout: "bestanden array is verplicht" }, { status: 400 });
    }

    // Default project directory
    const baseDir = projectDir ?? process.cwd();
    const results: { pad: string; status: string }[] = [];

    for (const bestand of bestanden) {
      try {
        const fullPath = join(baseDir, bestand.pad);

        // Security: prevent path traversal
        if (!fullPath.startsWith(baseDir)) {
          results.push({ pad: bestand.pad, status: "geblokkeerd: pad buiten project" });
          continue;
        }

        // Ensure directory exists
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
        }

        await writeFile(fullPath, bestand.inhoud, "utf-8");
        results.push({ pad: bestand.pad, status: "geschreven" });
      } catch (err) {
        results.push({
          pad: bestand.pad,
          status: `fout: ${err instanceof Error ? err.message : "onbekend"}`,
        });
      }
    }

    return NextResponse.json({
      succes: true,
      resultaten: results,
      aantalGeschreven: results.filter((r) => r.status === "geschreven").length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
