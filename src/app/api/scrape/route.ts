import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { scrapePage } from "@/lib/scraper";

// POST /api/scrape — scrape a URL and return markdown (Jina Reader + custom fallback).
// Body: { url: string }
// Response: { markdown, title, url, source } or { fout }
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const url: unknown = body?.url;

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ fout: "URL is verplicht" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ fout: "Ongeldige URL" }, { status: 400 });
    }

    const result = await scrapePage(url.trim());
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Scrape mislukt";
    return NextResponse.json(
      { fout: msg },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
