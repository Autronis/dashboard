import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getKlantContactDagen, getLeadContactDagen, urgencyBucket } from "@/lib/followup";

// GET /api/followup — computes last_contact per klant and lead, split in buckets
export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const [klant, lead] = await Promise.all([getKlantContactDagen(nu), getLeadContactDagen(nu)]);
    const all = [...klant, ...lead].sort((a, b) => b.dagenGeleden - a.dagenGeleden);

    const nooit = all.filter((c) => urgencyBucket(c) === "nooit");
    const danger = all.filter((c) => urgencyBucket(c) === "danger");
    const warning = all.filter((c) => urgencyBucket(c) === "warning");
    const ok = all.filter((c) => urgencyBucket(c) === "ok");

    return NextResponse.json({ nooit, danger, warning, ok, totaal: all.length });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
