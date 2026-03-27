import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUniqueScreenTimePerDay } from "@/lib/screen-time-utils";

// GET /api/analytics/heatmap — daily hours for the last 365 days (screen time, merged)
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const start = new Date(nu);
    start.setDate(start.getDate() - 365);

    const startStr = start.toISOString().slice(0, 10) + "T00:00:00";
    const eindStr = nu.toISOString().slice(0, 10) + "T23:59:59";

    const perDay = await getUniqueScreenTimePerDay(startStr, eindStr);

    const data = [...perDay.entries()].map(([datum, sec]) => ({
      datum,
      uren: Math.round((sec / 3600) * 100) / 100,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
