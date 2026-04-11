# Handoff — 11 april 2026

## Wat is er gedaan
- **Wiki PDF export**: volledig herschreven van HTML-print naar echte PDF met `@react-pdf/renderer`. Cover page, branded header/footer, HTML parser voor cards/grids/diagrams. Bestanden: `src/lib/wiki-pdf.tsx` + `src/app/api/wiki/[id]/pdf/route.ts`
- **Sidebar reorganisatie**: van 8 secties naar 5, georganiseerd op gebruiksfrequentie. Top-level: Dashboard, Taken, Agenda, Projecten. Bestand: `src/components/layout/sidebar.tsx`
- **Vercel deploy gefixt**: `*/5` en `*/30` crons in `vercel.json` blokkeerden deploy op Hobby plan → omgezet naar dagelijks
- **Vercel repo**: nu gekoppeld aan `Autronis/dashboard` (origin), deploy via GitHub Actions workflow
- **Reconi mail**: mail opgesteld voor Syb (Manuel@autronis.com) voor e-mailadres correctie

## Wat nog open staat — TWEE FEATURES BOUWEN

### Feature 1: Taken toewijzen + Claude conflict-preventie
- **Taken pagina filter**: "Sem / Syb / Alles" toggle, standaard = jouw taken
- **Standaard view**: als je inlogt zie je alleen taken toegewezen aan jou
- **Claude conflict-preventie**: team sync API (`/api/team/sync`) bestaat al met `taak_gepakt` (409 bij conflict). Dit moet in de skills (prime/go/build) ingebouwd worden zodat Claude automatisch taken claimt.
- Schema heeft al `toegewezen_aan` op taken + `toegewezenAanNaam` wordt al getoond

### Feature 2: Automatische tijdregistratie per project
- Claude start tijdregistratie bij `/prime` of `/go` — detecteert project uit werkdirectory
- Stopt bij `/end` of `/handoff`
- Dashboard toont splitsing "Autronis uren" vs "Overige uren"
- Alleen Autronis-uren tellen mee voor KPI's/weekoverzicht
- Sem = gebruiker id 1, Syb = gebruiker id 2

## Belangrijke beslissingen
- Vercel Hobby plan: alleen dagelijkse crons toegestaan
- Wiki PDF parser: class-aware HTML parser die `extractBlock()` gebruikt met nesting-counting — nog niet 100% getest voor alle skill-categorieën (na Agent Team)
- Sidebar: "Overig" sectie bevat alle minder-gebruikte features (collapsed by default)

## Huidige staat
- Branch: `feat/kilometerregistratie-2` (actieve feature branch)
- Main: up to date, deployed naar Vercel
- `vercel.json` op feature branch heeft nog `*/5` cron — moet gefixt worden bij merge
- Dev server: oud process (pid 44477) hangt op port 3000, gebruik port 3001

## Volgende stappen
1. Fix `vercel.json` op feature branch (*/5 → dagelijks)
2. Bouw Feature 1: taken filter + conflict-preventie
3. Bouw Feature 2: auto tijdregistratie
4. Test wiki PDF op productie — check of skill cards voor alle categorieën renderen
