# Kilometers Uitbreiding — Design Spec

**Datum:** 2026-03-27
**Status:** Approved
**Pagina:** `/app/(dashboard)/kilometers/`

## Overzicht

Uitbreiding van de bestaande kilometerregistratie met vier nieuwe features:
1. Km-stand registratie per maand
2. Privé/zakelijk ratio met donut chart
3. Belastingrapport PDF export
4. Terugkerende ritten (automatisch boeken)
5. Revolut brandstof koppeling (future-ready)

## 1. Database Schema

### 1.1 Nieuwe tabel: `km_standen`

Maandelijkse km-stand registratie voor sluitende administratie.

```sql
CREATE TABLE km_standen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
  jaar INTEGER NOT NULL,
  maand INTEGER NOT NULL,
  begin_stand REAL NOT NULL,
  eind_stand REAL NOT NULL,
  aangemaakt_op TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gebruiker_id, jaar, maand)
);
```

**Validatieregels:**
- `eindStand > beginStand`
- `beginStand` van maand X moet gelijk zijn aan `eindStand` van maand X-1 (als die bestaat)
- Beide waarden moeten ≥ 0 zijn

### 1.2 Nieuwe tabel: `terugkerende_ritten`

Templates voor ritten die automatisch geboekt worden.

```sql
CREATE TABLE terugkerende_ritten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
  naam TEXT NOT NULL,
  van_locatie TEXT NOT NULL,
  naar_locatie TEXT NOT NULL,
  kilometers REAL NOT NULL,
  is_retour INTEGER DEFAULT 0,
  doel_type TEXT,
  klant_id INTEGER REFERENCES klanten(id),
  project_id INTEGER REFERENCES projecten(id),
  frequentie TEXT NOT NULL, -- 'dagelijks' | 'wekelijks' | 'maandelijks'
  dag_van_week INTEGER,     -- 0-6 (ma-zo), voor wekelijks
  dag_van_maand INTEGER,    -- 1-31, voor maandelijks
  start_datum TEXT NOT NULL,
  eind_datum TEXT,           -- null = oneindig
  is_actief INTEGER DEFAULT 1,
  laatste_generatie TEXT,    -- laatste datum waarop ritten zijn aangemaakt
  aangemaakt_op TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Frequentie logica:**
- `dagelijks`: elke werkdag (ma-vr)
- `wekelijks`: op `dagVanWeek` (0=maandag, 6=zondag)
- `maandelijks`: op `dagVanMaand` (1-31, clamped aan maandlengte)

### 1.3 Nieuwe tabel: `auto_instellingen`

Per-gebruiker instellingen voor de kilometermodule.

```sql
CREATE TABLE auto_instellingen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id) UNIQUE,
  zakelijk_percentage REAL DEFAULT 75.0,
  tarief_per_km REAL DEFAULT 0.23,
  bijgewerkt_op TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 1.4 Nieuwe tabel: `brandstof_kosten`

Brandstofkosten, handmatig of automatisch via Revolut.

```sql
CREATE TABLE brandstof_kosten (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
  datum TEXT NOT NULL,
  bedrag REAL NOT NULL,
  liters REAL,
  km_stand REAL,
  bank_transactie_id INTEGER REFERENCES bank_transacties(id),
  notitie TEXT,
  aangemaakt_op TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 1.5 Uitbreiding `kilometer_registraties`

Nieuw veld om te markeren dat een rit automatisch is aangemaakt:

```
terugkerende_rit_id INTEGER REFERENCES terugkerende_ritten(id)
```

## 2. API Routes

### 2.1 `/api/kilometers/km-stand` — GET/POST

**GET** `?jaar=2026`
```typescript
// Response
{
  standen: Array<{
    id: number;
    maand: number;
    jaar: number;
    beginStand: number;
    eindStand: number;
    totaalKm: number; // berekend: eindStand - beginStand
  }>;
  huidigeStand: number | null; // laatste eindStand
}
```

**POST**
```typescript
// Request
{ jaar: number; maand: number; beginStand: number; eindStand: number }

