import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = process.env.PROJECTS_DIR || "/Users/semmiegijs/Autronis/Projects";

export async function GET() {
  try {
    await requireAuth();

    let mappen: { naam: string; pad: string }[] = [];

    try {
      const entries = await readdir(PROJECTS_DIR);
      for (const entry of entries) {
        const fullPath = join(PROJECTS_DIR, entry);
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          mappen.push({ naam: entry, pad: fullPath });
        }
      }
      mappen.sort((a, b) => a.naam.localeCompare(b.naam));
    } catch {
      // On Vercel (no local filesystem), return known projects
      mappen = [
        { naam: "autronis-dashboard", pad: `${PROJECTS_DIR}/autronis-dashboard` },
        { naam: "investment-engine", pad: `${PROJECTS_DIR}/investment-engine` },
        { naam: "speak-to-text", pad: `${PROJECTS_DIR}/speak-to-text` },
      ];
    }

    return NextResponse.json({ mappen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
