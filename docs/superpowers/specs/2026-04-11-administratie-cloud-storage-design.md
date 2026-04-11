# Administratie & Cloud Storage — Design Spec

**Datum:** 2026-04-11
**Status:** Goedgekeurd
**Doel:** Alle financiele documenten (facturen, bonnetjes) cloud-backed opslaan, automatisch facturen ophalen uit Gmail, en een overzichtspagina bieden voor belastingaangifte.

---

## 1. Probleem

- Financiele documenten (bonnetjes, inkomende facturen) staan lokaal op disk (`data/uploads/`)
- Geen backup, geen audit trail, geen toegang vanaf andere machines
- Facturen van leveranciers worden niet automatisch opgepikt
- Geen centraal overzicht per jaar/kwartaal voor de Belastingdienst (7 jaar bewaarplicht)

## 2. Oplossing — Drie onderdelen

### 2.1 Cloud Storage (Supabase Storage)

**Bucket:** `administratie`

**Structuur:**
```
administratie/
  2026/
    facturen-inkomend/     <- facturen van leveranciers (via Gmail)
    facturen-uitgaand/     <- eigen facturen aan klanten (PDF)
    bonnetjes/             <- receipt scans
```

**Wat verandert:**

| Huidige flow | Nieuw |
|---|---|
| Bonnetje upload → `data/uploads/bonnetjes/` | → Supabase Storage `bonnetjes/` |
| Email-factuur → `data/uploads/facturen-inbox/` | → Supabase Storage `facturen-inkomend/` |
| Factuur-PDF → on-the-fly gegenereerd | → ook opslaan in `facturen-uitgaand/` bij versturen |

**Database wijzigingen:**
- `bankTransacties`: nieuw veld `storageUrl` (text, nullable) — vervangt `bonPad` voor nieuwe uploads
- `uitgaven`: `bonnetjeUrl` wijst naar Supabase Storage URL ipv lokaal pad
- `facturen`: nieuw veld `pdfStorageUrl` (text, nullable) — opgeslagen PDF

**Migratie:** eenmalig script verplaatst bestaande bestanden uit `data/uploads/` naar Supabase Storage en update de database URLs.

### 2.2 Gmail Auto-Import

**Trigger:** Cron elke 30 minuten (`/api/administratie/gmail-sync`)

**Flow:**
1. Gmail API pollt `zakelijk@autronis.com` met query `has:attachment filename:pdf newer_than:1d`
2. Per email met PDF-bijlage:
   - Download PDF-bijlage
   - Claude Vision analyseert: "Is dit een factuur?" → nee = skip
   - Ja → extract: `leverancier`, `bedrag`, `btwBedrag`, `factuurnummer`, `datum`
   - Sla PDF op in Supabase Storage (`facturen-inkomend/{jaar}/`)
   - Zoek matching Revolut transactie (±5% bedrag, ±7 dagen)
   - Match gevonden → koppel automatisch, status = `gematcht`
   - Geen match → status = `onbekoppeld`, telt mee als notificatie
3. Gmail email-ID wordt opgeslagen voor deduplicatie

**Gmail API setup:**
- Google OAuth2 met refresh token
- Credentials: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in `.env`
- Scope: `gmail.readonly`

**Database — nieuwe tabel `inkomende_facturen`:**
```sql
id              INTEGER PRIMARY KEY
leverancier     TEXT NOT NULL
bedrag          REAL NOT NULL
btwBedrag       REAL
factuurnummer   TEXT
datum           TEXT NOT NULL
storageUrl      TEXT NOT NULL
emailId         TEXT UNIQUE          -- Gmail message ID (dedup)
bankTransactieId INTEGER             -- FK naar bankTransacties (nullable)
uitgaveId       INTEGER              -- FK naar uitgaven (nullable)
status          TEXT NOT NULL         -- "gematcht" | "onbekoppeld" | "handmatig_gematcht"
verwerkOp       TEXT NOT NULL
aangemaaktOp    TEXT NOT NULL DEFAULT (datetime('now'))
```

### 2.3 Administratie pagina

**Route:** `/administratie`

**Layout:**
- Jaar selector bovenaan (2025, 2026, ...)
- Notificatie banner: "X facturen wachten op koppeling" met link
- Tabs: Alle / Inkomend / Uitgaand / Bonnetjes
- Filter: Q1 / Q2 / Q3 / Q4 / Alles
- Per maand gegroepeerd, per document een rij met:
  - Type icoon (factuur / bonnetje)
  - Leverancier/omschrijving
  - Bedrag
  - Datum
  - Status badge (Gematcht / Open)
- Klik op document: preview + gekoppelde transactie + handmatig koppelen
- Kwartaal-totalen onderaan: inkomend, uitgaand, BTW te verrekenen

**Export:**
- "Download Q1 2026" → ZIP met alle PDFs geordend per submap
- Handig voor accountant of belastingaangifte

## 3. Bestaande flows — wat verandert

| Flow | Wijziging |
|---|---|
| `POST /api/bank/bonnetje` | Bestandsopslag → Supabase Storage. AI-analyse + matching ongewijzigd |
| `GET/POST /api/facturen/[id]/pdf` | Bij status "verzonden": PDF ook opslaan in Supabase Storage |
| `POST /api/bank/email-factuur` | Blijft als fallback voor handmatige upload. Opslag → Supabase |
| `POST /api/uitgaven` | `bonnetjeUrl` wijst naar Supabase URL |

**Wat NIET verandert:**
- Revolut webhook/sync flow
- Transactie matching logica
- Factuur CRUD
- Belasting module

## 4. Nieuwe API endpoints

| Method | Route | Doel |
|---|---|---|
| POST | `/api/administratie/gmail-sync` | Cron: poll Gmail, verwerk facturen |
| GET | `/api/administratie` | Lijst documenten met filters (jaar, kwartaal, type, status) |
| POST | `/api/administratie/koppel` | Handmatig koppelen: factuur ↔ transactie |
| GET | `/api/administratie/export` | Download ZIP per kwartaal |
| POST | `/api/administratie/upload` | Handmatige upload als fallback |

## 5. Notificaties

- Dashboard badge op `/administratie` nav-item: teller van `onbekoppeld` facturen
- Op de administratie pagina zelf: banner bovenaan met "X facturen wachten op koppeling"
- Geen email/Discord notificaties (alleen in-dashboard)

## 6. Technische details

- **Storage:** Supabase Storage (bestaand project `uhdkxstedvytowbaiers`)
- **AI:** Claude Sonnet voor PDF-analyse (vision), Haiku voor "is dit een factuur?" check
- **Gmail:** `googleapis` npm package, OAuth2 met refresh token
- **PDF preview:** Supabase signed URLs (1 uur geldig) via API endpoint — geen public bucket
- **ZIP export:** `archiver` npm package, server-side generatie
- **Cron:** Vercel cron (wordt al gebruikt voor radar, facturen, followup, ops-room, wiki)

## 7. Scope — wat we NIET bouwen

- Multi-currency support
- OCR van niet-PDF documenten (Word, Excel)
- Automatische BTW-aangifte indienen
- Koppeling met boekhoudpakketten (Moneybird, Exact)
- Email notificaties
