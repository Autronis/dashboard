# Handoff — 2026-04-14

## Wat is er gedaan deze sessie

Heel veel, in losse features:

### Proposal Presentation Deck (feature af, in worktree — NOG NIET GEMERGED NAAR MAIN)
Complete implementatie van een bold-agency dark premium proposal deck. 24 taken, alle uit plan gebouwd via subagent batching.

- **Worktree**: `.worktrees/proposals` op branch `feat/proposals`
- **Spec**: `docs/superpowers/specs/2026-04-13-proposal-presentation-deck-design.md`
- **Plan**: `docs/superpowers/plans/2026-04-13-proposal-presentation-deck.md`
- **Wat het doet**: Herschreven `/proposals/nieuw` + `/proposals/[id]` + `/proposal/[token]` publieke view met scroll-deck + demo modus (fullscreen + arrow keys + fade transitions) + PDF via `@react-pdf/renderer` die identiek is aan web deck. Structured slides per type (cover, situatie, aanpak, deliverables, tijdlijn, investering, waarom, volgende stap) + hybride free markdown escape hatch. Vercel Blob voor afbeeldingen.
- **Extra klein feature**: inline "Nieuwe klant"-knop in `/proposals/nieuw` zodat je een prospect kan toevoegen zonder eerst naar `/klanten` te gaan (commit `e2cb870` in worktree)
- **Status**: 24 commits in worktree. Werkt lokaal (getest via `npm run dev -p 3789`). NIET gemerged naar main omdat auto-sync op main intussen doorging met andere features en main heeft sindsdien ook `proposals/*` routes verwijderd (cleanup door andere chat) — dus merge nu zou conflicten geven die handmatig opgelost moeten worden.
- **Wat te doen**: Als Sem deze feature live wil, beslissen of we (a) de worktree rebased op main en conflicts oplossen, (b) alles vers in main reapply'en, of (c) 'm als proof-of-concept laten staan en de proposals code opnieuw bouwen wanneer nodig.

### Agenda Notificatie Dedup (live op main)
- Root cause: `/api/notifications/pending` werd door de Tauri desktop app in een loop gepolld, elke meeting binnen 30 min werd elke poll opnieuw als notificatie teruggegeven → Syb kreeg dezelfde afspraak-reminder 20-30× per meeting
- Fix: nieuwe kolom `agenda_items.herinnering_verstuurd_op`, na eerste pickup wordt 'ie gezet, volgende polls skippen 'm. 4-uurs escape hatch voor edge cases.
- Auto-migratie voor zowel Turso (libsql) als lokaal (better-sqlite3)
- **Commits**: `8572225` (fix) + `767ca79` (merge)

### Recall.ai Meeting Bot — Volledig gefixed (live op main)
Flow: user voegt meeting toe met meet link → bot joined automatisch. Was compleet stuk door zeven losse bugs:

1. **`createRecallBot` slikte errors** — `catch {}` zonder error terug te geven. Meeting werd opgeslagen "alsof het werkte", status bleef op `null`, bot was er nooit geweest. Nu return endpoint `recallFout` veld + console.error naar Vercel logs + status `mislukt` bij faal.
2. **`meetings.recall_fout` kolom toegevoegd** — error wordt persistent opgeslagen, UI toont 'm in de rode "Verwerking mislukt" kaart in een mono-block. (commit `718d1d7`)
3. **`join_at` werd niet meegegeven** aan Recall API — bot probeerde meteen te joinen bij meeting create ipv op de meeting tijd zelf. Voor toekomstige meetings = timeout in lobby. Fix: pass `datum` als `join_at`, bot wordt ingepland.
4. **Cron `*/15 * * * *` gaf Vercel Hobby plan error** (Hobby = daily only) — Vercel deploys faalden. Gereverted naar `0 6 * * *` (dagelijks 6u UTC). Cron is nu safety net, hoofdpad is `join_at` bij create.
5. **`RECALL_API_KEY` stond in env var `RECALL_API_REGION`** (user error, de key hash stond onder het region veld) — URL werd `https://c8dca...recall.ai/api/v1` → ENOTFOUND. User heeft dit zelf gefixed in Vercel. ⚠️ **`c8dca563a16de007eebb3da1a425c3c21b1c72f9` staat nu in DB + chat — Sem moet de key roteren in recall.ai.**
6. **`/api/meetings/recall-webhook` was niet in `PUBLIC_PATHS`** in `src/proxy.ts` → alle Recall callbacks werden naar /login geredirect → meeting bleef eeuwig "verwerken". Fix: toegevoegd aan PUBLIC_PATHS.
7. **Tijdzone bug** — frontend stuurde `datum` als `YYYY-MM-DDTHH:MM` zonder tijdzone. Vercel runt in UTC, dus 14:52 werd 14:52 UTC = 16:52 Amsterdam → bot 2u te laat ingepland. Fix: frontend doet nu `new Date(datum).toISOString()` voor submit.

