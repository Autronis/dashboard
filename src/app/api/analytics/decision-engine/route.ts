import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  tijdregistraties,
  projecten,
  klanten,
  facturen,
  uitgaven,
  offertes,
  leads,
  gebruikers,
  screenTimeEntries,
} from "@/lib/db/schema";
import { getUniqueScreenTimeSeconds } from "@/lib/screen-time-utils";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql, ne, or } from "drizzle-orm";

// ============ HELPERS ============

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function maandLabel(maandStr: string): string {
  const [jaar, m] = maandStr.split("-");
  const maanden = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  return `${maanden[parseInt(m, 10) - 1]} ${jaar}`;
}

// GET /api/analytics/decision-engine
export async function GET() {
  try {
    await requireAuth();

    const now = new Date();
    const jaar = now.getFullYear();
    const maand = now.getMonth(); // 0-indexed
    const jaarStart = `${jaar}-01-01`;
    const jaarEind = `${jaar}-12-31`;
    const dag90geleden = new Date(jaar, maand, now.getDate() - 90).toISOString().slice(0, 10);
    const vandaag = now.toISOString().slice(0, 10);

    // ============ FETCH ALL DATA IN PARALLEL ============

    // Time entries last 90 days with project + client
    const entries = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        startTijd: tijdregistraties.startTijd,
        categorie: tijdregistraties.categorie,
        uurtarief: klanten.uurtarief,
        klantNaam: klanten.bedrijfsnaam,
        klantId: klanten.id,
        projectNaam: projecten.naam,
        projectId: projecten.id,
        projectStatus: projecten.status,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        deadline: projecten.deadline,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, dag90geleden),
          lte(tijdregistraties.startTijd, vandaag + "T23:59:59")
        )
      )
      .all();

    // All year entries for YTD calculations
    const entriesJaar = await db
      .select({
        duurMinuten: tijdregistraties.duurMinuten,
        startTijd: tijdregistraties.startTijd,
        categorie: tijdregistraties.categorie,
        uurtarief: klanten.uurtarief,
        klantNaam: klanten.bedrijfsnaam,
        klantId: klanten.id,
        projectNaam: projecten.naam,
        projectId: projecten.id,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(
          gte(tijdregistraties.startTijd, jaarStart),
          lte(tijdregistraties.startTijd, jaarEind + "T23:59:59")
        )
      )
      .all();

    // Active projects
    const actieveProjecten = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantId: projecten.klantId,
        klantNaam: klanten.bedrijfsnaam,
        uurtarief: klanten.uurtarief,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        deadline: projecten.deadline,
        status: projecten.status,
      })
      .from(projecten)
      .innerJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(eq(projecten.status, "actief"), eq(projecten.isActief, 1)))
      .all();

    // All clients
    const alleKlanten = await db
      .select()
      .from(klanten)
      .where(eq(klanten.isActief, 1))
      .all();

    // Open invoices (verzonden + te_laat)
    const openFacturen = await db
      .select({
        id: facturen.id,
        klantId: facturen.klantId,
        bedragExclBtw: facturen.bedragExclBtw,
        bedragInclBtw: facturen.bedragInclBtw,
        status: facturen.status,
        vervaldatum: facturen.vervaldatum,
        factuurdatum: facturen.factuurdatum,
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.isActief, 1),
          or(eq(facturen.status, "verzonden"), eq(facturen.status, "te_laat"))
        )
      )
      .all();

    // Paid invoices this year
    const betaaldeFacturen = await db
      .select({
        klantId: facturen.klantId,
        bedragExclBtw: facturen.bedragExclBtw,
        betaaldOp: facturen.betaaldOp,
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.isActief, 1),
          eq(facturen.status, "betaald"),
          gte(facturen.betaaldOp, jaarStart),
          lte(facturen.betaaldOp, jaarEind)
        )
      )
      .all();

    // Pipeline: open/active offertes
    const openOffertes = await db
      .select({
        id: offertes.id,
        klantNaam: klanten.bedrijfsnaam,
        titel: offertes.titel,
        bedragExclBtw: offertes.bedragExclBtw,
        status: offertes.status,
        geldigTot: offertes.geldigTot,
        datum: offertes.datum,
        type: offertes.type,
      })
      .from(offertes)
      .innerJoin(klanten, eq(offertes.klantId, klanten.id))
      .where(
        and(
          eq(offertes.isActief, 1),
          or(eq(offertes.status, "verzonden"), eq(offertes.status, "concept"))
        )
      )
      .all();

    // Active leads
    const actieveLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          ne(leads.status, "verloren"),
          ne(leads.status, "gewonnen")
        )
      )
      .all();

    // Costs this year
    const kostenJaar = await db
      .select({
        totaal: sql<number>`COALESCE(SUM(${uitgaven.bedrag}), 0)`,
      })
      .from(uitgaven)
      .where(and(gte(uitgaven.datum, jaarStart), lte(uitgaven.datum, jaarEind)))
      .get();

    // Last 3 months income/costs for cash flow
    const maand3geleden = new Date(jaar, maand - 3, 1).toISOString().slice(0, 10);
    const inkomstenL3 = await db
      .select({
        totaal: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          gte(facturen.betaaldOp, maand3geleden),
          lte(facturen.betaaldOp, vandaag)
        )
      )
      .get();

    const kostenL3 = await db
      .select({
        totaal: sql<number>`COALESCE(SUM(${uitgaven.bedrag}), 0)`,
      })
      .from(uitgaven)
      .where(and(gte(uitgaven.datum, maand3geleden), lte(uitgaven.datum, vandaag)))
      .get();

    // ============ CALCULATIONS ============

    // --- Client dependency (Herfindahl Index) ---
    const klantOmzet = new Map<number, { naam: string; omzet: number; uren: number }>();
    for (const e of entriesJaar) {
      if (!e.klantId) continue;
      const existing = klantOmzet.get(e.klantId) || { naam: e.klantNaam || "Onbekend", omzet: 0, uren: 0 };
      const uren = (e.duurMinuten || 0) / 60;
      existing.omzet += uren * (e.uurtarief || 0);
      existing.uren += uren;
      klantOmzet.set(e.klantId, existing);
    }

    const totaleOmzet = [...klantOmzet.values()].reduce((s, k) => s + k.omzet, 0);
    const totaleUren = [...klantOmzet.values()].reduce((s, k) => s + k.uren, 0);

    const clientShares = [...klantOmzet.values()]
      .map((k) => ({
        naam: k.naam,
        omzet: round2(k.omzet),
        uren: round2(k.uren),
        percentage: totaleOmzet > 0 ? round2((k.omzet / totaleOmzet) * 100) : 0,
        uurtariefEffectief: k.uren > 0 ? round2(k.omzet / k.uren) : 0,
      }))
      .sort((a, b) => b.omzet - a.omzet);

    // Herfindahl-Hirschman Index (0-10000, >2500 = concentrated)
    const hhi = clientShares.reduce((s, c) => s + (c.percentage * c.percentage), 0);
    const topClientPct = clientShares.length > 0 ? clientShares[0].percentage : 0;
    const riskLevel: "laag" | "gemiddeld" | "hoog" =
      hhi > 4000 || topClientPct > 50 ? "hoog"
      : hhi > 2500 || topClientPct > 35 ? "gemiddeld"
      : "laag";

    // --- Rate analysis per client ---
    const rateAnalysis = clientShares.map((c) => {
      const klant = alleKlanten.find((k) => k.bedrijfsnaam === c.naam);
      const doelTarief = klant?.uurtarief ?? 95;
      const gap = c.uurtariefEffectief - doelTarief;
      const misgelopen = gap < 0 ? round2(Math.abs(gap) * c.uren) : 0;

      return {
        naam: c.naam,
        doelTarief,
        effectiefTarief: c.uurtariefEffectief,
        uren: c.uren,
        gap: round2(gap),
        misgelopen,
      };
    }).filter((r) => r.uren > 0);

    // --- Efficiency metrics ---
    let billableMinuten = 0;
    let nonBillableMinuten = 0;
    for (const e of entriesJaar) {
      const min = e.duurMinuten || 0;
      if (e.categorie === "administratie" || e.categorie === "overig") {
        nonBillableMinuten += min;
      } else {
        billableMinuten += min;
      }
    }
    const totalMinuten = billableMinuten + nonBillableMinuten;
    const billablePercent = totalMinuten > 0 ? round2((billableMinuten / totalMinuten) * 100) : 0;
    const revenuePerHour = totaleUren > 0 ? round2(totaleOmzet / totaleUren) : 0;
    const nonBillableUren = nonBillableMinuten / 60;
    const lostRevenue = round2(nonBillableUren * revenuePerHour);

    // --- Project insights ---
    const projectMap = new Map<number, { naam: string; klant: string; uren: number; omzet: number; geschat: number; deadline: string | null; status: string }>();
    for (const e of entriesJaar) {
      if (!e.projectId) continue;
      const existing = projectMap.get(e.projectId) || {
        naam: e.projectNaam || "Onbekend",
        klant: e.klantNaam || "Onbekend",
        uren: 0,
        omzet: 0,
        geschat: 0,
        deadline: null,
        status: "actief",
      };
      const uren = (e.duurMinuten || 0) / 60;
      existing.uren += uren;
      existing.omzet += uren * (e.uurtarief || 0);
      projectMap.set(e.projectId, existing);
    }

    // Enrich from actieveProjecten
    for (const p of actieveProjecten) {
      const existing = projectMap.get(p.id);
      if (existing) {
        existing.geschat = p.geschatteUren ?? 0;
        existing.deadline = p.deadline;
        existing.status = p.status ?? "actief";
      }
    }

    const projectInsights = [...projectMap.values()]
      .map((p) => {
        const euroPerUur = p.uren > 0 ? round2(p.omzet / p.uren) : 0;
        const overBudget = p.geschat > 0 ? round2(((p.uren - p.geschat) / p.geschat) * 100) : 0;
        const waarde: "hoog" | "gemiddeld" | "laag" =
          euroPerUur >= 95 ? "hoog"
          : euroPerUur >= 70 ? "gemiddeld"
          : "laag";

        return {
          naam: p.naam,
          klant: p.klant,
          uren: round2(p.uren),
          omzet: round2(p.omzet),
          geschatteUren: p.geschat,
          euroPerUur,
          overBudgetPct: p.geschat > 0 ? overBudget : null,
          deadline: p.deadline,
          waarde,
        };
      })
      .sort((a, b) => b.omzet - a.omzet)
      .slice(0, 15);

    // --- Pipeline ---
    const pipelineItems = openOffertes.map((o) => ({
      id: o.id,
      klant: o.klantNaam || "Onbekend",
      titel: o.titel || "Offerte",
      bedrag: o.bedragExclBtw ?? 0,
      status: o.status ?? "concept",
      geldigTot: o.geldigTot,
      kans: o.status === "verzonden" ? 50 : 20,
    }));

    const leadsItems = actieveLeads.map((l) => ({
      id: l.id,
      klant: l.bedrijfsnaam,
      titel: l.contactpersoon || "Lead",
      bedrag: l.waarde ?? 0,
      status: l.status ?? "nieuw",
      geldigTot: l.volgendeActieDatum,
      kans: l.status === "offerte" ? 60 : l.status === "contact" ? 30 : 15,
    }));

    const allPipeline = [...pipelineItems, ...leadsItems];
    const pipelineTotaal = round2(allPipeline.reduce((s, p) => s + p.bedrag, 0));
    const pipelineGewogen = round2(allPipeline.reduce((s, p) => s + (p.bedrag * p.kans / 100), 0));

    // --- Cashflow upgrade ---
    const uitstaand = round2(openFacturen.reduce((s, f) => s + (f.bedragExclBtw ?? 0), 0));
    const telaatFacturen = openFacturen.filter((f) => f.status === "te_laat" || (f.vervaldatum && f.vervaldatum < vandaag));
    const overdue = round2(telaatFacturen.reduce((s, f) => s + (f.bedragExclBtw ?? 0), 0));

    const gemInkomsten = round2((inkomstenL3?.totaal ?? 0) / 3);
    const gemKosten = round2((kostenL3?.totaal ?? 0) / 3);
    const nettoPerMaand = round2(gemInkomsten - gemKosten);
    const runwayMaanden = nettoPerMaand < 0 ? Math.floor(uitstaand / Math.abs(nettoPerMaand)) : null;

    // --- Forecast with confidence ---
    const betaaldePerMaand = new Map<string, number>();
    for (const f of betaaldeFacturen) {
      if (!f.betaaldOp) continue;
      const m = f.betaaldOp.slice(0, 7);
      betaaldePerMaand.set(m, (betaaldePerMaand.get(m) ?? 0) + (f.bedragExclBtw ?? 0));
    }

    const omzetTotNu = [...betaaldePerMaand.values()].reduce((s, v) => s + v, 0);
    const maandenMetData = [...betaaldePerMaand.values()].filter((v) => v > 0);
    const gemOmzetPerMaand = maandenMetData.length > 0
      ? maandenMetData.reduce((s, v) => s + v, 0) / maandenMetData.length
      : 0;

    // Remaining project value
    const restWaarde = actieveProjecten.reduce((s, p) => {
      const rest = Math.max((p.geschatteUren ?? 0) - (p.werkelijkeUren ?? 0), 0);
      return s + rest * (p.uurtarief ?? 0);
    }, 0);

    const jaardoel = 120000;
    const restMaanden = 12 - (maand + 1);
    const benodigdPerMaand = restMaanden > 0 ? round2((jaardoel - omzetTotNu) / restMaanden) : 0;
    const confidence = gemOmzetPerMaand > 0
      ? Math.min(100, Math.round(((gemOmzetPerMaand + pipelineGewogen / 6) / benodigdPerMaand) * 100))
      : 0;

    const forecastMaanden = [];
    for (let i = 1; i <= 3; i++) {
      const targetDate = new Date(jaar, maand + i, 1);
      const mStr = targetDate.toISOString().slice(0, 7);
      const zeker = round2(restWaarde / 3);
      forecastMaanden.push({
        maand: mStr,
        label: maandLabel(mStr),
        bestCase: round2(zeker + gemOmzetPerMaand * 1.3),
        verwacht: round2(zeker + gemOmzetPerMaand * 0.9),
        worstCase: round2(zeker * 0.5 + gemOmzetPerMaand * 0.5),
        confidence: Math.min(100, Math.max(0, confidence - (i - 1) * 12)),
      });
    }

    // --- Actionable goals ---
    const huidigeMaandStr = `${jaar}-${String(maand + 1).padStart(2, "0")}`;
    const omzetDezeMaand = betaaldePerMaand.get(huidigeMaandStr) ?? 0;
    const dag = now.getDate();
    const dagenInMaand = new Date(jaar, maand + 1, 0).getDate();
    const restDagen = dagenInMaand - dag;
    const werkdagenRest = Math.round(restDagen * 5 / 7);

    // Uren deze maand uit screen time (actieve uren)
    const screenUrenMaand = await db
      .select({
        totaal: sql<number>`COALESCE(SUM(${screenTimeEntries.duurSeconden}), 0)`.as("totaal"),
      })
      .from(screenTimeEntries)
      .where(
        and(
          gte(screenTimeEntries.startTijd, huidigeMaandStr + "-01T00:00:00"),
          lte(screenTimeEntries.startTijd, huidigeMaandStr + "-31T23:59:59"),
          sql`${screenTimeEntries.categorie} != 'inactief'`
        )
      );
    const urenDezeMaand = (screenUrenMaand[0]?.totaal || 0) / 3600;

    const OMZET_DOEL = 10000;
    const UREN_DOEL = 160;

    const actionableGoals = [
      {
        doel: "Omzet",
        huidig: round2(omzetDezeMaand),
        target: OMZET_DOEL,
        gap: round2(Math.max(OMZET_DOEL - omzetDezeMaand, 0)),
        actie: omzetDezeMaand >= OMZET_DOEL
          ? "Doel behaald"
          : werkdagenRest > 0
          ? `Nog ${formatBedragSimple(OMZET_DOEL - omzetDezeMaand)} nodig — ${formatBedragSimple((OMZET_DOEL - omzetDezeMaand) / werkdagenRest)}/werkdag`
          : "Maand bijna voorbij",
        percentage: round2(Math.min((omzetDezeMaand / OMZET_DOEL) * 100, 100)),
      },
      {
        doel: "Uren",
        huidig: round2(urenDezeMaand),
        target: UREN_DOEL,
        gap: round2(Math.max(UREN_DOEL - urenDezeMaand, 0)),
        actie: urenDezeMaand >= UREN_DOEL
          ? "Doel behaald"
          : werkdagenRest > 0
          ? `Nog ${Math.round(UREN_DOEL - urenDezeMaand)}u nodig — ${((UREN_DOEL - urenDezeMaand) / werkdagenRest).toFixed(1)}u/werkdag`
          : "Maand bijna voorbij",
        percentage: round2(Math.min((urenDezeMaand / UREN_DOEL) * 100, 100)),
      },
      {
        doel: "Jaardoel",
        huidig: round2(omzetTotNu),
        target: jaardoel,
        gap: round2(Math.max(jaardoel - omzetTotNu, 0)),
        actie: omzetTotNu >= jaardoel
          ? "Jaardoel behaald!"
          : restMaanden > 0
          ? `Nog ${formatBedragSimple(jaardoel - omzetTotNu)} nodig — ${formatBedragSimple(benodigdPerMaand)}/maand`
          : "Jaar bijna voorbij",
        percentage: round2(Math.min((omzetTotNu / jaardoel) * 100, 100)),
      },
    ];

    // --- AI insights (what's going wrong/right + actions) ---
    const insights: { tekst: string; type: "positief" | "waarschuwing" | "kritiek" | "actie"; impact?: string }[] = [];
    const nextActions: { actie: string; impact: string; prioriteit: "hoog" | "gemiddeld" | "laag"; categorie: string }[] = [];

    // 1. Client concentration risk
    if (topClientPct > 50) {
      insights.push({
        tekst: `${clientShares[0]?.naam} maakt ${topClientPct.toFixed(0)}% van je omzet uit — hoog afhankelijkheidsrisico`,
        type: "kritiek",
      });
      nextActions.push({
        actie: `Diversificeer: acquisitie richten op nieuwe klanten. ${clientShares[0]?.naam} vertegenwoordigt ${topClientPct.toFixed(0)}% van omzet`,
        impact: "Risicospreiding",
        prioriteit: "hoog",
        categorie: "klanten",
      });
    } else if (topClientPct > 35) {
      insights.push({
        tekst: `Klantconcentratie is gemiddeld — top klant is ${topClientPct.toFixed(0)}%`,
        type: "waarschuwing",
      });
    }

    // 2. Underpriced clients
    const underpricedClients = rateAnalysis.filter((r) => r.gap < -10 && r.uren > 10);
    if (underpricedClients.length > 0) {
      const totaalMis = round2(underpricedClients.reduce((s, c) => s + c.misgelopen, 0));
      insights.push({
        tekst: `${underpricedClients.length} klant(en) onder doeltarief — ${formatBedragSimple(totaalMis)} misgelopen omzet YTD`,
        type: "waarschuwing",
        impact: formatBedragSimple(totaalMis),
      });
      const worstClient = underpricedClients.sort((a, b) => b.misgelopen - a.misgelopen)[0];
      if (worstClient) {
        nextActions.push({
          actie: `Tarief ${worstClient.naam} heronderhandelen: €${worstClient.effectiefTarief.toFixed(0)}/u → €${worstClient.doelTarief}/u`,
          impact: `+${formatBedragSimple(worstClient.misgelopen)}/jaar`,
          prioriteit: "hoog",
          categorie: "pricing",
        });
      }
    }

    // 3. Low billable percentage
    if (billablePercent < 70 && totalMinuten > 0) {
      const potentieelExtra = round2((nonBillableUren * 0.3) * revenuePerHour);
      insights.push({
        tekst: `Slechts ${billablePercent.toFixed(0)}% billable — ${Math.round(nonBillableUren)}u intern dit jaar`,
        type: "waarschuwing",
        impact: formatBedragSimple(potentieelExtra),
      });
      nextActions.push({
        actie: `Reduceer non-billable werk (nu ${(100 - billablePercent).toFixed(0)}%) — automatiseer admin taken`,
        impact: `+${formatBedragSimple(potentieelExtra)} potentieel`,
        prioriteit: "gemiddeld",
        categorie: "efficiency",
      });
    } else if (billablePercent >= 80) {
      insights.push({
        tekst: `${billablePercent.toFixed(0)}% billable — uitstekende benutting`,
        type: "positief",
      });
    }

    // 4. Overdue invoices
    if (overdue > 0) {
      insights.push({
        tekst: `${formatBedragSimple(overdue)} aan openstaande facturen is te laat (${telaatFacturen.length} facturen)`,
        type: "kritiek",
        impact: formatBedragSimple(overdue),
      });
      nextActions.push({
        actie: `Stuur herinnering voor ${telaatFacturen.length} te late factuur${telaatFacturen.length > 1 ? "en" : ""}`,
        impact: `${formatBedragSimple(overdue)} ophalen`,
        prioriteit: "hoog",
        categorie: "cashflow",
      });
    }

    // 5. Pipeline health
    if (pipelineTotaal > 0) {
      insights.push({
        tekst: `Pipeline: ${formatBedragSimple(pipelineTotaal)} open (gewogen: ${formatBedragSimple(pipelineGewogen)})`,
        type: pipelineGewogen > benodigdPerMaand ? "positief" : "waarschuwing",
      });
    } else {
      insights.push({
        tekst: "Lege pipeline — geen openstaande offertes of actieve leads",
        type: "kritiek",
      });
      nextActions.push({
        actie: "Start acquisitie: maak nieuwe offertes aan of volg leads op",
        impact: "Pipeline vullen",
        prioriteit: "hoog",
        categorie: "sales",
      });
    }

    // 6. Over-budget projects
    const overBudgetProjecten = projectInsights.filter((p) => p.overBudgetPct !== null && p.overBudgetPct > 20);
    if (overBudgetProjecten.length > 0) {
      const worst = overBudgetProjecten.sort((a, b) => (b.overBudgetPct ?? 0) - (a.overBudgetPct ?? 0))[0];
      insights.push({
        tekst: `${worst.naam} is ${worst.overBudgetPct?.toFixed(0)}% over budget (${worst.uren.toFixed(0)}u vs ${worst.geschatteUren}u geschat)`,
        type: "waarschuwing",
      });
    }

    // 7. Revenue trend
    const last3Months = [...betaaldePerMaand.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 3)
      .map(([, v]) => v);

    if (last3Months.length >= 2) {
      const trend = last3Months[0] - last3Months[last3Months.length - 1];
      if (trend > 0) {
        insights.push({
          tekst: `Omzet stijgt: +${formatBedragSimple(trend)} vs 3 maanden geleden`,
          type: "positief",
        });
      } else if (trend < -500) {
        insights.push({
          tekst: `Omzet daalt: ${formatBedragSimple(trend)} vs 3 maanden geleden`,
          type: "waarschuwing",
        });
      }
    }

    // 8. Follow-up leads
    const leadsZonderActie = actieveLeads.filter((l) => !l.volgendeActieDatum || l.volgendeActieDatum < vandaag);
    if (leadsZonderActie.length > 0) {
      const potentieel = round2(leadsZonderActie.reduce((s, l) => s + (l.waarde ?? 0), 0));
      nextActions.push({
        actie: `${leadsZonderActie.length} lead(s) opvolgen — actie datum verlopen of niet ingesteld`,
        impact: potentieel > 0 ? `${formatBedragSimple(potentieel)} potentieel` : "Pipeline vullen",
        prioriteit: "gemiddeld",
        categorie: "sales",
      });
    }

    // 9. Goal risk
    if (omzetDezeMaand < OMZET_DOEL * (dag / dagenInMaand) * 0.8) {
      nextActions.push({
        actie: `Omzetdoel in gevaar: ${formatBedragSimple(OMZET_DOEL - omzetDezeMaand)} nodig in ${restDagen} dagen`,
        impact: formatBedragSimple(OMZET_DOEL - omzetDezeMaand),
        prioriteit: "hoog",
        categorie: "doelen",
      });
    }

    // Sort by priority
    const prioriteitOrder = { hoog: 0, gemiddeld: 1, laag: 2 };
    nextActions.sort((a, b) => prioriteitOrder[a.prioriteit] - prioriteitOrder[b.prioriteit]);

    return NextResponse.json({
      aiInsights: insights.slice(0, 8),
      nextActions: nextActions.slice(0, 6),
      clientDependency: {
        hhi: round2(hhi),
        topClientPct: round2(topClientPct),
        riskLevel,
        clients: clientShares.slice(0, 10),
      },
      rateAnalysis,
      efficiency: {
        revenuePerHour,
        billablePercent,
        nonBillableUren: round2(nonBillableUren),
        lostRevenue,
        totaleUren: round2(totaleUren),
        totaleOmzet: round2(totaleOmzet),
      },
      projectInsights,
      actionableGoals,
      pipeline: {
        totaal: pipelineTotaal,
        gewogen: pipelineGewogen,
        items: allPipeline.slice(0, 10),
      },
      cashflow: {
        uitstaand,
        overdue,
        overdueCount: telaatFacturen.length,
        gemInkomsten,
        gemKosten,
        nettoPerMaand,
        runwayMaanden,
        kostenJaar: round2(kostenJaar?.totaal ?? 0),
      },
      forecast: {
        omzetTotNu: round2(omzetTotNu),
        jaardoel,
        benodigdPerMaand,
        gemOmzetPerMaand: round2(gemOmzetPerMaand),
        confidence,
        opKoers: gemOmzetPerMaand >= benodigdPerMaand,
        maanden: forecastMaanden,
        restWaarde: round2(restWaarde),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

function formatBedragSimple(n: number): string {
  return `€${Math.round(Math.abs(n)).toLocaleString("nl-NL")}`;
}
