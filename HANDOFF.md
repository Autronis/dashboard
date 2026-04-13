# Handoff — 2026-04-13

## Wat is er gedaan (deze sessie)

### Lead-integratie (lead-dashboard-v2 → /leads/* in hoofddashboard)
Live op productie via merge `sem/lead-integratie`:
- **`src/lib/supabase-leads.ts`** — aparte Supabase client voor `hurzsuwaccglzoblqkxd` project
- **`src/types/supabase-leads.ts`** — 727 regels Database types
- **Env vars in Vercel**: `SUPABASE_LEADS_URL` + `SUPABASE_LEADS_SERVICE_KEY`
- **Pagina's** (10 totaal):
  - `/leads` — overzicht met klikbare KPI stats, source filter (LinkedIn/GMaps), folder dropdown, bulk delete, checkbox selectie
  - `/leads/contacts` — volledig herschreven (was minimale stub): source tabs, advanced filters (5x Ja/Nee), folder dropdown, search, checkbox + Select Top N, bulk Enrich/Generate/Export CSV (Hunter.io compatible)
  - `/leads/emails` — sort toggle, checkbox selectie, bulk approve/reject/send, individuele Verzend nu, inline edit subject+body, Opnieuw genereren voor failed
  - `/leads/enrichment` — kandidaten + 6 tabs + bulk enrich/clean
  - `/leads/folders` — CRUD met cascade, klikbare folder names → detail
  - `/leads/folders/[naam]` — folder detail met 5 tabs binnen folder + bulk acties
  - `/leads/website-leads` — Google Maps search + bellijst met status flow
  - `/leads/handmatig` — failed enrichments handmatig email/website toevoegen
  - `/leads/automations` — scraper runs overzicht (NB: zoekformulieren ontbreken nog)
  - `/leads/dashboard` — funnel statistieken (NB: Recent Activity feed ontbreekt)
  - `/leads/instellingen` — webhook URL beheer
- **API routes** (11 totaal):
  - `GET/PATCH/DELETE /api/leads` (incl. bulk delete + bulk PATCH)
  - `GET/PATCH/DELETE /api/leads/emails` (PATCH ondersteunt nu subject/body/recipient_email + bulk via `{ids,email_status}`)
  - `POST /api/leads/emails/send` — n8n webhook proxy met optimistic 'sending' + rollback
  - `GET/POST/PATCH/DELETE /api/leads/folders` met cascade
  - `GET/PATCH /api/leads/website-leads`
  - `POST /api/leads/website-leads/search`
  - `POST /api/leads/edge-function/[name]` — proxy met whitelist van 14 functions
  - `GET/DELETE /api/leads/scraper-runs`
  - `GET/DELETE /api/leads/google-maps`
  - `GET/PATCH /api/leads/outreach`
  - `GET/PATCH /api/leads/settings`
- **Sidebar**: Sales hub uitgebreid met 9 lead sub-items
- **Namespace fix**: oude interne CRM leads verhuisd van `/api/leads/*` naar `/api/klant-leads/*` (callers in `use-leads.ts`, `email-composer.tsx`, `docs/route.ts` bijgewerkt)
- **Lead count**: 863 leads (filter op `user_id = SYB_USER_ID` toegevoegd door Syb)

### GitHub auto-create
Live op productie via merge `feat/github-autocreate`:
- `src/lib/github.ts` — fetch-based GH helper
- `src/app/api/projecten/route.ts` — POST roept `createProjectRepo()` aan na insert
- `src/app/api/admin/migrate/github-url/route.ts` — idempotent ALTER TABLE
- Schema: `github_url` kolom op `projecten`
- Desktop agent `project_sync.rs` — clone ipv mkdir wanneer github_url aanwezig
- **Vercel env vars gezet**: `GITHUB_TOKEN` + `GITHUB_ORG=Autronis`
- **Migration gerund**: `github_url` kolom toegevoegd aan Turso (fixte ook 500 errors op projecten tabel)
- **End-to-end getest**: nieuwe project via POST creëert auto repo onder `github.com/Autronis/<slug>`

