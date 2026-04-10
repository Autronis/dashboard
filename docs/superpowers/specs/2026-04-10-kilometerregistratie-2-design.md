# Kilometerregistratie 2.0 — Design Spec

**Datum:** 2026-04-10
**Status:** Approved
**Scope:** 15 features verdeeld over 4 pijlers

## Context

De kilometerregistratie is functioneel compleet voor basis-logging (ritten, terugkerende ritten, brandstof, belastingrapport). Deze upgrade tilt het systeem naar best-in-class door automatisering, slimme features, analytics en mobiele UX toe te voegen.

**Bestaande infra die we benutten:**
- Google APIs (OAuth + Calendar al geconfigureerd, googleapis v171.4.0)
- Revolut webhook (banktransacties auto-import al actief)
- Push notifications (web-push + VAPID keys geconfigureerd)
- Resend email API (al in gebruik voor facturen)
- React-PDF belastingrapport (al operationeel)
- PWA manifest (al geconfigureerd)

---

## Pijler A — Automatisering

### Feature 1: Google Maps Afstandsberekening

**Wat:** Bij invoer van van/naar-locaties wordt de afstand automatisch berekend via Google Directions API.

**Technisch:**
- Nieuw: `src/app/api/kilometers/distance/route.ts` — proxy endpoint naar Google Directions API
- Google Directions API key toevoegen aan env (`GOOGLE_MAPS_API_KEY`)
- Request: `origin` + `destination` als tekst → response: `distance.value` in meters
- Frontend: debounced call (500ms) wanneer zowel van als naar zijn ingevuld
- Km-veld wordt auto-ingevuld maar blijft bewerkbaar (user override)
- Bij retour: toon berekende retour-km (2x) naast het retour-toggle

**Beperkingen:**
- Google Directions API kost $5 per 1000 requests — acceptabel bij ~50-100 ritten/maand
- Fallback bij API-fout: veld blijft leeg, gebruiker vult handmatig in

### Feature 2: Locatie Autocomplete

**Wat:** Twee-brons autocomplete bij het typen van locaties: eigen historie eerst, daarna Google Places.

**Technisch:**
- Nieuwe component: `src/app/(dashboard)/kilometers/components/LocatieAutocomplete.tsx`
- Nieuw API endpoint: `src/app/api/kilometers/locaties/route.ts` — zoekt in bestaande `vanLocatie`/`naarLocatie` waarden
  - Query: fuzzy match (LIKE `%zoekterm%`), gesorteerd op frequentie van gebruik
  - Retourneert: `{ locatie, aantalGebruikt, isGenormaliseerd }`
- Google Places Autocomplete als secondary source (alleen als <3 eigen resultaten)
- Dropdown: eigen locaties bovenaan met gebruiksteller, Google-resultaten eronder met label
- Bij selectie van Google-locatie: sla genormaliseerde naam op voor toekomstig gebruik

**UX:**
- Minimaal 2 karakters voor trigger
- Debounce: 300ms
- Max 4 eigen + 3 Google suggesties

### Feature 3: Automatische Brandstof-Matching (Revolut)

**Wat:** Revolut banktransacties met brandstof-keywords worden automatisch als brandstofkost aangemaakt.

**Technisch:**
- Aanpassing in bestaande Revolut webhook handler (`/api/revolut/webhook`)
- Nieuwe functie: `detectBrandstofTransactie(transactie)` — matcht op merchant keywords:
  - Keywords: `shell`, `bp`, `totalenergies`, `tango`, `tinq`, `esso`, `texaco`, `gulf`, `tamoil`, `argos`
  - Categorie `reiskosten` of MCC codes voor tankstations
- Bij match: auto-insert in `brandstofKosten` met `bankTransactieId` referentie
- Datum + bedrag uit transactie, `isAutomatisch` = true
- Liters en kmStand blijven null (handmatig aan te vullen)

**Safeguard:** Geen duplicaten — check of `bankTransactieId` al bestaat in `brandstofKosten`

### Feature 4: Dagelijkse Cron voor Terugkerende Ritten

**Wat:** Vercel Cron triggert elke ochtend om 07:00 de generatie van terugkerende ritten.

**Technisch:**
- Nieuw: `vercel.json` cron configuratie:
  ```json
  { "crons": [{ "path": "/api/kilometers/terugkerend/genereer", "schedule": "0 7 * * *" }] }
  ```
