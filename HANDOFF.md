# Handoff — 2026-04-09

## Wat is er gedaan
- **Leads pagina hersteld** — was per ongeluk verwijderd bij opruiming, iframe naar Syb's Lovable app teruggezet
- **VOF bedrijfsgegevens** — alle facturen/offertes/contracten gebruiken nu automatisch bedrijfsgegevens uit instellingen. `website` veld toegevoegd aan schema + instellingen pagina. Alle hardcoded fallbacks vervangen door dynamische waarden.
- **Ops Room poppetjes** — ProjectPanel toont nu Sem/Syb als actieve gebruikers op projecten (team/live API uitgebreid met sessie-tracking)
- **Duplicate taken opgelost** — root cause was `sync-taken` met `replace_all` die TODO.md las en open items terug-insertte. Fix: TODO.md afgevinkt + `replace_all` downgradet nooit meer "afgerond" naar "open"
- **Autronis Dashboard op 100%** — alle 33 taken afgevinkt in database, project status = afgerond
- **Project auto-afgerond** — taken/[id] PUT en sync-taken zetten project automatisch op "afgerond" bij 100% voortgang
- **VS Code opener** — desktop agent op http://127.0.0.1:3848 met `code --new-window`. Geen vscode:// fallback meer (dat was de oorzaak van venster-herplaatsing). HTTPS cert werkte niet met fetch, HTTP naar 127.0.0.1 wel (Chrome uitzondering).
- **Agenda AI plan** — tijdschattingen verlaagd (15-30 min ipv 60-120), "WACHTRIJ" als tijdstip gefixd (18 taken gecorrigeerd), validatie op HH:MM format
- **Vercel builds** — followup/cron SES→Resend migratie, esbuild lock file fix, `npm install` ipv `npm ci` in CI
- **Taak tellingen** — projecten route telt nu consistent met taken route (isActief filter)

## Wat nog open staat
- **"Deel document via e-mail" feature** — Sem's laatste verzoek, nog niet gebouwd. Zie details hieronder.

## Belangrijke beslissingen
- **HTTP ipv HTTPS voor desktop agent** — self-signed cert werkt voor browser navigatie maar niet voor `fetch()` vanuit een andere origin. Chrome staat `http://127.0.0.1` toe vanuit HTTPS (secure context exception).
- **Geen vscode:// fallback** — `vscode://file` herplaatst het bestaande venster. Als de agent niet draait, toont het dashboard een foutmelding in plaats van het venster te jatten.
- **sync-taken** — `replace_all` mode behoudt nu altijd "afgerond" status. Kan nooit meer afgeronde taken terugzetten naar open.
- **LaunchAgent verwijderd** — gaf problemen (EADDRINUSE, KeepAlive conflicten met Tauri app op 3847). Desktop agent wordt handmatig gestart: `node scripts/desktop-agent.js`

## Huidige staat
- **Branch**: main
- **Laatste commit**: 4252867 Auto-sync: autronis-dashboard
- **Uncommitted changes**: nee
- **Openstaande issues**: 
  - Desktop agent moet handmatig gestart worden (`node scripts/desktop-agent.js`) — geen LaunchAgent meer
  - Tauri Desktop App draait op poort 3847, desktop-agent.js op 3848
  - Builds slagen nu (npm install ipv npm ci)

## Volgende stappen
1. **Bouw "Deel document via e-mail" feature**:
   - API route: `POST /api/email/send-with-attachment`
   - Gebruik Resend met attachments (base64)
   - Herbruikbaar modal component: ontvanger, onderwerp, boodschap, bijlage
   - Referentie: `/api/facturen/[id]/verstuur/route.ts` en `/api/offertes/[id]/verstuur/route.ts`
   - Support voor PDF en HTML bijlagen
2. Optioneel: LaunchAgent opnieuw instellen voor desktop agent (poort 3848, KeepAlive, correcte PATH)

## Context
- Dashboard draait op Vercel (dashboard.autronis.nl), database op Turso
- Autronis is nu een VOF (Sem + Syb), bedrijfsgegevens in instellingen
- Sem werkt op Mac met 3 schermen (MacBook + ultrawide 3440x1440 + 1080p)
- De Tauri "Autronis Dashboard.app" bezet poort 3847, onze desktop-agent.js draait op 3848
- Resend is de email provider (RESEND_API_KEY in env)
- Sem vindt het belangrijk dat tijdschattingen realistisch zijn (15-30 min, max 45)
