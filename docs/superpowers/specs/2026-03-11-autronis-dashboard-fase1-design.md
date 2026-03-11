# Autronis Business Dashboard — Fase 1: Fundament

## Overzicht

Een volledig Nederlandstalig business dashboard voor Autronis (AI Automation & Workflow Automation bedrijf), gebruikt door 2 compagnons. Gebouwd als Next.js monoliet met SQLite database, ontworpen om later eenvoudig te deployen naar een server.

### Fasen Overzicht

| Fase | Naam | Omschrijving |
|------|------|-------------|
| **1** | **Fundament** | Projectstructuur, database, auth, layout, navigatie, thema, PWA |
| 2 | Core Business | Klanten, projecten, tijdregistratie (basis + pomodoro + idle + tijdlijn) |
| 3 | Financiën | Facturen, inkomsten/uitgaven, BTW, terugkerende facturen, doelen |
| 4 | Dashboard & Analytics | KPI's, grafieken, winstgevendheid, rankings, export |
| 5 | CRM & Samenwerking | Leads, offertes, taken, documentbeheer, comments |
| 6 | AI & Integraties | AI features, agenda, webhooks, API docs, push notificaties |

---

## Tech Stack

- **Framework:** Next.js 14+ (App Router, Server Components)
- **Styling:** Tailwind CSS + shadcn/ui componenten
- **Database:** SQLite via better-sqlite3
- **ORM:** Drizzle ORM
- **Auth:** iron-session (encrypted cookies)
- **Wachtwoorden:** bcrypt
- **Iconen:** Lucide React
- **Thema:** next-themes
- **PWA:** @serwist/next (maintained fork van next-pwa)
- **Taal:** TypeScript

### Conventies

- **Timestamps:** Alle tijden opgeslagen als UTC in ISO 8601 formaat: `YYYY-MM-DDTHH:mm:ssZ`
- **Geldbedragen:** Opgeslagen als REAL, altijd afronden op 2 decimalen vóór opslag
- **Berekende velden:** `werkelijke_uren` (projecten) en `huidige_waarde` (doelen) worden berekend via queries, niet opgeslagen — de kolommen dienen als cache en worden herberekend bij elke read
- **Soft-delete:** Business entiteiten (klanten, projecten, facturen, leads) krijgen een `is_actief` vlag. Verwijderen = `is_actief = 0`, niet hard delete. Dit behoudt audit trail integriteit
- **Foreign keys ON DELETE:** RESTRICT als standaard (voorkom verwijderen van records met afhankelijkheden), CASCADE alleen voor factuur_regels → facturen
- **Database scope:** Alle tabellen worden aangemaakt in Fase 1 zodat de database "future-ready" is. Migraties via Drizzle voor schema-wijzigingen in latere fasen

---

## Projectstructuur

```
C:\Users\semmi\autronis-dashboard\
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout (navigatie, thema)
│   │   ├── page.tsx                # Dashboard hoofdpagina (placeholder)
│   │   ├── login/page.tsx          # Login pagina
│   │   ├── api/                    # API routes
│   │   │   ├── auth/               # Login/logout/sessie endpoints
│   │   │   ├── gebruikers/         # Gebruiker endpoints
│   │   │   └── seed/               # Database seeden (dev)
│   │   ├── tijdregistratie/        # (placeholder voor fase 2)
│   │   ├── klanten/                # (placeholder voor fase 2)
│   │   ├── financien/              # (placeholder voor fase 3)
│   │   ├── analytics/              # (placeholder voor fase 4)
│   │   ├── crm/                    # (placeholder voor fase 5)
│   │   └── instellingen/           # Instellingen pagina
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                     # Herbruikbare UI componenten (shadcn/ui)
│   │   ├── layout/                 # Sidebar, Header, ThemeToggle
│   │   └── shared/                 # Gedeelde componenten (DataTable, StatusBadge)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts            # SQLite connectie via Drizzle
│   │   │   ├── schema.ts           # Alle database tabellen
│   │   │   └── seed.ts             # Seed data (2 gebruikers + testdata)
│   │   ├── auth.ts                 # Sessie/auth logica
│   │   └── utils.ts                # Helpers (formatDatum, formatBedrag, etc.)
│   ├── hooks/                      # Custom React hooks
│   └── types/                      # TypeScript types
├── public/
│   ├── manifest.json               # PWA manifest
│   └── icons/                      # App iconen (192x192, 512x512)
├── drizzle/                        # Database migraties
├── backups/                        # Dagelijkse DB backups (lokaal)
├── package.json
├── tailwind.config.ts
├── drizzle.config.ts
└── README.md
```

---

## Database Schema

