import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getVerbindingStatus, getAuthUrl } from "@/lib/revolut";

// GET /api/revolut — Connection status
export async function GET() {
  try {
    await requireAuth();

    const status = await getVerbindingStatus();

    return NextResponse.json({
      ...status,
      authUrl: !status.gekoppeld ? getAuthUrl() : undefined,
      configured: !!(process.env.REVOLUT_CLIENT_ID && process.env.REVOLUT_PRIVATE_KEY),
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
