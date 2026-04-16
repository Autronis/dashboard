# API Gebruik Pagina — Upgrade Design

**Datum:** 2026-04-16
**Status:** Ontwerp
**Doel:** De API Gebruik pagina upgraden zodat alle services die het dashboard gebruikt zichtbaar zijn, met live status, configureerbare dashboard links, en een duidelijke hiërarchie tussen AI-kosten (waar het geld zit) en infra/tooling services.

## Context

De huidige pagina toont 15 services, waarvan 5 met live data (Anthropic, OpenAI, Groq via DB; FAL.ai en Firecrawl via hun billing API). De rest zijn hardcoded statische entries. Er missen 8+ services die daadwerkelijk in de codebase gebruikt worden (Recall.ai, KIE AI, Google Maps/Places, GitHub, Vercel Blob, Supabase Leads, Jina Reader). Dashboard URLs zijn hardcoded in de backend en niet aanpasbaar zonder deploy.

## Beslissingen

1. **Service registry in database** — Een `api_services` tabel in Turso. Services zijn aanpasbaar via de UI (naam, dashboard URL, categorie, etc.) zonder deploy.
2. **Drie-zone layout** op één pagina:
   - Zone 1: Compact statusoverzicht (alle services als kleine chips)
   - Zone 2: AI kosten detail (prominent, met per-provider en per-route breakdown)
   - Zone 3: Niet-AI services als compacte, klikbare rijen per categorie
3. **Status indicatie**: groen bolletje = env var geconfigureerd. Voor DB-tracked AI services ook "laatste call" timestamp.
4. **Finance pagina bestaat al** — deze pagina focust op welke services actief zijn en waar het geld heen gaat bij AI. Maandelijkse abonnementskosten (Turso, Supabase, etc.) komen via Revolut.

## Database

### Nieuwe tabel: `api_services`

```sql
CREATE TABLE api_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naam TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  categorie TEXT NOT NULL DEFAULT 'overig',
  -- 'ai' | 'email' | 'media' | 'data' | 'betaal' | 'overig'
  omschrijving TEXT,
  -- Korte beschrijving: "Facturen, offertes, contracten versturen"
  env_var TEXT,
  -- Naam van de env var om status te checken, bijv. "ANTHROPIC_API_KEY"
  dashboard_url TEXT,
  -- Link naar extern dashboard/billing, bijv. "https://console.anthropic.com/settings/billing"
  tracking_type TEXT NOT NULL DEFAULT 'geen',
  -- 'db' = wij loggen calls in api_token_gebruik
  -- 'api' = we halen live data op via hun billing API
  -- 'geen' = alleen status check
  kosten_type TEXT NOT NULL DEFAULT 'infra',
  -- 'usage' = betaal per gebruik (API calls)
  -- 'infra' = vast maandbedrag / subscription
  -- 'gratis' = geen kosten
  provider_slug TEXT,
  -- Voor DB-tracked services: de provider naam in api_token_gebruik, bijv. "anthropic"
  icon TEXT,
  -- Lucide icon naam, bijv. "Brain", "Mail", "Database"
  volgorde INTEGER DEFAULT 0,
  -- Sortering binnen categorie
  is_actief INTEGER DEFAULT 1,
  -- Soft delete / verbergen
  aangemaakt_op TEXT DEFAULT (datetime('now')),
  bijgewerkt_op TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_api_services_slug ON api_services(slug);
```

### Seed data

De migratie bevat een INSERT met alle huidige + missende services:

| slug | naam | categorie | env_var | tracking_type | kosten_type |
|------|------|-----------|---------|---------------|-------------|
| `anthropic` | Anthropic (Claude) | ai | ANTHROPIC_API_KEY | db | usage |
| `openai` | OpenAI (GPT) | ai | OPENAI_API_KEY | db | usage |
| `groq` | Groq (Llama) | ai | GROQ_API_KEY | db | usage |
| `fal-ai` | FAL.ai (Kling) | media | FAL_API_KEY | api | usage |
| `firecrawl` | Firecrawl | overig | FIRECRAWL_API_KEY | api | usage |
| `resend` | Resend | email | RESEND_API_KEY | geen | usage |
| `aws-ses` | AWS SES | email | AWS_ACCESS_KEY_ID | geen | usage |
| `recall-ai` | Recall.ai | media | RECALL_API_KEY | geen | usage |
| `kie-ai` | KIE AI | media | KIE_API_KEY | geen | usage |
| `notion` | Notion | data | NOTION_API_KEY | geen | infra |
| `supabase` | Supabase (Main) | data | SUPABASE_URL | geen | infra |
| `supabase-leads` | Supabase (Leads) | data | SUPABASE_LEADS_URL | geen | infra |
| `turso` | Turso | data | TURSO_DATABASE_URL | geen | infra |
| `vercel-blob` | Vercel Blob | data | BLOB_READ_WRITE_TOKEN | geen | infra |
| `mollie` | Mollie | betaal | MOLLIE_API_KEY | geen | usage |
| `revolut` | Revolut Business | betaal | REVOLUT_CLIENT_ID | geen | infra |
| `google-maps` | Google Maps / Places | overig | GOOGLE_MAPS_API_KEY | geen | usage |
| `github` | GitHub | overig | GITHUB_TOKEN | geen | gratis |
| `jina-reader` | Jina Reader | overig | JINA_API_KEY | geen | gratis |
| `google-oauth` | Google OAuth | overig | GOOGLE_CLIENT_ID | geen | gratis |

Dashboard URLs worden per service ingevuld in de seed. Exact dezelfde URLs als nu hardcoded staan, plus de nieuwe services.

### Drizzle schema toevoeging