- Aanpassing `genereer/route.ts`: accepteer cron-calls via `Authorization: Bearer ${CRON_SECRET}`
- Na generatie: push notificatie naar betreffende gebruikers via bestaande `sendPush()` util
  - Bericht: "X ritten automatisch toegevoegd voor vandaag"
- Env: `CRON_SECRET` toevoegen voor Vercel Cron authenticatie

### Feature 5: Google Calendar → Rit-Suggesties

**Wat:** Calendar events met een locatie die nog niet als rit gelogd zijn worden als suggestie getoond.

**Technisch:**
- Nieuw endpoint: `src/app/api/kilometers/suggesties/route.ts`
  - Haalt vandaag's events op via bestaande Google Calendar integratie (`src/lib/google-calendar.ts`)
  - Filtert op events met `location` veld
  - Cross-check met `kilometerRegistraties` van vandaag (zelfde locatie = al gelogd)
  - Optioneel: match locatie met `klanten` tabel voor auto-klantId
  - Berekent afstand via Google Directions API (feature 1)
- Frontend: suggestie-banner bovenaan km-pagina
  - Toon event naam, tijd, locatie, geschatte km
  - Actie: "Toevoegen" (pre-filled form) of "Verbergen" (dismiss, opslaan in sessionStorage)
- Alleen tonen als Google Calendar gekoppeld is (check `googleTokens`)

---

## Pijler B — Slimme Features

### Feature 6: Locatie-Normalisatie

**Wat:** Locatie-aliassen systeem dat varianten (kantoor, Kantoor, office) samenvoegt.

**Technisch:**
- Nieuwe tabel: `locatie_aliassen`
  - `id` INTEGER PK
  - `gebruikerId` INTEGER FK
  - `alias` TEXT (de variant, bijv. "kantoor")
  - `genormaliseerdeNaam` TEXT (de standaardnaam, bijv. "Autronis Kantoor, Eindhoven")
  - `aangemaaktOp` TEXT
  - Unique index op `(gebruikerId, alias)`
- Bij rit-invoer: check of locatie een bekende alias is → vervang door genormaliseerde naam
- Bij autocomplete (feature 2): zoek ook in aliassen
- Eenmalige migratie-script: groepeer bestaande locaties op lowercase + trim, stel meest gebruikte als standaard in, maak aliassen voor de rest
- UI: settings-sectie waar gebruiker aliassen kan beheren (simpele lijst met edit/delete)

### Feature 7: Duplicate Detection

**Wat:** Waarschuwing bij het toevoegen van een rit die lijkt op een bestaande rit van dezelfde dag.

**Technisch:**
- Check in `POST /api/kilometers` voordat de rit wordt opgeslagen:
  - Zoek ritten met zelfde `datum` + zelfde `gebruikerId`
  - Match: `vanLocatie`/`naarLocatie` gelijk (of omgekeerd) EN `kilometers` binnen ±10%
- Bij match: retourneer `{ waarschuwing: "duplicate", bestaandeRit: {...} }` met HTTP 200
- Frontend: toon waarschuwingsmodal met details van de bestaande rit
  - Opties: "Toch toevoegen" (POST met `forceer: true`) of "Annuleren"
- Geen harde blokkade — alleen waarschuwing

### Feature 8: Privé/Zakelijk Split op Werkelijke Data

**Wat:** Bereken het werkelijke zakelijke percentage uit km-standen vs gelogde ritten ipv een vast percentage.

**Technisch:**
- Aanpassing `jaaroverzicht/route.ts`:
  - Haal km-standen op voor het jaar
  - `totaalGereden` = som van (eindStand - beginStand) per maand
  - `totaalZakelijk` = som van alle gelogde ritten-km
  - `werkelijkPercentage` = (totaalZakelijk / totaalGereden) × 100
  - Retourneer `werkelijkPercentage` naast het ingestelde percentage
- Frontend: toon beide percentages in het jaaroverzicht
  - Visuele indicator als ze significant afwijken (>5%)
  - Aanbeveling: "Je werkelijke zakelijk % is 82.4% — overweeg je instelling aan te passen"
- Belastingrapport: gebruik `werkelijkPercentage` als km-standen compleet zijn, anders fallback naar instelling

