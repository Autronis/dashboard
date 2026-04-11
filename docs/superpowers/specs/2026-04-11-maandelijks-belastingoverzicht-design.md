# Maandelijks Belastingoverzicht — Design Spec

## Doel

Automatisch maandelijks financieel rapport in het dashboard dat zakelijke uitgaven, BTW-berekeningen, Sem/Syb verrekening en borgoverzicht toont. Vervangt het handmatig gegenereerde HTML-rapport (`belasting-overzicht-april-2026.html`).

## Referentie

- HTML voorbeeld: `~/Autronis/belasting-overzicht-april-2026.html`
- Bestaande belasting pagina: `src/app/(dashboard)/belasting/page.tsx`

## Locatie

Eigen pagina op `/belasting/maandrapport`. Bereikbaar via link vanuit `/belasting`. De bestaande `/belasting` pagina (5 tabs) blijft ongewijzigd.

## Pagina-structuur

### Header
- Titel: "Autronis VOF — Maandrapport"
- Subtitel: "Gegenereerd op basis van bankdata"
- Maandselector (◀ April 2026 ▶) met navigatie
- PDF Export knop (teal accent)

### Trendlijn
- Compacte bar chart van de afgelopen 6 maanden
- Toont totale uitgaven per maand
- Huidige maand highlighted met border + bold label
- Geen externe chart library — simpele div-gebaseerde bars

### KPI-kaarten (4 kolommen)
1. **Totaal uitgaven** — som van alle zakelijke uitgaven die maand (wit)
2. **BTW terug** — totaal terug te vragen BTW (groen)
3. **Van Syb te ontvangen** — alleen zichtbaar als er openstaande verrekeningen zijn, anders "Kosten per persoon" (oranje)
4. **Totaal terug** — BTW + openstaande verrekeningen (paars)

### Secties

#### 1. Zakelijke uitgaven tabel
- Kolommen: Datum, Omschrijving, Categorie (badge), Bron (ING/Revolut), Incl. BTW, BTW bedrag, Eigenaar
- Eigenaar-kolom toont badges: "Sem" (teal), "Syb" (blauw), "50/50" of "25/75" (geel)
- Ongetagde transacties: "+ Tag" knop met dashed border, subtiele oranje achtergrond
- Totaalrij onderaan
- Noot-blok voor buitenlandse diensten (geen NL BTW) en borg-uitleg

#### 2. BTW split — Sem vs Syb
- Twee kaarten naast elkaar (split-grid)
- Per persoon: opsplitsing van BTW per bron/type
- Totaal per persoon in groen

#### 3. Verrekening Syb → Sem (optioneel)
- Alleen zichtbaar als er openstaande verrekeningen zijn
- Simpele lijst met checkboxes om items af te vinken als betaald
- Totaal openstaand in oranje
- Verdwijnt zodra alles via de zakelijke rekening loopt

#### 4. Borg kantoor (hardcoded config)
- Tabel met huurders, borgbedrag, huur per maand, status
- Noot: borg is geen kostenpost maar vordering op balans
- Data komt uit een config object, niet uit de DB

#### 5. Samenvatting — totaal terug
- Compacte kaart: BTW terug + openstaande verrekeningen = totaal

### PDF Export
- Hergebruikt `@react-pdf/renderer` patroon uit bestaande `belastingrapport-pdf.tsx`
- Zelfde secties als de pagina
- Generatie via `/api/belasting/maandrapport/pdf?maand=2026-04`

## Datamodel

### Wijzigingen aan bestaande tabellen

**`uitgaven` — 2 nieuwe kolommen:**
```sql
eigenaar TEXT          -- "sem" / "syb" / "gedeeld" / NULL (ongemarkeerd)
splitRatio TEXT        -- "50/50", "25/75", etc. Alleen relevant bij eigenaar = "gedeeld"
```

**`bankTransacties` — 2 nieuwe kolommen:**
```sql
eigenaar TEXT          -- "sem" / "syb" / "gedeeld" / NULL (ongemarkeerd)
splitRatio TEXT        -- "50/50", "25/75", etc.
```

### Nieuwe tabellen

**`verdeelRegels`** — default splits per leverancier of categorie:
```sql
id INTEGER PRIMARY KEY
type TEXT NOT NULL              -- "leverancier" of "categorie"
waarde TEXT NOT NULL            -- bijv. "KVK", "kantoor", "Rinkel"
eigenaar TEXT NOT NULL          -- "sem" / "syb" / "gedeeld"
splitRatio TEXT NOT NULL        -- "50/50", "100/0", "25/75"
```

Voorbeeldregels:
| type | waarde | eigenaar | splitRatio |
|------|--------|----------|------------|
| leverancier | Coolblue | sem | 100/0 |
| leverancier | KVK | gedeeld | 50/50 |
| leverancier | Rinkel | gedeeld | 50/50 |
| categorie | kantoorhuur | gedeeld | 25/75 |

**`openstaandeVerrekeningen`** — simpele afvinklijst:
```sql
id INTEGER PRIMARY KEY
omschrijving TEXT NOT NULL
bedrag REAL NOT NULL
vanGebruikerId INTEGER NOT NULL   -- FK naar gebruikers
naarGebruikerId INTEGER NOT NULL  -- FK naar gebruikers
betaald INTEGER DEFAULT 0         -- 0/1
betaaldOp TEXT                    -- datum wanneer betaald
aangemaaktOp TEXT DEFAULT (datetime('now'))
```

