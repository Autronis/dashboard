# Autronis Dashboard

## Status
- **Status**: Live + in development
- **Deployment platform**: Vercel (auto-deploy via GitHub)
- **URL**: https://dashboard.autronis.nl
- **Database**: Turso (libsql) — zowel lokaal als live dezelfde database

## Deployment
- Git post-commit hook pusht automatisch naar GitHub na elke commit
- Vercel deployt automatisch na elke push naar main
- **Na elke wijziging**: gewoon committen, de rest gaat automatisch
- Nooit handmatig pushen of deployen nodig

## n8n workflows
- `yt-playlist-sync` — dagelijks 08:00 Europe/Amsterdam, RSS poll van Autronis YouTube playlist (hardcoded ID in Set-node), POST naar `/api/yt-knowledge` + auto-trigger `/analyze` voor nieuwe videos. JSON in [n8n/yt-playlist-sync.workflow.json](n8n/yt-playlist-sync.workflow.json). Playlist-ID wijzigen = Set-node waarde aanpassen in n8n UI. Auth via `INTERNAL_API_KEY` (inline Bearer header in workflow, niet via credential-ID omdat die niet in de export staat).
- `yt-transcript-proxy` — webhook-driven proxy om YouTube captions op te halen omdat YouTube Vercel IPs blokkeert. POST met `{videoId}` → returnt `{ok, transcript, language}`. Draait op Hostinger VPS (Vercel IP range is geblokt, Hostinger niet). Webhook path heeft random suffix (URL = secret). JSON in [n8n/yt-transcript-proxy.workflow.json](n8n/yt-transcript-proxy.workflow.json). Dashboard gebruikt `N8N_TRANSCRIPT_PROXY_URL` env var; `/analyze` valt terug op directe fetch als env niet gezet (handig voor dev op Sem's Mac). Code node gebruikt `this.helpers.httpRequest()` omdat n8n sandbox `fetch`/`axios`/`require` blokkeert.

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router, Turbopack)
- **Language**: TypeScript 5
- **UI**: React 19, Tailwind CSS v4, Framer Motion, lucide-react
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode)
- **Auth**: iron-session (cookie-based), bcrypt
- **State**: Zustand
- **AI**: Anthropic SDK (Claude), OpenAI SDK
- **PDF**: @react-pdf/renderer (server-side)
- **Video**: Remotion
- **E-mail**: Resend API
- **Integrations**: Notion API, Google APIs, AWS SES, Mollie (betaal)
- **Drag & Drop**: @dnd-kit
- **Command Palette**: cmdk
- **PWA**: manifest.json + icons

## Project Context
Intern dashboard voor Autronis. Realtime overzicht van projecten, taken, tijdregistraties en klanten. Gepersonaliseerd per ingelogde gebruiker (Sem of Syb).

## Kleuren & Design
- Donker thema (standaard), teal/turquoise accent
- Achtergrond: `#0E1719` — Card: `#192225` — Border: `#2A3538`
- Accent: `#17B8A5` — Accent hover: `#4DC9B4`
- Custom CSS variabelen met `autronis-*` prefix
- Ruime UI (p-6/p-7/p-8), `rounded-2xl` kaarten, `card-glow` hover

## Database
- SQLite (bestand: `./data/autronis.db`)
- Drizzle ORM, schema in `src/lib/db/schema.ts`
- 15 tabellen, alle kolomnamen in het Nederlands
- Soft delete via `is_actief` flag (klanten, leads, projecten)

## Patronen
- API error responses: `{ fout: "message" }` (Nederlands)
- API success responses: `{ [entity]: data }` of `{ succes: true }`
- Alle API routes gebruiken `requireAuth()` (behalve login, seed)
- Frontend pagina's zijn `"use client"` met `useCallback` + `useEffect` data fetching
- Toast notificaties via `useToast()`: `addToast("message", "succes" | "fout")`
- Factuurnummer format: `AUT-YYYY-NNN`

## Commands
```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npx tsc --noEmit     # TypeScript check (altijd runnen na wijzigingen)
```

### Turbopack + .worktrees/ valkuil
Turbopack's file watcher overloadt als er een `.worktrees/` directory in de project root zit met meerdere geparkeerde git worktrees (dev server hangt of crasht bij elke hot reload). **Houd `.worktrees/` weg uit de project root** — gebruik `/tmp/autronis-worktrees-parked-<timestamp>/` of een andere locatie buiten de tree. Als Turbopack alsnog traag is, fallback naar webpack via `NODE_OPTIONS='--max-old-space-size=6144' npx next dev -p 3000` (zonder `--turbo`).