### gebruikers
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| naam | TEXT NOT NULL | Volledige naam |
| email | TEXT UNIQUE NOT NULL | Login email |
| wachtwoord_hash | TEXT NOT NULL | bcrypt hash |
| rol | TEXT DEFAULT 'gebruiker' | admin / gebruiker |
| uurtarief_standaard | REAL | Standaard uurtarief |
| thema_voorkeur | TEXT DEFAULT 'donker' | donker / licht |
| twee_factor_geheim | TEXT | TOTP secret (voorbereid) |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### klanten
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| bedrijfsnaam | TEXT NOT NULL | Naam bedrijf |
| contactpersoon | TEXT | Naam contactpersoon |
| email | TEXT | Email adres |
| telefoon | TEXT | Telefoonnummer |
| adres | TEXT | Volledig adres |
| uurtarief | REAL | Klant-specifiek uurtarief |
| notities | TEXT | Vrije notities |
| is_actief | INTEGER DEFAULT 1 | Soft-delete vlag |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### projecten
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| klant_id | INTEGER FK | → klanten.id |
| naam | TEXT NOT NULL | Projectnaam |
| omschrijving | TEXT | Beschrijving |
| status | TEXT DEFAULT 'actief' | actief / afgerond / on-hold |
| voortgang_percentage | INTEGER DEFAULT 0 | 0-100 |
| deadline | TEXT | Deadline datum |
| geschatte_uren | REAL | Geschatte uren |
| werkelijke_uren | REAL DEFAULT 0 | Cache — herberekend via query op tijdregistraties |
| is_actief | INTEGER DEFAULT 1 | Soft-delete vlag |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### tijdregistraties
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| gebruiker_id | INTEGER FK | → gebruikers.id |
| project_id | INTEGER FK | → projecten.id |
| omschrijving | TEXT | Wat heb je gedaan |
| start_tijd | TEXT NOT NULL | ISO timestamp |
| eind_tijd | TEXT | ISO timestamp (null = lopend) |
| duur_minuten | INTEGER | Berekende duur |
| categorie | TEXT DEFAULT 'development' | development / meeting / administratie / overig |
| is_handmatig | INTEGER DEFAULT 0 | Boolean |
| aangemaakt_op | TEXT | ISO timestamp |

### facturen
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| klant_id | INTEGER FK | → klanten.id |
| project_id | INTEGER FK | → projecten.id (optioneel) |
| factuurnummer | TEXT UNIQUE NOT NULL | Bijv. AUT-2026-001 |
| status | TEXT DEFAULT 'concept' | concept / verzonden / betaald / te_laat |
| bedrag_excl_btw | REAL NOT NULL | Bedrag zonder BTW |
| btw_percentage | REAL DEFAULT 21 | BTW percentage |
| btw_bedrag | REAL | Berekend BTW bedrag |
| bedrag_incl_btw | REAL | Totaal inclusief BTW |
| factuurdatum | TEXT | Datum factuur |
| vervaldatum | TEXT | Betaal deadline |
| betaald_op | TEXT | Datum betaling |
| is_terugkerend | INTEGER DEFAULT 0 | Boolean |
| terugkeer_interval | TEXT | wekelijks / maandelijks |
| notities | TEXT | Opmerkingen |
| is_actief | INTEGER DEFAULT 1 | Soft-delete vlag |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

> **Noot:** `bedrag_excl_btw`, `btw_bedrag` en `bedrag_incl_btw` worden altijd herberekend vanuit `factuur_regels`. Het `btw_percentage` op factuurniveau is een standaard voor nieuwe regels.

### factuur_regels
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| factuur_id | INTEGER FK | → facturen.id |
| omschrijving | TEXT NOT NULL | Regel omschrijving |
| aantal | REAL NOT NULL | Aantal uren/stuks |
| eenheidsprijs | REAL NOT NULL | Prijs per eenheid |
| btw_percentage | REAL DEFAULT 21 | BTW percentage |
| totaal | REAL | Berekend totaal |

### inkomsten
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| factuur_id | INTEGER FK | → facturen.id (optioneel) |
| klant_id | INTEGER FK | → klanten.id (optioneel) |
| omschrijving | TEXT NOT NULL | Beschrijving |
| bedrag | REAL NOT NULL | Bedrag |
| datum | TEXT NOT NULL | Datum |
| categorie | TEXT | Categorie |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### uitgaven
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| omschrijving | TEXT NOT NULL | Beschrijving |
| bedrag | REAL NOT NULL | Bedrag |
| datum | TEXT NOT NULL | Datum |
| categorie | TEXT DEFAULT 'overig' | software / hardware / kantoor / reis / overig |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### doelen
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| gebruiker_id | INTEGER FK | → gebruikers.id (optioneel, null = bedrijfsbreed) |
| type | TEXT NOT NULL | omzet / uren |
| maand | INTEGER NOT NULL | 1-12 |
| jaar | INTEGER NOT NULL | Bijv. 2026 |
| doelwaarde | REAL NOT NULL | Target |
| huidige_waarde | REAL DEFAULT 0 | Cache — herberekend via query |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

