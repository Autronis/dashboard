/**
 * Slimme taken — vooraf gedefinieerde Claude-uitvoerbare acties die Sem/Syb
 * met één klik aan hun dag kunnen toevoegen. Het zijn geen project taken —
 * ze staan los van een specifiek klantproject. Gebruik ze voor terugkerende
 * Autronis operationele analyse/review acties die echte dashboard data als
 * input pakken.
 *
 * Elke template heeft:
 * - id: slug, uniek
 * - naam: korte titel (met {placeholders})
 * - beschrijving: één regel context
 * - cluster: welke cluster — bepaalt historische ownership
 * - geschatteDuur: minuten
 * - prompt: letterlijke opdracht voor Claude Code met {placeholder} subs
 * - velden: optionele input velden
 *
 * DESIGN PRINCIPE: slimme taken pakken BESTAANDE dashboard data (/api/ideeen,
 * /api/yt-knowledge, /api/leads, /api/projecten, /api/financien) en doen
 * ANALYSE + BESLISSING + PRIORITEIT. NIET "schrijf 3 LinkedIn posts" — daar
 * heeft het dashboard al generators voor.
 */

export interface SlimmeTaakTemplate {
  id: string;
  naam: string;
  beschrijving: string;
  cluster: "backend-infra" | "frontend" | "klantcontact" | "content" | "admin" | "research";
  geschatteDuur: number;
  prompt: string;
  velden?: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: "text" | "number" | "url";
  }>;
}

/**
 * Oude system template slugs die niet meer passen bij de filosofie
 * "analyse + beslis ipv produceer". Worden bij elke ensure-call
 * gedeactiveerd (is_actief=0) in de DB. Blijven bestaan als
 * historisch record.
 */
export const DEPRECATED_SYSTEM_SLUGS = [
  "linkedin-posts-week",    // dashboard heeft al een generator
  "factuur-check-week",     // vervangen door financiele-snapshot-acties (breder)
  "concurrentie-analyse",   // vervangen door concurrentie-week-scan (beter promt)
  "email-followup-leads",   // vervangen door lead-followup-prioriteiten (analyse-first)
  "ideeen-ranker",          // vervangen door review-top-ideeen (diepere review)
];

