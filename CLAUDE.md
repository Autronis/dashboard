# Autronis Dashboard

## Project Overview

Intern business dashboard voor **Autronis**, een 2-persoons bedrijf (Sem en Syb). Gebouwd als fullstack Next.js applicatie met een donker thema en teal accent kleuren. Alle labels, API responses en UI teksten zijn in het **Nederlands**.

## Tech Stack

- **Framework**: Next.js 16.1.6, React 19, App Router, Turbopack
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode)
- **Auth**: iron-session (cookie-based), bcrypt voor wachtwoorden, rate limiting op login
- **Styling**: Tailwind CSS v4 met custom CSS variabelen (`autronis-*` tokens)
- **State Management**: Zustand (timer, toast, sidebar stores in `src/hooks/`)
- **PDF**: @react-pdf/renderer (server-side generatie)
- **E-mail**: Resend API (RESEND_API_KEY env var)
- **Icons**: lucide-react
- **PWA**: manifest.json + icons

## Kleuren & Design

### Kleurenpalet (donker thema = standaard)
- Achtergrond: `#0E1719` (`autronis-bg`)
- Card: `#192225` (`autronis-card`)
- Border: `#2A3538` (`autronis-border`)
- Accent: `#17B8A5` (`autronis-accent`)
- Accent hover: `#4DC9B4` (`autronis-accent-hover`)
- Tekst primair: `#E8ECED` (`autronis-text-primary`)
- Tekst secundair: `#8A9BA0` (`autronis-text-secondary`)

### Design Principes
- Ruime, grote UI elementen (p-6, p-7, p-8 padding)
- Kaarten met `rounded-2xl` en `card-glow` hover effect
- Status badges als `rounded-full` pills met semi-transparante achtergrond
- `tabular-nums` op alle bedragen en cijfers
- `transition-colors` op alle interactieve elementen
- Consistente loading spinner: `border-t-autronis-accent animate-spin`
- Geen externe chart libraries — pure CSS bar charts

## Projectstructuur

```
src/
├── app/
│   ├── (dashboard)/           # Route group — beveiligd via layout.tsx
│   │   ├── layout.tsx         # Auth check + AppShell wrapper
│   │   ├── page.tsx           # Dashboard homepage
│   │   ├── agenda/
│   │   ├── analytics/
│   │   ├── crm/
│   │   ├── financien/
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx        # Factuur detail
│   │   │   │   └── bewerken/
│   │   │   └── nieuw/
│   │   ├── instellingen/
│   │   ├── klanten/
│   │   │   └── [id]/
│   │   │       └── projecten/[projectId]/
│   │   ├── taken/
│   │   └── tijdregistratie/
│   ├── api/                   # API routes (alle requireAuth())
│   │   ├── agenda/
│   │   ├── analytics/
│   │   ├── auth/ (login, logout)
│   │   ├── dashboard/
│   │   ├── documenten/
│   │   ├── facturen/ (CRUD, pdf, betaald, verstuur)
│   │   ├── instellingen/
│   │   ├── klanten/
│   │   ├── leads/
│   │   ├── notities/
│   │   ├── profiel/
│   │   ├── projecten/
│   │   ├── seed/
│   │   ├── taken/
│   │   └── tijdregistraties/
│   └── login/
├── components/
│   ├── layout/ (app-shell, header, sidebar, theme-toggle, waves-background)
│   ├── shared/ (placeholder-page)
│   └── ui/ (confirm-dialog, form-field, modal, toast)
├── hooks/ (use-timer, use-toast, use-sidebar — Zustand stores)
├── lib/
│   ├── auth.ts          # Session config, requireAuth(), rate limiter
│   ├── db/
│   │   ├── index.ts     # Drizzle DB instance
│   │   └── schema.ts    # 15 tabellen (alle Nederlands)
│   ├── factuur-pdf.tsx  # PDF template component
│   └── utils.ts         # cn(), formatBedrag(), formatDatum()
├── proxy.ts             # Middleware — auth check op alle routes
└── types/               # Gedeelde TypeScript types
```

