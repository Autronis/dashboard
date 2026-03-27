import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { berekenActieveUren } from "@/lib/screen-time-uren";

// GET /api/analytics/heatmap — daily hours for the last 365 days (screen time)
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const start = new Date(nu);
    start.setDate(start.getDate() - 365);

    const startStr = start.toISOString().slice(0, 10);
    const eindStr = nu.toISOString().slice(0, 10);

    // Bereken per dag via berekenActieveUren — die retourneert al per-dag
    // Voor performance: bereken per week ipv per dag
    const data: { datum: string; uren: number }[] = [];
    const current = new Date(startStr);
    const end = new Date(eindStr);

    while (current <= end) {
      const dagStr = current.toISOString().slice(0, 10);
      const uren = await berekenActieveUren(1, dagStr, dagStr);
      if (uren > 0) {
        data.push({ datum: dagStr, uren });
      }
      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