## Environment Variables
```
SESSION_SECRET=...        # iron-session secret (min 32 chars, vereist)
RESEND_API_KEY=...        # Factuur e-mail versturen
ANTHROPIC_API_KEY=...     # Claude AI
MOLLIE_API_KEY=...        # Betaalintegratie
NEXT_PUBLIC_URL=...       # Publieke URL voor webhooks/links
NOTION_API_KEY=...        # Notion integratie
SUPABASE_ACCESS_TOKEN=... # Personal access token van supabase.com — voor sync-syb-leads (types regen)
```

## Auto-sync van Syb's lead-dashboard-v2

Syb beheert `https://github.com/Autronis/lead-dashboard-v2` (Lovable React app + Supabase project hurzsuwaccglzoblqkxd). Ons dashboard praat met zijn Supabase via service key. Wijzigingen aan zijn schema of edge functions vereisen aan onze kant updates aan `src/types/supabase-leads.ts` en de `ALLOWED_FUNCTIONS` whitelist in de edge-function proxy.

Die sync gebeurt automatisch via [scripts/sync-syb-leads.mjs](scripts/sync-syb-leads.mjs) en de GitHub Action [.github/workflows/sync-syb-leads.yml](.github/workflows/sync-syb-leads.yml).

### Wat er auto gebeurt
1. **Cron** elke 30 min (of `repository_dispatch` als de companion Action in lead-dashboard-v2 aan staat) → script draait
2. Script vergelijkt `gh api repos/Autronis/lead-dashboard-v2/commits/main` met `.syb-sync-state.json`
3. Per categorie wijziging:
   - `supabase/migrations/*.sql` veranderd → `npx supabase gen types typescript --project-id hurzsuwaccglzoblqkxd > src/types/supabase-leads.ts`
   - `supabase/functions/*` veranderd → `ALLOWED_FUNCTIONS` Set in `src/app/api/leads/edge-function/[name]/route.ts` wordt gepatcht (toegevoegd/verwijderd, alfabetisch gesorteerd)
4. Als er code wijzigingen zijn → committen + pushen naar main → Vercel deployt
5. Een dashboard-taak wordt aangemaakt onder project "Autronis Dashboard", cluster `backend-infra`, met samenvatting van wat Syb veranderde + suggestie of er UI werk bij komt kijken

### Vereiste GitHub Secrets
- `SUPABASE_ACCESS_TOKEN` — maak aan op [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens), nodig voor types regen
- `DASHBOARD_API_KEY` — `atr_...` key (zelfde als `INTERNAL_API_KEY`/auto-sync hook), voor het aanmaken van de samenvattings-taak
- `GH_PAT` (optioneel) — alleen nodig als `GITHUB_TOKEN` niet genoeg rechten heeft op de Autronis org. Standaard `GITHUB_TOKEN` zou moeten werken.

### Lokaal handmatig draaien
```bash
# Dry run — laat alleen zien wat de script zou doen
node scripts/sync-syb-leads.mjs --dry-run --verbose

# Echt draaien (commits + pushed)
SUPABASE_ACCESS_TOKEN=sbp_xxx DASHBOARD_API_KEY=atr_xxx node scripts/sync-syb-leads.mjs

# Force een sync zelfs als HEAD niet veranderd is (handig voor testing)
node scripts/sync-syb-leads.mjs --force --dry-run

# Lokaal wel committen maar niet pushen
SKIP_PUSH=1 node scripts/sync-syb-leads.mjs
```

### Instant trigger (optioneel)
Standaard polled de cron elke 30 min. Voor instant sync: copy [docs/syb-lead-dashboard-dispatch.yml](docs/syb-lead-dashboard-dispatch.yml) naar `Autronis/lead-dashboard-v2/.github/workflows/notify-dashboard.yml`. Dat fired een `repository_dispatch` event af bij elke push naar main, en onze sync workflow draait dan binnen seconden ipv halfuren.

### Wat NIET auto wordt gedaan
- UI changes — als Syb een nieuwe kolom toevoegt, krijg jij een taak ("Syb voegde X kolom toe — surfacen?"). Een mens of Claude moet beslissen of die kolom in `/leads` of `/leads/rebuild-prep` getoond moet worden, een filter krijgt, etc. Auto-gegenereerde UI is te risky.
- Edge function gedrag — als Syb de body shape of response shape van een bestaande function verandert, blijft onze proxy 'm gewoon doorforwarden. Onze frontend code die er vanuit gaat moet handmatig worden bijgewerkt. De taak waarschuwt hier wel voor.

## Taken Ophalen bij Sessiestart (VERPLICHT)
Bij het BEGIN van elke sessie MOET je de openstaande taken ophalen uit het dashboard. Dit is de single source of truth — niet TODO.md, niet de conversatie.