## Database Schema (SQLite)

15 tabellen, alle kolomnamen in Nederlands:
- `gebruikers` — id, naam, email, wachtwoord_hash, rol (admin/gebruiker), uurtarief_standaard, thema_voorkeur
- `klanten` — bedrijfsnaam, contactpersoon, email, telefoon, adres, uurtarief, is_actief (soft delete)
- `projecten` — naam, klant_id, status (actief/afgerond/gepauzeerd), deadline, voortgang_percentage, is_actief
- `tijdregistraties` — gebruiker_id, project_id, start_tijd, eind_tijd, duur_minuten, omschrijving
- `taken` — project_id, titel, status (open/bezig/afgerond), prioriteit (laag/normaal/hoog), deadline, toegewezen_aan
- `facturen` — klant_id, factuurnummer (AUT-YYYY-NNN), status (concept/verzonden/betaald), bedrag_excl_btw, btw, bedrag_incl_btw, factuurdatum, vervaldatum, betaald_op
- `factuur_regels` — factuur_id, omschrijving, aantal, eenheidsprijs, btw_percentage, totaal
- `leads` — bedrijfsnaam, status (nieuw/contact/offerte/gewonnen/verloren), waarde, volgende_actie, is_actief
- `agenda_items` — titel, type (afspraak/deadline/belasting/herinnering), start_datum, eind_datum, hele_dag
- `bedrijfsinstellingen` — bedrijfsnaam, adres, kvk, btw_nummer, iban, email, standaard_btw, betalingstermijn
- `notities`, `documenten`, + meer

## Patronen & Conventies

### API Routes
- Alle routes gebruiken `requireAuth()` (behalve login, seed, public assets)
- Error responses: `{ fout: "message" }` (Nederlands)
- Success responses: `{ [entity]: data }` of `{ succes: true }`
- Soft delete via `is_actief` flag (klanten, leads, projecten)
- Hard delete voor taken, agenda items, factuurregels

### Frontend
- Alle pagina's zijn `"use client"` met `useCallback` + `useEffect` data fetching
- Toast notificaties via `useToast()` hook: `addToast("message", "succes" | "fout")`
- Modals voor CRUD operaties (niet aparte pagina's, behalve facturen)
- ConfirmDialog voor destructieve acties
- Loading state: spinner component, consistent op alle pagina's

### Factuurnummer Format
`AUT-YYYY-NNN` — auto-gegenereerd, jaar-gebaseerde sequence

### Timer
- Zustand store (`useTimer`) + localStorage voor persistentie
- Gedeeld tussen dashboard en tijdregistratie pagina
- Start/stop creëert automatisch tijdregistratie record

## Gebruikersvoorkeuren (Sem)

- Communiceert in het **Nederlands**, geeft korte antwoorden
- Wil dat ik zelf technische beslissingen neem ("wat volgens jou het beste is")
- Houdt van **ruime, grote UI** elementen
- Wil geen toestemming gevraagd worden voor bestandswijzigingen of commando's — gewoon uitvoeren
- Apprecieert snelle iteratie: bouw → check → volgende
- Geeft voorkeur aan alles in één keer bouwen (API + pagina + TS check)

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npx tsc --noEmit     # TypeScript check (altijd runnen na wijzigingen)
```

## Environment Variables

```
SESSION_SECRET=...        # iron-session secret (min 32 chars)
RESEND_API_KEY=...        # Voor factuur e-mail versturen
```

## Huidige Status

Alle sidebar-pagina's zijn volledig functioneel (geen placeholders meer):
- Dashboard, Tijdregistratie, Klanten, Financiën, Analytics, CRM/Leads, Agenda, Taken, Instellingen

De `bedrijfsinstellingen` tabel moet nog gevuld worden met echte Autronis bedrijfsgegevens (KvK, BTW, IBAN etc.) via de Instellingen pagina.
