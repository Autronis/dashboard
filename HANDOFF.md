# Handoff — 2026-04-10

## Wat is er gedaan
- **Deel document via e-mail** — ShareDocumentModal + API route, Resend met HTML content + signature
- **Document PDF export** — print.css herschreven (Arial, geen overflow, A4, data-print-* attributes)
- **Project status fix** — gaat automatisch terug naar "actief" bij nieuwe open taken (sync-taken + taken PUT)
- **Dashboard sync hook versterkt** — Stop hook blokkeert einde sessie zonder sync, feedback memory opgeslagen
- **Wiki import** — API route /api/wiki/import (GET scan + POST import), werkwijze + skills HTML docs geïmporteerd, Vercel cron dagelijks 12:00
- **Auto-doc-sync hook** — PostToolUse hook die HTML/MD bestanden naar wiki synct
- **Wiki PDF export** — /api/wiki/[id]/pdf met Autronis huisstijl (cover, logo, branding), PDF knop op wiki pagina
- **API endpoints** — POST /api/projecten (aanmaken), GET /api/projecten/taken (ophalen per project), sync-taken auto-create project
- **Wiki HTML support** — wiki view rendert nu HTML content naast Markdown
- **Tijdregistratie locatie** — klikbare LocatieBadge (toggle), locatie dropdown in edit modal, IP auto-detect via localStorage
- **Screen time samenvattingen** — veel specifiekere AI prompt, meer venstertitels/bestandsnamen meesturen, Claude Code titel parsing
- **Taken pagina** — afgeronde projecten verbergen via hideCompleted toggle
- **Analytics snelheid** — decision-engine (11 queries) en analytics route (8 queries + 2x berekenActieveUren) geparalleliseerd met Promise.all
- **VS Code opener** — LaunchAgent nl.autronis.vscode-opener op poort 3848, auto-start bij login
- **Agenda Claude sessie blok** — één paars blok met checklist per project, "jij bent vrij" indicator
- **Agenda split-view** — Claude sessie links (50%), handmatige taken rechts (50%), geen overlap
- **Agenda suggesties** — "Wat je nu kunt doen" in zijbalk met klikbare items (sales, LinkedIn, offertes)
- **Agenda drag & drop fix** — taken stapelen automatisch na laatste taak in slot, timezone-fix (minOfDay helper), Claude sessie-taken uitgesloten van overlap check
- **Agenda direct inplannen** — drag & drop plant direct in zonder modal
- **Kopieer knoppen verwijderd** — batch banner, sessie-blok kopieer, Terminal icons op taken
- **AI planner** — plant handmatige taken TIJDENS Claude sessie, development taken ERNA
- **Meetings module** — meeting_url kolom toegevoegd, meeting link veld in UI, auto-dispatch Recall bot bij aanmaken
- **Cal.com update** — website embed geüpdatet naar autronis/30-min-meeting (Google Meet ipv Cal Video)
- **Auto-record cron** — checkt elke 5 min kalender events op Google Meet URLs, maakt DB meeting + stuurt Recall bot
- **Recall.ai fix** — transcription_options verwijderd (deprecated), recording_config.transcript.provider.meeting_captions toegevoegd, getRecallTranscript geüpdatet voor v1/transcript/{id} endpoint
- **Turso DB fixes** — meeting_url, sentiment, tags kolommen toegevoegd aan meetings tabel
- **Autronis website** — website veld toegevoegd aan contactformulier (NL + EN)

## Wat nog open staat
- **Recall webhook → automatisch verwerken** — na meeting moet transcript automatisch opgehaald worden en AI samenvatting gegenereerd. Nu moet je handmatig "Verwerken" klikken. De recall-webhook route bestaat maar moet geüpdatet worden voor de nieuwe API (v1/transcript/{id} + download_url).
- **Transcriptie kwaliteit** — meeting_captions geeft matige kwaliteit (1 segment, verkeerde taal). Optie: overschakelen naar deepgram_streaming of gebruiker moet captions op NL zetten in Google Meet.
- **Per-klant isolatie** — eigen Supabase + n8n per klant via MCP (taak in dashboard, gepland voor later bij 5+ klanten)

## Belangrijke beslissingen
- **meeting_captions** gekozen als transcriptie provider (gratis, geen extra API key). Kwaliteit is afhankelijk van Google Meet captions. Deepgram is beter maar kost extra.
- **Cal.com locatie** gewijzigd van "Cal Video" naar "Google Meet" — Cal Video URLs worden niet ondersteund door Recall.ai
- **Nieuwe Cal.com event type** aangemaakt: `autronis/30-min-meeting` (oude `30min` kon niet gewijzigd worden)
- **Auto-record cron** draait elke 5 min (ma-vr 7-18u) — checkt zowel DB meetings als kalender events
- **Agenda drag & drop** plant nu direct in zonder modal — sneller workflow
- **Claude sessie-taken** worden uitgesloten van overlap check zodat handmatige taken ernaast gepland kunnen worden

## Huidige staat
- **Branch**: main
- **Laatste commit**: 8a46da8 Auto-sync: autronis-dashboard
- **Uncommitted changes**: nee (auto-sync pushed alles)
- **Dev server**: was actief op localhost:3000
- **Desktop agent**: draait via LaunchAgent nl.autronis.vscode-opener op poort 3848
- **Openstaande issues**:
  - Recall transcript kwaliteit is laag met meeting_captions
  - Google Meet bot moet handmatig toegelaten worden (Google Meet beperking)
  - meetings GET route had fallback nodig voor $dynamic() query failure

## Volgende stappen
1. **Recall webhook automatisch verwerken** — update /api/meetings/recall-webhook zodat na meeting einde automatisch transcript wordt opgehaald (via v1/transcript/{id} → download_url) en AI samenvatting wordt gegenereerd
2. **Transcriptie kwaliteit verbeteren** — test met deepgram_streaming provider, of documenteer dat Google Meet captions op Nederlands moeten staan
3. **End-to-end test** — nieuwe Cal.com booking → Google Meet → bot joint → transcript → samenvatting in dashboard
4. **Meetings pagina** — toon "Bot actief" indicator als recall_bot_id bestaat en status = verwerken

## Context
- Sem werkt op Mac met 3 schermen, Autronis is een VOF (Sem + Syb)
- Dashboard draait op Vercel (dashboard.autronis.nl), database op Turso
- Auto-sync process maakt "Auto-sync: autronis-dashboard" commits bij file changes
- Recall.ai API regio: eu-central-1, API key staat in .env.local
- Cal.com account: "autronis" op app.cal.com, gekoppeld aan zakelijk@autronis.com
- De Recall bot heet "Autronis Notulist"
- Transcript endpoint: GET /api/v1/transcript/{artifact_id}/ → response bevat data.download_url → download JSON met segmenten
- Laatste test-bot ID: 5d6b7d73-3e99-42d5-b168-f62809745d72