**Vereiste:** Km-standen moeten voor alle maanden ingevuld zijn voor betrouwbare berekening. Toon waarschuwing als maanden ontbreken.

### Feature 9: Verbeterd Belastingrapport

**Wat:** 4 nieuwe secties in het PDF rapport voor een waterdichte onderbouwing.

**Technisch:**
- Aanpassing `src/lib/belastingrapport-pdf.tsx`:
  1. **Km-stand bewijs sectie:** Tabel met maand, beginStand, eindStand, totaalGereden, gelogdZakelijk, privéKm
  2. **Zakelijk % onderbouwing:** Berekening totaalGereden vs totaalZakelijk met resultaat-percentage
  3. **Brandstofkosten detail:** Per-maand tabel met bedrag, liters, km/liter berekening
  4. **Foto-bijlagen:** Km-stand foto's als afbeeldingen in het rapport (afhankelijk van feature 15)
- Aanpassing `belastingrapport/route.ts`: extra data ophalen (km-standen, brandstof per maand, foto URLs)

---

## Pijler C — Analytics & Rapportage

### Feature 10: Dashboard Widget

**Wat:** Kilometerkaart op de hoofdpagina met maandoverzicht en weekgrafiek.

**Technisch:**
- Nieuwe component: `src/app/(dashboard)/components/KilometerWidget.tsx`
- Nieuw API endpoint: `src/app/api/kilometers/widget/route.ts`
  - Retourneert: `{ km, aftrekbaar, ritten, perWeek: number[], trendVsVorigeMaand: number }`
  - Lichtgewicht query — alleen aggregates, geen individuele ritten
- Widget toont: 3 KPI's (km, aftrekbaar, ritten) + mini bar chart per week + trend-indicator
- Link naar /kilometers pagina
- Plaatsing: op het hoofddashboard naast bestaande widgets

### Feature 11: Goal-Type Analytics

**Wat:** Visualisatie van ritten per doelType, per klant, en trend over tijd.

**Technisch:**
- Nieuwe component: `src/app/(dashboard)/kilometers/components/AnalyticsPanel.tsx`
- Data komt uit bestaande `jaaroverzicht` endpoint (al grouped by klant)
- Nieuwe aggregatie toevoegen aan jaaroverzicht: `perDoelType: { type, km, ritten, bedrag }[]`
- UI elementen:
  - Donut chart: verdeling per doelType (hergebruik/upgrade bestaande `DonutChart.tsx`)
  - Horizontal bar chart: top 5 klanten op km
  - Sparkline: 6-maanden km trend
- Collapsible panel op de km-pagina (standaard ingeklapt om ruimte te sparen)

### Feature 12: Brandstof Analytics

**Wat:** KPI-panel met brandstofkosten, prijs per km, km/liter, en trend.

**Technisch:**
- Nieuwe component: `src/app/(dashboard)/kilometers/components/BrandstofPanel.tsx`
- Data uit bestaande `jaaroverzicht` endpoint (brandstof data is er al)
- Extra berekeningen:
  - `kostenPerKm` = totaalBrandstof / totaalKm (uit km-standen)
  - `kmPerLiter` = totaalKm / totaalLiters (alleen als liters beschikbaar)
  - `trendVsVorigeMaand` = vergelijk huidige maand met vorige
- 4 KPI-kaarten + optionele per-maand bar chart
- Toon alleen als er brandstofdata beschikbaar is

### Feature 13: Maandelijkse Email-Samenvatting

**Wat:** Automatische email op de 1e van elke maand met samenvatting van de vorige maand.

**Technisch:**
- Nieuw endpoint: `src/app/api/kilometers/maandrapport/route.ts`
  - Vercel Cron: `{ "path": "/api/kilometers/maandrapport", "schedule": "0 8 1 * *" }`
  - Haalt data op voor vorige maand: km, ritten, klanten, brandstof, aftrekbaar
  - Detecteert ontbrekende data: km-stand niet ingevuld, weinig ritten vs verwacht
  - Stuurt email via Resend naar alle actieve gebruikers
- Email template: HTML met Autronis branding
  - KPI's: totaal km, aftrekbaar bedrag
  - Highlights: aantal ritten, klanten bezocht, brandstofkosten
  - Waarschuwingen: ontbrekende km-stand, afwijkend rittenpatroon
  - CTA button: "Bekijk in dashboard"