// Validatie:
// - eindStand > beginStand
// - beginStand === vorige maand eindStand (als die bestaat)
// - Upsert: als er al een record is voor deze maand, update het

// Response
{ stand: KmStand } | { fout: "Eindstand moet hoger zijn dan beginstand" }
```

### 2.2 `/api/kilometers/instellingen` — GET/PUT

**GET**
```typescript
// Response (maakt default record aan als die niet bestaat)
{
  instellingen: {
    zakelijkPercentage: number; // 0-100
    tariefPerKm: number;
  }
}
```

**PUT**
```typescript
// Request
{ zakelijkPercentage?: number; tariefPerKm?: number }

// Validatie: zakelijkPercentage 0-100, tariefPerKm >= 0
// Response
{ instellingen: AutoInstellingen }
```

### 2.3 `/api/kilometers/terugkerend` — GET/POST/PUT/DELETE

**GET**
```typescript
// Response
{
  ritten: Array<{
    id: number;
    naam: string;
    vanLocatie: string;
    naarLocatie: string;
    kilometers: number;
    isRetour: boolean;
    doelType: string | null;
    klantId: number | null;
    klantNaam: string | null;
    projectId: number | null;
    frequentie: 'dagelijks' | 'wekelijks' | 'maandelijks';
    dagVanWeek: number | null;
    dagVanMaand: number | null;
    startDatum: string;
    eindDatum: string | null;
    isActief: boolean;
    laatsteGeneratie: string | null;
  }>
}
```

**POST** — Nieuwe terugkerende rit
```typescript
// Request
{
  naam: string;
  vanLocatie: string;
  naarLocatie: string;
  kilometers: number;
  isRetour?: boolean;
  doelType?: string;
  klantId?: number;
  projectId?: number;
  frequentie: 'dagelijks' | 'wekelijks' | 'maandelijks';
  dagVanWeek?: number;    // verplicht bij wekelijks
  dagVanMaand?: number;   // verplicht bij maandelijks
  startDatum: string;
  eindDatum?: string;
}
```

**PUT** `?id=X` — Bewerk terugkerende rit (zelfde body als POST)

**DELETE** `?id=X` — Verwijder terugkerende rit

### 2.4 `/api/kilometers/terugkerend/genereer` — POST

Genereert achterstallige ritten. Wordt aangeroepen bij page load.

```typescript
// Request (geen body nodig, gebruikt session user)
// Logica:
// 1. Haal alle actieve terugkerende ritten op voor de gebruiker
// 2. Per rit: bepaal welke datums er sinds `laatsteGeneratie` gegenereerd moeten worden
// 3. Filter: skip datums in de toekomst, skip datums voor startDatum, skip datums na eindDatum
// 4. Maak kilometerRegistraties aan met terugkerendeRitId reference
// 5. Update laatsteGeneratie naar vandaag
// Response
{ aangemaakt: number } // aantal nieuwe ritten
```

**Generatie-algoritme:**
- `dagelijks`: elke werkdag (ma-vr) tussen laatsteGeneratie+1 en vandaag
- `wekelijks`: elke week op dagVanWeek tussen laatsteGeneratie+1 en vandaag
- `maandelijks`: elke maand op dagVanMaand tussen laatsteGeneratie+1 en vandaag
- Deduplicatie: check of er al een rit bestaat met dezelfde terugkerendeRitId + datum

### 2.5 `/api/kilometers/belastingrapport` — GET

**GET** `?jaar=2026`
```typescript
// Verzamelt alle data en genereert PDF:
// 1. Alle ritten van het jaar, gegroepeerd per maand
// 2. Km-standen per maand
// 3. Auto-instellingen (zakelijk %, tarief)
// 4. Berekeningen: totaal km, zakelijk km, aftrekbaar bedrag
// 5. Samenvatting per doelType categorie

