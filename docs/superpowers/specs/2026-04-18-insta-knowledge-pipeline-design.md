# Instagram Knowledge Pipeline — Design

**Datum:** 2026-04-18
**Project:** Autronis Dashboard (id=9)
**Eigenaar:** sem
**Chat-ID:** SEM-INSTA-001
**Parallel aan:** `yt-knowledge` (bestaande pipeline in `src/app/api/yt-knowledge`)

---

## Context

`yt-knowledge` pakt YouTube-video's: transcript ophalen → Claude analyseert naar `{summary, features, steps, tips, links, relevance_score}` → bij score ≥ 9 auto-idee aanmaken in `ideeen`-tabel. Die pipeline werkt en wordt in een andere chat verder uitgebreid (playlists/channel-polling).

Deze spec beschrijft een **parallelle** pipeline voor Instagram. Zelfde analyse-schema, andere content-bron. Wordt gebouwd in dezelfde `autronis-dashboard` repo.

## Doel

Sem kan Instagram-reels en -posts die interessant lijken voor AI/coding/automation submitten aan het dashboard, en krijgt een gestructureerde analyse terug die doorzoekbaar is en bij hoge relevantie automatisch naar `/ideeen` vloeit.

## Niet-doelen (Fase 1)

- **Geen auto-discovery van nieuwe content.** Handmatige URL-submit alleen. Auto-scraping (Apify, profielen, hashtags) komt in Fase 2, zonder rewrite.
- **Geen Stories.** Die verdwijnen binnen 24u en hebben geen permalinks — valt buiten scope.
- **Geen OCR op carrousel-slides.** Alleen caption + (voor reels) audio-transcript. OCR evalueren in v2 als blijkt dat we veel carrousel-posts missen.
- **Geen multi-account login / private content.** Public reels/posts alleen.
- **Geen abstractie naar één "kennis-tabel".** `isk_*` en `ytk_*` blijven apart. Abstraheren pas bij 3+ platforms.

## Architectuur

```
┌──────────────┐    POST /api/insta-knowledge    ┌──────────────┐
│  Dashboard   │────────── submit URL ──────────>│   API route  │
│     UI       │<──────── poll GET /api/ ────────│  + pending   │
│  /insta-     │                                  │    record    │
│  knowledge   │                                  └──────┬───────┘
└──────────────┘                                         │
                                                         │ insert
                                                         v
                                                  ┌──────────────┐
                                                  │ isk_items    │
                                                  │ status=pending│
                                                  └──────┬───────┘
                                                         │
                           ┌─────────────────────────────┘
                           │ Vercel Cron (1x/min)
                           v
                    ┌──────────────┐
                    │  /api/insta- │
                    │  knowledge/  │  pick oldest pending, lock
                    │    cron      │
                    └──────┬───────┘
                           │
           ┌───────────────┼────────────────┐
           v               v                v
     ┌──────────┐    ┌──────────┐    ┌──────────┐
     │  Source  │    │  Media   │    │ Analyze  │
     │ Adapter  │    │ Fetcher  │    │  (Claude)│
     │ (manual) │    │  + ASR   │    │          │
     └──────────┘    └──────────┘    └──────────┘
           │               │                │
           v               v                v
      caption +        transcript       analysis
     metadata        (Whisper, reels    JSON in
                      only)           isk_analyses
                                           │
                                           v
                              score >= 9 → ideeen row
```

### Componenten

