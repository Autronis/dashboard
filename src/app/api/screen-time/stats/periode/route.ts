import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrApiKey } from "@/lib/auth";
import { aggregeerPeriode } from "@/lib/screen-time/aggregate";

// ────────────────────────────────────────────────────────────────────────────
// GET /api/screen-time/stats/periode?van=YYYY-MM-DD&tot=YYYY-MM-DD
//
// Single source of truth voor periode-totalen. Geen AI overhead, geen cache.
// Aggregeert raw entries uit screen_time_entries via de gedeelde helper in
// src/lib/screen-time/aggregate.ts. Zelfde logica = zelfde getal overal
// (dashboard KPI cards, Discord weekrapport, etc).
// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    if (!van || !tot) {
      return NextResponse.json({ fout: "van + tot vereist (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) {
      return NextResponse.json({ fout: "van en tot moeten YYYY-MM-DD formaat zijn" }, { status: 400 });
    }
    if (van > tot) {
      return NextResponse.json({ fout: "van moet <= tot zijn" }, { status: 400 });
    }

    const data = await aggregeerPeriode({
      gebruikerId: gebruiker.id,
      van,
      tot,
    });

    // Target = 4u deep work per dag * aantal actieve dagen
    const deepWorkTarget = data.dagen * 4 * 60;

    return NextResponse.json({
      van: data.van,
      tot: data.tot,
      dagen: data.dagen,
      totaalActiefSeconden: data.totaalActiefSeconden,
      productiefSeconden: data.productiefSeconden,
      productiefPercentage: data.productiefPercentage,
      deepWorkMinuten: data.deepWorkMinuten,
      deepWorkSeconden: data.deepWorkSeconden,
      deepWorkTarget,
      afleidingSeconden: data.afleidingSeconden,
      inactiefSeconden: data.inactiefSeconden,
      topProject: data.topProject,
      perDag: data.perDag,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}
