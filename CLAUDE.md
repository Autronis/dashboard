# Autronis Dashboard

## Status
- **Status**: In development (alle pagina's functioneel, bedrijfsinstellingen moeten nog gevuld)
- **Deployment platform**: Geen vercel.json gevonden — draait lokaal (Next.js dev server)
- **URL**: Vraag aan Sem

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

## Regels
- Code altijd in het Engels, UI-teksten in het Nederlands
- Nooit `any` in TypeScript
- Nooit `console.log` in productie-code
- Dit is een BESTAAND project — niet opnieuw opzetten
