import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tijdregistraties, projecten, klanten, gebruikers, screenTimeEntries } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, or, isNull } from "drizzle-orm";
import { berekenActieveUren } from "@/lib/screen-time-uren";

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

    // ── Fetch all data in parallel ──
    const [
      entries,
      vorigJaarEntries,
      screenEntries,
      gebruikersList,
      projectList,
      klantList,
      urenDitJaar,
      urenVorigJaar,
    ] = await Promise.all([
      db.select({
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
        .where(and(
          gte(tijdregistraties.startTijd, jaarStart),
          lte(tijdregistraties.startTijd, jaarEind),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`,
          or(eq(klanten.isDemo, 0), isNull(klanten.isDemo))
        )),

      db.select({ duurMinuten: tijdregistraties.duurMinuten, uurtarief: klanten.uurtarief })
        .from(tijdregistraties)
        .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
        .innerJoin(klanten, eq(projecten.klantId, klanten.id))
        .where(and(
          gte(tijdregistraties.startTijd, vorigJaarStart),
          lte(tijdregistraties.startTijd, vorigJaarEind),
          sql`${tijdregistraties.eindTijd} IS NOT NULL`,
          or(eq(klanten.isDemo, 0), isNull(klanten.isDemo))
        )),

      db.select({
        duurSeconden: screenTimeEntries.duurSeconden,
        startTijd: screenTimeEntries.startTijd,
        gebruikerId: screenTimeEntries.gebruikerId,
        projectId: screenTimeEntries.projectId,
        klantId: screenTimeEntries.klantId,
        categorie: screenTimeEntries.categorie,
      })
        .from(screenTimeEntries)
        .where(and(
          gte(screenTimeEntries.startTijd, jaarStart),
          lte(screenTimeEntries.startTijd, jaarEind),
          sql`${screenTimeEntries.categorie} != 'inactief'`
        )),

      db.select({ id: gebruikers.id, naam: gebruikers.naam }).from(gebruikers),

      db.select({ id: projecten.id, naam: projecten.naam, klantId: projecten.klantId }).from(projecten),

      db.select({ id: klanten.id, bedrijfsnaam: klanten.bedrijfsnaam, uurtarief: klanten.uurtarief })
        .from(klanten)
        .where(or(eq(klanten.isDemo, 0), isNull(klanten.isDemo))),

      berekenActieveUren(1, `${jaar}-01-01`, `${jaar}-12-31`),
      berekenActieveUren(1, `${jaar - 1}-01-01`, `${jaar - 1}-12-31`),
    ]);

    const gebruikerNamen = new Map(gebruikersList.map((g) => [g.id, g.naam]));
    const projectNamen = new Map(projectList.map((p) => [p.id, p]));
    const klantData = new Map(klantList.map((k) => [k.id, k]));

    let omzetDitJaar = 0;
    for (const e of entries) {
      const uren = (e.duurMinuten || 0) / 60;
      omzetDitJaar += uren * (e.uurtarief || 0);
    }

    let omzetVorigJaar = 0;
    for (const e of vorigJaarEntries) {
      omzetVorigJaar += ((e.duurMinuten || 0) / 60) * (e.uurtarief || 0);
    }

    const gemiddeldUurtarief = urenDitJaar > 0 ? omzetDitJaar / urenDitJaar : 0;

    // Actieve klanten: uit screen time + tijdregistraties (excl. demo)
    const echteKlantIds = new Set(klantList.map((k) => k.id));
    const actieveKlantIds = new Set<number>();
    for (const e of screenEntries) {
      if (e.klantId && echteKlantIds.has(e.klantId)) actieveKlantIds.add(e.klantId);
    }
    for (const e of entries) {
      if (e.klantId) actieveKlantIds.add(e.klantId);
    }

    // === Maanden (uren uit screen time via berekenActieveUren per maand) ===
    const maandUren = new Map<string, number>();
    for (let m = 0; m < 12; m++) {
      const maandStr = `${jaar}-${String(m + 1).padStart(2, "0")}`;
      const lastDay = new Date(jaar, m + 1, 0).getDate();
      const uren = await berekenActieveUren(1, `${maandStr}-01`, `${maandStr}-${lastDay}`);
      maandUren.set(maandStr, uren);
    }

    const maanden = MAAND_LABELS.map((label, i) => {
      const maandStr = `${jaar}-${String(i + 1).padStart(2, "0")}`;
      const uren = maandUren.get(maandStr) || 0;

      // Omzet uit tijdregistraties
      let omzet = 0;
      for (const e of entries) {
        if (e.startTijd?.startsWith(maandStr)) {
          const u = (e.duurMinuten || 0) / 60;
          omzet += u * (e.uurtarief || 0);
        }
      }

      return { maand: maandStr, label, omzet: Math.round(omzet * 100) / 100, uren: Math.round(uren * 100) / 100 };
    });

    // === Top projecten (uren uit screen time) ===
    const projectMap = new Map<string, { projectNaam: string; klantNaam: string; uren: number; omzet: number }>();

    // Screen time per project
    for (const e of screenEntries) {
      if (!e.projectId) continue;
      const proj = projectNamen.get(e.projectId);
      const key = proj?.naam || "Onbekend";
      const kl = proj?.klantId ? klantData.get(proj.klantId) : null;
      const existing = projectMap.get(key) || { projectNaam: key, klantNaam: kl?.bedrijfsnaam || "", uren: 0, omzet: 0 };
      existing.uren += (e.duurSeconden || 0) / 3600;
      projectMap.set(key, existing);
    }

    // Omzet per project uit tijdregistraties
    for (const e of entries) {
      const key = e.projectNaam || "Onbekend";
      const existing = projectMap.get(key) || { projectNaam: key, klantNaam: e.klantNaam || "", uren: 0, omzet: 0 };
      const u = (e.duurMinuten || 0) / 60;
      existing.omzet += u * (e.uurtarief || 0);
      projectMap.set(key, existing);
    }

    const topProjecten = [...projectMap.values()]
      .sort((a, b) => b.uren - a.uren)
      .slice(0, 10)
      .map((p) => ({ ...p, uren: Math.round(p.uren * 100) / 100, omzet: Math.round(p.omzet * 100) / 100 }));

    // === Per gebruiker (uren uit screen time) ===
    const gebruikerMap = new Map<string, { naam: string; uren: number; omzet: number }>();

    for (const e of screenEntries) {
      const naam = (e.gebruikerId ? gebruikerNamen.get(e.gebruikerId) : null) || "Onbekend";
      const existing = gebruikerMap.get(naam) || { naam, uren: 0, omzet: 0 };
      existing.uren += (e.duurSeconden || 0) / 3600;
      gebruikerMap.set(naam, existing);
    }

    // Omzet per gebruiker uit tijdregistraties
    for (const e of entries) {
      const naam = e.gebruikerNaam || "Onbekend";
      const existing = gebruikerMap.get(naam) || { naam, uren: 0, omzet: 0 };
      const u = (e.duurMinuten || 0) / 60;
      existing.omzet += u * (e.uurtarief || 0);
      gebruikerMap.set(naam, existing);
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
        actieveKlanten: actieveKlantIds.size,
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