**Debug tip gebruikt**: Turso-query direct vanuit terminal (via `@libsql/client` in dashboard project cwd met .env.local) — sneller dan Vercel logs, zeer nuttig. Commits: `4fa5b51`, `efcb971`, `8715620`, `718d1d7`.

### Meeting Samenvatting Prompt (live)
Oude prompt vroeg "bullet points als string" → GPT-4o-mini leverde `.,` comma-joined troep. Nieuwe prompt heeft expliciete formatting rules: markdown bullets met `-` prefix, echte newlines, correcte Nederlandse interpunctie, voorbeelden erbij. Commit `494892b`.

### YT Knowledge Pipeline Fix (live)
`youtube-transcript` npm package v1.3.0 is **gebroken** — `"type": "module"` + `"main": "dist/youtube-transcript.common.js"` (CJS) conflict → Node vond geen exports → elke video kreeg instant `failed`.

Vervangen met inline Innertube fetcher + ytInitialPlayerResponse HTML parser. Geen nieuwe dependency. Commit `db2c75e`.

### Site Rebuild Tool (live)
Groot nieuw feature. Dashboard pagina `/site-rebuild` die:
- URL (Firecrawl scrape) OF logo upload
- Brand naam + accent (optioneel, leeg = Claude kiest passend bij bron)
- Drie knoppen:
  - **Genereer direct** — one-shot Claude API call → `html` voor iframe preview + `jsxBody` voor Next.js scaffold → downloadable ZIP met compleet Next.js 15 + Tailwind project
  - **Bouw Claude prompt** — zelfde context maar geeft een paste-ready prompt voor claude.ai (extended thinking + artifacts + iteratie)
  - **Alleen scrape** — raw Firecrawl markdown, copy button (vervangt de oude `/scrape` pagina die is verwijderd)

Files:
- `src/lib/firecrawl.ts` — shared `scrapeUrl()` + `searchWeb()` (Firecrawl /v1/search)
- `src/lib/site-rebuild-scaffold.ts` — Next.js 15 + Tailwind scaffold builder (package.json, tsconfig, tailwind config, layout.tsx, page.tsx met geïnjecteerde JSX, globals.css, README, .gitignore)
- `src/app/api/site-rebuild/generate/route.ts` — Claude call met system prompt die JSON `{html, jsxBody}` terugeist
- `src/app/api/site-rebuild/download/route.ts` — gebruikt `archiver` (al in deps) om ZIP te builden
- `src/app/api/site-rebuild/prompt/route.ts` — assembleert paste-ready prompt zonder Claude call
- `src/app/api/scrape/route.ts` — generic endpoint (niet meer vanuit UI gebruikt, nog wel intern)
- `src/app/(dashboard)/site-rebuild/page.tsx` — 2-col form + iframe preview
- Sidebar: "Site Rebuild" onder Content

Commits: `31828a56`, `4fa5b51`, `1f42893e`, `076a9a88`.

### Team Vergelijking Profielfoto's (live)
Ronde foto's van Sem + Syb boven hun kolommen in de home-page widget. Commit `624aa419`. Gebruikt `/foto-sem.jpg` + `/foto-syb.jpg` uit `public/`.

### Lead Rebuild Prep — ⚠️ IN PROGRESS, NOG NIET AF ⚠️
Dit is waar we waren toen we besloten tot handoff. Deze feature moet de volgende sessie afmaken.

