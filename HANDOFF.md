# Handoff — 11 april 2026

## Wat is er gedaan
- **Administratie & Cloud Storage feature** volledig gebouwd en gedeployd:
  - Supabase Storage voor alle financiële documenten (bonnetjes, facturen)
  - Gmail auto-import cron voor inkomende facturen (Claude Vision analyse)
  - `/administratie` pagina met overzicht per jaar/kwartaal, upload, ZIP export
  - Bestaande flows (bonnetje, email-factuur, factuur PDF) gemigreerd naar Supabase Storage
- **Financial Dashboard project** gearchiveerd (was overbodig, alles zat al in het dashboard)
- **Auto-sync hook** gebouwd: `~/.claude/hooks/auto-sync-taken.sh` — stuurt systemMessage na elke git commit om taken te syncen naar dashboard
- **Vercel deploy fix**: Resend client lazy-init om build failure te voorkomen

## Wat nog open staat (handmatig door Sem)
1. **Supabase Storage bucket aanmaken**: Supabase Dashboard → Storage → New bucket "administratie" (private)
2. **SUPABASE_SERVICE_KEY**: Supabase → Settings → API → service_role key → toevoegen als Vercel env var
3. **Gmail koppelen**: Google Cloud Console → Gmail API enablen + redirect URI toevoegen: `https://dashboard.autronis.nl/api/auth/google/gmail/callback`. Dan naar `https://dashboard.autronis.nl/api/auth/google/gmail` om te autoriseren met zakelijk@autronis.com

## Volgende taak: Maandelijks Belastingoverzicht
Sem wil een automatisch maandelijks financieel rapport in het dashboard, vergelijkbaar met `~/Autronis/belasting-overzicht-april-2026.html`. Dat bestand bevat:

### Wat het rapport toont:
- Zakelijke uitgaven per maand met categorie-badges (hardware, kantoor, software, etc.)
- BTW terug te vragen (met split per bron: ING, Revolut, persoonlijk)
- **Sem/Syb verrekening** — welke kosten gedeeld zijn (50/50, 25/75) en wat Syb aan Sem moet betalen
- Openstaande schulden onderling
- Borg/vorderingen overzicht
- Samenvatting: totaal terug te krijgen

### Wat er al bestaat in het dashboard:
- Uitgaven per categorie → `bankTransacties` + `uitgaven` tabellen
- BTW berekening → `/api/belasting/btw-voorbereiding`
- Winst/verlies → `/api/belasting/winst-verlies`
- Jaaroverzicht → `/api/belasting/jaaroverzicht`
- Bank transacties (Revolut + ING CSV import)

### Wat er NIET bestaat en gebouwd moet worden:
1. **Gedeelde kosten markeren** — veld op uitgaven/transacties: eigenaar (Sem/Syb/gedeeld) + split ratio
2. **Verrekenmodule** — berekent wie wat aan wie moet betalen
3. **Maandrapport generatie** — combineert alle data tot een overzicht zoals de HTML
4. **Rapport pagina** in het dashboard (of tab op /belasting)
5. **Optioneel: PDF/email export** van het maandrapport

### Referentie:
- HTML voorbeeld: `~/Autronis/belasting-overzicht-april-2026.html`
- Design spec administratie: `docs/superpowers/specs/2026-04-11-administratie-cloud-storage-design.md`

## Belangrijke beslissingen
- Supabase Storage gekozen boven Cloudflare R2 (zat al in de stack)
- Gmail API polling gekozen boven Resend forwarding (zero effort voor Sem)
- Lazy-init pattern voor alle externe clients (Supabase, Resend) om Vercel build failures te voorkomen

## Huidige staat
- Branch: `main`
- Laatste commit: `01b63fc` — fix: lazy-init Resend client
- Vercel: deploy draait, zou moeten slagen na de Resend fix
- Dashboard taken: 12 administratie taken staan als afgerond in Fase 2

## Volgende stappen
1. Start brainstorming voor het maandelijks belastingoverzicht
2. Lees `~/Autronis/belasting-overzicht-april-2026.html` als referentie
3. Check de bestaande `/belasting` pagina en API routes
