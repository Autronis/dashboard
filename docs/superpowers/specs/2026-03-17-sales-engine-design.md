# Sales Engine MVP — Design Spec

## Doel

Automatisch een AI-analyse rapport genereren voor prospects die een call boeken via Cal.com op autronis.com. Het rapport bevat een bedrijfsprofiel en top 3 automatiseringskansen, zichtbaar in het Autronis Dashboard.

## Afwijkingen van PROJECT_BRIEF

- **Trigger:** Cal.com booking webhook vervangt Jobby lead systeem (Jobby speelt geen rol meer)
- **Scraping:** Fetch-based (geen Puppeteer) — compatibel met Vercel serverless
- **MVP output:** Dashboard view only, geen PDF (komt in Phase 2)

## Data Flow

```
Cal.com booking
    → n8n (extract velden uit webhook payload)
    → POST /api/sales-engine/scan (dashboard API)
        1. Valideer input + SSRF check op URL
        2. Deduplicatie check (email + websiteUrl, laatste 10 min)
        3. Match/maak lead op email
        4. Scrape website (fetch-based, max 15s)
        5. Claude AI analyse
        6. Sla scan + kansen op in DB
    → Response naar n8n (succes/fout)
```

## Cal.com Webhook Velden

Via n8n doorgestuurd naar de dashboard API:

| Veld | Type | Required |
|------|------|----------|
| naam | string | ja |
| email | string | ja |
| bedrijfsnaam | string | ja |
| bedrijfsgrootte | string | ja |
| rol | string | ja |
| websiteUrl | string | ja |
| grootsteKnelpunt | string | ja |
| huidigeTools | string | nee |
| opmerkingen | string | nee |

## Database Schema

Twee nieuwe tabellen in het bestaande Drizzle schema (`src/lib/db/schema.ts`):

### salesEngineScans

| Kolom | Type | Omschrijving |
|-------|------|-------------|
| id | integer PK | Auto-increment |
| leadId | integer FK → leads | Gekoppelde lead |
| websiteUrl | text NOT NULL | Gescande URL |
| bedrijfsgrootte | text | Uit Cal.com |
| rol | text | Rol van de booker |
| grootsteKnelpunt | text | Uit Cal.com |
| huidigeTools | text | Uit Cal.com |
| opmerkingen | text | Uit Cal.com |
| scrapeResultaat | text | JSON: raw scrape data |
| aiAnalyse | text | JSON: Claude's analyse |
| samenvatting | text | AI conclusie (direct access, niet in JSON) |
| status | text NOT NULL | "pending" / "completed" / "failed" |
| foutmelding | text | Error message bij failure |
| aangemaaktOp | text NOT NULL | ISO timestamp |
| bijgewerktOp | text NOT NULL | ISO timestamp |

### salesEngineKansen

| Kolom | Type | Omschrijving |
|-------|------|-------------|
| id | integer PK | Auto-increment |
| scanId | integer FK → salesEngineScans | Cascade delete |
| titel | text NOT NULL | "Lead opvolging automatiseren" |
| beschrijving | text NOT NULL | Uitleg van de kans |
| categorie | text NOT NULL | lead_gen / communicatie / administratie / data / content |
| impact | text NOT NULL | hoog / midden / laag |
| geschatteTijdsbesparing | text | "5 uur per week" |
| prioriteit | integer NOT NULL | 1, 2, 3 |

## API Endpoint

### POST /api/sales-engine/scan

**Authenticatie:** Bearer token via bestaand `apiKeys` systeem.

**Input validatie:**
- Alle required velden aanwezig en non-empty strings
- `email` moet geldig email formaat zijn
- `websiteUrl` moet `https://` of `http://` zijn
- SSRF bescherming: blokkeer private IP ranges (10.x, 172.16-31.x, 192.168.x), localhost, en metadata endpoints (169.254.x)