## API Routes

### Maandrapport

**`GET /api/belasting/maandrapport?maand=2026-04`**

Response:
```json
{
  "maandrapport": {
    "maand": "2026-04",
    "uitgaven": [
      {
        "id": 1,
        "datum": "2026-04-01",
        "omschrijving": "Coolblue",
        "categorie": "hardware",
        "bron": "ING",
        "bedragInclBtw": 1662.89,
        "btwBedrag": 288.60,
        "eigenaar": "sem",
        "splitRatio": null
      }
    ],
    "totaalUitgaven": 2518.64,
    "totaalBtw": 429.08,
    "btwSplit": {
      "sem": { "items": [...], "totaal": 377.93 },
      "syb": { "items": [...], "totaal": 24.15 }
    },
    "verrekeningen": [
      { "id": 1, "omschrijving": "Claude uitgave", "bedrag": 60.00, "betaald": false }
    ],
    "totaalVerrekening": 106.49,
    "totaalTerug": 666.51,
    "trend": [
      { "maand": "2025-11", "uitgaven": 1200, "btw": 210 },
      { "maand": "2025-12", "uitgaven": 1800, "btw": 315 },
      ...
    ]
  }
}
```

Logica:
1. Haal alle `bankTransacties` (type = "af") + `uitgaven` voor de gevraagde maand
2. Combineer tot één lijst. Bron wordt afgeleid: `bankTransacties.bank` voor transacties, `"handmatig"` voor uitgaven zonder bank-link
3. Per item: gebruik `eigenaar` als gezet, anders match tegen `verdeelRegels` (eerst op leverancier/merchantNaam, dan op categorie)
4. Bereken BTW split per persoon op basis van eigenaar + splitRatio. Bij gedeeld (bijv. 50/50): elk persoon krijgt 50% van de BTW
5. Haal openstaande verrekeningen op
6. Bereken trend: voor afgelopen 6 maanden, aggregeer totaal uitgaven + totaal BTW per maand
7. Assembleer response

### PDF

**`GET /api/belasting/maandrapport/pdf?maand=2026-04`**
- Hergebruikt data van het maandrapport endpoint
- Rendert via `@react-pdf/renderer`
- Retourneert PDF blob

### Verdeelregels

**`GET /api/belasting/verdeelregels`** — alle regels ophalen
**`POST /api/belasting/verdeelregels`** — regel toevoegen/wijzigen
**`DELETE /api/belasting/verdeelregels/[id]`** — regel verwijderen

### Verrekeningen

**`GET /api/belasting/verrekeningen`** — openstaande lijst
**`POST /api/belasting/verrekeningen`** — nieuwe verrekening
**`PUT /api/belasting/verrekeningen/[id]`** — markeer als betaald

### Eigenaar tagging

**`PUT /api/uitgaven/[id]/eigenaar`** — eigenaar/split op uitgave zetten
**`PUT /api/bank-transacties/[id]/eigenaar`** — eigenaar/split op transactie zetten

Body: `{ "eigenaar": "sem" | "syb" | "gedeeld", "splitRatio": "50/50" }`

## Borg config

Hardcoded object in de codebase (geen DB tabel):

```typescript
const BORG_CONFIG = {
  adres: "Edisonstraat 60",
  totaalBorg: 585.00,
  huurders: [
    { naam: "Sem (voorgeschoten)", borg: 585.00, huurPerMaand: 101.34, status: "eigen deel" },
    { naam: "Syb (M. Sprenkeler)", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "LP Brands", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "Nukeware Entertainment", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" }
  ]
};
```

## UI Design

Volgt het bestaande dashboard design systeem:
- Donker thema met `autronis-*` CSS variabelen
- Kaarten: `bg-autronis-card`, `border-autronis-border`, `rounded-2xl`
- Ruime padding (`p-6`/`p-7`)
- Accent: `autronis-accent` (teal)
- Framer Motion animaties voor page transitions
- Responsive: 4-kolom grid → 2-kolom op tablet → 1-kolom op mobile

Categorie-badges gebruiken dezelfde kleuren als de HTML-referentie:
- Hardware: blauw (#60a5fa op #1e3a5f)
- Kantoor: oranje (#fb923c op #3b2f1a)
- Software: groen (#4ade80 op #1a3b2d)
- KVK: paars (#c084fc op #2d1a3b)
- Telefonie: roze (#f472b6 op #3b1a2d)
- Afbetaling: geel (#facc15 op #3b3b1a)
- Hosting: teal (#2dd4bf op #1a3b3b)

Eigenaar-badges:
- Sem: teal (#17B8A5, witte tekst, rounded pill)
- Syb: blauw (#60a5fa, witte tekst, rounded pill)
- Gedeeld (50/50, 25/75): geel (#facc15 op #3b3b1a, rounded pill)
- Ongetagd: dashed border, grijze tekst, "+ Tag" label

## Toekomst (niet in scope)

- Revolut API directe koppeling (fase 2 — verwacht binnenkort)
- Automatische maandrapport generatie via cron
- Email export van het rapport
- Complexe verdeelregels (per bedrag, per datum range)
