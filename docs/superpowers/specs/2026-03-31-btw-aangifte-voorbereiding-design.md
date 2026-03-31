# BTW Aangifte Voorbereiding — Design Spec

## Doel

Automatische BTW-aangifte voorbereiding op de belasting pagina. Berekent alle rubrieken op basis van facturen en uitgaven, toont het resultaat in een modal in Belastingdienst-stijl, en laat het opslaan als concept of markeren als ingediend.

## Databronnen

- **facturen** — omzet binnenland (bedrag_excl_btw, btw_bedrag, btw_percentage, factuurdatum, status)
- **uitgaven** — voorbelasting (btw_bedrag, datum, categorie, leverancier, is_buitenland)
- Abonnementen worden NIET meegenomen (staan al als uitgave of bank_transactie)

## Database wijzigingen

### Bestaande `btw_aangiftes` tabel uitbreiden

Nieuwe kolommen:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| rubriek_1a_omzet | real | Omzet binnenland hoog tarief (excl BTW) |
| rubriek_1a_btw | real | BTW 21% |
| rubriek_1b_omzet | real | Omzet binnenland laag tarief (excl BTW) |
| rubriek_1b_btw | real | BTW 9% |
| rubriek_4a_omzet | real | Diensten buiten EU |
| rubriek_4a_btw | real | Verlegde BTW 21% over buiten-EU diensten |
| rubriek_4b_omzet | real | Leveringen/diensten binnen EU |
| rubriek_4b_btw | real | Verlegde BTW EU |
| rubriek_5a_btw | real | Totaal verschuldigde BTW (1a + 1b + 4a + 4b) |
| rubriek_5b_btw | real | Totaal voorbelasting (BTW op zakelijke uitgaven) |
| saldo | real | Te betalen (+) of terug te krijgen (-) |
| betalingskenmerk | text | Betalingskenmerk van de Belastingdienst |

Bestaande kolommen `btw_ontvangen`, `btw_betaald`, `btw_afdragen` blijven bestaan voor backward compatibility.

### Bestaande `uitgaven` tabel uitbreiden

Nieuw veld:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| is_buitenland | text | null (binnenland), "buiten_eu", "binnen_eu" |

### Leverancier auto-detectie

Hardcoded lijst voor automatische herkenning van buitenlandse leveranciers (buiten EU):

```typescript
const BUITEN_EU_LEVERANCIERS = [
  "Anthropic", "AWS", "Amazon Web Services", "OpenAI",
  "Vercel", "Google Cloud", "Microsoft Azure", "Stripe",
  "DigitalOcean", "Cloudflare", "GitHub", "Notion",
  "Figma", "Slack", "Zoom"
];
```

Matching: case-insensitive, partial match (leverancier.toLowerCase().includes(naam.toLowerCase())).

Het `is_buitenland` veld op uitgaven overrult de hardcoded lijst — als een uitgave expliciet `is_buitenland = null` heeft maar de leverancier in de lijst staat, wordt deze als buiten EU behandeld. Als `is_buitenland` expliciet gezet is, wint dat.

## API

### POST `/api/belasting/btw-voorbereiding`

**Request:** `{ kwartaal: number, jaar: number }`

**Berekening:**

1. **Rubriek 1a** (21% binnenland):
   - Query: facturen WHERE status = 'betaald' AND btw_percentage = 21 AND factuurdatum in kwartaal
   - rubriek_1a_omzet = SUM(bedrag_excl_btw)
   - rubriek_1a_btw = SUM(btw_bedrag)

2. **Rubriek 1b** (9% binnenland):
   - Query: facturen WHERE status = 'betaald' AND btw_percentage = 9 AND factuurdatum in kwartaal
   - rubriek_1b_omzet = SUM(bedrag_excl_btw)
   - rubriek_1b_btw = SUM(btw_bedrag)

3. **Rubriek 4a** (diensten buiten EU):
   - Query: uitgaven WHERE datum in kwartaal AND (is_buitenland = 'buiten_eu' OR leverancier in BUITEN_EU_LEVERANCIERS)
   - rubriek_4a_omzet = SUM(bedrag)
   - rubriek_4a_btw = SUM(bedrag) * 0.21 (verlegde BTW)