**Deduplicatie:** Check of een scan met dezelfde email + websiteUrl in de laatste 10 minuten is aangemaakt. Zo ja: return bestaande scan in plaats van duplicaat.

**Request body:**
```json
{
  "naam": "Jan de Vries",
  "email": "jan@bedrijf.nl",
  "bedrijfsnaam": "Bedrijf BV",
  "bedrijfsgrootte": "11-50",
  "rol": "Eigenaar",
  "websiteUrl": "https://bedrijf.nl",
  "grootsteKnelpunt": "Te veel tijd aan handmatige offertes",
  "huidigeTools": "Excel, Outlook",
  "opmerkingen": ""
}
```

**Flow:**
1. Valideer API key (bestaand middleware patroon)
2. Valideer request body (velden, email, URL, SSRF check)
3. Deduplicatie check
4. Match lead op email → update bestaande of maak nieuwe lead aan
5. Maak `salesEngineScan` record (status: "pending")
6. Scrape website → sla `scrapeResultaat` op
7. Stuur scrape data + Cal.com context naar Claude → ontvang analyse
8. Parse kansen uit AI response → sla op in `salesEngineKansen`
9. Update scan: status → "completed", sla `samenvatting` op, update `bijgewerktOp`
10. Return `{ success: true, scanId, leadId }`

**Error handling:** Bij fout in stap 6-8: status → "failed", `foutmelding` opslaan, return error response.

**Response succes:**
```json
{ "success": true, "scanId": 42, "leadId": 7 }
```

**Response fout:**
```json
{ "success": false, "error": "Scrape failed: timeout" }
```

## Website Scraper

**Fetch-based** (geen Puppeteer — compatibel met Vercel serverless). Volgt het patroon van de bestaande `scan-concurrent.ts` in het dashboard.

**Wat het doet:**
- Fetch homepage HTML via `fetch()` met timeout (5s per request)
- Parse HTML server-side (regex + string parsing, geen browser nodig)
- Zoek interne links → fetch max 5 subpagina's (over-ons, diensten, contact, producten, team)
- Per pagina: title, meta description, h1/h2 headings, body text (eerste 2000 chars)
- Detecteer formulieren (contact, offerte, newsletter) via `<form>` tags
- Detecteer chat widgets via bekende script-URLs (Intercom, Drift, Tidio, WhatsApp)
- Detecteer tech stack via HTML/headers/meta tags (WordPress, Shopify, Wix, React, Next.js, etc.)
- Detecteer social media links (LinkedIn, Instagram, Facebook, Twitter)
- Totale timeout: 15 seconden
- User-Agent: professionele browser string
- GDPR compliant: alleen publiek toegankelijke content

**Beperking:** JavaScript-rendered SPA's leveren minder data op via fetch. Voor MVP acceptabel — overgrote meerderheid MKB-websites is server-rendered.

**Output (JSON):**
```json
{
  "homepage": {
    "title": "Bedrijf BV - Uw partner in...",
    "metaDescription": "...",
    "headings": ["h1: ...", "h2: ..."],
    "bodyText": "Eerste 2000 tekens..."
  },
  "subpaginas": [
    { "url": "/over-ons", "title": "...", "headings": ["..."], "bodyText": "..." }
  ],
  "techStack": ["WordPress", "WooCommerce", "Contact Form 7"],
  "formulieren": ["contact", "offerte-aanvraag"],
  "chatWidgets": [],
  "socialMedia": {
    "linkedin": "https://linkedin.com/company/...",
    "instagram": "https://instagram.com/..."
  }
}
```

## AI Analyse (Claude API)

Eén API call naar Claude met gestructureerde prompt.

**Input voor Claude:**
- Scrape resultaat (tech stack, pagina content, formulieren)
- Cal.com context (bedrijfsgrootte, rol, grootste knelpunt, huidige tools)
- Autronis diensten catalogus (zodat kansen relevant zijn)

