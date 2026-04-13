# Handoff — 2026-04-12

## Wat is er gedaan

### 1. Terugkerende facturen (COMPLEET + live)
Volledige UI + backend voor herhalende facturen. Spec: `docs/superpowers/specs/2026-04-11-terugkerende-facturen-design.md`. Plan: `docs/superpowers/plans/2026-04-11-terugkerende-facturen.md`.

- Schema uitgebreid: `terugkeerAantal`, `terugkeerEenheid`, `terugkeerStatus`, `volgendeFactuurdatum`, `bronFactuurId` op de `facturen` tabel
- `/api/facturen` POST/GET + `/api/facturen/[id]` PUT accepteren nu recurring velden
- Nieuw endpoint: `/api/facturen/[id]/terugkerend` voor pauzeren/hervatten/stoppen
- Cron job (`/api/facturen/cron`) gebruikt nu `volgendeFactuurdatum` + `terugkeerStatus` ipv `betaaldOp`
- Frontend: "Herhaling" sectie in `/financien/nieuw` en `/financien/[id]/bewerken` (toggle + aantal + eenheid)
- Nieuwe tab **Terugkerend** in `/financien` met KPI cards, tabel, pauze/hervat/stop acties
- GET API retourneert klantNaam + recurring velden

### 2. Screen time 7h45m bug (COMPLEET + live, vereist desktop agent herstart)
Discord entry (id 5935) spande 7u25m terwijl de actual `duration_secs` 15s was. Root cause: `storage.rs` merge updatete `end_time` naar `now` zonder te checken hoe oud de vorige entry was. Plus `tracker.rs` `get_idle_duration()` gaf `0` terug bij `ioreg` failure ipv een grote waarde.

- `storage.rs`: merge skipt nu als `now - last.end_time > 30s` (creëert nieuwe entry)
- `tracker.rs`: idle fallback is nu 1 uur (falende ioreg = "zeer idle")
- 18 corrupte entries lokaal + 16 op Turso genormaliseerd (`end_time = start_time + duration_secs`)
- **Desktop agent moet nog herstart worden door Sem** voor de Rust fix actief wordt

### 3. Screen time locatie toggle fix (COMPLEET + live)
Optimistic update in `handleLocatieChange` schreef naar `["sessies", datum]` maar de daadwerkelijke key is `["screen-time-sessies", datum, gebruikerId]`. UI bleef oude locatie tonen tot refresh.

- `tab-tijdlijn.tsx`: nu `setQueriesData` met prefix match op `screen-time-sessies` + `screen-time-week-sessies`
- Invalidate na zowel success als failure

### 4. Action Dock (COMPLEET + live)
Vervangt mobile BottomNav + desktop FAB met context-aware shortcut dock. Spec: `docs/superpowers/specs/2026-04-12-action-dock-design.md`. Plan: `docs/superpowers/plans/2026-04-12-action-dock.md`.

- `src/components/layout/action-registry.ts` — 46 acties, 13 route mappings, `getShortcutsForRoute()`
- `src/components/layout/action-registry.test.ts` — 6 unit tests passing
- `src/hooks/use-action-shortcuts.ts` — bindt registry aan router + toast ctx
- `src/components/layout/action-dock.tsx` — responsive (mobile bottom bar + desktop floating pill)
- `src/components/layout/action-dock-overflow.tsx` — bottom sheet/popover met search
- **Verwijderd**: `src/components/layout/bottom-nav.tsx`, `src/components/ui/quick-action-button.tsx`
- `app-shell.tsx` luistert nu naar custom event `autronis:open-command-palette`
- Desktop pill: icons + labels naast elkaar zichtbaar (Sem wilde tekst zien zonder hover)
- Desktop pill: offset met halve sidebar-breedte (256 uitgeklapt / 72 ingeklapt) zodat hij visueel centreert binnen content area, met spring animation bij sidebar toggle

## Wat nog open staat

### A. OPEN VRAAG: Focus sessie / timer weghalen uit dock
Sem zei aan het einde: *"ik zie timer start stop maar we hadden afgesproken om die hele focus sessie met timer weg te halen tovh"*. Ik heb geen context over deze afspraak (geen HANDOFF.md met die info, geen commits). Ik heb Sem 4 opties voorgelegd maar hij heeft geen antwoord gegeven voordat hij /handoff deed.

**Mogelijke bedoeling (vraag Sem):**
1. Hele `/focus` pagina weg + alle `focus-*` actions uit registry
2. Hele `/tijd` (tijdregistratie) weg + alle `timer-*` actions
3. Alleen "focus sessie MET timer" combo weg, apart blijven bestaan
4. Alleen uit dock shortcuts halen, routes/features laten staan