> **Noot:** UNIQUE constraint op `(gebruiker_id, type, maand, jaar)` om duplicaten te voorkomen.

### leads
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| bedrijfsnaam | TEXT NOT NULL | Naam bedrijf |
| contactpersoon | TEXT | Naam contact |
| email | TEXT | Email |
| telefoon | TEXT | Telefoon |
| waarde | REAL | Geschatte waarde |
| status | TEXT DEFAULT 'nieuw' | nieuw / contact / offerte / gewonnen / verloren |
| bron | TEXT | Hoe binnengekomen |
| notities | TEXT | Vrije notities |
| volgende_actie | TEXT | Wat moet er gebeuren |
| volgende_actie_datum | TEXT | Wanneer |
| is_actief | INTEGER DEFAULT 1 | Soft-delete vlag |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### agenda_items
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| gebruiker_id | INTEGER FK | → gebruikers.id |
| titel | TEXT NOT NULL | Titel |
| omschrijving | TEXT | Details |
| type | TEXT DEFAULT 'afspraak' | afspraak / deadline / belasting / herinnering |
| start_datum | TEXT NOT NULL | Start datum/tijd |
| eind_datum | TEXT | Eind datum/tijd |
| hele_dag | INTEGER DEFAULT 0 | Boolean |
| herinnering_minuten | INTEGER | Minuten voor start |
| aangemaakt_op | TEXT | ISO timestamp |

### taken
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| project_id | INTEGER FK | → projecten.id (optioneel) |
| toegewezen_aan | INTEGER FK | → gebruikers.id |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| titel | TEXT NOT NULL | Taak titel |
| omschrijving | TEXT | Details |
| status | TEXT DEFAULT 'open' | open / bezig / afgerond |
| deadline | TEXT | Deadline |
| prioriteit | TEXT DEFAULT 'normaal' | laag / normaal / hoog |
| aangemaakt_op | TEXT | ISO timestamp |
| bijgewerkt_op | TEXT | ISO timestamp |

### notities
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| gebruiker_id | INTEGER FK | → gebruikers.id |
| klant_id | INTEGER FK | (optioneel) |
| project_id | INTEGER FK | (optioneel) |
| lead_id | INTEGER FK | (optioneel) |
| inhoud | TEXT NOT NULL | Notitie tekst |
| aangemaakt_op | TEXT | ISO timestamp |

### documenten
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| klant_id | INTEGER FK | (optioneel) |
| project_id | INTEGER FK | (optioneel) |
| lead_id | INTEGER FK | (optioneel) |
| naam | TEXT NOT NULL | Bestandsnaam |
| bestandspad | TEXT NOT NULL | Pad op disk |
| type | TEXT DEFAULT 'overig' | contract / offerte / overig |
| versie | INTEGER DEFAULT 1 | Versienummer |
| aangemaakt_door | INTEGER FK | → gebruikers.id |
| aangemaakt_op | TEXT | ISO timestamp |

### audit_log
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Auto increment |
| gebruiker_id | INTEGER FK | → gebruikers.id |
| actie | TEXT NOT NULL | aangemaakt / bijgewerkt / verwijderd |
| entiteit_type | TEXT NOT NULL | klant / project / factuur / etc. |
| entiteit_id | INTEGER | ID van het gewijzigde record |
| oude_waarde | TEXT | JSON van oude waarden |
| nieuwe_waarde | TEXT | JSON van nieuwe waarden |
| ip_adres | TEXT | IP adres |
| aangemaakt_op | TEXT | ISO timestamp |

### bedrijfsinstellingen
| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | INTEGER PK | Altijd 1 (singleton) |
| bedrijfsnaam | TEXT DEFAULT 'Autronis' | Bedrijfsnaam |
| adres | TEXT | Volledig adres |
| kvk_nummer | TEXT | KVK nummer |
| btw_nummer | TEXT | BTW nummer |
| iban | TEXT | Bankrekeningnummer |
| email | TEXT | Bedrijfs email |
| telefoon | TEXT | Bedrijfs telefoon |
| logo_pad | TEXT | Pad naar logo bestand |
| standaard_btw | REAL DEFAULT 21 | Standaard BTW percentage |
| betalingstermijn_dagen | INTEGER DEFAULT 30 | Dagen tot vervaldatum |
| herinnering_na_dagen | INTEGER DEFAULT 7 | Dagen na vervaldatum voor herinnering |

---

## Auth & Sessie Systeem