**Gevraagde output (JSON):**
```json
{
  "bedrijfsProfiel": {
    "branche": "Bouwbedrijf",
    "watZeDoen": "Korte omschrijving van kernactiviteiten",
    "doelgroep": "B2B / aannemers en projectontwikkelaars"
  },
  "kansen": [
    {
      "titel": "Offerte generatie automatiseren",
      "beschrijving": "Huidige situatie en wat Autronis kan bouwen",
      "categorie": "administratie",
      "impact": "hoog",
      "geschatteTijdsbesparing": "8 uur per week",
      "prioriteit": 1
    }
  ],
  "samenvatting": "Totale besparingspotentieel en conclusie"
}
```

Top 3 kansen, gerangschikt op impact. Claude krijgt een system prompt met Autronis' diensten en prijsindicaties.

## Dashboard UI

### Navigatie

Nieuw sidebar item: **"Sales Engine"** in de **"Klanten & Sales"** sectie, naast "Leads". Icoon: Zap (Lucide).

### /sales-engine — Overzichtspagina

**KPI cards bovenaan:**
- Totaal scans (all time)
- Scans deze week
- Succesratio (completed vs failed)

**Scan lijst:**
- Tabel/cards met per scan: bedrijfsnaam, datum, status badge, aantal kansen, hoogste impact
- Klikbaar → navigeer naar detail
- Filter op status (pending/completed/failed)
- Gesorteerd op datum (nieuwste eerst)

### /sales-engine/[id] — Detail pagina

**Header:** Bedrijfsnaam, website link (extern), scan datum, status badge

**Cards layout:**

1. **Cal.com Context** — bedrijfsgrootte, rol, grootste knelpunt, huidige tools
2. **Bedrijfsprofiel** — branche, wat ze doen, doelgroep (uit AI analyse)
3. **Automatiseringskansen** — per kans een card:
   - Titel
   - Beschrijving
   - Categorie badge (kleur per categorie)
   - Impact badge (hoog=groen, midden=geel, laag=grijs)
   - Geschatte tijdsbesparing
   - Prioriteit nummer
4. **Samenvatting** — AI's conclusie over totaal besparingspotentieel
5. **Scrape Data** — inklapbare sectie: tech stack, gevonden pagina's, formulieren, social media
6. **Link naar lead** — directe navigatie naar `/leads/[leadId]`

Styling: bestaande dashboard patterns (dark mode, `var(--card)`, `var(--accent)`, card-glow hover).

## Scope Afbakening (MVP)

**Wel:**
- API endpoint voor scan trigger (met validatie, SSRF check, deduplicatie)
- Website scraping (fetch-based)
- Claude AI analyse
- Database opslag (scans + kansen)
- Dashboard overzicht + detail pagina
- Lead matching op email

**Niet (later):**
- PDF generatie (Level 1 mini-voorstel)
- Email verzending
- Diepe scan (Level 2: alle pagina's, reviews, vacatures, concurrenten)
- ROI berekening
- Presentatie/offerte generatie
- Google Places API integratie
- Social media analyse (posting frequentie, engagement)

## Technische Afhankelijkheden

**Geen nieuwe npm packages nodig.**

**Bestaande packages (hergebruik):**
- `@anthropic-ai/sdk` — Claude API (al geinstalleerd)
- Drizzle ORM — database (al geinstalleerd)
- Iron Session — auth (al geinstalleerd)

## Bestandsstructuur

```
src/
  app/
    api/
      sales-engine/
        scan/
          route.ts          — POST endpoint (webhook ontvanger)
    (dashboard)/
      sales-engine/
        page.tsx            — Overzichtspagina
        [id]/
          page.tsx          — Detail pagina
  components/
    sales-engine/
      ScanOverzicht.tsx     — Scan lijst component
      ScanDetail.tsx        — Detail view component
      KansenCard.tsx        — Individuele kans card
  lib/
    sales-engine/
      scraper.ts            — Fetch-based website scraper
      analyzer.ts           — Claude AI analyse logica
      prompts.ts            — AI prompt templates
```
