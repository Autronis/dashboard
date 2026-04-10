import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { berekenAfstand } from "@/lib/google-maps";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const naar = searchParams.get("naar");

    if (!van || !naar) {
      return NextResponse.json({ fout: "van en naar zijn verplicht" }, { status: 400 });
    }

    const result = await berekenAfstand(van, naar);

    if (!result) {
      return NextResponse.json({ fout: "Kon afstand niet berekenen" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