### Windows setup voor Syb
- `syb-windows-setup/` map met hooks/auto-sync-taken.py + .cmd, claude-sync.json.example, settings.json.snippet, CLAUDE.md.template, INSTALL-WINDOWS.md
- `syb-windows-setup.zip` (11KB) ligt klaar in dashboard root
- Discord bericht klaargezet (Sem moet 'm nog versturen + zip aanhangen)

### Agenda fixes (eerder deze sessie)
- Backend snap logic vervangen door overlap-detectie in `/api/taken/[id]/route.ts`
- handlePlanFase sequentieel ipv parallel
- Side-by-side lane layout voor overlappende handmatige taken én calendar events in dag-view
- 22 stale "afgerond + ingepland" taken opgeruimd via nieuwe `/api/agenda/cleanup-afgerond` endpoint
- Agenda API filtert nu afgerond uit
- Wiki PDF italic font fix (verwijderd ipv crash)

## Wat nog open staat — KRITISCH (anders is port functioneel onaf)

Volgens Syb's "Lead Dashboard Volledige Port Spec" zijn er nog drie features die hij in zijn localhost wel heeft maar in onze port niet:

### 1. Google Maps unified view in `/leads` index 🚨
**Probleem**: het origineel (`Index.tsx`, 476 regels) unifieert BEIDE tabellen (`leads` LinkedIn + `google_maps_leads` Google Maps) tot één lijst van `UnifiedLead`. **Bij ons toont `/leads` nu alleen de `leads` tabel, dus de helft van de leads (Google Maps) is onzichtbaar op de hoofdpagina.**

**Hoe fixen**:
- API: nieuwe `GET /api/leads/google-maps` route bestaat al — alleen ophalen
- Frontend: `/leads/page.tsx` moet beide ophalen en mergen naar één `UnifiedLead` type
- `UnifiedLead` interface uit lead-dashboard-v2 `Index.tsx` regels 23-42 kopiëren
- Mapping helpers: `unifyLinkedinLead()` en `unifyGmapsLead()` (zie regels 56-89 van origineel)
- Source filter werkt al, alleen de data-bron moet breder

### 2. `/leads/automations` zoekformulieren 🚨
**Probleem**: Mijn versie heeft alleen blinde "trigger LinkedIn" / "trigger Google Maps" knoppen zonder velden. **Zonder forms kan je geen meaningful scrape starten.**

**Hoe fixen** (zie origineel `Automations.tsx` regels 1-229):
- LinkedIn form velden: `folder` (FolderSelect), `query`, `location`, `max_items`, `start_page`, `company_size` (1-10/11-50/51-200/201-500/501-1000/1000+)
- Google Maps form velden: `folder`, `query`, `location`, `max_items`
- Beide POSTen naar bestaande `/api/leads/edge-function/trigger-scraper` resp. `/trigger-google-maps-scraper` met de form data als `body`
- Folder dropdown: gebruikt bestaande `/api/leads/folders` GET
- Run history (laatste 20 runs) bestaat al in mijn versie

### 3. `/leads/emails` recipient_email inline edit
**Probleem**: PATCH route accepteert `recipient_email` al, maar UI knop ontbreekt om 'm te wijzigen.

**Hoe fixen**:
- In `/leads/emails/page.tsx` rond regel 580 (waar `→ {email.recipient_email}` getoond wordt)
- Klik op het email adres → input verschijnt → save → PATCH met `{ id, recipient_email: nieuwe waarde }`

## Wat nog open staat — LAGE PRIO (nice-to-haves)

4. **OutreachSection component** onderaan `/leads/emails` — los blok dat outreach pipeline status toont
5. **`/leads/dashboard` Recent Activity feed** — laatste 10 events (replies, sends, failures)
6. **Bedrijfsanalyse collapsible** in `/leads/emails` — `company_summary` veld uitklapbaar
7. **Painpoint badge** in email header (zit nu in meta footer)
8. **Stuck email recovery** — automatic 10s check op 'sending' status reset (edge case)
9. **Demo mode toggle** in `/leads/instellingen` — `useDemo` voor screenshots

## Belangrijke beslissingen

- **Aparte Supabase client**: `SUPABASE_URL` in env wijst naar het Storage project (`uhdkxstedvytowbaiers`), niet naar het leads project (`hurzsuwaccglzoblqkxd`). Daarom nieuwe env vars `SUPABASE_LEADS_URL` + `SUPABASE_LEADS_SERVICE_KEY` voor de leads client. Nooit `NEXT_PUBLIC_` prefix — alle calls server-side via API routes.
- **`SYB_USER_ID` hardcoded** in `src/lib/supabase-leads.ts` als `9497e39a-734f-4ce4-81db-230d590064ea`. Wordt gebruikt voor folder inserts en scraper run filters. Vervang later met mapping vanuit iron-session als multi-user lead systeem nodig wordt.
- **Pagination**: Supabase default cap is 1000 rijen — overal pagination loop met `range(from, to)` tot batch leeg, max 50 pagina's safety.
- **Hybrid auth** op alle `/api/leads/*` routes (session OR Bearer) zodat scripts en desktop agent het ook kunnen aanroepen.
- **Email send flow**: optimistic `'sending'` status zodra request binnenkomt, rollback naar `'approved'` als webhook faalt, n8n update later naar `'sent'`/`'replied'`.
- **Edge function proxy** met whitelist (14 functions) ipv open passthrough — voorkomt willekeurige function calls.
- **CSV export**: eigen implementatie zonder externe dep (`exportLeadsAsCSV` in `/leads/contacts/page.tsx` en `/leads/folders/[naam]/page.tsx`). Hunter.io kolommen: first_name/last_name/email/company/website/phone/location/linkedin_url/source/folder.
- **Namespace collision**: bestaande interne CRM `/api/leads/*` (Nederlands schema) verplaatst naar `/api/klant-leads/*` om de namespace vrij te maken voor de leadgen integratie. Geen page gebruikt de oude hook nu, dus geen breakage.
- **GitHub PAT**: gebruikt classic PAT met `repo` scope. Heeft GEEN `delete_repo` scope, dus test repo's moeten handmatig via UI weggehaald worden. PAT staat nog in chat history van vorige sessie — **moet geroteerd worden** via github.com/settings/tokens.

## Huidige staat

- **Branch**: `main`
- **Laatste commit**: `cac39ac feat(leads): folder detail + bulk delete + remaining API routes`
- **Uncommitted changes**: `M src/components/layout/sidebar.tsx` (door user/linter aangepast — niet door Claude — laat staan, niet reverten)
- **Openstaande issues**:
  - 2 test projecten (id 33, 34) staan in dashboard — handmatig opruimen via `/projecten` UI
  - 1 test repo `github.com/Autronis/gh-test-1776097309-33449` — handmatig deleten in GitHub UI
  - GitHub PAT moet geroteerd worden (classic PAT zonder `delete_repo` scope)
  - `syb-windows-setup.zip` ligt klaar maar nog niet naar Syb gestuurd
  - Stale `.next/dev/types/validator.ts` errors in tsc — niet door mij, pre-existing

## Volgende stappen

1. **Read this HANDOFF.md** + run `git status` + `git log --oneline -3` om huidige staat te verifiëren
2. **Begin met de drie kritische items**:
   - **Eerst**: Google Maps unified view in `/leads` index — biggest user-facing gap
   - **Daarna**: `/leads/automations` zoekformulieren — anders kan Sem geen scrapes starten
   - **Daarna**: recipient_email inline edit op `/leads/emails`
3. **Daarna eventueel**: lage prio nice-to-haves (OutreachSection, Recent Activity feed, etc.)
4. **Verifieer telkens** met `npx tsc --noEmit` en commit per logische unit
5. **Auto-sync hook** synct commits naar dashboard automatisch — geen handmatige sync nodig

## Context

- **Spec bron**: `lead-dashboard-v2` Lovable repo (https://github.com/Autronis/lead-dashboard-v2). Alle origineel pagina's te fetchen via `gh api repos/Autronis/lead-dashboard-v2/contents/src/pages/<file>.tsx --jq .content | base64 -d`
- **Architectuur regel**: elke `supabase.from('...').select(...)` in origineel wordt `fetch('/api/leads/...')` in port. Elke `supabase.functions.invoke('...')` wordt `POST /api/leads/edge-function/[name]`.
- **Auto-sync hook**: commit-hook synct automatisch taken naar dashboard. Edits worden vanzelf gecommit door de PostToolUse hook.
- **Vercel deploys**: ~2 min na elke `git push origin main`. Beide leads + dashboard env vars staan al in production.
- **Sem's setup**: Mac, dev server draait al op `localhost:3000`. Dashboard URL: `dashboard.autronis.nl`.
- **Syb's situatie**: Windows (laptop + PC). Nog niet de syb-windows-setup geïnstalleerd. Service key voor lead-dashboard-v2 Supabase staat al in Vercel.
- **Auto-commit hook** kan je commits stelen — controleer altijd `git log` voor je een commit doet om dubbele commits te voorkomen. Als de hook je commit al heeft gedaan, krijg je "nothing to commit" wat OK is.
