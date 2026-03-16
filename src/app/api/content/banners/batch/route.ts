import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// Legacy batch route — use the banner generator page for batch creation
export async function POST() {
  try {
    await requireAuth();
    return NextResponse.json({ generated: 0, failed: 0, bericht: "Gebruik de banner generator pagina voor batch aanmaken" });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
