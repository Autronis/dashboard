import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, projecten, tijdregistraties, facturen, notities as notitiesTabel } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, and, inArray } from "drizzle-orm";

// GET /api/klanten — All clients with enriched KPIs, health indicators
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const toonInactief = searchParams.get("inactief") === "1";

    const conditions = toonInactief ? [] : [eq(klanten.isActief, 1)];

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

    // Batch: factuur stats per klant (total revenue, outstanding)
    const factuurStats = await db
      .select({
        klantId: facturen.klantId,
        totaleOmzet: sql<number>`coalesce(sum(case when ${facturen.status} = 'betaald' then ${facturen.bedragInclBtw} else 0 end), 0)`,
        openstaand: sql<number>`coalesce(sum(case when ${facturen.status} in ('verzonden', 'te_laat') then ${facturen.bedragInclBtw} else 0 end), 0)`,
        oudsteOpenVervaldatum: sql<string>`min(case when ${facturen.status} in ('verzonden', 'te_laat') then ${facturen.vervaldatum} else null end)`,
      })
      .from(facturen)
      .where(eq(facturen.isActief, 1))
      .groupBy(facturen.klantId);
    const factuurMap = new Map(factuurStats.map((f) => [f.klantId, f]));

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

      // Check last contact (notitie or tijdregistratie)
      const laatsteNotitie = notitieMap.get(klant.id);
      const laatsteReg = tijdMap.get(klant.id);
      const laatsteContact = [laatsteNotitie, laatsteReg]
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

      if (laatsteContact && gezondheid === "groen") {
        const contactDatum = new Date(laatsteContact.includes("T") ? laatsteContact : laatsteContact.replace(" ", "T") + "Z");
        const dagenGeleden = Math.floor((nu.getTime() - contactDatum.getTime()) / (1000 * 60 * 60 * 24));
        if (dagenGeleden > 30) {
          gezondheid = "rood";
          gezondheidReden = `Geen contact sinds ${dagenGeleden} dagen`;
        } else if (dagenGeleden > 14) {
          gezondheid = "oranje";
          gezondheidReden = `Laatste contact ${dagenGeleden} dagen geleden`;
        }
      }

      // Effective hourly rate
      const effectiefUurtarief = totaalMinuten > 0 ? (totaleOmzet / (totaalMinuten / 60)) : klant.uurtarief || 0;

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
        laatsteContact,
      };
    });

    // Global KPIs
    const totaleOmzetAlleKlanten = klantenMetKPIs.reduce((s, k) => s + k.totaleOmzet, 0);
    const totaalOpenstaand = klantenMetKPIs.reduce((s, k) => s + k.openstaand, 0);
    const actieveKlanten = klantenMetKPIs.filter((k) => k.isActief).length;
    const gezondheidsVerdeling = {
      groen: klantenMetKPIs.filter((k) => k.gezondheid === "groen" && k.isActief).length,
      oranje: klantenMetKPIs.filter((k) => k.gezondheid === "oranje" && k.isActief).length,
      rood: klantenMetKPIs.filter((k) => k.gezondheid === "rood" && k.isActief).length,
    };

    return NextResponse.json({
      klanten: klantenMetKPIs,
      kpis: {
        actieveKlanten,
        totaleOmzet: totaleOmzetAlleKlanten,
        totaalOpenstaand,
        gezondheid: gezondheidsVerdeling,
      },
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

    const { bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, notities: notitiesTekst } = body;

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