**Wat het moet doen**: Een batch-tool op `/leads/rebuild-prep` die voor elke lead zonder website (uit de Supabase leads tabel, Google Maps source):
1. **SERP-check** — Firecrawl `/v1/search` op "bedrijfsnaam + locatie" om te verifiëren of ze ECHT geen site hebben (Google Maps mist vaak de website-field)
2. **Sector fit** — classificeer op basis van `category` veld: fysiek product → scroll-stop geschikt, dienst → statische upgrade, onbekend → handmatig
3. **Claude prompt builder** — assembleer een paste-ready prompt voor claude.ai met alle lead-context, klaar voor site generation

**Wat er al klaar staat op main**:
- ✅ `src/lib/firecrawl.ts` → `searchWeb(query, limit)` toegevoegd
- ✅ `src/lib/lead-rebuild-fit.ts` → `classifyFit(category, name)` keyword-based classifier met Dutch Google Maps categorieën (product/service keyword lists, returnt `{verdict, label, reason}`)

**Wat nog moet**:
1. Extend `/api/site-rebuild/prompt/route.ts` met `mode: "brief"` (zonder scrape, alleen brand + notes) — OF inline de prompt-assembly in de shared helper (mijn voorkeur: inline in helper om nested HTTP calls te vermijden)
2. Nieuwe shared helper `src/lib/lead-rebuild-prep.ts` met `async function prepLead(lead): Promise<{lead, serp, fit, prompt}>` die alles orkestreert
3. Nieuwe endpoint `POST /api/leads/prep-rebuild/route.ts` — body `{ leadIds: string[] }`, returnt array van prep resultaten. Parallel-limit 3 à 5 om Firecrawl niet te overbelasten.
4. Nieuwe page `src/app/(dashboard)/leads/rebuild-prep/page.tsx`:
   - Query `/api/leads` (Supabase leads)
   - Filter client-side op `!lead.website`
   - Lijst met checkboxes + "Prep geselecteerde" knop (hard limit 20 per batch)
   - Resultaten tabel: lead naam + SERP verdict (found URL of "bevestigd geen site") + fit badge (scroll-stop / static / unknown) + Copy prompt knop per rij
5. Sidebar entry onder Leads (of header-knop op `/leads`)

**Belangrijk context voor volgende chat**:
- Leads leven in externe Supabase (zie `src/lib/supabase-leads.ts`), niet in lokale Turso. Dus ophalen via `getSupabaseLeads().from("leads").select("*").eq("user_id", SYB_USER_ID)`.
- Lead schema: `id, name, website, phone, emails, location, address, category, google_maps_url, rating, reviews_count, created_at` — relevante velden voor prep zijn `name, website, location, category, address`.
- Firecrawl search is paid per query — vandaar de batch limit + hard cap.
- Sem wil BATCH, niet per-lead. Hij wil "prep alle 50 leads in één klik, krijg 50 prompts terug".
- De per-lead flow kan later als progressive enhancement.

## Belangrijke beslissingen deze sessie

- **Worktrees zijn opgegeven als coordinatie-mechanisme.** Dev server draait nu direct in main repo op `localhost:3000`. User had last van hot reload die de "oude" code uit een cluster-worktree bleef tonen. We hebben main into feat/clusters gemerged om te voorkomen dat 't weer gebeurt. Fuck die worktrees, zoals de user het noemde.
- **Vercel Hobby plan = daily crons max.** `*/15` breekt de build. Voor meetings is de main fix `join_at` bij create, dus cron is een safety net en daily is acceptabel.
- **Accent kleur in site-rebuild is optioneel.** Firecrawl geeft alleen markdown (geen CSS), dus als user 'm leeg laat kiest Claude een passende kleur op basis van industry.
- **`/scrape` standalone page verwijderd**, `/site-rebuild` doet nu alle drie: scrape + prompt + generate.
- **Localhost dev server config**: `NODE_OPTIONS='--max-old-space-size=4096' npx next dev -p 3000` vanuit main dashboard cwd. Eén keer gecrasht met exit 144 bij 2GB heap → 4GB werkt stabiel.

## Huidige staat

