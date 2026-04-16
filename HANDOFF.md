# Handoff — 2026-04-16

## Wat is er gedaan

### Lead Rebuild Prep (`/leads/rebuild-prep`) — volledig gebouwd
- Batch-tool op `/leads/rebuild-prep` voor alle leads (LinkedIn 863 + Website Leads 95 = 958 totaal)
- Twee modes: **Upgrade** (lead heeft website → scrape via Jina Reader → prompt met echte content) en **Fresh** (geen website → from-scratch prompt)
- Sector-fit classificatie: scroll-stop geschikt (fysiek product) vs statische upgrade (dienstverlening) — kijkt naar category + name, NL én EN keywords
- Filter: Alle / Zonder site / Met site + zoekbalk
- Result cards met mode badge, fit badge, SERP status, "Copy prompt" knop + claude.ai link
- Bug fix: fit classifier returnde "Onbekend" als category null was (early-return vóór name fallback). Gefixed + Engelse keywords toegevoegd.

### Jina Reader scraper (`src/lib/scraper.ts`) — vervangt Firecrawl
- Nieuw bestand `src/lib/scraper.ts` met `scrapePage(url)` — Jina Reader primary + custom HTML fallback
- **87% success rate** op 8 echte leads (1 failure = gebroken SSL cert, niet onze schuld)
- €0/maand kosten, geen API key nodig
- Alle Firecrawl scrapeUrl() calls vervangen: `/api/scrape`, `/api/site-rebuild/generate`, `/api/site-rebuild/prompt`, `/api/animaties/generate`, `lead-rebuild-prep.ts`
- `src/lib/firecrawl.ts` opgeschoond: `scrapeUrl` verwijderd, alleen `searchWeb` bewaard (wordt later ook vervangen)
- **FIRECRAWL_API_KEY is NIET in .env.local of Vercel** — was er nooit geweest. Sales Engine gebruikt eigen custom scraper, niet Firecrawl.

### Syb's SERP integratie
- `website_leads` tabel (95 leads, 100% gecheckt door Syb: 86 zonder site, 9 met site)
- `/leads/website-leads` pagina uitgebreid met:
  - `has_website`, `website_url`, `website_confidence` kolommen in interface + types
  - Confidence badges: groen (website gevonden), oranje (mogelijk/onzeker), rood (geen website)
  - Filter: "Verified geen website" / "Heeft website" / "Niet gecheckt" met live counts
  - Detail panel: gevonden website URL als clickable link in groene bar
- Rebuild-prep haalt nu ook `website_leads` als derde bron op (naast LinkedIn + Google Maps)
- Syb's SERP data wordt direct gebruikt in rebuild-prep: geen eigen SERP call nodig
- `src/types/supabase-leads.ts` handmatig bijgewerkt met `has_website`, `website_url`, `website_confidence` op `website_leads` tabel

