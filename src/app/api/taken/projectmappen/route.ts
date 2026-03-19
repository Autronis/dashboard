import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { readdir, stat } from "fs/promises";
import { join } from "path";

const PROJECTS_DIR = "C:\\Users\\semmi\\OneDrive\\Claude AI\\Projects";

export async function GET() {
  try {
    await requireAuth();

    const entries = await readdir(PROJECTS_DIR);
    const mappen: { naam: string; pad: string }[] = [];

    for (const entry of entries) {
      const fullPath = join(PROJECTS_DIR, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        mappen.push({ naam: entry, pad: fullPath });
      }
    }

    mappen.sort((a, b) => a.naam.localeCompare(b.naam));

    return NextResponse.json({ mappen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
