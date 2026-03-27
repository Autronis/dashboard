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

## Environment Variables
```
SESSION_SECRET=...        # iron-session secret (min 32 chars, vereist)
RESEND_API_KEY=...        # Factuur e-mail versturen
ANTHROPIC_API_KEY=...     # Claude AI
MOLLIE_API_KEY=...        # Betaalintegratie
NEXT_PUBLIC_URL=...       # Publieke URL voor webhooks/links
NOTION_API_KEY=...        # Notion integratie
```

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
