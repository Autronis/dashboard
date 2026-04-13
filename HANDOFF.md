# Handoff — 2026-04-11

## Wat is er gedaan

### 1. Maandelijks Belastingoverzicht (hoofdfeature)
Volledige feature gebouwd en live op `/belasting/maandrapport`:
- **DB**: `eigenaar` + `splitRatio` kolommen op `uitgaven` en `bank_transacties`, nieuwe tabellen `verdeel_regels` en `openstaande_verrekeningen`
- **API endpoints**: `/api/belasting/maandrapport` (aggregation), `/api/belasting/maandrapport/pdf` (PDF export), CRUD voor verdeelregels + verrekeningen, PUT eigenaar-tagging op uitgaven/bank-transacties
- **UI**: nieuwe pagina met header + maandselector, 6-maanden trendlijn, 4 KPI-kaarten (dynamisch — "Van Syb" alleen als er openstaande verrekeningen zijn), uitgaventabel met eigenaar-badges en "+ Tag" dropdown, BTW split Sem/Syb, verrekening-checkboxes, borg overzicht (hardcoded config), samenvatting
- **PDF export** via `@react-pdf/renderer` — hergebruikt bestaand patroon
- **Verdeelregels seed** (22 regels): Coolblue→Sem, KVK→50/50, Kantoorhuur→25/75, Turso/Google/Vercel/Anthropic etc. voor Revolut
- **Auto BTW-schatting** (21%) voor transacties zonder expliciete BTW, skipt bekende buitenlandse leveranciers (Temu, Turso, Vercel, Stripe, Google Workspace)
- **Link** vanuit `/belasting` pagina naar maandrapport
- **Test data** voor april 2026 uit `belasting-overzicht-april-2026.html` ingeladen in Turso (20 transacties + 5 verrekeningen)

### 2. Dashboard sync hook bugfix
Auto-sync hook creeerde een nieuw project elke sessie omdat `"autronis-dashboard"` ≠ `"Autronis Dashboard"`:
- **Hook** (`~/.claude/hooks/auto-sync-taken.py`): `PROJECT_NAME_MAP` toegevoegd
- **API** (`sync-taken/route.ts`): strict normalize + fuzzy substring match toegevoegd (de gebruiker/linter heeft dit verder verfijnd)
- **Opruimen**: 23 foutieve taken op project 31 verwijderd, 9 granulaire Task 1-9 items verwijderd, 1 nette samenvattende taak toegevoegd

### 3. Ops Room heartbeat
Elke open Claude Code chat verschijnt nu als werkende builder in de ops room:
- **Script**: `~/.claude/hooks/ops-heartbeat.sh` — scant elke minuut `~/.claude/projects/` voor sessies met .jsonl bewerkt <3 min, stuurt heartbeat
- **LaunchAgent**: `~/Library/LaunchAgents/com.autronis.ops-heartbeat.plist` (StartInterval 60s, RunAtLoad) — geladen en draaiend

### 4. CLAUDE.md optimalisatie
Root CLAUDE.md van 8.648 → 2.071 bytes (76% kleiner). Uitgebreide curl-voorbeelden, dubbele sync-instructies en HANDOFF template weggehaald omdat skills en hooks dat al afhandelen.

### 5. "Uren deze week" fix
KPI op dashboard homepage toonde 3:19u terwijl deep work hoger lag. In `src/lib/screen-time-uren.ts`:
- Weggehaald: `if (!entry.projectId) continue` — sloot te veel uit
- Toegevoegd: `PRODUCTIEF_CATS` filter (development, design, administratie, finance, communicatie) — alleen Autronis-werk telt, al het andere (entertainment, social, afleiding) wordt genegeerd i.p.v. afgetrokken
- Afleiding-subtractie verwijderd (niet meer nodig door categorie-filter)

## Wat nog open staat

- **Revolut API koppeling** (fase 2) — Sem verwacht de API "morgen" (2026-04-12). Zodra die draait en transacties in `bank_transacties` terechtkomen, werkt het maandrapport automatisch. Verdeelregels en auto-BTW vangen de meeste gevallen af.
- **Uncommitted change**: `src/app/api/projecten/sync-from-agent/route.ts` heeft lokale wijzigingen die nog niet gecommit zijn — niet door mij aangeraakt, check bij Sem of dat van een andere sessie komt.
- **Turso migratie voor toekomstige projecten**: de auto-migrate in `src/lib/db/index.ts` voegt de nieuwe kolommen toe maar ALTER TABLE faalt silently als ze al bestaan — dit werkt, maar is kwetsbaar voor edge cases.

## Belangrijke beslissingen

- **Borg als config, niet DB**: hardcoded `src/lib/borg-config.ts` omdat het hooguit 1x per jaar verandert. Geen DB-tabel nodig.
- **Verrekeningen light**: simpele afvinklijst, geen complex systeem. Zodra alles via zakelijke rekening loopt verdwijnt het.
- **Eigenaar-filter bij uitgaven**: regel 1 is leverancier-match, dan categorie-match. Volgorde matters.
- **"Uren deze week" telt categorieën, niet projectId**: de projectId werd niet altijd gezet door de screen time tracker, dus categorie is betrouwbaarder. Sem wil "alles wat niet duidelijk Autronis is = telt niet".
- **Auto-sync hook heeft dubbele veiligheid**: PROJECT_NAME_MAP in hook + normalize in API. Beide werken los van elkaar.

## Huidige staat

- **Branch**: `main`
- **Laatste commit**: `0189c52 Agenda: Claude sessie prompt + uniforme event styling + duur fix`
- **Uncommitted changes**: ja — `src/app/api/projecten/sync-from-agent/route.ts` (niet van mij)
- **Dev server**: draait op `http://localhost:3001` (port 3000 had een zombie process)
- **Vercel**: auto-deployt na elke main push, zou live moeten zijn

## Volgende stappen

1. **Check in de browser** dat "Uren deze week" nu het juiste getal toont (productieve Autronis activiteit, niet 3:19u)
2. **Check maandrapport** op `/belasting/maandrapport` — navigeer tussen maanden, check of PDF export werkt
3. **Wanneer Revolut API live gaat**: maandrapport moet automatisch nieuwe transacties laten zien. Eventueel extra verdeelregels toevoegen als er nieuwe leveranciers bijkomen die niet matchen.
4. **Check `sync-from-agent/route.ts` wijziging** — vraag Sem of dat commit moet

## Context

- **Dashboard DB is Turso** (libsql), niet lokale SQLite — dat gaf verwarring tijdens het testen omdat ALTER TABLE in Turso andere kolommen mist (is_verlegging, bon_pad, storage_url ontbraken in Turso maar stonden wel in het Drizzle schema). Deze zijn handmatig toegevoegd via een Node-script.
- **Auth voor test-API calls**: `sem@autronis.com` / `Autronis2026!` (login via `/api/auth/login`)
- **Ops Room token**: `autronis-ops-2026` (header `x-ops-token`)
- **PRODUCTIEF_CATS**: `{development, design, administratie, finance, communicatie}` — deze set wordt op meerdere plekken gebruikt, verander hem niet zonder alle gebruikers te checken
- Linter heeft later `sync-taken/route.ts` verder verfijnd met compact-matching en fuzzy substring fallback — die wijzigingen zijn intentioneel
- Linter heeft later `maandrapport/page.tsx` van `green-*` kleuren naar `emerald-*` veranderd — ook intentioneel