export const SLIMME_TAKEN: SlimmeTaakTemplate[] = [
  // ─── BEHOUDEN UIT v1 ───
  {
    id: "10-bedrijven-zoeken",
    naam: "10 bedrijven zoeken in {branche}",
    beschrijving: "Scrape 10 bedrijven in een specifieke branche via Google Maps",
    cluster: "research",
    geschatteDuur: 15,
    velden: [
      { key: "branche", label: "Branche", placeholder: "bv. Marketing Agency, Bouwbedrijven" },
      { key: "locatie", label: "Locatie", placeholder: "bv. Amsterdam, Utrecht", type: "text" },
    ],
    prompt: `Scrape 10 bedrijven in branche "{branche}" in "{locatie}" via de Google Maps scraper.

Stappen:
1. POST naar /api/leads/edge-function/trigger-google-maps-scraper met body:
   { "searchQuery": "{branche}", "locations": ["{locatie}"], "maxItems": 10 }
2. Wacht op resultaten (check /leads/automations pagina na 30 sec)
3. Rapporteer: naam, website, telefoon, email, locatie per bedrijf
4. Rank op fit met Autronis dienstverlening (automatisering, AI, integraties)
5. Return top 3 meest interessante voor outreach + waarom`,
  },
  {
    id: "website-scrape",
    naam: "Scrape website {url}",
    beschrijving: "Gebruik Firecrawl om een website te scrapen en te analyseren",
    cluster: "research",
    geschatteDuur: 10,
    velden: [
      { key: "url", label: "Website URL", placeholder: "https://...", type: "url" },
    ],
    prompt: `Scrape {url} via de bestaande scrape tool of Firecrawl.

Rapporteer:
- Wat doet het bedrijf (in 2 zinnen)
- Doelgroep / branche
- Dienstverlening / producten
- Contact info (email, telefoon, adres)
- Tech stack (Next.js, WordPress, Shopify, etc)
- Eerste indruk kwaliteit (pro / middelmatig / rommelig)
- 3 potentiele automatisering kansen voor Autronis (met ROI schatting)

Output als markdown rapport naar /tmp/scrape-{slug}-{datum}.md`,
  },

  // ─── NIEUWE ANALYSE / REVIEW TAKEN ───

  {
    id: "review-yt-knowledge",
    naam: "Review 10 YouTube knowledge items",
    beschrijving: "Analyseer recente YT research en beslis wat nuttig is voor Autronis",
    cluster: "research",
    geschatteDuur: 20,
    prompt: `Review de 10 meest recente YouTube knowledge analyses in het dashboard.

Stappen:
1. GET /api/yt-knowledge?limit=10&sort=recent
2. Voor elk item — lees summary, features, steps, tips, relevance_score
3. Categoriseer per item in één van:
   A. BOUWEN — concrete feature of tool die we moeten bouwen in het dashboard
   B. TOEPASSEN — werkwijze/tip die we direct kunnen toepassen in onze workflow
   C. DELEN — waardevol om als content (blog / LinkedIn / video) uit te werken
   D. ARCHIVEREN — al bekend of niet relevant voor Autronis
4. Voor de top 3 BOUWEN/TOEPASSEN items: maak concrete actie-items aan in /ideeen met link naar de YT bron
5. Rapporteer in chat: top 3 bouwen, top 3 toepassen, top 3 delen, de rest archiveren

Doel: geen YT knowledge blijft stof happen. Elke waardevolle inzicht wordt óf een taak óf content.`,
  },
  {
    id: "review-top-ideeen",
    naam: "Review top 10 ideeën uit backlog",
    beschrijving: "Diepe analyse + prioritering van de beste ideeen uit de backlog",
    cluster: "research",
    geschatteDuur: 25,
    prompt: `Review de top 10 ideeen uit het dashboard en maak een build-order.

Stappen:
1. GET /api/ideeen?sort=aiScore&limit=10
2. Voor elk idee, diepe analyse:
   - Bouwbaarheid (uren schatting, 1-40h)
   - ROI (wat levert het op: omzet / tijdsbesparing / strategic fit)
   - Afhankelijkheden (welke andere systemen/ideeen hangen eraan)
   - Risico (wat kan mis gaan, kosten van failure)
   - Energy level (saaie plicht, leuk nieuw, of iets ertussen)
3. Categoriseer:
   - BOUWEN DEZE MAAND (top 3 — hoog ROI, laag effort)
   - VOLGEND KWARTAAL (3 items — meer effort of afhankelijk)
   - PARKEREN (4 items — lage prio of te vroeg)
4. Per BOUWEN item: maak direct een project entry aan via /api/projecten (vraag eigenaar eerst)

Rapporteer in chat met je full reasoning per idee.`,
  },
  {
    id: "projecten-gezondheid-scan",
    naam: "Projecten gezondheid scan",
    beschrijving: "Check alle actieve projecten, flag problemen, rank aandacht",
    cluster: "admin",
    geschatteDuur: 15,
    prompt: `Scan alle actieve projecten en rank welke nu aandacht nodig hebben.

Stappen:
1. GET /api/projecten?status=actief
2. Voor elk project check:
   - Voortgangspercentage vs deadline nabijheid (mismatch = probleem)
   - Uren besteed vs geschatte uren (overspent > 120% = flag)
   - Laatste activiteit (geen commits/taken in 14+ dagen = stil)
   - Openstaande hoge-prioriteit taken (> 5 = overbelast)
   - Klant communicatie (laatste mail/meeting met klant)
3. Geef elk project een health score 1-10 + kleur (groen/geel/rood)
4. Rank top 3 rood-markeerde projecten
5. Per rood project: concrete actie (bv. "bel klant", "deadline verschuiven", "scope snijden")
6. Rapporteer + maak follow-up taken aan in het betreffende project

Dit is een wekelijkse sanity check, geen diepe audit.`,
  },
  {
    id: "lead-followup-prioriteiten",
    naam: "Lead follow-up prioriteiten",
    beschrijving: "Analyseer stille leads, rank op warmte, top 5 voor persoonlijk contact",
    cluster: "klantcontact",
    geschatteDuur: 15,
    prompt: `Analyseer de lead pipeline en return top 5 leads voor persoonlijk contact deze week.

Stappen:
1. GET /api/leads/emails?status=sent&reply_received_at=null
2. Voor elke stille lead scoren op warmte:
   - Bedrijfsgrootte / fit met Autronis profiel (research, AI, automations)
   - Tijd sinds laatste contact (niet te kort = te pushy, niet te lang = verloren)
   - Email status: bounced/read/nothing (read = interesse)
   - Origineel lead source (Google Maps zoekopdracht fit)
3. Rank op (warmte × potentiele deal waarde)
4. Top 5: voor elk geef:
   - Reden waarom deze nu prioriteit is
   - Suggestie voor het persoonlijk bericht (formeel, casual, referentie naar hun website, etc)
   - Beste kanaal (email, LinkedIn, bel)
5. Rapporteer in chat als actiebare lijst — Sem maakt zelf persoonlijk contact

GEEN automatische emails versturen. Alleen analyse + aanbevelingen.`,
  },
  {
    id: "concurrentie-week-scan",
    naam: "Concurrentie week scan",
    beschrijving: "Check recente activity van onze 5 concurrenten, threat assessment",
    cluster: "research",
    geschatteDuur: 20,
    prompt: `Maak een wekelijkse concurrentie update.

Concurrenten: definieer zelf op basis van eerder onderzoek of vraag Sem om lijst.

Per concurrent:
1. Scrape hun website via Firecrawl — diff met vorige week (nieuwe pagina's, prijs wijziging, case studies)
2. LinkedIn bedrijfspagina — laatste 5 posts, reach indicatie
3. Google nieuws zoekopdracht laatste 7 dagen
4. Rapporteer:
   - Wat is nieuw deze week
   - Threat level voor Autronis (laag / midden / hoog) met reden
   - 1 concrete les wat we kunnen overnemen
   - 1 concrete differentiator die we sterker moeten communiceren
5. Eind: 3-min actiepunten voor Sem

Output als markdown rapport + maak top 3 acties als taak in het dashboard.`,
  },
  {
    id: "financiele-snapshot-acties",
    naam: "Financiële snapshot + actiepunten",
    beschrijving: "Analyse van facturen, BTW, runway — concrete acties voor deze week",
    cluster: "admin",
    geschatteDuur: 15,
    prompt: `Maak een wekelijkse financiële snapshot met actiepunten.

Stappen:
1. Haal data op:
   - /api/facturen?status=openstaand → facturen ouder dan 14 dagen
   - /api/facturen?status=verzonden&deze_maand=1 → omzet deze maand
   - /api/administratie/uitgaven?deze_maand=1 → uitgaven deze maand
   - /api/belasting/btw-saldo → BTW apart gezet
   - /api/financien/runway → maanden cash left

2. Analyseer:
   - Welke facturen hebben herinnering nodig (openstaand > 14 dagen)
   - Welke uitgaven nog niet zijn geboekt op project (billability loss)
   - Is BTW afdracht goed apart gezet voor volgende kwartaal
   - Runway: komt die gevaarlijk in de buurt van < 3 maanden

3. Output: 3 concrete acties voor deze week (bv. "Factuur 2026-042 Klant X herinneren", "Mollie payout van 15/4 nog boeken als inkomst", "BTW Q1 aangifte staat open tot 30/4")

Rapporteer in chat + maak taken aan in het dashboard voor elk actiepunt.`,
  },
  {
    id: "klantretentie-check",
    naam: "Klantretentie check — stille klanten",
    beschrijving: "Welke klanten zijn stil, waarom, top 5 check-ins deze week",
    cluster: "klantcontact",
    geschatteDuur: 15,
    prompt: `Identificeer klanten die meer dan 30 dagen stil zijn en rank top 5 voor check-in.

Stappen:
1. GET /api/klanten — alle actieve klanten
2. Voor elke klant check:
   - Datum laatste factuur (/api/facturen)
   - Datum laatste email (in/uit via /api/administratie/gmail-sync)
   - Datum laatste agenda item (/api/agenda)
   - Status openstaande offertes (/api/offertes)
3. Filter: klanten waar geen activiteit in 30+ dagen
4. Voor elk:
   - Waarom stil? (project klaar, budget op, niet tevreden, vergeten)
   - Potentie voor vervolg? (Yes/Maybe/No)
   - Concrete check-in actie ("mail met vraag of nieuwe behoeften", "bel voor status huidige project", "bied follow-up scope aan", "afschrijven als inactief")
5. Top 5 prioriteit op (potentie × historical value)
6. Rapporteer + maak klantcontact taken aan per priority lead

Geen automatische outreach — alleen analyse + aanbevelingen.`,
  },
];