- **UI** (`src/app/(dashboard)/insta-knowledge/page.tsx`) — submit form, lijst, stats, detail-drawer. Parallel aan yt-knowledge page; later evt. samenvoegen in `/knowledge` als het gebruik ernaar vraagt.
- **API — submit** (`src/app/api/insta-knowledge/route.ts`) — `GET` (lijst + stats), `POST` (submit URL → insert pending).
- **API — worker** (`src/app/api/insta-knowledge/cron/route.ts`) — Vercel Cron pakt oudste pending, locked row, verwerkt, schrijft resultaat. `maxDuration = 60`.
- **Source Adapter** (`src/lib/insta-knowledge/adapters/manual.ts`) — interface `SourceAdapter` met enkelvoudige methode `fetchItem(url): Promise<RawItem>`. Manual-adapter doet IG-page scrape. Tweede implementatie (`apify.ts`) wordt later toegevoegd zonder route-code aan te raken.
- **Media Fetcher** (`src/lib/insta-knowledge/media.ts`) — voor reels: extract MP4-URL uit de scrape, fetch binary, stream naar Whisper API. Voor posts: skip.
- **Analyze** (`src/lib/insta-knowledge/analyze.ts`) — identiek aan yt-knowledge maar input is `{caption, transcript?}` ipv transcript-only. Gebruikt `TrackedAnthropic` en hergebruikt de Autronis-context uit het yt-knowledge system prompt.

## Database schema

Nieuwe tabellen via Drizzle migratie in `src/lib/db/schema.ts`.

```ts
// isk_sources — voor Apify-fase; nu leeg maar structuur staat klaar
export const iskSources = sqliteTable("isk_sources", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // "profile" | "hashtag"
  handle: text("handle").notNull(), // @username of #tag (zonder prefix)
  active: integer("active").notNull().default(1),
  discoveredVia: text("discovered_via"), // "manual" voor MVP
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// isk_items — individuele reels/posts
export const iskItems = sqliteTable("isk_items", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").references(() => iskSources.id), // null voor handmatige submit
  instagramId: text("instagram_id").notNull(), // shortcode uit URL, unique
  type: text("type").notNull(), // "reel" | "post"
  url: text("url").notNull(),
  caption: text("caption"),
  authorHandle: text("author_handle"),
  mediaUrl: text("media_url"), // MP4 voor reels
  discoveredAt: text("discovered_at").default(sql`(datetime('now'))`),
  status: text("status").notNull().default("pending"), // pending | processing | done | failed
  failureReason: text("failure_reason"),
  processedAt: text("processed_at"),
});

// isk_analyses — zelfde structuur als ytk_analyses
export const iskAnalyses = sqliteTable("isk_analyses", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => iskItems.id),
  summary: text("summary").notNull(),
  features: text("features").notNull(), // JSON
  steps: text("steps").notNull(), // JSON
  tips: text("tips").notNull(), // JSON
  links: text("links").notNull(), // JSON
  relevanceScore: integer("relevance_score").notNull(),
  relevanceReason: text("relevance_reason").notNull(),
  rawTranscript: text("raw_transcript"), // voor reels
  rawCaption: text("raw_caption"), // altijd
  modelUsed: text("model_used").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});
```

Indexes:
- `isk_items (status, discovered_at)` — cron picks `WHERE status='pending' ORDER BY discovered_at LIMIT 1`
- `isk_items (instagram_id)` unique — dedup bij submit

## API endpoints

### `POST /api/insta-knowledge`
Body: `{ url: string }`
- Validate IG URL (`instagram.com/(p|reel)/<shortcode>`)
- Extract shortcode, determine type (`reel` of `post`) van path
- Check `isk_items` op bestaande shortcode → return 200 met bestaande id als al gezien
- Insert als `status=pending` → return 201 met item-id
- **Geen** synchrone verwerking; cron doet dat

### `GET /api/insta-knowledge`
Returned `{ items: [...], stats: {...}, sources: [...] }`. Items join met laatste analyse. Stats: totaal, processed, avg_score. Sources leeg in fase 1.

### `POST /api/insta-knowledge/cron`
Auth: Vercel Cron header OF `requireAuth()` voor manual trigger.
- Claim oudste pending in transactie: `UPDATE isk_items SET status='processing' WHERE id = (SELECT id FROM isk_items WHERE status='pending' ORDER BY discovered_at LIMIT 1) RETURNING *`
- Rol terug processing → pending als het bestand na 10 min nog processing is (detected door cron via "stale lock" check, fallback naar pending).
- Run adapter → media fetch → analyse → write `isk_analyses` → `status=done`
- Bij fout: `status=failed`, `failure_reason` gevuld.