// Response: application/pdf binary
// Content-Disposition: attachment; filename="belastingrapport-kilometers-2026.pdf"
```

### 2.6 `/api/kilometers/brandstof` — GET/POST/DELETE

**GET** `?jaar=2026`
```typescript
{
  kosten: Array<{
    id: number;
    datum: string;
    bedrag: number;
    liters: number | null;
    kmStand: number | null;
    notitie: string | null;
    bankTransactieId: number | null;
    isAutomatisch: boolean; // true als bankTransactieId != null
  }>;
  totaalBedrag: number;
  gemiddeldPerMaand: number;
}
```

**POST** — Handmatig brandstofkost toevoegen
```typescript
{ datum: string; bedrag: number; liters?: number; kmStand?: number; notitie?: string }
```

**DELETE** `?id=X`

### 2.7 Revolut Webhook Uitbreiding

In de bestaande webhook handler voor Revolut transacties, toevoegen:

```typescript
// Na ontvangst van een transactie:
if (transactie.merchantCategorie === '5541' || transactie.merchantCategorie === '5542') {
  // Automatisch brandstofkost aanmaken
  await db.insert(brandstofKosten).values({
    gebruikerId: userId, // bepaal op basis van Revolut account
    datum: transactie.datum,
    bedrag: Math.abs(transactie.bedrag),
    bankTransactieId: transactie.id,
    notitie: `Auto: ${transactie.merchantNaam || 'Tankstation'}`,
  });
}
```

MCC codes:
- `5541` = Service Stations (met automobielbijproducten)
- `5542` = Automated Fuel Dispensers

## 3. UI Componenten

### 3.1 KmStandPanel

**Locatie:** `src/app/(dashboard)/kilometers/components/KmStandPanel.tsx`
**Positie:** Boven de maand-navigatie, uitklapbaar paneel (vergelijkbaar met jaaroverzicht).

**UI:**
- Toggle knop in de header: "Km-stand" met Gauge icon
- Uitgeklapt: kaart met twee inputvelden naast elkaar
  - "Beginstand" (number input, pre-filled als vorige maand eindstand bestaat)
  - "Eindstand" (number input)
- Onder de inputs:
  - "Totaal gereden: X km" (berekend)
  - "Geregistreerde zakelijke ritten: Y km" (uit rittenData)
  - "Verschil: Z km privé" (totaal - zakelijk)
- Validatiefout inline (rood, onder het betreffende veld)
- Opslaan knop (of auto-save bij blur)

**States:**
- Geen data: toon lege velden met placeholder
- Vorige maand beschikbaar: pre-fill beginstand
- Validatiefout: rode border + foutmelding

### 3.2 DonutChart (Privé/Zakelijk)

**Locatie:** `src/app/(dashboard)/kilometers/components/DonutChart.tsx`
**Positie:** Als extra KPI kaart in de rij, of als onderdeel van het jaaroverzicht.

**UI:**
- SVG donut chart (geen externe library)
- Twee segmenten: teal (zakelijk), grijs (privé)
- Percentage in het midden (groot getal + label)
- Onder de chart: "Zakelijk: X km (€Y aftrekbaar)" en "Privé: Z km"
- Klik op percentage opent een popover om het percentage aan te passen (slider of number input)

**Berekening:**
- Als km-stand beschikbaar: zakelijk% van (eindStand - beginStand) = zakelijke km
- Als geen km-stand: alleen geregistreerde ritten tonen (geen ratio)
- Aftrekbaar: zakelijke km × tariefPerKm

### 3.3 TerugkerendeRittenModal

**Locatie:** `src/app/(dashboard)/kilometers/components/TerugkerendeRittenModal.tsx`
**Positie:** Bereikbaar via knop in header ("Terugkerend" met Repeat icon).

**UI - Lijst:**
- Lijst van actieve terugkerende ritten
- Per rit: naam, van→naar, km, frequentie badge, volgende datum
- Aan/uit toggle per rit
- Edit/Delete knoppen (hover reveal)

**UI - Formulier (in modal):**
- Naam
- Van/Naar locatie
- Kilometers + retour toggle
- Frequentie: radio buttons (dagelijks/wekelijks/maandelijks)
  - Wekelijks: dag van de week dropdown (ma-zo)
  - Maandelijks: dag van de maand number input (1-31)
- Startdatum (date input, default vandaag)
- Einddatum (optioneel)
- DoelType dropdown
- Klant/Project dropdowns

**Page load generatie:**
- Bij mount van de pagina: `POST /api/kilometers/terugkerend/genereer`
- Als `aangemaakt > 0`: toast "X terugkerende ritten toegevoegd" + invalidate queries

### 3.4 BelastingrapportKnop

**Locatie:** `src/app/(dashboard)/kilometers/components/BelastingrapportKnop.tsx`
**Positie:** In de header naast CSV en Kopieer knoppen.

**UI:**
- Knop met FileText icon + "Belastingrapport"
- Loading state tijdens generatie (spinner)
- Downloadt PDF automatisch via blob URL

### 3.5 BelastingrapportPDF

**Locatie:** `src/lib/belastingrapport-pdf.tsx`
**Volgt patroon van:** `factuur-pdf.tsx`

**PDF Structuur:**

**Pagina 1 — Voorblad:**
- Autronis logo
- "Kilometerregistratie {jaar}"
- Gebruikersnaam
- Generatiedatum
- Samenvatting: totaal km, zakelijk %, aftrekbaar bedrag

**Pagina 2+ — Maandoverzichten:**
- Per maand met data:
  - Maandnaam als kop
  - Km-stand: begin → eind (totaal X km)
  - Tabel: datum | van | naar | km | doel | klant | bedrag
  - Subtotaal per maand

**Laatste pagina — Samenvatting:**
- Totaal alle maanden
- Per doelType categorie: aantal ritten, km, bedrag
- Zakelijk percentage
- Totaal aftrekbaar bedrag (€0,23/km × zakelijke km)
- Brandstofkosten totaal (indien beschikbaar)

## 4. React Query Hooks (uitbreiding)

Toevoegen aan `src/hooks/queries/use-kilometers.ts`:

```typescript
// Km-standen
useKmStanden(jaar: number)
useSaveKmStand()