- **Branch**: `main`
- **Laatste commit op origin/main**: `38508bf3` (Auto-sync)
- **Laatste eigen commit van deze sessie**: `076a9a88` (site-rebuild scrape merge + optional accent)
- **Uncommitted op main**: `M src/app/(dashboard)/taken/page.tsx` + `?? src/components/taken/slimme-taken-modal.tsx` — niet van deze sessie, andere chat bezig met taken. **Niet committen**.
- **Dev server**: `localhost:3000` zou moeten draaien vanuit main repo (PID checken met `lsof -iTCP:3000`). Pad: `/Users/semmiegijs/Autronis/Projects/autronis-dashboard`.
- **Worktrees in `.worktrees/`**: proposals (feat/proposals, 24 commits onaangeraakt), meldingen-dedup, meeting-bot-fix, meeting-error-visible, recall-error-cause, clusters (gemerged), en een paar andere. Kunnen blijven staan of worden opgeruimd afhankelijk van of we proposals nog willen.

## Openstaande issues / waarschuwingen

- **⚠️ RECALL_API_KEY gelekt**: `c8dca563a16de007eebb3da1a425c3c21b1c72f9` staat in Turso DB (meetings.recall_fout), in deze chat, en in logs. **Sem moet deze key ROTEREN in recall.ai → Developers → API Keys.** Ik heb het hem meerdere keren laten weten maar 't is nog niet gedaan.
- **Proposals feature in worktree niet gemerged**: 24 commits, werkende code, niet op main. Zie sectie hierboven over drie opties.
- **Auto-sync hook commit elke paar minuten**: verwarrend voor debugging, maar niet kapot. Je ziet commits in git log van andere files die je niet hebt aangeraakt — dat is Sem's andere werk via de hook.

## Volgende stappen (voor `/pickup`)

1. **Pickup handoff**: lees dit document, check `git log --oneline -20` om de laatste commits te zien
2. **Check dev server**: `lsof -iTCP:3000 -sTCP:LISTEN -P -n` — als dood, herstart vanuit dashboard dir: `cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && NODE_OPTIONS='--max-old-space-size=4096' npx next dev -p 3000` in een background bash
3. **Bouw lead rebuild prep batch feature af**:
   - `src/lib/lead-rebuild-prep.ts` — shared helper
   - `src/app/api/leads/prep-rebuild/route.ts` — POST endpoint met parallel limit
   - `src/app/(dashboard)/leads/rebuild-prep/page.tsx` — batch UI
   - Sidebar entry
4. **Commit + push** per logische stap zodat Sem op localhost:3000 live kan meekijken
5. **Testen**: pick a handful of leads without website from Sem's Supabase, run prep, verify prompts komen door, Copy button werkt, claude.ai open link werkt
6. **Vraag Sem of proposals feature nog moet worden afgemaakt** — als ja: plan de merge of rebuild strategie

## Dingen die je NIET moet doen

- Proposals feature worktree aanraken zonder Sem's toestemming (24 commits werk, kan conflicten)
- Taken page / slimme-taken-modal aanraken — dat is lopend werk van een andere chat via auto-sync
- Iets pushen in `.worktrees/clusters` — is al gemerged in main, verder werk erin is verloren
- De dev server op localhost:3000 killen zonder te herstarten — Sem test er live op
- Destructive git (reset --hard, branch -D) zonder toestemming

## Belangrijke referenties

- **Live URL**: `https://dashboard.autronis.nl`
- **Local dev**: `http://localhost:3000`
- **Dashboard CLAUDE.md**: `/Users/semmiegijs/Autronis/Projects/autronis-dashboard/CLAUDE.md` (Vercel deploy rules, auto-sync hook, team sync API, taken sync flow)
- **Autronis CLAUDE.md (parent)**: `/Users/semmiegijs/Autronis/CLAUDE.md` (worktree regel, context management, STT dictionary auto-learn, strategische discipline)
- **Turso direct query pattern** (handig voor debugging):
  ```bash
  cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && node -e "
  const { createClient } = require('@libsql/client');
  require('dotenv').config({ path: '.env.local' });
  const c = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  (async () => { const r = await c.execute('SELECT ... FROM ...'); console.log(JSON.stringify(r.rows, null, 2)); })();
  "
  ```
- **Vercel CLI**: `vercel ls` (deploys), `vercel inspect <url> --logs` (build logs — streaming logs werken niet goed via CLI)

Veel plezier. Pick up at `/pickup` en doe de lead-rebuild-prep feature af.