Registratie in `vercel.json`:
```json
{ "crons": [{ "path": "/api/insta-knowledge/cron", "schedule": "*/1 * * * *" }] }
```

### `POST /api/insta-knowledge/items/[id]/retry`
Reset `status=pending` voor items in `failed`. UI-trigger.

### `DELETE /api/insta-knowledge/items/[id]`
Verwijder item + bijbehorende analyse. Soft of hard, TBD bij UI-bouw.

## Source Adapter interface

```ts
// src/lib/insta-knowledge/adapters/types.ts
export interface RawItem {
  instagramId: string;
  type: "reel" | "post";
  url: string;
  caption: string;
  authorHandle: string;
  mediaUrl?: string; // alleen voor reels
}

export interface SourceAdapter {
  name: string;
  fetchItem(url: string): Promise<RawItem>;
}
```

Fase 1: `manualAdapter` (scrape IG page). Fase 2: `apifyAdapter` (Apify actor). Cron-worker kiest adapter op basis van item-metadata; voor nu altijd `manualAdapter`.

## Media fetch + transcriptie (reels)

1. Adapter returned `mediaUrl` (MP4) als onderdeel van `RawItem`.
2. `fetch(mediaUrl)` in Vercel function → krijg binary blob.
3. Check `Content-Length`: als > 20MB → `failed` met reason `media_too_large` (marge onder Whisper's 25MB limiet).
4. Stream blob direct naar OpenAI Whisper API (`/v1/audio/transcriptions`, model `whisper-1`, formaat `mp4`).
5. Whisper returnt `{ text: "..." }` → gebruik als transcript.

Whisper accepteert video-formaten (mp4, webm, mpga) en extract audio zelf. Geen ffmpeg nodig.

## Claude analyse

Identiek aan yt-knowledge maar andere input-format:

```
--- CAPTION ---
{caption}

--- TRANSCRIPT (alleen reels) ---
{transcript}
```

System prompt: zelfde als yt-knowledge maar herschreven zodat het Instagram-context dekt (reels zijn kort; scoring moet niet bestraffen voor korte content). Model: `claude-sonnet-4-20250514` met prompt caching op system prompt.

Output-format identiek aan yt-knowledge (`idea_title`, `summary`, `features[]`, `steps[]`, `tips[]`, `links[]`, `relevance_score`, `relevance_reason`).

## Auto-idee creatie

Bij `relevance_score >= 9`: zelfde flow als yt-knowledge `analyze/route.ts` regel 286-365, aangepast:
- `bron = "insta-knowledge"`
- `bronTekst` JSON: `{ instagramId, itemUrl, authorHandle, analysisId, relevanceScore }`
- Dedup: `WHERE bron='insta-knowledge' AND bronTekst LIKE '%"instagramId":"<id>"%'`

## UI

Pagina `src/app/(dashboard)/insta-knowledge/page.tsx`:
- Header: titel + "Plak reel- of post-URL"-input + submit-knop
- Stats-strip: totaal items, processed, avg score, failed
- Filter-row: status (alle/pending/processing/done/failed), type (alle/reel/post), min score
- Lijst: kaart per item met thumbnail (als we die uit scrape halen), title (idea_title van analyse, anders shortcode), author, score-badge, status-indicator
- Klik op kaart → drawer met volledige analyse (summary, features, steps, tips, links, originele caption, originele transcript)
- Actions per item: retry (bij failed), delete, open op Instagram

Later (Fase 2) sectie "Bronnen" aan de pagina toevoegen.

Gebruik bestaande patterns:
- `UitlegBlock` uit `components/ui` met id `insta-knowledge-intro` voor korte uitleg bovenaan
- `useToast()` voor submit-feedback
- Fetch via `useCallback` + `useEffect`, polling-interval 4s zolang er iets `pending`/`processing` is

## Error handling & failure modes

Per failure-mode: in welke status eindigen we, wat ziet Sem, wat is de retry?

| Mode | Oorzaak | Status | `failure_reason` | Retry |
|---|---|---|---|---|
| IG page scrape faalt | IG layout gewijzigd of rate limit | `failed` | `scrape_failed` | Manual retry, als structureel → log voor debug |
| Private/deleted URL | Post is weg of privé | `failed` | `not_public` | Geen; content niet beschikbaar |
| Reel > 20MB | Lange reel | `failed` | `media_too_large` | Geen; content buiten scope |
| Whisper API fout | Rate limit / auth | `failed` | `transcription_failed` | Manual retry |
| Claude API fout | Rate limit / timeout | `failed` | `analysis_failed` | Manual retry |
| Vercel function timeout | Alles bij elkaar > 60s | `processing` (stuck) | — | Cron ruimt stale `processing` op na 10 min → `pending` |
| Dubbele submit | URL al in DB | 200 met bestaande id | — | N.v.t. |

Stale-lock cleanup: aan begin van elke cron-run: `UPDATE isk_items SET status='pending' WHERE status='processing' AND discovered_at < datetime('now', '-10 minutes')`. Logt aantal opgeruimd.

## Kosten (fase 1, klein gebruik)

- Apify: **$0** (niet gebruikt in fase 1)
- OpenAI Whisper: ~$0.005/reel × 30 reels/mo = **$0.15/mo**
- Claude Sonnet: ~$0.03/item × 100 items/mo = **$3/mo**
- **Totaal fase 1: ~$3-5/mo** (alleen Claude + Whisper)

Fase 2 (Apify aanzetten, 20 profielen): +$20-30/mo.

## Testing

- **Unit** (`src/lib/insta-knowledge/__tests__/`):
  - `scrape.test.ts` — mock IG page HTML, assert caption + mediaUrl extract
  - `adapters/manual.test.ts` — input URL → valid `RawItem`
  - `analyze.test.ts` — mock Claude response, assert schema validation + idea creation
- **Integration** (`src/app/api/insta-knowledge/__tests__/`):
  - `route.test.ts` — POST valideert URL, dedupes, creates pending
  - `cron.test.ts` — cron picks oldest pending, runs through happy path, handles failure
- **E2E manual**: submit een publieke reel van `@aipreneur` of vergelijkbaar, check dat analyse binnen 2 min in UI verschijnt
- **Tests dat niet doen**: echte IG scraping in CI (brittle). Mock HTML fixtures.

## Migratie

- Drizzle migratie-file: `drizzle/0XXX_insta_knowledge.sql` (auto-gegenereerd via `npx drizzle-kit generate`)
- Geen data-migratie nodig: nieuwe tabellen, leeg bij start
- Deployment: push naar main → Vercel deployt → cron job start automatisch

## Open punten (niet-blokkerend voor Fase 1, meenemen in Fase 2)

- IG scraping wordt fragiel: hoe detecteren we layout-changes vroeg? → failure-rate monitor.
- Apify adapter: welke exact actor? `apify/instagram-scraper` of `apify/instagram-post-scraper`? Test eerst.
- Carrousel-slides: als we OCR willen, `@paddle/ocr` of een cloud-OCR? V2-beslissing.
- Combineren met yt-knowledge in `/knowledge`-pagina: na 2-3 weken gebruik evalueren.
- Whisper vs Claude audio: nu Whisper, maar Anthropic audio-support volwassener wordt, evalueren.

---

## Implementatie-volgorde (voor implementatie-plan)

1. Drizzle schema + migratie (`isk_sources`, `isk_items`, `isk_analyses`)
2. `SourceAdapter` interface + `manualAdapter` (IG-page scrape)
3. Media fetcher + Whisper integratie
4. Analyze-module (hergebruik yt-knowledge system prompt logic)
5. API routes: `POST/GET /api/insta-knowledge`, `POST /api/insta-knowledge/cron`
6. `vercel.json` cron-registratie
7. UI pagina `(dashboard)/insta-knowledge`
8. Auto-idee flow bij score ≥ 9
9. Retry + delete endpoints
10. Tests (unit + integration)
11. Manual E2E met 5 voorbeeld-URLs
12. Doc-update (`CLAUDE.md` onder dashboard) met kosten + gebruikshandleiding
