import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  facturen,
  klanten,
  leads,
  projecten,
  taken,
  screenTimeEntries,
  tijdregistraties,
  klantUren,
  bankTransacties,
  abonnementen,
  revolutVerbinding,
  upworkJobs,
  projectIntakes,
  meetings,
} from "@/lib/db/schema";
import { eq, and, ne, gte, lte, lt, sql } from "drizzle-orm";

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
;

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
;

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

    // 3. Leads zonder opvolging (status "nieuw" of "contact", >7 dagen stil,
    //    én geen volgende actie al in de toekomst gepland). Zonder die laatste
    //    filter kwamen leads terug waar we al een actie geagendeerd hadden —
    //    vals signaal.
    const nuISO = new Date().toISOString();
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
          lt(leads.bijgewerktOp, eenWeekGeleden.toISOString()),
          sql`(${leads.volgendeActieDatum} IS NULL OR ${leads.volgendeActieDatum} <= ${nuISO})`,
        )
      )
;

    if (verwaarloosdeLeads.length > 0) {
      inzichten.push({
        id: "leads-opvolgen",
        type: "kans",
        prioriteit: 3,
        titel: `${verwaarloosdeLeads.length} lead${verwaarloosdeLeads.length > 1 ? "s" : ""} wacht${verwaarloosdeLeads.length === 1 ? "" : "en"} op opvolging`,
        omschrijving: `Deze leads zijn langer dan een week niet bijgewerkt: ${verwaarloosdeLeads.map((l) => l.bedrijfsnaam).join(", ")}.`,
        actie: { label: "Open leads", link: "/leads" },
      });
    }

    // 4. Urgente taken alert uitgeschakeld — 'Mijn taken' widget toont al
    // de volgende focus-taak met afvink-knop direct op de home. Dubbel.
    // Als je 'm ooit wil terug: uncomment + query op taken waar prioriteit
    // 'hoog' + status != afgerond, én tegelijk UIT de Mijn taken widget halen.

    // 5. Actieve projecten waar niemand mee bezig is geweest deze week
    //    Check drie activity-bronnen parallel: screen-time, handmatige
    //    tijdregistraties, klant-uren. Een project telt als 'actief' zodra
    //    er in ÉÉN van de drie een entry is — anders is 't écht stil.
    const actieveProjectenLijst = await db
      .select({
        id: projecten.id,
        naam: projecten.naam,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(projecten)
      .leftJoin(klanten, eq(projecten.klantId, klanten.id))
      .where(and(eq(projecten.status, "actief"), eq(projecten.isActief, 1)));

    const eenWeekISO = eenWeekGeleden.toISOString();
    const eenWeekDatum = datumISO(eenWeekGeleden);

    const [screenTimeProjects, tijdregProjects, klantUrenProjects] = await Promise.all([
      db
        .select({ projectId: screenTimeEntries.projectId })
        .from(screenTimeEntries)
        .where(and(
          gte(screenTimeEntries.startTijd, eenWeekISO),
          ne(screenTimeEntries.categorie, "inactief"),
        ))
        .groupBy(screenTimeEntries.projectId),
      db
        .select({ projectId: tijdregistraties.projectId })
        .from(tijdregistraties)
        .where(gte(tijdregistraties.startTijd, eenWeekISO))
        .groupBy(tijdregistraties.projectId),
      db
        .select({ projectId: klantUren.projectId })
        .from(klantUren)
        .where(gte(klantUren.datum, eenWeekDatum))
        .groupBy(klantUren.projectId),
    ]);

    const projectenMetActiviteit = new Set<number>();
    for (const row of screenTimeProjects) if (row.projectId) projectenMetActiviteit.add(row.projectId);
    for (const row of tijdregProjects) if (row.projectId) projectenMetActiviteit.add(row.projectId);
    for (const row of klantUrenProjects) if (row.projectId) projectenMetActiviteit.add(row.projectId);

    const stilleProjecten = actieveProjectenLijst.filter(
      (p) => !projectenMetActiviteit.has(p.id)
    );

    // Stille projecten alert uitgeschakeld — dupliceerde de 'Project updates'
    // widget in Dagbriefing. Die toont al voortgang per project, inclusief
    // welke stil staan. Alert hier gaf extra cognitieve ruis zonder nieuwe actie.
    // stilleProjecten blijft wel in de response beschikbaar voor andere
    // clients die het willen gebruiken.
    void stilleProjecten;

    // 5b. Onbetaalde facturen met overdue status — directe actie (herinnering).
    const overdueFacturen = await db
      .select({
        id: facturen.id,
        factuurnummer: facturen.factuurnummer,
        klantNaam: klanten.bedrijfsnaam,
        bedragInclBtw: facturen.bedragInclBtw,
        vervaldatum: facturen.vervaldatum,
      })
      .from(facturen)
      .leftJoin(klanten, eq(facturen.klantId, klanten.id))
      .where(
        and(
          eq(facturen.status, "te_laat"),
          sql`${facturen.vervaldatum} IS NOT NULL`,
        ),
      )
      .limit(10);

    if (overdueFacturen.length > 0) {
      const totaal = overdueFacturen.reduce(
        (acc, f) => acc + (f.bedragInclBtw ?? 0),
        0,
      );
      const lijst = overdueFacturen
        .slice(0, 3)
        .map((f) => `${f.factuurnummer}${f.klantNaam ? ` (${f.klantNaam})` : ""}`)
        .join(", ");
      inzichten.push({
        id: "facturen-overdue",
        type: "waarschuwing",
        prioriteit: 2,
        titel: `€${Math.round(totaal).toLocaleString("nl-NL")} onbetaald over ${overdueFacturen.length} fact${overdueFacturen.length > 1 ? "uren" : "uur"}`,
        omschrijving: `Vervallen: ${lijst}${overdueFacturen.length > 3 ? " +meer" : ""}. Stuur een herinnering of bel.`,
        actie: { label: "Open facturen", link: "/facturen" },
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
        actie: { label: "Open leads", link: "/leads" },
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
;

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

    // 8. "Top prospect"-inzicht is verwijderd — dupliceerde de ProspectRadar
    //    widget verderop op de homepage (zelfde data, ander framing). Als je
    //    'm terug wil, strip dan de Radar of verschil de criteria.

    // 9. Revolut: Uitgaven trend (deze maand vs vorige maand)
    try {
      const [revolutActive] = await db
        .select({ id: revolutVerbinding.id })
        .from(revolutVerbinding)
        .where(eq(revolutVerbinding.isActief, 1))
        .limit(1);

      if (revolutActive) {
        const uitgavenDezeMaand = await db
          .select({ totaal: sql<number>`COALESCE(SUM(${bankTransacties.bedrag}), 0)` })
          .from(bankTransacties)
          .where(
            and(
              eq(bankTransacties.type, "af"),
              eq(bankTransacties.bank, "revolut"),
              gte(bankTransacties.datum, datumISO(eersteVandeMaand))
            )
          )
          .get();

        const uitgavenVorigeMaand = await db
          .select({ totaal: sql<number>`COALESCE(SUM(${bankTransacties.bedrag}), 0)` })
          .from(bankTransacties)
          .where(
            and(
              eq(bankTransacties.type, "af"),
              eq(bankTransacties.bank, "revolut"),
              gte(bankTransacties.datum, datumISO(eersteVorigeMaand)),
              lte(bankTransacties.datum, datumISO(laatsteVorigeMaand))
            )
          )
          .get();

        const uitDeze = uitgavenDezeMaand?.totaal ?? 0;
        const uitVorige = uitgavenVorigeMaand?.totaal ?? 0;

        if (uitVorige > 0 && uitDeze > uitVorige * 1.15) {
          const pct = Math.round(((uitDeze - uitVorige) / uitVorige) * 100);
          inzichten.push({
            id: "revolut-uitgaven-stijging",
            type: "waarschuwing",
            prioriteit: 3,
            titel: `Uitgaven ${pct}% hoger dan vorige maand`,
            omschrijving: `Via Revolut: €${Math.round(uitDeze).toLocaleString("nl-NL")} deze maand vs €${Math.round(uitVorige).toLocaleString("nl-NL")} vorige maand.`,
            actie: { label: "Bekijk uitgaven", link: "/financien?tab=uitgaven" },
          });
        }

        // 10. Nieuw gedetecteerde abonnementen (afgelopen 7 dagen)
        const nieuweAbonnementen = await db
          .select({ naam: abonnementen.naam, bedrag: abonnementen.bedrag })
          .from(abonnementen)
          .where(
            and(
              eq(abonnementen.isActief, 1),
              gte(abonnementen.aangemaaktOp, eenWeekGeleden.toISOString()),
              sql`${abonnementen.notities} LIKE '%Automatisch gedetecteerd%'`
            )
          );

        if (nieuweAbonnementen.length > 0) {
          const totaal = nieuweAbonnementen.reduce((s, a) => s + a.bedrag, 0);
          inzichten.push({
            id: "revolut-nieuwe-abonnementen",
            type: "tip",
            prioriteit: 4,
            titel: `${nieuweAbonnementen.length} nieuw${nieuweAbonnementen.length > 1 ? "e" : ""} abonnement${nieuweAbonnementen.length > 1 ? "en" : ""} gedetecteerd`,
            omschrijving: `${nieuweAbonnementen.map((a) => `${a.naam} (€${a.bedrag.toFixed(2)})`).join(", ")} — totaal €${totaal.toFixed(2)}/maand.`,
            actie: { label: "Bekijk abonnementen", link: "/financien?tab=abonnementen" },
          });
        }

        // 11. Totale abonnementenkosten inzicht
        const totaalAbonnementen = await db
          .select({
            maandelijks: sql<number>`COALESCE(SUM(CASE
              WHEN ${abonnementen.frequentie} = 'maandelijks' THEN ${abonnementen.bedrag}
              WHEN ${abonnementen.frequentie} = 'per_kwartaal' THEN ${abonnementen.bedrag} / 3.0
              WHEN ${abonnementen.frequentie} = 'jaarlijks' THEN ${abonnementen.bedrag} / 12.0
              ELSE 0 END), 0)`,
          })
          .from(abonnementen)
          .where(eq(abonnementen.isActief, 1))
          .get();

        const maandKosten = totaalAbonnementen?.maandelijks ?? 0;
        if (maandKosten > 200) {
          inzichten.push({
            id: "abonnementen-kosten",
            type: "tip",
            prioriteit: 7,
            titel: `€${Math.round(maandKosten)}/maand aan abonnementen`,
            omschrijving: `Je vaste lasten zijn €${Math.round(maandKosten)}/maand (€${Math.round(maandKosten * 12)}/jaar). Check of alles nog nodig is.`,
            actie: { label: "Bekijk abonnementen", link: "/financien?tab=abonnementen" },
          });
        }
      }
    } catch {
      // Revolut insights are optional, don't break the whole endpoint
    }

    // 12. Upwork: nieuwe jobs in inbox — echte "wacht op jou"-signaal,
    //     niet-afgehandelde scans die nog niet bekeken zijn.
    try {
      const [upworkNewRow] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(upworkJobs)
        .where(eq(upworkJobs.status, "new"));
      const upworkNew = Number(upworkNewRow?.count ?? 0);
      if (upworkNew > 0) {
        inzichten.push({
          id: "upwork-inbox",
          type: "kans",
          prioriteit: 3,
          titel: `${upworkNew} nieuw${upworkNew === 1 ? "e" : "e"} Upwork job${upworkNew === 1 ? "" : "s"} in je inbox`,
          omschrijving: upworkNew === 1
            ? "Eén onbekeken job uit je saved search — claim of dismiss."
            : `${upworkNew} onbekeken jobs wachten — snel door scannen.`,
          actie: { label: "Open Upwork", link: "/upwork" },
        });
      }
    } catch {
      // Upwork tabel kan ontbreken in dev — non-fatal
    }

    // 13. Intake vast — project_intakes die >3 dagen niet verder zijn
    //     gekomen (stap != klaar). Vaak wachten die op scope of beslissing.
    try {
      const drieDagenGeleden = new Date();
      drieDagenGeleden.setDate(drieDagenGeleden.getDate() - 3);
      const stalledIntakes = await db
        .select({
          id: projectIntakes.id,
          stap: projectIntakes.stap,
          klantConcept: projectIntakes.klantConcept,
          projectId: projectIntakes.projectId,
        })
        .from(projectIntakes)
        .where(
          and(
            ne(projectIntakes.stap, "klaar"),
            lt(projectIntakes.bijgewerktOp, drieDagenGeleden.toISOString()),
          ),
        )
        .limit(5);

      if (stalledIntakes.length > 0) {
        const first = stalledIntakes[0];
        const rest = stalledIntakes.length - 1;
        inzichten.push({
          id: "intake-vast",
          type: "waarschuwing",
          prioriteit: 3,
          titel: `${stalledIntakes.length} intake${stalledIntakes.length > 1 ? "s" : ""} vast — geen voortgang in 3+ dagen`,
          omschrijving: `Eerste: "${first.klantConcept?.slice(0, 60) ?? "(zonder concept)"}" (stap: ${first.stap}).${rest > 0 ? ` +${rest} meer.` : ""}`,
          actie: { label: "Open intakes", link: "/projecten" },
        });
      }
    } catch {
      // Non-fatal
    }

    // 14. Meetings met ongeleegde actiepunten — meetings.status='klaar'
    //     waar actiepunten JSON minimaal 1 item heeft. Geen check of die al
    //     tot taken zijn omgezet (zou JSON-join vereisen); user vinkt ze af
    //     op /meetings detail.
    try {
      const meetingsMetActiepunten = await db
        .select({
          id: meetings.id,
          titel: meetings.titel,
          actiepunten: meetings.actiepunten,
        })
        .from(meetings)
        .where(
          and(
            eq(meetings.status, "klaar"),
            sql`COALESCE(json_array_length(${meetings.actiepunten}), 0) > 0`,
          ),
        )
        .orderBy(sql`${meetings.datum} DESC`)
        .limit(10);

      // Filter: alleen meetings van afgelopen 14d (oudere worden toch niet meer verwerkt)
      const twee_weken = new Date();
      twee_weken.setDate(twee_weken.getDate() - 14);
      const recentMeetings = meetingsMetActiepunten.filter((m) => {
        const meetingRow = m as typeof meetingsMetActiepunten[number] & { datum?: string };
        return !meetingRow.datum || meetingRow.datum >= twee_weken.toISOString();
      });

      let totaalActiepunten = 0;
      for (const m of recentMeetings) {
        try {
          const parsed = JSON.parse(m.actiepunten ?? "[]");
          if (Array.isArray(parsed)) totaalActiepunten += parsed.length;
        } catch {
          // malformed JSON, skip
        }
      }

      if (recentMeetings.length > 0 && totaalActiepunten > 0) {
        inzichten.push({
          id: "meeting-actiepunten",
          type: "tip",
          prioriteit: 4,
          titel: `${totaalActiepunten} actiepunt${totaalActiepunten === 1 ? "" : "en"} uit ${recentMeetings.length} meeting${recentMeetings.length === 1 ? "" : "s"}`,
          omschrijving: `Meest recent: "${recentMeetings[0].titel}". Doorloop ze en maak taken aan.`,
          actie: { label: "Open meetings", link: "/meetings" },
        });
      }
    } catch {
      // Non-fatal (json_array_length is SQLite 3.38+, zou altijd moeten werken)
    }

    // Sorteer op prioriteit
    inzichten.sort((a, b) => a.prioriteit - b.prioriteit);

    return Response.json({ inzichten });
  } catch {
    return Response.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }
}