### Auto-sync systeem voor Syb's `lead-dashboard-v2`
- `scripts/sync-syb-leads.mjs` — detecteert Syb's pushes, regenereert types, patcht whitelist, maakt dashboard taak
- `.github/workflows/sync-syb-leads.yml` — cron elke 30 min (momenteel uitgecommentarieerd, was re-enabled maar check of 't aan staat) + workflow_dispatch + repository_dispatch
- `docs/syb-lead-dashboard-dispatch.yml` — companion workflow voor Syb's repo (instant trigger)
- `.syb-sync-state.json` — state tracker, huidige baseline op Syb's SHA `533a020`
- **Alle 3 GitHub Secrets staan**: `SUPABASE_ACCESS_TOKEN`, `DASHBOARD_API_KEY`, `GH_PAT`
- Eerste sync run succesvol (detecteerde Syb's push, 2 files frontend-only, correct geen actie)
- Push notificatie bij elke Syb push toegevoegd (via `/api/push/test`)
- Taak wordt nu ALTIJD aangemaakt bij elke push (niet alleen bij migrations/functions)

### Kleine fixes
- **Sidebar**: Sales Engine verplaatst boven Leads (onder Klanten)
- **Folder kolom op `/leads`**: toont nu altijd een pill (naam of "geen")
- **Rebuild Prep knop** op `/leads` header rechtsboven
- **STT dictionary**: `zip → Syb` toegevoegd
- **Vercel CRON_SECRET whitespace**: was de oorzaak van build failures, door user zelf gefixed in Vercel UI

## Wat nog open staat

### A) Auto-prep alle leads (rebuild-prep) — NOG NIET GEBOUWD
Sem wil dat alle prompts automatisch klaar staan, niet handmatig selecteren + klikken. Voor leads ZONDER website is dat instant (puur tekst, geen API call). Voor leads MET website vereist het Jina scrape (~8 sec per stuk).

Aanpak: "Prep alles" knop die in chunks van 20 alle zichtbare leads door de API haalt. Of: pre-genereer bij page load voor de no-scrape leads.

### B) Sales Engine integratie — NOG NIET GEBOUWD
Rebuild voorstel als automatische sectie in `/sales-engine/[id]` detail pagina. Als de scan laat zien dat een website verouderd/afwezig is → automatisch een rebuild prompt tonen die klaar is om te kopiëren.

**Sem's woorden**: "als website van toepassing is dat dat standaard bij de sales engine als voorstel er uit kan komen"

Relevante files:
- `src/app/(dashboard)/sales-engine/[id]/page.tsx` — detail pagina
- `src/lib/sales-engine/analyzer.ts` — analyse logica
- `src/lib/sales-engine/scraper.ts` — eigen custom HTML scraper (los van onze Jina scraper)
- `src/lib/lead-rebuild-prep.ts` — de rebuild prompt builder (hergebruik `buildUpgradePrompt` / `buildFreshPrompt`)

### C) Sync cron check
De `sync-syb-leads.yml` cron was disabled wegens 48 fail-mails/dag (secrets ontbraken). Secrets staan er nu, maar check of cron weer aan staat (was handmatig uncommented door andere sessie, maar is daarna ook weer gecommentarieerd — check de file).

### D) Proposals worktree
24 commits in `.worktrees/proposals` op branch `feat/proposals`. Niet gemerged, niet besproken deze sessie. Sem moet beslissen: rebase, reapply, of dump.

## Belangrijke beslissingen

- **Firecrawl is eruit**: volledig vervangen door Jina Reader (gratis). `scrapeUrl` is deprecated, `searchWeb` blijft voor nu maar wordt ook vervangen zodra Syb's SerpAPI beschikbaar is.
- **Syb's SERP data wordt direct gelezen**: geen eigen SERP engine, we lezen `website_leads` tabel. Nul overlap met LinkedIn leads (andere bedrijven), dus cross-table lookup werkt niet — directe veld-read per bron.
- **Auto-sync maakt ALTIJD taak + push**: ook voor frontend-only changes. Sem wil elke push zien.
- **`website_leads` is derde bron in rebuild-prep**: naast `leads` (LinkedIn) en `google_maps_leads`.

## Huidige staat

- **Branch**: `main`
- **Uncommitted changes**: nee, working tree clean
- **3 commits ahead van origin** — auto-sync hook pakt ze waarschijnlijk alsnog op
- **Dev server**: `localhost:3000` draait (check `lsof -iTCP:3000`)
- **Vercel builds**: weer groen, deployen normaal

## Volgende stappen

1. **`/pickup`** → lees dit document
2. **Check cron status**: `cat .github/workflows/sync-syb-leads.yml | grep -A2 "schedule"` — als gecommentarieerd, uncomment
3. **Bouw feature A**: auto-prep alle leads. Quick win:
   - "Prep alles" knop op rebuild-prep pagina
   - Chunks van 20 leads parallel door API
   - Progress bar
4. **Bouw feature B**: Sales Engine integratie:
   - Lees `src/app/(dashboard)/sales-engine/[id]/page.tsx`
   - Voeg "Website Rebuild Voorstel" sectie toe
   - Gebruik `buildUpgradePrompt()` of `buildFreshPrompt()` uit `lead-rebuild-prep.ts`
   - Toon als de scan een slechte/afwezige site detecteert
5. **Push naar Vercel** als klaar — alles in één commit

## Context

- Sem en Syb zitten naast elkaar. Syb beheert `Autronis/lead-dashboard-v2` (Lovable + Supabase project `hurzsuwaccglzoblqkxd`). Syb's Claude draait een aparte sessie.
- Syb heeft een bericht gekregen met de volledige uitleg van ons auto-sync systeem + vragen over Supabase token, companion workflow, en tier-strategie voor UI updates. Nog niet volledig beantwoord.
- Firecrawl API key heeft NOOIT bestaan in dit project. Sales Engine werkt al maanden met eigen custom HTML scraper. Site-rebuild en animaties waren effectief broken tot ik Jina eraan hing.
- De `leads` tabel (LinkedIn, 863) en `website_leads` (Google Maps SERP, 95) zijn COMPLEET verschillende datasets met 0 overlap op naam.
- Sem wil: "als sales engine een bedrijf scant en de website is slecht → automatisch rebuild voorstel erbij". Dat is feature B.
- Rebuild-prep prompts moeten voor ALLE leads auto-gegenereerd worden, niet alleen voor de leads zonder website. Leads MET website zijn juist makkelijker (meer content).