### Hoe taken ophalen:
```bash
CONFIG=$(cat ~/.config/autronis/claude-sync.json)
URL=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['dashboard_url'])")
KEY=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")

# Haal openstaande taken op
curl -s -X POST "$URL/api/projecten/sync-taken" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectNaam": "Autronis Dashboard", "voltooide_taken": [], "nieuwe_taken": []}' 
```
Als dit geen taken retourneert, vraag Sem welke taken open staan of check het dashboard visueel.

### Workflow:
1. **Sessiestart** → taken ophalen → toon aan Sem → vraag wat oppakken
2. **Taak afronden** → DIRECT syncen als voltooide_taken
3. **Nieuwe taak ontdekt** → DIRECT syncen als nieuwe_taken **met fase**
4. **Sessie-einde** → check of alles gesynct is

### Nieuwe taken toevoegen (VERPLICHT — altijd met context)
`nieuwe_taken` accepteert zowel strings als objecten. **Gebruik ALTIJD objecten** en vul zoveel mogelijk velden in zodat Sem de taak direct snapt zonder context erbij te zoeken:

```json
{
  "nieuwe_taken": [
    {
      "titel": "INTERNAL_API_KEY instellen in .env.local en Vercel",
      "fase": "Fase 2: Financieel & Compliance",
      "prioriteit": "hoog",
      "omschrijving": "Stappen:\n1. Open .env.local → voeg toe: INTERNAL_API_KEY=...\n2. Ga naar Vercel → Settings → Environment Variables\n3. Voeg dezelfde key toe voor production\n4. Deploy opnieuw",
      "geschatteDuur": 15,
      "deadline": "2026-04-15"
    }
  ]
}
```

**Velden** (alleen `titel` is verplicht, rest optioneel maar aanbevolen):

| Veld | Type | Wat |
|---|---|---|
| `titel` | string | Korte, concrete actie-titel |
| `fase` | string | Fase binnen het project (bijv. "Fase 2: Financieel"). Als niet gegeven → meest recente actieve fase |
| `prioriteit` | `"laag" \| "normaal" \| "hoog"` | Default `"normaal"` |
| `omschrijving` | string (markdown) | **Stappen, context, acceptatiecriteria**. Multi-line met `\n`. Sem leest dit in het Taak Detail paneel. |
| `geschatteDuur` | int | Minuten. Gebruik 15/30/60/120. |
| `prompt` | string | **Alleen voor Claude-taken**: de exacte prompt die gebruikt moet worden om de taak uit te voeren |
| `deadline` | `"YYYY-MM-DD"` | Hard deadline |

**Regels:**
- **Omschrijving is bijna altijd waardevol**. Als je weet wat de stappen zijn, schrijf ze op. Geen enkele cognitieve overhead voor Sem als hij de taak later oppakt.
- **geschatteDuur bij nieuwe taken** — een ruwe schatting is beter dan niks
- **Voor Claude-taken**: vul `prompt` in met de letterlijke tekst die Sem kan kopiëren in een nieuwe Claude Code sessie
- **Enrichment werkt ook bij bestaande taken**: als je sync-taken aanroept met een `omschrijving`/`geschatteDuur`/`prompt` veld voor een taak die al bestaat maar die velden leeg heeft, worden ze aangevuld (lege velden worden gevuld, bestaande content wordt niet overschreven)

## Team Sync (VERPLICHT)
Dit project wordt gedeeld door Sem (id=1) en Syb (id=2). Gebruik de team sync API bij ELKE sessie.

### Bij start van sessie
Check wie waar aan werkt en welke taken vrij zijn:
```bash
curl -H "x-api-key: $SESSION_SECRET" "https://dashboard.autronis.nl/api/team/sync?projectId=9"
```

### Bij start van een taak
Claim de taak zodat de ander hem niet pakt (409 = al bezet, pak een andere):
```bash
curl -X POST -H "x-api-key: $SESSION_SECRET" -H "Content-Type: application/json" \
  "https://dashboard.autronis.nl/api/team/sync" \
  -d '{"gebruikerId": ID, "type": "taak_gepakt", "taakId": TAAK_ID, "projectId": 9, "bericht": "Begonnen aan TITEL", "taakStatus": "bezig"}'
```

### Bij afronding
```bash
curl -X POST -H "x-api-key: $SESSION_SECRET" -H "Content-Type: application/json" \
  "https://dashboard.autronis.nl/api/team/sync" \
  -d '{"gebruikerId": ID, "type": "taak_afgerond", "taakId": TAAK_ID, "projectId": 9, "bericht": "Afgerond: TITEL", "taakStatus": "afgerond"}'
```

### Nieuwe taken aanmaken
Als je features bouwt die niet als taak bestaan, maak ze aan via POST /api/taken en gebruik de sync API.

## Regels
- Code altijd in het Engels, UI-teksten in het Nederlands
- Nooit `any` in TypeScript
- Nooit `console.log` in productie-code
- Dit is een BESTAAND project — niet opnieuw opzetten
