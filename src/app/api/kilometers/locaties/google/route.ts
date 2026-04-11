import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { zoekPlaatsen } from "@/lib/google-maps";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const q = new URL(req.url).searchParams.get("q");
    if (!q || q.length < 2) {
      return NextResponse.json({ suggesties: [] });
    }
    const suggesties = await zoekPlaatsen(q);
    return NextResponse.json({ suggesties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
