import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  facturen,
  klanten,
  leads,
  projecten,
  taken,
  tijdregistraties,
} from "@/lib/db/schema";
import { eq, and, ne, gte, lte, lt, sql, desc } from "drizzle-orm";

interface Inzicht {
  id: string;
  type: "waarschuwing" | "kans" | "tip" | "succes";
  prioriteit: number; // 1 = hoogst
  titel: string;
  omschrijving: string;
  actie?: { label: string; link: string };
}

function datumISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function GET() {
  try {
    await requireAuth();

    const nu = new Date();
    const vandaag = datumISO(nu);
    const eenWeekGeleden = new Date(nu);
    eenWeekGeleden.setDate(eenWeekGeleden.getDate() - 7);
    const tweeWekenGeleden = new Date(nu);
    tweeWekenGeleden.setDate(tweeWekenGeleden.getDate() - 14);
    const dertigDagenGeleden = new Date(nu);
    dertigDagenGeleden.setDate(dertigDagenGeleden.getDate() - 30);

    const inzichten: Inzicht[] = [];

    // 1. Te late facturen (verzonden, vervaldatum verstreken)
    const teLateFact = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        bedrag: facturen.bedragInclBtw,
        klantNaam: klanten.bedrijfsnaam,
        vervaldatum: facturen.vervaldatum,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "verzonden"),
          eq(facturen.isActief, 1),
          lt(facturen.vervaldatum, vandaag)
        )
      )
      .all();

    if (teLateFact.length > 0) {
      const totaal = teLateFact.reduce((s, f) => s + (f.bedrag ?? 0), 0);
      inzichten.push({
        id: "facturen-te-laat",
        type: "waarschuwing",
        prioriteit: 1,
        titel: `${teLateFact.length} factuur${teLateFact.length > 1 ? "en" : ""} te laat`,
        omschrijving: `€${Math.round(totaal).toLocaleString("nl-NL")} aan openstaande facturen waarvan de vervaldatum is verstreken. ${teLateFact.map((f) => `${f.factuurnummer} (${f.klantNaam})`).join(", ")}.`,
        actie: { label: "Bekijk facturen", link: "/financien" },
      });
    }

    // 2. Facturen bijna verlopen (vervaldatum binnen 3 dagen)
    const drieDAgen = new Date(nu);
    drieDAgen.setDate(drieDAgen.getDate() + 3);
    const bijnaVerlopen = await db
      .select({
        factuurnummer: facturen.factuurnummer,
        klantNaam: klanten.bedrijfsnaam,
        vervaldatum: facturen.vervaldatum,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "verzonden"),
          eq(facturen.isActief, 1),
          gte(facturen.vervaldatum, vandaag),
          lte(facturen.vervaldatum, datumISO(drieDAgen))
        )
      )
      .all();

    if (bijnaVerlopen.length > 0) {
      inzichten.push({
        id: "facturen-bijna-verlopen",
        type: "waarschuwing",
        prioriteit: 2,
        titel: `${bijnaVerlopen.length} factuur${bijnaVerlopen.length > 1 ? "en" : ""} verlop${bijnaVerlopen.length > 1 ? "en" : "t"} binnenkort`,
        omschrijving: `Vervaldatum binnen 3 dagen: ${bijnaVerlopen.map((f) => `${f.factuurnummer} (${f.klantNaam})`).join(", ")}.`,
        actie: { label: "Bekijk facturen", link: "/financien" },
      });
    }

    // 3. Leads zonder opvolging (status "nieuw" of "contact" met geen activiteit >7 dagen)
    const verwaarloosdeLeads = await db
      .select({
        id: leads.id,
        bedrijfsnaam: leads.bedrijfsnaam,
        status: leads.status,
        bijgewerktOp: leads.bijgewerktOp,
      })
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          sql`${leads.status} IN ('nieuw', 'contact')`,
          lt(leads.bijgewerktOp, eenWeekGeleden.toISOString())
        )
      )
      .all();

    if (verwaarloosdeLeads.length > 0) {
      inzichten.push({
        id: "leads-opvolgen",
        type: "kans",
        prioriteit: 3,
        titel: `${verwaarloosdeLeads.length} lead${verwaarloosdeLeads.length > 1 ? "s" : ""} wacht${verwaarloosdeLeads.length === 1 ? "" : "en"} op opvolging`,
        omschrijving: `Deze leads zijn langer dan een week niet bijgewerkt: ${verwaarloosdeLeads.map((l) => l.bedrijfsnaam).join(", ")}.`,
        actie: { label: "Ga naar CRM", link: "/crm" },
      });
    }

    // 4. Taken met hoge prioriteit
    const urgenteTaken = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(taken)
      .where(
        and(
          eq(taken.prioriteit, "hoog"),
          ne(taken.status, "afgerond")
        )
      )
      .get();

    if (urgenteTaken && urgenteTaken.count > 0) {
      inzichten.push({
        id: "taken-urgent",
        type: "waarschuwing",
        prioriteit: 4,
        titel: `${urgenteTaken.count} urgente ta${urgenteTaken.count > 1 ? "ken" : "ak"} open`,
        omschrijving: `Er staan ${urgenteTaken.count} taken met hoge prioriteit open die aandacht nodig hebben.`,
        actie: { label: "Bekijk taken", link: "/taken" },
      });
    }

    // 5. Projecten zonder tijdregistratie afgelopen week
    const actieveProjectenLijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(
        and(eq(projecten.status, "actief"), eq(projecten.isActief, 1))
      )
      .all();

    const projectenMetUren = await db
      .select({
        projectId: tijdregistraties.projectId,
      })
      .from(tijdregistraties)
      .where(gte(tijdregistraties.startTijd, eenWeekGeleden.toISOString()))
      .groupBy(tijdregistraties.projectId)
      .all()
      .map((r) => r.projectId);

    const stilleProjecten = actieveProjectenLijst.filter(
      (p) => !projectenMetUren.includes(p.id)
    );

    if (stilleProjecten.length > 0) {
      inzichten.push({
        id: "projecten-stil",
        type: "tip",
        prioriteit: 5,
        titel: `${stilleProjecten.length} actie${stilleProjecten.length > 1 ? "ve" : "f"} project${stilleProjecten.length > 1 ? "en" : ""} zonder uren deze week`,
        omschrijving: `Geen tijd geregistreerd voor: ${stilleProjecten.map((p) => `${p.naam} (${p.klantNaam})`).join(", ")}.`,
        actie: { label: "Ga naar tijdregistratie", link: "/tijd" },
      });
    }

    // 6. Omzet trend (vergelijk deze maand vs vorige maand)
    const eersteVandeMaand = new Date(nu.getFullYear(), nu.getMonth(), 1);
    const eersteVorigeMaand = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
    const laatsteVorigeMaand = new Date(nu.getFullYear(), nu.getMonth(), 0, 23, 59, 59);

    const omzetDezeMaand = await db
      .select({ totaal: sql<number>`COALESCE(SUM(${facturen.bedragInclBtw}), 0)` })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          gte(facturen.betaaldOp, eersteVandeMaand.toISOString())
        )
      )
      .get();

    const omzetVorigeMaand = await db
      .select({ totaal: sql<number>`COALESCE(SUM(${facturen.bedragInclBtw}), 0)` })
      .from(facturen)
      .where(
        and(
          eq(facturen.status, "betaald"),
          gte(facturen.betaaldOp, eersteVorigeMaand.toISOString()),
          lte(facturen.betaaldOp, laatsteVorigeMaand.toISOString())
        )
      )
      .get();

    const huidig = omzetDezeMaand?.totaal ?? 0;
    const vorig = omzetVorigeMaand?.totaal ?? 0;

    if (vorig > 0 && huidig > vorig * 1.2) {
      const percentage = Math.round(((huidig - vorig) / vorig) * 100);
      inzichten.push({
        id: "omzet-stijging",
        type: "succes",
        prioriteit: 6,
        titel: `Omzet ${percentage}% hoger dan vorige maand`,
        omschrijving: `Je omzet deze maand (€${Math.round(huidig).toLocaleString("nl-NL")}) ligt flink hoger dan vorige maand (€${Math.round(vorig).toLocaleString("nl-NL")}).`,
        actie: { label: "Bekijk analytics", link: "/analytics" },
      });
    } else if (vorig > 0 && huidig < vorig * 0.5) {
      const percentage = Math.round(((vorig - huidig) / vorig) * 100);
      inzichten.push({
        id: "omzet-daling",
        type: "waarschuwing",
        prioriteit: 2,
        titel: `Omzet ${percentage}% lager dan vorige maand`,
        omschrijving: `Je omzet deze maand (€${Math.round(huidig).toLocaleString("nl-NL")}) is een stuk lager dan vorige maand (€${Math.round(vorig).toLocaleString("nl-NL")}). Tijd om leads op te volgen?`,
        actie: { label: "Ga naar CRM", link: "/crm" },
      });
    }

    // 7. Concept facturen die al lang open staan
    const oudeConcepten = await db
      .select({
        factuurnummer: facturen.factuurnummer,
        klantNaam: klanten.bedrijfsnaam,
        aangemaaktOp: facturen.aangemaaktOp,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "concept"),
          eq(facturen.isActief, 1),
          lt(facturen.aangemaaktOp, eenWeekGeleden.toISOString())
        )
      )
      .all();

    if (oudeConcepten.length > 0) {
      inzichten.push({
        id: "concept-facturen",
        type: "tip",
        prioriteit: 4,
        titel: `${oudeConcepten.length} concept-factuur${oudeConcepten.length > 1 ? "en" : ""} klaar om te versturen`,
        omschrijving: `Deze concepten staan al meer dan een week open: ${oudeConcepten.map((f) => `${f.factuurnummer} (${f.klantNaam})`).join(", ")}.`,
        actie: { label: "Bekijk facturen", link: "/financien" },
      });
    }

    // 8. Leads met hoge waarde in pipeline
    const waardevollLeads = await db
      .select({
        bedrijfsnaam: leads.bedrijfsnaam,
        waarde: leads.waarde,
        status: leads.status,
      })
      .from(leads)
      .where(
        and(
          eq(leads.isActief, 1),
          sql`${leads.status} IN ('nieuw', 'contact', 'offerte')`,
          gte(leads.waarde, 5000)
        )
      )
      .orderBy(desc(leads.waarde))
      .limit(3)
      .all();

    if (waardevollLeads.length > 0) {
      const totaal = waardevollLeads.reduce((s, l) => s + (l.waarde ?? 0), 0);
      inzichten.push({
        id: "leads-waarde",
        type: "kans",
        prioriteit: 3,
        titel: `€${Math.round(totaal).toLocaleString("nl-NL")} aan kansrijke leads`,
        omschrijving: `${waardevollLeads.map((l) => `${l.bedrijfsnaam} (€${Math.round(l.waarde ?? 0).toLocaleString("nl-NL")}, ${l.status})`).join(", ")}.`,
        actie: { label: "Ga naar CRM", link: "/crm" },
      });
    }

    // Sorteer op prioriteit
    inzichten.sort((a, b) => a.prioriteit - b.prioriteit);

    return Response.json({ inzichten });
  } catch {
    return Response.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }
}