4. **Rubriek 4b** (binnen EU):
   - Query: uitgaven WHERE datum in kwartaal AND is_buitenland = 'binnen_eu'
   - rubriek_4b_omzet = SUM(bedrag)
   - rubriek_4b_btw = SUM(bedrag) * 0.21 (verlegde BTW)

5. **Rubriek 5a** (verschuldigde BTW):
   - rubriek_5a_btw = rubriek_1a_btw + rubriek_1b_btw + rubriek_4a_btw + rubriek_4b_btw

6. **Rubriek 5b** (voorbelasting):
   - Query: uitgaven WHERE datum in kwartaal AND btw_bedrag > 0 (binnenlandse uitgaven)
   - PLUS rubriek_4a_btw + rubriek_4b_btw (verlegde BTW mag je ook terugvragen)
   - rubriek_5b_btw = SUM(btw_bedrag) + rubriek_4a_btw + rubriek_4b_btw

7. **Saldo**:
   - saldo = rubriek_5a_btw - rubriek_5b_btw
   - Positief = betalen, negatief = terugkrijgen

**Response:**
```json
{
  "rubrieken": {
    "rubriek_1a": { "omzet": 15000, "btw": 3150 },
    "rubriek_1b": { "omzet": 0, "btw": 0 },
    "rubriek_4a": { "omzet": 2500, "btw": 525 },
    "rubriek_4b": { "omzet": 0, "btw": 0 },
    "rubriek_5a": { "btw": 3675 },
    "rubriek_5b": { "btw": 1200 }
  },
  "saldo": 2475,
  "kwartaal": 1,
  "jaar": 2026,
  "bestaandeAangifte": null
}
```

Als er al een btw_aangifte bestaat voor het kwartaal, wordt `bestaandeAangifte` meegestuurd (incl. status, betalingskenmerk, ingediend_op).

### PUT `/api/belasting/btw/[id]` (bestaande route uitbreiden)

Accepteert nu ook:
- Alle rubriek-velden voor concept opslaan
- `betalingskenmerk` string
- `status: "ingediend"` → zet `ingediend_op` op nu, markeert bijbehorende deadline als afgerond
- `status: "open"` → concept opslaan

Als er nog geen btw_aangifte record bestaat voor het kwartaal, wordt deze aangemaakt (upsert).

## UI

### Trigger

Knop "BTW aangifte voorbereiden" in de BTW-sectie van het Overzicht tab op de belasting pagina. Disabled als er geen data is voor het geselecteerde kwartaal.

### Modal (max-w-3xl)

**Header:**
- Titel: "BTW Aangifte Q{kwartaal} {jaar}"
- Kwartaalselector: Q1, Q2, Q3, Q4 (knoppen)
- Jaarselector: huidig jaar ± 1

**Status badge** (rechtsboven):
- "Nieuw" (grijs) — nog niet opgeslagen
- "Concept" (amber) — opgeslagen maar niet ingediend
- "Ingediend" (groen) — ingediend met datum

**Body — Rubrieken:**

Rubriek 1 — Omzet binnenland:
- 1a: Omzet hoog tarief (21%) | Omzet: €X | BTW: €X
- 1b: Omzet laag tarief (9%) | Omzet: €X | BTW: €X

Rubriek 4 — Buitenland:
- 4a: Diensten buiten EU | Omzet: €X | Verlegde BTW: €X
- 4b: Leveringen/diensten binnen EU | Omzet: €X | Verlegde BTW: €X

Rubriek 5 — Berekening:
- 5a: Verschuldigde BTW | €X
- 5b: Voorbelasting | €X

**Saldo:**
- Groot bedrag met groen (terug) of rood (betalen) achtergrond
- Tekst: "Te betalen aan de Belastingdienst" of "Terug te ontvangen van de Belastingdienst"

**Betalingskenmerk:**
- Invulveld, alleen actief bij status "open" of nieuw

**Footer — Actieknoppen:**
- "Opslaan als concept" → slaat rubrieken + kenmerk op met status "open"
- "Markeer als ingediend" → zet status op "ingediend", markeert deadline afgerond
- "Ingediend" knop is disabled als status al "ingediend" is

### Styling

- Zelfde autronis-card/border/accent stijl als de rest
- Rubrieken als rijen met duidelijke scheiding
- Nummering (1a, 1b, 4a, etc.) in accent kleur
- Saldo-blok prominent onderaan
