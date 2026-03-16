import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// Legacy auto-genereer route — deprecated in favor of topic-based banner generator
export async function POST() {
  try {
    await requireAuth();
    return NextResponse.json({ fout: "Gebruik de banner generator pagina" }, { status: 410 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