// Instellingen
useAutoInstellingen()
useUpdateAutoInstellingen()

// Terugkerende ritten
useTerugkerendeRitten()
useSaveTerugkerendeRit()
useUpdateTerugkerendeRit()
useDeleteTerugkerendeRit()
useGenereerTerugkerendeRitten()

// Brandstof
useBrandstofKosten(jaar: number)
useSaveBrandstofKost()
useDeleteBrandstofKost()
```

## 5. Wijzigingen aan bestaande pagina

De bestaande `page.tsx` wordt uitgebreid met:

1. **Header:** Twee nieuwe knoppen: "Km-stand" toggle, "Terugkerend" modal, "Belastingrapport" download
2. **Boven maand-navigatie:** `<KmStandPanel>` (uitklapbaar)
3. **KPI sectie:** `<DonutChart>` als 5e kaart toevoegen
4. **Page load effect:** `useEffect` die `genereerTerugkerendeRitten` aanroept bij mount
5. **Import** van de nieuwe componenten

De bestaande code wordt niet gewijzigd, alleen uitgebreid.

## 6. Bestandsoverzicht

```
Nieuw:
├── src/lib/db/schema.ts                              (uitbreiden: 4 tabellen + 1 veld)
├── src/app/api/kilometers/km-stand/route.ts
├── src/app/api/kilometers/instellingen/route.ts
├── src/app/api/kilometers/terugkerend/route.ts
├── src/app/api/kilometers/terugkerend/genereer/route.ts
├── src/app/api/kilometers/belastingrapport/route.ts
├── src/app/api/kilometers/brandstof/route.ts
├── src/app/(dashboard)/kilometers/components/KmStandPanel.tsx
├── src/app/(dashboard)/kilometers/components/DonutChart.tsx
├── src/app/(dashboard)/kilometers/components/TerugkerendeRittenModal.tsx
├── src/app/(dashboard)/kilometers/components/BelastingrapportKnop.tsx
├── src/lib/belastingrapport-pdf.tsx
├── src/hooks/queries/use-kilometers.ts                (uitbreiden)

Wijzigen:
├── src/app/(dashboard)/kilometers/page.tsx            (nieuwe knoppen + imports + useEffect)
├── src/app/api/revolut/webhook/route.ts               (brandstof auto-detect, indien bestaat)
```
