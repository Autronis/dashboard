import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSignedUrl } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const path = req.nextUrl.searchParams.get("path");
    if (!path) return NextResponse.json({ fout: "Pad is verplicht" }, { status: 400 });

    const url = await getSignedUrl(path, 3600);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