---

## Pijler D — Mobiele UX

### Feature 14: Floating Quick-Entry Button

**Wat:** FAB (floating action button) op mobiel met bottom sheet voor snelle rit-invoer.

**Technisch:**
- Nieuwe component: `src/app/(dashboard)/kilometers/components/MobileQuickEntry.tsx`
- Detectie: toon FAB alleen op schermen <768px (`useMediaQuery` of Tailwind `md:hidden`)
- FAB: fixed positie rechtsonder (bottom: 24px, right: 20px), teal achtergrond, "+" icoon
- Bij tik: bottom sheet (Framer Motion slide-up animatie) met:
  1. **Snelkeuze rij:** horizontaal scrollbare saved routes als chips — 1 tik = direct toevoegen
  2. **Compact formulier:** van (auto-ingevuld met meest gebruikte), naar (autocomplete), km (auto-berekend), type (dropdown)
  3. **Twee submit knoppen:** "Toevoegen" en "↩ + Retour"
- "Van" wordt automatisch ingevuld met de locatie die het vaakst als vertrekpunt is gebruikt
- Bij snelkeuze: POST direct zonder formulier, toast bevestiging

### Feature 15: Km-stand Foto Upload

**Wat:** Foto van kilometerteller uploaden als bewijs bij km-stand invoer.

**Technisch:**
- Nieuwe tabel: `km_stand_fotos`
  - `id` INTEGER PK
  - `kmStandId` INTEGER FK naar `km_standen`
  - `gebruikerId` INTEGER FK
  - `bestandsnaam` TEXT
  - `bestandspad` TEXT (lokaal pad of cloud URL)
  - `aangemaaktOp` TEXT
- Nieuw endpoint: `src/app/api/kilometers/km-stand/foto/route.ts`
  - POST: multipart/form-data upload, max 5MB, alleen JPEG/PNG
  - Opslag: `public/uploads/km-standen/` of cloud storage (S3/Vercel Blob)
  - GET: retourneer foto URL voor een km-stand
  - DELETE: verwijder foto
- Frontend: upload zone in `KmStandPanel.tsx`
  - Drop zone of camera input (`<input type="file" accept="image/*" capture="environment">`)
  - Preview na upload
  - Bestaande foto tonen als al geüpload
- Belastingrapport (feature 9): foto's als bijlage-pagina's in het PDF

**Opslag:** Lokaal `public/uploads/km-standen/` — simpelste oplossing, past bij de bestaande SQLite/file-based architectuur. Migratie naar Vercel Blob kan later als volumes groeien.

---

## Database Wijzigingen

### Nieuwe tabel: `locatie_aliassen`
```sql
CREATE TABLE locatie_aliassen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gebruikerId INTEGER NOT NULL REFERENCES gebruikers(id),
  alias TEXT NOT NULL,
  genormaliseerdeNaam TEXT NOT NULL,
  aangemaaktOp TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(gebruikerId, alias)
);
```

### Nieuwe tabel: `km_stand_fotos`
```sql
CREATE TABLE km_stand_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kmStandId INTEGER NOT NULL REFERENCES km_standen(id),
  gebruikerId INTEGER NOT NULL REFERENCES gebruikers(id),
  bestandsnaam TEXT NOT NULL,
  bestandspad TEXT NOT NULL,
  aangemaaktOp TEXT DEFAULT (datetime('now', 'localtime'))
);
```

### Bestaande tabellen: geen schema-wijzigingen
Alle bestaande kolommen worden hergebruikt. Nieuwe berekeningen (werkelijk zakelijk %, brandstof analytics) zijn query-time aggregaties.

---

## Environment Variables (nieuw)

| Variable | Doel |
|----------|------|
| `GOOGLE_MAPS_API_KEY` | Directions API + Places Autocomplete |
| `CRON_SECRET` | Vercel Cron authenticatie |

Bestaande variabelen blijven ongewijzigd.

---

## Niet in scope

- GPS live tracking / geofencing
- OBD-II / voertuig-telematica integratie
- Multi-auto ondersteuning
- Route-optimalisatie / trip planning
- Brandstofprijs-API integratie
- Native mobile app (blijft PWA)
