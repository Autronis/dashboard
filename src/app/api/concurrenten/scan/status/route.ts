import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getScanState } from "../route";

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json(getScanState());
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
