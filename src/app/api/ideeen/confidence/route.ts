import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateConfidence, updateAllConfidence } from "@/lib/ideeen/confidence";

// POST /api/ideeen/confidence — herbereken confidence score(s)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json() as { ideeId?: number };
    const { ideeId } = body;

    if (ideeId !== undefined) {
      if (typeof ideeId !== "number" || !Number.isInteger(ideeId) || ideeId <= 0) {
        return NextResponse.json({ fout: "Ongeldig ideeId" }, { status: 400 });
      }

      await updateConfidence(ideeId);
      return NextResponse.json({ succes: true, ideeId });
    }

    const bijgewerkt = await updateAllConfidence();
    return NextResponse.json({ succes: true, bijgewerkt });
  } catch (error) {
    const bericht = error instanceof Error ? error.message : "Onbekende fout";
    const status = bericht === "Niet geauthenticeerd" ? 401 : 500;
    return NextResponse.json({ fout: bericht }, { status });
  }
}
