import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten, gebruikers } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const MAAND_LABELS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

// GET /api/analytics?jaar=2026
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const jaar = Number(searchParams.get("jaar")) || new Date().getFullYear();

    const jaarStart = `${jaar}-01-01T00:00:00`;
    const jaarEind = `${jaar}-12-31T23:59:59`;
    const vorigJaarStart = `${jaar - 1}-01-01T00:00:00`;
    const vorigJaarEind = `${jaar - 1}-12-31T23:59:59`;

    // All time entries for this year with project/klant data
    const entries = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        startTijd: tijdregistraties.startTijd,
        uurtarief: klanten.uurtarief,
        projectNaam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
        klantId: klanten.id,
        gebruikerNaam: gebruikers.naam,
        gebruikerId: tijdregistraties.gebruikerId,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .innerJoin(gebruikers, eq(tijdregistraties.gebruikerId, gebruikers.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, jaarStart),
          lte(tijdregistraties.startTijd, jaarEind),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );

    // Previous year for comparison
    const vorigJaarEntries = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        uurtarief: klanten.uurtarief,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, vorigJaarStart),
          lte(tijdregistraties.startTijd, vorigJaarEind),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`
        )
      );

    // === KPIs ===
    let omzetDitJaar = 0;
    let urenDitJaar = 0;
    for (const e of entries) {
      const uren = (e.duurMinuten || 0) / 60;
      urenDitJaar += uren;
      omzetDitJaar += uren * (e.uurtarief || 0);
    }

    let omzetVorigJaar = 0;
    for (const e of vorigJaarEntries) {
      omzetVorigJaar += ((e.duurMinuten || 0) / 60) * (e.uurtarief || 0);
    }

    const gemiddeldUurtarief = urenDitJaar > 0 ? omzetDitJaar / urenDitJaar : 0;
    const actieveKlanten = new Set(entries.map((e) => e.klantId)).size;

    // === Maanden ===
    const maanden = MAAND_LABELS.map((label, i) => {
      const maandStr = `${jaar}-${String(i + 1).padStart(2, "0")}`;
      const maandEntries = entries.filter((e) => e.startTijd?.startsWith(maandStr));
      let omzet = 0;
      let uren = 0;
      for (const e of maandEntries) {
        const u = (e.duurMinuten || 0) / 60;
        uren += u;
        omzet += u * (e.uurtarief || 0);
      }
      return { maand: maandStr, label, omzet: Math.round(omzet * 100) / 100, uren: Math.round(uren * 100) / 100 };
    });

    // === Top projecten ===
    const projectMap = new Map<string, { projectNaam: string; klantNaam: string; uren: number; omzet: number }>();
    for (const e of entries) {
      const key = e.projectNaam || "Onbekend";
      const existing = projectMap.get(key) || { projectNaam: key, klantNaam: e.klantNaam || "", uren: 0, omzet: 0 };
      const u = (e.duurMinuten || 0) / 60;
      existing.uren += u;
      existing.omzet += u * (e.uurtarief || 0);
      projectMap.set(key, existing);
    }
    const topProjecten = [...projectMap.values()]
      .sort((a, b) => b.uren - a.uren)
      .slice(0, 10)
      .map((p) => ({ ...p, uren: Math.round(p.uren * 100) / 100, omzet: Math.round(p.omzet * 100) / 100 }));

    // === Per gebruiker ===
    const gebruikerMap = new Map<string, { naam: string; uren: number; omzet: number }>();
    for (const e of entries) {
      const key = e.gebruikerNaam || "Onbekend";
      const existing = gebruikerMap.get(key) || { naam: key, uren: 0, omzet: 0 };
      const u = (e.duurMinuten || 0) / 60;
      existing.uren += u;
      existing.omzet += u * (e.uurtarief || 0);
      gebruikerMap.set(key, existing);
    }
    const perGebruiker = [...gebruikerMap.values()]
      .sort((a, b) => b.uren - a.uren)
      .map((g) => ({ ...g, uren: Math.round(g.uren * 100) / 100, omzet: Math.round(g.omzet * 100) / 100 }));

    return NextResponse.json({
      kpis: {
        omzetDitJaar: Math.round(omzetDitJaar * 100) / 100,
        omzetVorigJaar: Math.round(omzetVorigJaar * 100) / 100,
        urenDitJaar: Math.round(urenDitJaar * 100) / 100,
        gemiddeldUurtarief: Math.round(gemiddeldUurtarief * 100) / 100,
        actieveKlanten,
      },
      maanden,
      topProjecten,
      perGebruiker,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