Nieuwe tabel `apiServices` in `src/lib/db/schema.ts`, direct onder het bestaande `apiTokenGebruik` blok.

## API Route

### `GET /api/api-gebruik` (bestaand, refactoren)

De huidige route haalt services hardcoded op. Refactoren naar:

1. Lees alle services uit `api_services` tabel
2. Voor services met `tracking_type = 'db'`: haal maandelijkse stats uit `api_token_gebruik` (bestaande `fetchTokenStats` query + nieuwe query voor laatste call timestamp)
3. Voor services met `tracking_type = 'api'`: roep externe billing APIs aan (bestaande FAL/Firecrawl logica, maar nu gedreven door de registry)
4. Voor services met `tracking_type = 'geen'`: alleen env var check voor status
5. Per-route breakdown query blijft ongewijzigd

**Response shape** (nieuw):

```typescript
{
  services: Array<{
    id: number;
    naam: string;
    slug: string;
    categorie: string;
    omschrijving: string | null;
    dashboardUrl: string | null;
    kostenType: 'usage' | 'infra' | 'gratis';
    status: 'actief' | 'niet_geconfigureerd';
    laatsteCall?: string;           // ISO timestamp, alleen voor db-tracked
    gebruik?: {                     // alleen voor db/api-tracked
      verbruikt: string;
      limiet?: string;
      eenheid: string;
      percentage?: number;
      details?: string;
    };
    fout?: string;
  }>;
  aiDetail: {
    totaalKostenEuro: string;
    totaalCalls: number;
    providers: Array<{
      naam: string;
      calls: number;
      tokens: { input: number; output: number; totaal: number };
      kostenEuro: string;
      laatsteCall: string | null;
    }>;
  };
  routeBreakdown: Array<{
    route: string;
    provider: string;
    aantalCalls: number;
    kostenCent: number;
    tokens: number;
  }>;
}
```

### `GET /api/api-services` (nieuw)

CRUD endpoint voor de service registry:
- `GET` — alle services ophalen (voor admin)
- `POST` — nieuwe service toevoegen
- `PATCH /api/api-services/[id]` — service updaten (dashboard URL, omschrijving, etc.)
- `DELETE /api/api-services/[id]` — soft delete (`is_actief = 0`)

Alle endpoints achter `requireAuth()`.

## Frontend — Pagina Layout

De bestaande `page.tsx` wordt herschreven. Gebruikt dezelfde Autronis design tokens (`bg-autronis-card`, `border-autronis-border`, `rounded-2xl`, `text-autronis-accent`, etc.).

### Zone 1: Status Grid

Bovenaan de pagina, direct onder de header.

- Grid van kleine chips (auto-fill, `minmax(160px, 1fr)`)
- Elke chip: groen/grijs bolletje + service naam
- AI services tonen ook relatieve tijd van laatste call ("2 min geleden")
- Niet-geconfigureerde services zijn gedempt (grijze tekst + grijs bolletje)
- Chip styling: `bg-autronis-card border border-autronis-border rounded-xl p-3`

### Zone 2: AI Kosten Detail

Prominent blok met accent border (`border-autronis-accent/30`).

- Header: "AI Kosten — [maand jaar]" + totaalbedrag in accent kleur
- Per-provider cards (grid van 3): naam, calls, tokens, kosten, laatste call
- Kosten per Feature tabel: bestaande `routeBreakdown` tabel, ongewijzigd qua functionaliteit

### Zone 3: Service Rijen

Compacte, klikbare rijen gegroepeerd per categorie.

- Categorie headers met Lucide icons (bestaande `categorieIcons` mapping)
- Elke rij: status bolletje + naam + omschrijving + badge (usage/infra/gratis) + dashboard link + expand chevron
- Expand toont: env var naam, tracking type, volledige dashboard URL
- Badge kleuren:
  - `usage` → teal/accent (`bg-autronis-accent/15 text-autronis-accent`)
  - `infra` → blauw (`bg-blue-500/15 text-blue-400`)
  - `gratis` → groen (`bg-emerald-500/10 text-emerald-400`)

### "+ Service toevoegen" button

Rechts in de page header, naast de "Verversen" button. Opent een modal/dialog met velden:
- Naam (verplicht)
- Slug (auto-gegenereerd uit naam, aanpasbaar)
- Categorie (dropdown)
- Omschrijving
- Env var naam
- Dashboard URL
- Kosten type (dropdown: usage/infra/gratis)
- Icon (optioneel, dropdown met Lucide namen)

## Bestandswijzigingen

| Bestand | Actie |
|---------|-------|
| `src/lib/db/schema.ts` | Toevoegen: `apiServices` tabel definitie |
| `drizzle/XXXX_api_services.sql` | Nieuw: migratie met CREATE TABLE + seed INSERT |
| `src/app/api/api-gebruik/route.ts` | Refactoren: services uit DB lezen i.p.v. hardcoded |
| `src/app/api/api-services/route.ts` | Nieuw: GET + POST voor service registry |
| `src/app/api/api-services/[id]/route.ts` | Nieuw: PATCH + DELETE per service |
| `src/app/(dashboard)/api-gebruik/page.tsx` | Herschrijven: drie-zone layout |

## Wat NIET in scope is

- Live billing API integraties voor nieuwe services (Recall.ai, Google Maps, etc.) — alleen Anthropic/OpenAI/Groq (DB) en FAL/Firecrawl (API) behouden hun bestaande tracking
- Admin pagina voor service beheer — de "+ Service toevoegen" modal op de API gebruik pagina zelf is voldoende
- Historische usage grafieken of trends — dat is een aparte feature
- Notificaties bij hoog gebruik — niet gevraagd
