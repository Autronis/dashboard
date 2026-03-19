import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten, tijdregistraties, notities, documenten, facturen, offertes, meetings } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql, desc } from "drizzle-orm";

// GET /api/klanten/[id] — Client detail with projects, notes, documents, timeline, financial overview
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [klant] = await db
      .select()
      .from(klanten)
      .where(eq(klanten.id, Number(id)));

    if (!klant) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    // Projects
    const projectenLijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        omschrijving: projecten.omschrijving,
        status: projecten.status,
        voortgangPercentage: projecten.voortgangPercentage,
        deadline: projecten.deadline,
        geschatteUren: projecten.geschatteUren,
        werkelijkeUren: projecten.werkelijkeUren,
        isActief: projecten.isActief,
      })
      .from(projecten)
      .where(and(eq(projecten.klantId, Number(id)), eq(projecten.isActief, 1)))
      .orderBy(projecten.naam);

    // Calculate actual hours per project
    const projectenMetUren = await Promise.all(
      projectenLijst.map(async (p) => {
        const [uren] = await db
          .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
          .from(tijdregistraties)
          .where(eq(tijdregistraties.projectId, p.id));
        return { ...p, werkelijkeMinuten: uren?.totaal || 0 };
      })
    );

    // Notes
    const notitiesLijst = await db
      .select()
      .from(notities)
      .where(eq(notities.klantId, Number(id)))
      .orderBy(desc(notities.aangemaaktOp));

    // Documents
    const documentenLijst = await db
      .select()
      .from(documenten)
      .where(eq(documenten.klantId, Number(id)))
      .orderBy(desc(documenten.aangemaaktOp));

    // Recent time entries (last 10)
    const recenteTijd = await db
      .select({
        id: tijdregistraties.id,
        omschrijving: tijdregistraties.omschrijving,
        startTijd: tijdregistraties.startTijd,
        duurMinuten: tijdregistraties.duurMinuten,
        categorie: tijdregistraties.categorie,
        projectNaam: projecten.naam,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .where(eq(projecten.klantId, Number(id)))
      .orderBy(desc(tijdregistraties.startTijd))
      .limit(10);

    // Facturen for this klant
    const facturenLijst = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        status: facturen.status,
        bedragInclBtw: facturen.bedragInclBtw,
        factuurdatum: facturen.factuurdatum,
        vervaldatum: facturen.vervaldatum,
        betaaldOp: facturen.betaaldOp,
      })
      .from(facturen)
      .where(and(eq(facturen.klantId, Number(id)), eq(facturen.isActief, 1)))
      .orderBy(desc(facturen.factuurdatum));

    // Offertes for this klant
    const offertesLijst = await db
      .select({
        id: offertes.id,
        offertenummer: offertes.offertenummer,
        titel: offertes.titel,
        status: offertes.status,
        bedragInclBtw: offertes.bedragInclBtw,
        datum: offertes.datum,
        geldigTot: offertes.geldigTot,
      })
      .from(offertes)
      .where(and(eq(offertes.klantId, Number(id)), eq(offertes.isActief, 1)))
      .orderBy(desc(offertes.datum));

    // Meetings for this klant
    const meetingsLijst = await db
      .select({
        id: meetings.id,
        titel: meetings.titel,
        datum: meetings.datum,
        duurMinuten: meetings.duurMinuten,
        samenvatting: meetings.samenvatting,
      })
      .from(meetings)
      .where(eq(meetings.klantId, Number(id)))
      .orderBy(desc(meetings.datum));

    // Build timeline from all interactions
    interface TijdlijnItem {
      id: string;
      type: "factuur" | "offerte" | "meeting" | "notitie" | "tijdregistratie";
      datum: string;
      titel: string;
      details: string | null;
      status?: string;
      bedrag?: number | null;
    }

    const tijdlijn: TijdlijnItem[] = [];

    for (const f of facturenLijst) {
      tijdlijn.push({
        id: `factuur-${f.id}`,
        type: "factuur",
        datum: f.factuurdatum || "",
        titel: `Factuur ${f.factuurnummer}`,
        details: f.bedragInclBtw ? `€ ${f.bedragInclBtw.toFixed(2)}` : null,
        status: f.status || undefined,
        bedrag: f.bedragInclBtw,
      });
    }

    for (const o of offertesLijst) {
      tijdlijn.push({
        id: `offerte-${o.id}`,
        type: "offerte",
        datum: o.datum || "",
        titel: `Offerte ${o.offertenummer}${o.titel ? `: ${o.titel}` : ""}`,
        details: o.bedragInclBtw ? `€ ${o.bedragInclBtw.toFixed(2)}` : null,
        status: o.status || undefined,
        bedrag: o.bedragInclBtw,
      });
    }

    for (const m of meetingsLijst) {
      tijdlijn.push({
        id: `meeting-${m.id}`,
        type: "meeting",
        datum: m.datum,
        titel: m.titel,
        details: m.samenvatting ? m.samenvatting.substring(0, 100) + (m.samenvatting.length > 100 ? "..." : "") : null,
      });
    }

    for (const n of notitiesLijst) {
      tijdlijn.push({
        id: `notitie-${n.id}`,
        type: "notitie",
        datum: n.aangemaaktOp || "",
        titel: n.type === "belangrijk" ? "Belangrijke notitie" : n.type === "afspraak" ? "Afspraak" : "Notitie",
        details: n.inhoud.substring(0, 100) + (n.inhoud.length > 100 ? "..." : ""),
      });
    }

    // Sort timeline by date descending
    tijdlijn.sort((a, b) => {
      const da = a.datum || "";
      const db2 = b.datum || "";
      return db2.localeCompare(da);
    });

    // KPIs
    const [totaalUren] = await db
      .select({ totaal: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)` })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .where(eq(projecten.klantId, Number(id)));

    // Financial overview
    const totaleOmzet = facturenLijst
      .filter((f) => f.status === "betaald")
      .reduce((s, f) => s + (f.bedragInclBtw || 0), 0);
    const totaalOpenstaand = facturenLijst
      .filter((f) => f.status === "verzonden" || f.status === "te_laat")
      .reduce((s, f) => s + (f.bedragInclBtw || 0), 0);
    const aantalBetaaldeFacturen = facturenLijst.filter((f) => f.status === "betaald").length;
    const gemiddeldFactuurbedrag = aantalBetaaldeFacturen > 0 ? totaleOmzet / aantalBetaaldeFacturen : 0;

    // Payment behavior: average days between factuurdatum and betaaldOp
    let gemiddeldeBetalingsDagen: number | null = null;
    const betaaldeMetData = facturenLijst.filter((f) => f.status === "betaald" && f.factuurdatum && f.betaaldOp);
    if (betaaldeMetData.length > 0) {
      const totaalDagen = betaaldeMetData.reduce((s, f) => {
        const facDatum = new Date(f.factuurdatum!);
        const betDatum = new Date(f.betaaldOp!);
        return s + Math.floor((betDatum.getTime() - facDatum.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      gemiddeldeBetalingsDagen = Math.round(totaalDagen / betaaldeMetData.length);
    }

    return NextResponse.json({
      klant,
      projecten: projectenMetUren,
      notities: notitiesLijst,
      documenten: documentenLijst,
      recenteTijdregistraties: recenteTijd,
      facturen: facturenLijst,
      offertes: offertesLijst,
      meetings: meetingsLijst,
      tijdlijn: tijdlijn.slice(0, 50),
      kpis: {
        aantalProjecten: projectenMetUren.length,
        totaalMinuten: totaalUren?.totaal || 0,
        omzet: totaleOmzet,
        uurtarief: klant.uurtarief || 0,
        openstaand: totaalOpenstaand,
        gemiddeldFactuurbedrag: Math.round(gemiddeldFactuurbedrag * 100) / 100,
        gemiddeldeBetalingsDagen,
        aantalFacturen: facturenLijst.length,
        aantalOffertes: offertesLijst.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/klanten/[id] — Update client
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [bestaand] = await db.select().from(klanten).where(eq(klanten.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    const { bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, notities: notitiesTekst, website, branche, kvkNummer, btwNummer } = body;

    if (bedrijfsnaam !== undefined && !bedrijfsnaam?.trim()) {
      return NextResponse.json({ fout: "Bedrijfsnaam is verplicht." }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ fout: "Ongeldig e-mailadres." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { bijgewerktOp: new Date().toISOString() };
    if (bedrijfsnaam !== undefined) updateData.bedrijfsnaam = bedrijfsnaam.trim();
    if (contactpersoon !== undefined) updateData.contactpersoon = contactpersoon?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim().toLowerCase() || null;
    if (telefoon !== undefined) updateData.telefoon = telefoon?.trim() || null;
    if (adres !== undefined) updateData.adres = adres?.trim() || null;
    if (uurtarief !== undefined) updateData.uurtarief = uurtarief || null;
    if (notitiesTekst !== undefined) updateData.notities = notitiesTekst?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (branche !== undefined) updateData.branche = branche?.trim() || null;
    if (kvkNummer !== undefined) updateData.kvkNummer = kvkNummer?.trim() || null;
    if (btwNummer !== undefined) updateData.btwNummer = btwNummer?.trim() || null;

    const [bijgewerkt] = await db
      .update(klanten)
      .set(updateData)
      .where(eq(klanten.id, Number(id)))
      .returning();

    return NextResponse.json({ klant: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/klanten/[id] — Soft-delete (is_actief = 0)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const [bestaand] = await db.select().from(klanten).where(eq(klanten.id, Number(id)));
    if (!bestaand) {
      return NextResponse.json({ fout: "Klant niet gevonden." }, { status: 404 });
    }

    await db
      .update(klanten)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(klanten.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
