# Handoff — 2026-04-16

## Wat is er gedaan

### Vercel / Deploy fixes
- `CRON_SECRET` whitespace in Vercel env var gefixt (trailing `\n` verwijderd)
- `vercel.json` hourly crons (`gmail-sync`, `revolut/sync`) teruggebracht naar daily (Hobby plan limit)
- `.vercelignore` aangemaakt — sluit `desktop-agent/` en `.worktrees/` uit zodat Rust target/ (2.19 GB) niet in serverless functions belandt
- `next.config.ts` `outputFileTracingExcludes` uitgebreid met `desktop-agent/**/*`
- Sem heeft Vercel **Pro plan** geactiveerd ($20/maand) na quota exhaustion

### Agenda & Taken
- `/api/agenda/taken` — privacy + actief filter toegevoegd (Sem zag Syb's privé projecten + gedeactiveerde projecten)
- `/api/agenda/taken` — auto-uitplan: open taken met `ingeplandStart < vandaag` worden automatisch teruggezet naar NULL (1u cooldown)
- 17 verwaarloosde taken handmatig uitgepland via direct SQL
- Per-taak "+" plan vandaag knop in fase grouping (hover-only, handlePlanFase met 1 taak)
- Taken filter tabs dynamisch: "Mij/Sem/Team/Vrij/Alle" past aan op ingelogde gebruiker
- Expliciete Sem/Syb tab override op privacy filter — klikken op de andere persoon toont hun taken
- Slimme taken templates direct getoond in agenda sidebar (uit `/api/taken/slim`)
- `preSelectedSlug` prop op SlimmeTakenModal — klik template in sidebar → modal opent direct op die template
- AI genereer 5 nieuwe template ideeën knop in beheer view (POST `/api/taken/slim/templates/suggest`)

### Screen-time tracking
- Desktop agent rebuilt met 10-min push debounce (`PUSH_DEBOUNCE_SECS = 600`)
- Agent sync interval van 30s → 300s (5 min) — 90% reductie in Vercel function calls
- Info.plist: `NSAppleEventsUsageDescription` + `NSAccessibilityUsageDescription` toegevoegd
- Codesign met stabiele identifier `nl.autronis.dashboard`
- Build artifact bundle verwijderd (voorkwam "Autronis Dashboard 2" in TCC)
- LaunchAgent plist hernaamd van `.disabled` → `.plist`, `KeepAlive: true`
- VS Code `window.title` setting: `${activeEditorMedium}${separator}${rootName}${separator}${appName}`

### Focus log systeem (NIEUW)
- DB tabel `focus_logs` (gebruiker_id, tekst, bron, aangemaakt_op) + auto-migrate
- `POST /api/focus/log` endpoint (accepteert Bearer API key via `requireAuthOrApiKey`)
- `~/.claude/hooks/focus-log.py` — UserPromptSubmit hook, rate limit 3 min, skip korte/vage prompts
- `/api/screen-time/sessies` leest focus logs per dag, joint per sessie tijdvenster, geeft als `ChatFocus` mee aan Groq prompt
- AI prompt: ChatFocus krijgt altijd voorrang boven window titles
- Claude Code sessie-namen (`claudeSessionRe`) worden automatisch gefilterd uit AI input
- Memory entry: toekomstige Claude sessies loggen periodiek focus samenvattingen
- Cache bumped naar v7

### Site Rebuild
- "Optimaliseer met AI" knop bij Extra Instructies veld
- `POST /api/site-rebuild/optimize-instructies` — Sonnet 4.6 expand't korte hints naar design briefing

### Timezone fix
- `/api/screen-time/sessies` insights widgets: UTC→NL timezone conversie via `timeZone: "Europe/Amsterdam"`

### Syb sync
- `CLAUDE.md.template` in `syb-windows-setup/` gesynct met huidige versie (247 regels)
- `docs/synchronisatie-flow.md` — foutieve Windows paden gecorrigeerd
- AUTRO briefing verstuurd met 6-stappen installatie instructies
- AUTRO bevestigd: stap 1 (git pull) + stap 4 (skill check) klaar, stap 2/3/5/6 wacht op Syb

### Push policy
- `.git/hooks/post-commit` in beide repos → `.disabled`
- Desktop agent auto-push debounce (10 min)
- CLAUDE.md push policy sectie toegevoegd

## Wat nog open staat

### Slimme taken UX (PRIORITEIT)
Sem's feedback: als hij een slimme taak template klikt in de agenda sidebar, wil hij:
1. **Tijd kiezen** (niet hardcoded 09:00) — zelfde UX als normale taak plannen
2. **Template velden optioneel** of met smart defaults — geen verplichte "Branche" invullen voor quick-plan
3. **Zelfde flow als normale taken** — datum + tijd kiezen, klaar

Dit is de #1 open taak. De `preSelectedSlug` prop werkt al (modal opent op de juiste template), maar de form mode mist:
- Starttijd dropdown (08:00-17:00 in 30 min steps)
- Duur aanpasbaar (pre-filled vanuit template `geschatteDuur`)
- Velden optioneel maken bij quick-plan vanuit agenda

### Andere open items
- Supabase RLS waarschuwing (project `uhdkxstedvytowbaiers`) — Sem wil het later bekijken
- `project-sync` error: agent probeert taak id 67219 te deleten die niet bestaat (500 loop)
- NaN bug in deep work balk bij 0 data (kosmetisch)

## Belangrijke beslissingen
- **Vercel Pro plan** — geactiveerd vanwege quota exhaustion. Hobby plan was structureel te weinig voor dagelijks gebruik + screen-time agent
- **Focus logs boven window titles** — AI prompt geeft ChatFocus altijd voorrang. Claude Code sessie-namen worden gefilterd want ze zijn stale (eerste topic, niet huidig)
- **Agent sync 5 min ipv 30s** — grote CPU besparing, nog steeds near-realtime genoeg
- **Geen worktrees** — bevestigd dat worktrees niet meer gebruikt worden
- **Desktop agent auto-start** — KeepAlive: true, plist niet meer disabled

## Huidige staat
- **Branch**: main
- **Laatste commit**: `06c440b5` Auto-sync
- **Uncommitted changes**: nee (clean)
- **Openstaande issues**: slimme taken UX (zie boven), project-sync 67219 error

## Volgende stappen
1. **Slimme taken UX fixen** — starttijd + duur controls toevoegen aan form mode in SlimmeTakenModal, velden optioneel bij quick-plan
2. **Lead Rebuild Prep tool** — Sem had dit als doel voor deze sessie maar we zijn niet toegekomen aan de code. Spec staat in CLAUDE.md (auto-sync Syb's lead-dashboard-v2 sectie). Begin met `/api/leads/rebuild-prep/route.ts`
3. **Focus log verifiëren** — check morgenochtend /tijdlijn voor rijke beschrijvingen. Als nog steeds vaag → prompt tuning nodig
4. **Syb stappen 2/3/5/6** — Syb moet Claude Code herstarten + intake flow smoke test doen

## Context
- Sem werkt met meerdere parallel Claude chats (4-6 tegelijk) op het Autronis Dashboard project
- Screen-time tracking was een groot punt vandaag — Sem wil Rize-niveau accuracy. Het focus log systeem is de oplossing maar moet nog bewezen worden over een volle werkdag
- De desktop agent is vandaag 3x opnieuw geïnstalleerd (Tauri rebuild, codesign, TCC permissions). Alles staat nu stabiel met `KeepAlive: true`
- Sem praat Nederlands via SpeakToText — verwacht STT fouten in prompts. Dictionary entries toegevoegd: "pruis→privacy", "wijsgingen→wijzigingen"
- CLAUDE.md in de meta-repo (`~/Autronis/CLAUDE.md`) is de cascade root en bevat push policy + cluster regels + intake flow
