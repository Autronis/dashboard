# Terugkerende Facturen — Design Spec

## Doel

Frontend UI toevoegen voor het beheren van terugkerende facturen. De backend (database velden, cron job, periodiek endpoint) bestaat al — dit ontwerp voegt de ontbrekende UI toe en verbetert de backend-logica.

## Aanpak

Uitbreiden van het bestaande `facturen` schema met extra velden voor custom intervallen en pauzeer-functionaliteit. Geen aparte templates-tabel.

---

## 1. Database wijzigingen

### Bestaande velden (reeds in schema)
- `isTerugkerend` (integer, default 0)
- `terugkeerInterval` (text: "wekelijks" | "maandelijks")

### Nieuwe velden toevoegen aan `facturen`
| Veld | Type | Default | Beschrijving |
|------|------|---------|--------------|
| `terugkeerAantal` | integer | 1 | Het getal bij custom interval (bijv. "elke **2** weken") |
| `terugkeerEenheid` | text | null | "dagen" \| "weken" \| "maanden" |
| `terugkeerStatus` | text | "actief" | "actief" \| "gepauzeerd" \| "gestopt" |
| `volgendeFactuurdatum` | text | null | ISO datum van de volgende te genereren factuur |
| `bronFactuurId` | integer | null | Verwijzing naar de originele bron-factuur (voor historie) |

### Backwards compatibility
`terugkeerInterval` blijft bestaan. De cron job ondersteunt zowel het oude formaat als het nieuwe `terugkeerEenheid` + `terugkeerAantal`. Nieuwe facturen gebruiken alleen de nieuwe velden.

---

## 2. Factuur formulier (nieuw + bewerken)

### Locatie
Nieuwe card-sectie **"Herhaling"** onderaan het formulier, na de notities-sectie. Zowel op `/financien/nieuw` als `/financien/[id]/bewerken`.

### Velden
1. **Toggle** — "Terugkerende factuur" (switch/checkbox)
2. Wanneer aan, verschijnen:
   - **Aantal** — number input (default 1, min 1)
   - **Eenheid** — dropdown: "dagen", "weken", "maanden"
   - **Eerste factuur op** — datumveld, automatisch berekend (factuurdatum + interval), maar aanpasbaar
3. **Voorbeeld-tekst** onder de velden: *"Deze factuur wordt automatisch elke 2 weken verstuurd"*

### Gedrag
- Bij opslaan worden `isTerugkerend`, `terugkeerAantal`, `terugkeerEenheid`, `volgendeFactuurdatum` meegestuurd
- `terugkeerStatus` wordt automatisch "actief"
- `volgendeFactuurdatum` wordt berekend als: factuurdatum + (aantal × eenheid)

---

## 3. Overzichtspagina terugkerende facturen

### Locatie
Nieuwe tab **"Terugkerend"** in de financien pagina (naast Uitgaven, Abonnementen, etc.).

### KPI cards (bovenaan)
- **Actief** — aantal actieve terugkerende facturen
- **Gepauzeerd** — aantal gepauzeerde
- **Maandelijkse omzet** — geschatte maandelijkse omzet uit actieve herhalingen

### Tabel
| Kolom | Beschrijving |
|-------|--------------|
| Klant | Klantnaam |
| Factuurnummer | Van de bron-factuur |
| Bedrag | Incl. BTW |
| Interval | Leesbaar formaat, bijv. "elke 2 weken" |
| Volgende factuur | Datum |
| Status | Badge: actief (groen), gepauzeerd (geel), gestopt (rood) |
| Acties | Pauzeren/hervatten, stoppen, bekijken |

### Acties
- **Pauzeren** → `terugkeerStatus` = "gepauzeerd", cron slaat deze over
- **Hervatten** → `terugkeerStatus` = "actief", `volgendeFactuurdatum` herberekend vanaf vandaag
- **Stoppen** → `terugkeerStatus` = "gestopt", permanent, kan niet hervat worden
- **Rij klik** → navigeert naar factuur detail pagina

---

## 4. Cron job aanpassingen

### Huidige logica
Checkt `isTerugkerend` + `terugkeerInterval` + `betaaldOp` datum.

### Nieuwe logica
1. Query: `isTerugkerend = 1 AND terugkeerStatus = "actief" AND volgendeFactuurdatum <= vandaag`
2. Genereer nieuwe factuur (kopie regels, nieuw factuurnummer, nieuwe datums)
3. Zet `bronFactuurId` naar de originele factuur
4. Verstuur per e-mail met PDF (bestaande Resend flow)
5. Update `volgendeFactuurdatum` op de bron-factuur: `volgendeFactuurdatum + (terugkeerAantal × terugkeerEenheid)`
6. Fallback: als `terugkeerEenheid` leeg is, gebruik `terugkeerInterval` (backwards compat)

### Pauzeer/stop
- `terugkeerStatus = "gepauzeerd"` → overgeslagen
- `terugkeerStatus = "gestopt"` → overgeslagen, permanent

---

## 5. API wijzigingen

### POST/PATCH `/api/facturen`
Accepteert nu ook: `isTerugkerend`, `terugkeerAantal`, `terugkeerEenheid`, `volgendeFactuurdatum`

### GET `/api/facturen`
Nieuwe query parameter: `?terugkerend=true` — filtert op `isTerugkerend = 1`, retourneert inclusief terugkeer-velden en klantnaam.

### PATCH `/api/facturen/[id]/terugkerend` (nieuw)
Beheer terugkeer-status:
- `{ actie: "pauzeren" }` → `terugkeerStatus = "gepauzeerd"`
- `{ actie: "hervatten" }` → `terugkeerStatus = "actief"`, herbereken `volgendeFactuurdatum` vanaf vandaag
- `{ actie: "stoppen" }` → `terugkeerStatus = "gestopt"`

---

## Technische details

### Stack
- Frontend: Next.js, Tailwind CSS v4, Framer Motion, lucide-react
- Backend: Next.js API routes, Drizzle ORM, SQLite
- Email: Resend API
- PDF: @react-pdf/renderer
- Cron: Vercel Cron (dagelijks 08:00)

### Bestaande patronen volgen
- Card-based layout met `rounded-2xl border border-autronis-border`
- `FormField`, `SelectField` componenten
- `useToast()` voor notificaties
- Status badges met kleuren
- Tab-structuur in financien pagina
