import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projecten, facturen, tijdregistraties, klanten } from "@/lib/db/schema";
import { eq, sum, and, isNotNull } from "drizzle-orm";

const STANDAARD_UURTARIEF = 75;

export async function GET() {
  try {
    await requireAuth();

    // Haal alle actieve projecten op met klant info
    const projectenLijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        status: projecten.status,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        voortgangPercentage: projecten.voortgangPercentage,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        klantUurtarief: klanten.uurtarief,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(eq(projecten.isActief, 1));

    // Haal omzet per project op (betaalde facturen)
    const omzetPerProject = await db
      .select({
        projectId: facturen.projectId,
        omzet: sum(facturen.bedragExclBtw),
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          eq(facturen.isActief, 1),
          isNotNull(facturen.projectId)
        )
      )
      .groupBy(facturen.projectId);

    // Haal uren per project op
    const urenPerProject = await db
      .select({
        projectId: tijdregistraties.projectId,
        totaalMinuten: sum(tijdregistraties.duurMinuten),
      })
      .from(tijdregistraties)
      .where(isNotNull(tijdregistraties.projectId))
      .groupBy(tijdregistraties.projectId);

    // Combineer data
    const omzetMap = new Map(omzetPerProject.map((r) => [r.projectId, Number(r.omzet ?? 0)]));
    const urenMap = new Map(urenPerProject.map((r) => [r.projectId, Number(r.totaalMinuten ?? 0)]));

    const resultaten = projectenLijst.map((p) => {
      const omzet = omzetMap.get(p.id) ?? 0;
      const urenMinuten = urenMap.get(p.id) ?? 0;
      const uren = urenMinuten / 60;
      const uurtarief = p.klantUurtarief ?? STANDAARD_UURTARIEF;
      const kostenUren = uren * uurtarief;
      const profit = omzet - kostenUren;
      const marge = omzet > 0 ? (profit / omzet) * 100 : null;

      return {
        id: p.id,
        naam: p.naam,
        status: p.status,
        klantNaam: p.klantNaam,
        omzet,
        uren: Math.round(uren * 10) / 10,
        uurtarief,
        kostenUren: Math.round(kostenUren * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        marge: marge !== null ? Math.round(marge * 10) / 10 : null,
        geschatteUren: p.geschatteUren,
        werkelijkeUren: p.werkelijkeUren,
        voortgang: p.voortgangPercentage,
      };
    });

    // Sorteer op profit descending
    resultaten.sort((a, b) => b.profit - a.profit);

    const totalen = {
      omzet: resultaten.reduce((s, r) => s + r.omzet, 0),
      kostenUren: resultaten.reduce((s, r) => s + r.kostenUren, 0),
      profit: resultaten.reduce((s, r) => s + r.profit, 0),
      uren: resultaten.reduce((s, r) => s + r.uren, 0),
    };

    return NextResponse.json({ projecten: resultaten, totalen });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