export function getSlimmeTaakById(id: string): SlimmeTaakTemplate | null {
  return SLIMME_TAKEN.find((t) => t.id === id) ?? null;
}

export function fillPromptTemplate(template: string, veldWaarden: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => veldWaarden[key] ?? match);
}

export function fillNaamTemplate(naam: string, veldWaarden: Record<string, string>): string {
  return naam.replace(/\{(\w+)\}/g, (match, key) => veldWaarden[key] ?? match);
}

/**
 * Zorg dat de system templates in de DB gelijk lopen met de lib:
 * - Deactiveer deprecated slugs (soft delete, is_actief=0)
 * - Upsert alle huidige SLIMME_TAKEN: insert als niet bestaat, update als
 *   bestaand is_systeem template (user customs blijven onaangeraakt)
 * Idempotent. Veilig om bij elke GET te draaien.
 */
export async function ensureSystemTemplates(): Promise<{
  toegevoegd: number;
  bijgewerkt: number;
  gedeactiveerd: number;
}> {
  const { db } = await import("@/lib/db");
  const { slimmeTakenTemplates } = await import("@/lib/db/schema");
  const { eq, and, inArray } = await import("drizzle-orm");

  let toegevoegd = 0;
  let bijgewerkt = 0;
  let gedeactiveerd = 0;

  // 1. Deactiveer deprecated system templates
  if (DEPRECATED_SYSTEM_SLUGS.length > 0) {
    const result = await db
      .update(slimmeTakenTemplates)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(
        and(
          inArray(slimmeTakenTemplates.slug, DEPRECATED_SYSTEM_SLUGS),
          eq(slimmeTakenTemplates.isSysteem, 1),
          eq(slimmeTakenTemplates.isActief, 1)
        )
      )
      .returning({ id: slimmeTakenTemplates.id });
    gedeactiveerd = result.length;
  }

  // 2. Upsert huidige SLIMME_TAKEN
  for (const template of SLIMME_TAKEN) {
    const [bestaand] = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.slug, template.id))
      .limit(1);

    const velden = template.velden ? JSON.stringify(template.velden) : null;

    if (!bestaand) {
      // Insert nieuw
      await db.insert(slimmeTakenTemplates).values({
        slug: template.id,
        naam: template.naam,
        beschrijving: template.beschrijving,
        cluster: template.cluster,
        geschatteDuur: template.geschatteDuur,
        prompt: template.prompt,
        velden,
        isSysteem: 1,
        isActief: 1,
      });
      toegevoegd++;
    } else if (bestaand.isSysteem === 1) {
      // Update bestaand system template (user customs overslaan)
      const needsUpdate =
        bestaand.naam !== template.naam ||
        bestaand.beschrijving !== template.beschrijving ||
        bestaand.cluster !== template.cluster ||
        bestaand.geschatteDuur !== template.geschatteDuur ||
        bestaand.prompt !== template.prompt ||
        bestaand.velden !== velden ||
        bestaand.isActief !== 1;

      if (needsUpdate) {
        await db
          .update(slimmeTakenTemplates)
          .set({
            naam: template.naam,
            beschrijving: template.beschrijving,
            cluster: template.cluster,
            geschatteDuur: template.geschatteDuur,
            prompt: template.prompt,
            velden,
            isActief: 1,
            bijgewerktOp: new Date().toISOString(),
          })
          .where(eq(slimmeTakenTemplates.id, bestaand.id));
        bijgewerkt++;
      }
    }
    // Als bestaand && is_systeem === 0: user heeft 'm gekloond, laat staan
  }

  return { toegevoegd, bijgewerkt, gedeactiveerd };
}

/**
 * Backwards compat alias — de oude seed functie heette zo.
 */
export const seedSystemTemplates = ensureSystemTemplates;
