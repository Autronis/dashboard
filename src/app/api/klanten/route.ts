import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten, tijdregistraties, facturen, offertes, notities as notitiesTabel, meetings, taken } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and } from "drizzle-orm";

// GET /api/klanten — All clients with enriched KPIs, health indicators
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const toonInactief = searchParams.get("inactief") === "1";
    const toonDemo = searchParams.get("demo") === "1";

    const conditions = [];
    if (!toonInactief) conditions.push(eq(klanten.isActief, 1));
    if (!toonDemo) conditions.push(eq(klanten.isDemo, 0));

    const lijst = await db
      .select({
        id: klanten.id,
        bedrijfsnaam: klanten.bedrijfsnaam,
        contactpersoon: klanten.contactpersoon,
        email: klanten.email,
        telefoon: klanten.telefoon,
        adres: klanten.adres,
        uurtarief: klanten.uurtarief,
        notities: klanten.notities,
        isActief: klanten.isActief,
        type: klanten.type,
        isDemo: klanten.isDemo,
        website: klanten.website,
        branche: klanten.branche,
        kvkNummer: klanten.kvkNummer,
        btwNummer: klanten.btwNummer,
        aantalMedewerkers: klanten.aantalMedewerkers,
        taal: klanten.taal,
        klantSinds: klanten.klantSinds,
        aangemaaktOp: klanten.aangemaaktOp,
      })
      .from(klanten)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(klanten.bedrijfsnaam);

    // Batch: project counts per klant
    const projectStats = await db
      .select({
        klantId: projecten.klantId,
        aantalProjecten: sql<number>`count(*)`,
        actieveProjecten: sql<number>`sum(case when ${projecten.status} = 'actief' then 1 else 0 end)`,
      })
      .from(projecten)
      .where(eq(projecten.isActief, 1))
      .groupBy(projecten.klantId);
    const projectMap = new Map(projectStats.map((p) => [p.klantId, p]));

    // Batch: total hours per klant
    const urenStats = await db
      .select({
        klantId: projecten.klantId,
        totaalMinuten: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)`,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .groupBy(projecten.klantId);
    const urenMap = new Map(urenStats.map((u) => [u.klantId, u.totaalMinuten]));

    // Batch: factuur stats per klant (total revenue, outstanding, last invoice)
    const factuurStats = await db
      .select({
        klantId: facturen.klantId,
        totaleOmzet: sql<number>`coalesce(sum(case when ${facturen.status} = 'betaald' then ${facturen.bedragInclBtw} else 0 end), 0)`,
        openstaand: sql<number>`coalesce(sum(case when ${facturen.status} in ('verzonden', 'te_laat') then ${facturen.bedragInclBtw} else 0 end), 0)`,
        oudsteOpenVervaldatum: sql<string>`min(case when ${facturen.status} in ('verzonden', 'te_laat') then ${facturen.vervaldatum} else null end)`,
        laatsteFactuurDatum: sql<string>`max(${facturen.factuurdatum})`,
        laatsteFactuurBedrag: sql<number>`(
          SELECT f2.bedrag_incl_btw FROM facturen f2
          WHERE f2.klant_id = ${facturen.klantId} AND f2.is_actief = 1
          ORDER BY f2.factuurdatum DESC LIMIT 1
        )`,
      })
      .from(facturen)
      .where(eq(facturen.isActief, 1))
      .groupBy(facturen.klantId);
    const factuurMap = new Map(factuurStats.map((f) => [f.klantId, f]));

    // Batch: open offertes per klant
    const offerteStats = await db
      .select({
        klantId: offertes.klantId,
        openstaandeOffertes: sql<number>`count(*)`,
      })
      .from(offertes)
      .where(and(
        eq(offertes.isActief, 1),
        sql`${offertes.status} IN ('concept', 'verzonden')`
      ))
      .groupBy(offertes.klantId);
    const offerteMap = new Map(offerteStats.map((o) => [o.klantId, o.openstaandeOffertes]));

    // Batch: last interaction per klant (most recent note, time entry, or factuur)
    const laatsteNotities = await db
      .select({
        klantId: notitiesTabel.klantId,
        laatsteNotitie: sql<string>`max(${notitiesTabel.aangemaaktOp})`,
      })
      .from(notitiesTabel)
      .groupBy(notitiesTabel.klantId);
    const notitieMap = new Map(laatsteNotities.map((n) => [n.klantId, n.laatsteNotitie]));

    const laatsteTijd = await db
      .select({
        klantId: projecten.klantId,
        laatsteRegistratie: sql<string>`max(${tijdregistraties.startTijd})`,
      })
      .from(tijdregistraties)
      .innerJoin(projecten, eq(tijdregistraties.projectId, projecten.id))
      .groupBy(projecten.klantId);
    const tijdMap = new Map(laatsteTijd.map((t) => [t.klantId, t.laatsteRegistratie]));

    // Batch: last meeting per klant
    const laatsteMeetings = await db
      .select({
        klantId: meetings.klantId,
        laatsteMeeting: sql<string>`max(${meetings.datum})`,
      })
      .from(meetings)
      .groupBy(meetings.klantId);
    const meetingMap = new Map(laatsteMeetings.map((m) => [m.klantId, m.laatsteMeeting]));

    // Batch: open taken per klant (via projecten)
    const openTakenStats = await db
      .select({
        klantId: projecten.klantId,
        openTaken: sql<number>`count(*)`,
      })
      .from(taken)
      .innerJoin(projecten, eq(taken.projectId, projecten.id))
      .where(sql`${taken.status} IN ('open', 'bezig')`)
      .groupBy(projecten.klantId);
    const openTakenMap = new Map(openTakenStats.map((t) => [t.klantId, t.openTaken]));

    // Calculate health + enrichment per klant
    const nu = new Date();
    const klantenMetKPIs = lijst.map((klant) => {
      const projStats = projectMap.get(klant.id);
      const totaalMinuten = urenMap.get(klant.id) || 0;
      const fStats = factuurMap.get(klant.id);
      const totaleOmzet = fStats?.totaleOmzet || 0;
      const openstaand = fStats?.openstaand || 0;

      // Determine health: green/orange/red
      let gezondheid: "groen" | "oranje" | "rood" = "groen";
      let gezondheidReden = "";

      // Check for overdue invoices
      if (fStats?.oudsteOpenVervaldatum) {
        const vervaldatum = new Date(fStats.oudsteOpenVervaldatum);
        const dagenOver = Math.floor((nu.getTime() - vervaldatum.getTime()) / (1000 * 60 * 60 * 24));
        if (dagenOver > 30) {
          gezondheid = "rood";
          gezondheidReden = `Factuur ${dagenOver} dagen over vervaldatum`;
        } else if (dagenOver > 0) {
          gezondheid = "oranje";
          gezondheidReden = `Factuur ${dagenOver} dagen over vervaldatum`;
        }
      }

      // Check last contact (notitie, tijdregistratie, or meeting)
      const laatsteNotitie = notitieMap.get(klant.id);
      const laatsteReg = tijdMap.get(klant.id);
      const laatsteMeeting = meetingMap.get(klant.id);
      const laatsteContact = [laatsteNotitie, laatsteReg, laatsteMeeting]
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      if (laatsteContact && gezondheid === "groen") {
        const contactDatum = new Date(laatsteContact.includes("T") ? laatsteContact : laatsteContact.replace(" ", "T") + "Z");
        const dagenGeleden = Math.floor((nu.getTime() - contactDatum.getTime()) / (1000 * 60 * 60 * 24));
        if (dagenGeleden > 60) {
          gezondheid = "rood";
          gezondheidReden = `Geen contact sinds ${dagenGeleden} dagen`;
        } else if (dagenGeleden > 30) {
          gezondheid = "oranje";
          gezondheidReden = `Laatste contact ${dagenGeleden} dagen geleden`;
        }
      }

      // Effective hourly rate
      const effectiefUurtarief = totaalMinuten > 0 ? (totaleOmzet / (totaalMinuten / 60)) : klant.uurtarief || 0;

      // Relatie status: maps health to user-friendly label
      let relatieStatus: "actief" | "stil" | "aandacht_nodig" | "inactief" = "actief";
      if (!klant.isActief) {
        relatieStatus = "inactief";
      } else if (gezondheid === "rood") {
        relatieStatus = "aandacht_nodig";
      } else if (gezondheid === "oranje") {
        relatieStatus = "stil";
      }

      // Days since last contact
      let dagenSindsContact: number | null = null;
      if (laatsteContact) {
        const contactDatum = new Date(laatsteContact.includes("T") ? laatsteContact : laatsteContact.replace(" ", "T") + "Z");
        dagenSindsContact = Math.floor((nu.getTime() - contactDatum.getTime()) / (1000 * 60 * 60 * 24));
      }

      const openTaken = openTakenMap.get(klant.id) || 0;

      // Build tags
      const tags: string[] = [];
      if (klant.klantSinds) {
        tags.push(`Klant sinds ${klant.klantSinds.substring(0, 4)}`);
      } else if (klant.aangemaaktOp) {
        tags.push(`Klant sinds ${klant.aangemaaktOp.substring(0, 4)}`);
      }
      const projCount = projStats?.aantalProjecten || 0;
      if (projCount > 0) tags.push(`${projCount} project${projCount > 1 ? "en" : ""}`);
      if (klant.branche) tags.push(klant.branche);

      return {
        ...klant,
        aantalProjecten: projStats?.aantalProjecten || 0,
        actieveProjecten: projStats?.actieveProjecten || 0,
        totaalMinuten,
        totaleOmzet,
        openstaand,
        effectiefUurtarief: Math.round(effectiefUurtarief * 100) / 100,
        gezondheid,
        gezondheidReden,
        relatieStatus,
        dagenSindsContact,
        openTaken,
        laatsteContact,
        laatsteMeetingDatum: laatsteMeeting || null,
        laatsteFactuurDatum: fStats?.laatsteFactuurDatum || null,
        laatsteFactuurBedrag: fStats?.laatsteFactuurBedrag || null,
        openstaandeOffertes: offerteMap.get(klant.id) || 0,
        tags,
      };
    });

    // Global KPIs (exclude demo)
    const echteKlanten = klantenMetKPIs.filter((k) => !k.isDemo);
    const totaleOmzetAlleKlanten = echteKlanten.reduce((s, k) => s + k.totaleOmzet, 0);
    const totaalOpenstaand = echteKlanten.reduce((s, k) => s + k.openstaand, 0);
    const actieveKlanten = echteKlanten.filter((k) => k.isActief).length;
    const gezondheidsVerdeling = {
      groen: echteKlanten.filter((k) => k.gezondheid === "groen" && k.isActief).length,
      oranje: echteKlanten.filter((k) => k.gezondheid === "oranje" && k.isActief).length,
      rood: echteKlanten.filter((k) => k.gezondheid === "rood" && k.isActief).length,
    };

    return NextResponse.json({
      klanten: klantenMetKPIs,
      kpis: {
        actieveKlanten,
        totaleOmzet: totaleOmzetAlleKlanten,
        totaalOpenstaand,
        gezondheid: gezondheidsVerdeling,
      },
    }, {
      headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=600" },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/klanten — Create new client
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, notities: notitiesTekst, website, branche, type, taal } = body;

    if (!bedrijfsnaam?.trim()) {
      return NextResponse.json({ fout: "Bedrijfsnaam is verplicht." }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ fout: "Ongeldig e-mailadres." }, { status: 400 });
    }

    if (uurtarief !== undefined && uurtarief !== null && uurtarief <= 0) {
      return NextResponse.json({ fout: "Uurtarief moet positief zijn." }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(klanten)
      .values({
        bedrijfsnaam: bedrijfsnaam.trim(),
        contactpersoon: contactpersoon?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        telefoon: telefoon?.trim() || null,
        adres: adres?.trim() || null,
        uurtarief: uurtarief || null,
        notities: notitiesTekst?.trim() || null,
        website: website?.trim() || null,
        branche: branche?.trim() || null,
        type: type === "facturatie" ? "facturatie" : "klant",
        taal: taal === "en" ? "en" : "nl",
        klantSinds: new Date().toISOString().substring(0, 10),
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ klant: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
