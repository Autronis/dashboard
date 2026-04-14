/**
 * Slimme taken — vooraf gedefinieerde Claude-uitvoerbare acties die Sem of
 * Syb met één klik aan hun dag kunnen toevoegen. Het zijn geen project
 * taken — ze staan los van een specifiek klantproject. Gebruik ze voor
 * terugkerende Autronis operationele acties.
 *
 * Elke slimme taak heeft:
 * - naam: korte titel die in het taak-overzicht verschijnt
 * - beschrijving: één regel context
 * - cluster: welke cluster — bepaalt wie 'm historisch pakt
 * - geschatteDuur: minuten (Claude rost door in 1 sessie)
 * - prompt: de letterlijke opdracht voor Claude Code, met {placeholders}
 *   die de UI invult bij het aanmaken
 * - velden: optionele input velden die de UI vraagt (bv. "branche", "url")
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

export const SLIMME_TAKEN: SlimmeTaakTemplate[] = [
  {
    id: "10-bedrijven-zoeken",
    naam: "10 bedrijven zoeken in {branche}",
    beschrijving: "Scrape 10 bedrijven in een specifieke branche via Google Maps of LinkedIn",
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
4. Schrijf een short markdown samenvatting met de top 3 meest relevante voor Autronis dienstverlening.`,
  },
  {
    id: "website-scrape",
    naam: "Scrape website {url}",
    beschrijving: "Gebruik Firecrawl om een website te scrapen en samenvatten",
    cluster: "research",
    geschatteDuur: 10,
    velden: [
      { key: "url", label: "Website URL", placeholder: "https://...", type: "url" },
    ],
    prompt: `Scrape {url} met de scrape tool op /site-rebuild of via Firecrawl direct.

Rapporteer:
- Wat doen ze (in 2 zinnen)
- Doelgroep / branche
- Dienstverlening / producten
- Contact info (email, telefoon, adres)
- Tech stack (als zichtbaar: Next.js, WordPress, Shopify, etc)
- Eerste indruk kwaliteit (pro / middelmatig / rommelig)
- 3 potentiele automatisering kansen voor Autronis

Output als markdown rapport.`,
  },
  {
    id: "linkedin-posts-week",
    naam: "3 LinkedIn posts schrijven",
    beschrijving: "Maak 3 LinkedIn posts voor Autronis op basis van recente activiteit",
    cluster: "content",
    geschatteDuur: 30,
    prompt: `Maak 3 LinkedIn posts voor Autronis deze week.

Bronnen:
- Recente afgeronde projecten uit dashboard (/api/dashboard/recente-activiteit)
- Ideeen met hoge aiScore uit /ideeen
- YouTube research uit /api/yt-knowledge met relevance_score ≥ 8

Per post:
- Haak: 1 regel die stopt met scrollen
- Body: 3-5 regels verhaal/observatie
- CTA: zacht, nooit "call me"
- Hashtags: max 3, relevant

Autronis tone: persoonlijk, direct, geen marketing-taal, Nederlandse tech scene. Output in /content/linkedin-posts-{yyyy-mm-dd}.md`,
  },
  {
    id: "factuur-check-week",
    naam: "Factuur check deze week",
    beschrijving: "Check of alle facturen voor afgeronde projecten zijn verstuurd",
    cluster: "admin",
    geschatteDuur: 10,
    prompt: `Check de factuur status voor deze week.

Stappen:
1. Haal projecten op die deze week status='afgerond' kregen
2. Check /api/facturen — is er voor elk een factuur aangemaakt en verstuurd?
3. Check /api/facturen voor openstaande (niet betaalde) facturen ouder dan 14 dagen
4. Rapporteer:
   - Missende facturen (project afgerond, geen factuur)
   - Niet verstuurde facturen (factuur bestaat, niet verzonden)
   - Openstaande facturen ouder dan 14 dagen (stuur herinnering)
5. Stuur herinneringen voor openstaand 14+ dagen via /api/followup/webhook

Output als korte actie-lijst.`,
  },
  {
    id: "concurrentie-analyse",
    naam: "Concurrentie update {concurrent}",
    beschrijving: "Check wat een concurrent deze week heeft gedaan (website, LinkedIn, nieuws)",
    cluster: "research",
    geschatteDuur: 20,
    velden: [
      { key: "concurrent", label: "Concurrent naam", placeholder: "bv. Nova, Hypercontext" },
    ],
    prompt: `Maak een concurrentie update voor "{concurrent}".

Stappen:
1. Scrape hun website via Firecrawl — check wat er veranderd is vs vorige week
2. Zoek hun LinkedIn bedrijfspagina, pak de laatste 5 posts
3. Google "{concurrent}" nieuws laatste 7 dagen
4. Rapporteer:
   - Nieuwe content op website (blog, case studies, producten)
   - LinkedIn activiteit (reach, engagement, posttypes)
   - Nieuws/persberichten
   - Prijsveranderingen als zichtbaar
   - 2-3 bedreigingen voor Autronis
   - 1-2 lessen wat we kunnen overnemen

Output als korte markdown in /content/concurrentie/{concurrent}-{yyyy-mm-dd}.md`,
  },
  {
    id: "email-followup-leads",
    naam: "Email follow-up naar stille leads",
    beschrijving: "Check leads zonder respons in de laatste 7 dagen en stuur vriendelijke reminder",
    cluster: "klantcontact",
    geschatteDuur: 15,
    prompt: `Check stille leads in /leads/emails en stuur follow-ups.

Stappen:
1. Filter op email_status='sent' waar reply_received_at IS NULL
2. Filter op updated_at > 7 dagen geleden
3. Max 10 per keer (niet meer, anders lijkt 't spam)
4. Genereer een zachte follow-up mail: "Ik wil alleen even polsen of je interesse hebt..."
5. Zet email_status='generating' en laat de bestaande /api/leads/emails/send flow het versturen
6. Rapporteer aantal verstuurde follow-ups + verwachte replies

Tone: niet pushy, erken dat ze waarschijnlijk druk zijn, bied korte video call aan.`,
  },
  {
    id: "ideeen-ranker",
    naam: "Ideeen ranker update",
    beschrijving: "Update AI scores op alle ideeen + zet top 3 in de 'Wat moet ik bouwen' widget",
    cluster: "admin",
    geschatteDuur: 15,
    prompt: `Update de AI scoring op alle ideeen in /ideeen.

Stappen:
1. Haal alle ideeen op via /api/ideeen
2. Voor elk idee zonder aiScore: call de AI analyse endpoint
3. Voor elk idee met aiScore ouder dan 14 dagen: her-score
4. Zorg dat de top 3 "hot ideeen" up-to-date is
5. Rapporteer:
   - Top 3 hot ideeen met reason waarom
   - Ideeen die hoger zijn gescored vs vorige week
   - Ideeen die lager zijn gescored (afhaken)`,
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