### Flow
1. Twee gebruikers aangemaakt via seed script
2. Login via email + wachtwoord op `/login`
3. Wachtwoorden gehashed met bcrypt
4. Sessie als encrypted cookie via iron-session
5. Middleware checkt sessie op elke request
6. Niet ingelogd → redirect naar `/login`

### Beveiliging
- Geen zelf-registratie (alleen via seed of admin)
- 2FA kolom voorbereid, activeerbaar in latere fase
- Sessies verlopen na 7 dagen inactiviteit
- Wachtwoord wijzigen via instellingen
- Login attempts gelimiteerd tot 5 per minuut per IP (in-memory counter)

---

## Layout & Navigatie

### Structuur
- **Header:** Autronis logo, zoekbalk (later), notificatie bel (later), gebruiker avatar + naam, thema toggle
- **Sidebar:** Navigatie met iconen, inklapbaar, actieve pagina gemarkeerd
- **Content area:** Pagina inhoud, scrollbaar
- **Mobiel:** Sidebar verborgen achter hamburger menu

### Navigatie Items
1. Dashboard (LayoutDashboard icoon)
2. Tijdregistratie (Clock icoon)
3. Klanten (Users icoon)
4. Financiën (Euro icoon)
5. Analytics (BarChart icoon)
6. CRM / Leads (Target icoon)
7. Agenda (Calendar icoon)
8. Taken (CheckSquare icoon)
9. --- separator ---
10. Instellingen (Settings icoon)

### Responsive Breakpoints
- Desktop (≥1024px): sidebar vast zichtbaar
- Tablet (768-1023px): sidebar ingeklapt (alleen iconen)
- Mobiel (<768px): sidebar verborgen, hamburger menu

---

## Kleurenschema (Autronis Branding)

### Donker thema (standaard)
| Element | Kleur |
|---------|-------|
| Achtergrond | `#0B1A1F` |
| Sidebar / Cards | `#112B34` |
| Accent / primair | `#2DD4A8` |
| Accent hover | `#5EEAD4` |
| Succes | `#22C55E` |
| Waarschuwing | `#F97316` |
| Gevaar | `#EF4444` |
| Tekst primair | `#F1F5F9` |
| Tekst secundair | `#94A3B8` |
| Borders | `#1E3A45` |

### Licht thema
| Element | Kleur |
|---------|-------|
| Achtergrond | `#F0FDFA` |
| Sidebar / Cards | `#FFFFFF` |
| Accent / primair | `#0D9373` |
| Accent hover | `#0F766E` |
| Succes | `#16A34A` |
| Waarschuwing | `#EA580C` |
| Gevaar | `#DC2626` |
| Tekst primair | `#0B1A1F` |
| Tekst secundair | `#64748B` |
| Borders | `#CCFBF1` |

---

## PWA Setup

- `manifest.json` met Autronis naam en turquoise themakleur
- Service worker via next-pwa
- Installeerbaar op telefoon via browser
- Offline fallback pagina
- Push notificaties voorbereid (activeren in fase 6)

---

## Database Backup

- Dagelijks bij eerste login: backup via SQLite `.backup()` API (veilig bij concurrent writes)
- Bestandsnaam: `autronis_backup_YYYY-MM-DD.db`
- Laatste 30 backups bewaren, oudere automatisch verwijderen
- Bij fout: loggen naar console, geen blokkering van de gebruiker

## Bestandsopslag

- Uploads opgeslagen in `uploads/` directory (lokaal)
- Max bestandsgrootte: 10MB
- Toegestane types: PDF, DOCX, PNG, JPG, XLSX
- Naamgeving: `Autronis_[Type]_[KlantNaam]_[Datum].[ext]`

---

## Audit Trail

- Middleware bij elke POST/PUT/DELETE schrijft naar audit_log
- Vastleggen: gebruiker, actie, entiteit, oude/nieuwe waarde, tijdstip
- Bekijkbaar in instellingen (latere fase)

---

## Seed Data

Bij eerste setup worden aangemaakt:
- 2 gebruikers (email + bcrypt wachtwoord)
- Bedrijfsinstellingen pre-filled met "Autronis"
- 3 dummy klanten met elk 1-2 projecten
- Enkele tijdregistraties voor demo

---

## Instellingen Pagina (Fase 1)

- **Bedrijfsgegevens:** naam, KVK, BTW-nr, IBAN, adres, logo
- **Gebruikersprofiel:** wachtwoord wijzigen, thema voorkeur, uurtarief
- **"Wat is nieuw" sectie:** changelog per fase

---

## Wat Fase 1 Oplevert

Na fase 1 kan de gebruiker:
- De app starten en inloggen
- Navigeren door alle pagina's (met placeholders voor latere modules)
- Thema wisselen (donker/licht)
- De app installeren als PWA op telefoon
- Bedrijfsinstellingen configureren
- Database staat klaar voor alle 6 fasen