De relevante actions in `src/components/layout/action-registry.ts`:
- `timer-start`, `timer-toggle`, `timer-op-taak`, `tijd-handmatig`, `tijd-week`
- `focus`, `focus-sessie`, `focus-start`, `focus-block`, `focus-pauze`, `focus-stats`
- `SHORTCUTS_BY_ROUTE["/tijd"]`: `timer-toggle, tijd-handmatig, locatie-toggle, tijd-week, focus-sessie`
- `SHORTCUTS_BY_ROUTE["/focus"]`: `focus-start, focus-block, focus-pauze, focus-stats, idee-nieuw`
- `FALLBACK_SHORTCUTS`: `timer-start` zit er in

**EERSTE VRAAG VOOR NIEUWE SESSIE: vraag Sem welke van de 4 opties hij bedoelt.**

### B. Session locking (spec + plan geschreven, NIET geïmplementeerd)
Sem wilde voorkomen dat meerdere Claude sessies aan dezelfde taken/files werken.

- Spec: `docs/superpowers/specs/2026-04-11-session-locking-design.md`
- Plan: `docs/superpowers/plans/2026-04-11-session-locking.md`
- 10 tasks gepland (DB schema, 5 API endpoints, 3 hooks, CLAUDE.md update)
- Niet gestart — Sem wilde eerst andere dingen

**Als Sem dit wil, subagent-driven executie starten.**

### C. Uncommitted change
`src/app/api/projecten/sync-from-agent/route.ts` heeft een uncommitted wijziging. Niet door mij in deze sessie aangeraakt — Sem moet beslissen of dit hoort te committen.

## Belangrijke beslissingen

1. **Action Dock v1 = URL navigation, geen modal host**: de spec beschreef oorspronkelijk een globale modal store met GlobalModalHost, maar dat zou alle bestaande modals moeten refactoren. Voor v1 gebruiken alle acties `router.push(/path?nieuw=true)` — bestaande patronen. Modal integratie is Phase 2 (niet gepland).

2. **Screen time fix = defense in depth**: zowel de merge-guard in storage.rs als de idle-fallback in tracker.rs zijn nodig. De merge-guard voorkomt dat een enkele entry hours kan spannen. De idle-fallback voorkomt dat de tracker überhaupt opneemt als `ioreg` faalt. Beide bugs bestonden tegelijk.

3. **Terugkerende facturen aanpak A**: uitbreiden bestaand `facturen` schema (5 kolommen erbij) ipv aparte `factuur_templates` tabel. Minder complexiteit, hergebruikt bestaande cron infrastructure.

4. **Desktop dock offset = client-side**: gebruikt `useSidebar().isCollapsed` + hardcoded widths (256/72). Spring animation voor soepel meebewegen.

5. **Subagent-driven development** gebruikt voor Terugkerende facturen + Action Dock. Werkte goed — elke task commit apart, auto-sync hook committed ertussen door.

## Huidige staat

- **Branch**: main
- **Laatste commit**: `0189c52 Agenda: Claude sessie prompt + uniforme event styling + duur fix` (auto-sync, niet van mij)
- **Mijn laatste feature commit**: `29ff83d fix(action-dock): center desktop dock within main content area`
- **Uncommitted changes**: ja — `src/app/api/projecten/sync-from-agent/route.ts` (niet door mij)
- **Build status**: production build slaagt ✓
- **TypeScript**: clean behalve pre-existing error in `src/app/(dashboard)/taken/page.tsx:992` (`PageHeaderProps` missing `children` — niet door deze sessie veroorzaakt)
- **Tests**: 39/39 passing (inclusief nieuwe `action-registry.test.ts` met 6 tests)

## Volgende stappen

1. **Pickup HANDOFF.md** lezen en daarna verwijderen
2. **Vraag Sem welke optie** hij bedoelt voor de focus/timer afspraak (Open A, de 4 opties)
3. **Pas action registry aan** op basis van Sem's antwoord (verwijder relevante action IDs, update `SHORTCUTS_BY_ROUTE`, update `FALLBACK_SHORTCUTS`)
4. **Check uncommitted change** in `sync-from-agent/route.ts` — moet dit gecommit?
5. **Optioneel: start session locking implementatie** als Sem dat nog wil (plan ligt klaar)
6. **Herinner Sem**: desktop agent herstarten voor de Rust fix voor de screen time bug

## Context

- Sem werkt vanuit `/Users/semmiegijs/Autronis/Projects/autronis-dashboard/`
- Dashboard is live op https://dashboard.autronis.nl via Vercel auto-deploy
- Database is Turso (libsql), zelfde DB voor lokaal + live
- Auto-sync hook committ automatisch tussendoor — wees niet verrast als `git status` clean is terwijl jij net dacht te hebben gewerkt
- Code in Engels, UI-teksten in Nederlands
- Custom event `autronis:open-command-palette` is een bewuste keuze om AppShell refactor te vermijden voor de Action Dock "search" action
- Screen time tracker draait via Tauri desktop agent in `desktop-agent/src-tauri/` (Rust, macOS + Windows targets)
- Focus sessie + timer features bestaan nog volledig in de code (`/tijd`, `/focus`, `useFocus` hook, etc.) — NIET weghalen zonder bevestiging van Sem welke optie hij bedoelt
