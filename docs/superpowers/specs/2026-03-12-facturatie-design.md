# Autronis Dashboard — Facturatie Module

## Overzicht

Volledige facturatie-module: facturen aanmaken, PDF genereren met Autronis branding, versturen per e-mail via Resend, en betaalstatus bijhouden. Facturen zijn per project met vaste bedragen.

**Uitgangspunten:**
- Database tabellen bestaan al: `facturen`, `factuur_regels`, `bedrijfsinstellingen`
- Facturatie is per project (vast bedrag), niet per uur
- PDF generatie server-side met bedrijfsgegevens uit `bedrijfsinstellingen`
- E-mail versturen via Resend (gratis tier, 3.000 mails/maand)
- Factuurnummer automatisch gegenereerd: `AUT-YYYY-NNN`
- Alle tekst in het Nederlands
- Autronis branding, card-glow, ruime UI

---

## 1. Overzichtspagina (`/financien`)

### KPI Balk (4 kaarten)

| KPI | Berekening | Kleur |
|-----|-----------|-------|
| Openstaand | Som bedragInclBtw waar status = "verzonden" | danger (rood) als > 0 |
| Betaald deze maand | Som bedragInclBtw waar status = "betaald" en betaaldOp in huidige maand | accent |
| Te laat | Count facturen waar status = "verzonden" en vervaldatum < vandaag | danger |
| Totaal facturen | Count alle actieve facturen | text-primary |

### Facturentabel

Tabel met kolommen:
- Factuurnummer (link naar detail)
- Klant (bedrijfsnaam)
- Datum (factuurdatum)
- Bedrag (incl. BTW)
- Status badge (concept=grijs, verzonden=blauw, betaald=groen, te_laat=rood)
- Acties: bekijken, downloaden PDF

**Filters boven de tabel:**
- Status filter (Alle / Concept / Verzonden / Betaald / Te laat)
- Zoeken op factuurnummer of klantnaam

**Sortering:** Nieuwste eerst (op factuurdatum).

**Knop:** "+ Nieuwe factuur" → opent factuur aanmaken pagina.

---

## 2. Factuur Aanmaken (`/financien/nieuw`)

Aparte pagina (geen modal — te veel velden).

### Velden

**Klant & Project:**
- Klant selecteren (dropdown, verplicht)
- Project selecteren (dropdown, gefilterd op klant, optioneel)

**Factuurgegevens:**
- Factuurnummer (auto-gegenereerd, bewerkbaar)
- Factuurdatum (standaard vandaag)
- Betalingstermijn in dagen (standaard uit `bedrijfsinstellingen.betalingstermijn_dagen`, default 30)
- Vervaldatum (automatisch berekend: factuurdatum + betalingstermijn)

**Factuurregels (dynamische tabel):**
Per regel:
- Omschrijving (tekst, verplicht)
- Aantal (getal, standaard 1)
- Eenheidsprijs (getal, verplicht)
- BTW % (standaard uit `bedrijfsinstellingen.standaard_btw`, default 21)
- Regeltotaal (automatisch: aantal × eenheidsprijs)

Knoppen: "+ Regel toevoegen", verwijder per regel.

**Totalen (automatisch berekend, rechts uitgelijnd):**
- Subtotaal (excl. BTW)
- BTW bedrag
- **Totaal incl. BTW** (groot, accent kleur)

**Extra:**
- Notities/opmerkingen (textarea, optioneel — komt onderaan de factuur)

### Validatie
- Klant is verplicht
- Minimaal 1 factuurregel
- Elke regel: omschrijving en eenheidsprijs verplicht
- Aantal moet > 0

### Opslaan
- Knop "Opslaan als concept" → status = "concept"
- Na opslaan → redirect naar factuur detail pagina

---

## 3. Factuur Detail (`/financien/[id]`)

### Header
- Terug-link naar overzicht
- Factuurnummer als titel + status badge
- Klantnaam als subtitel
- Knoppen: "Bewerken" (alleen bij concept), "Download PDF", "Verstuur per e-mail", "Markeer als betaald"

### Factuur Preview
Een card die de factuur toont zoals de PDF eruit zal zien:
- Autronis logo + bedrijfsgegevens (links)
- Klantgegevens (rechts)
- Factuurnummer, datum, vervaldatum
- Regelstabel: omschrijving, aantal, prijs, BTW%, totaal
- Subtotaal, BTW, Totaal incl. BTW
- Betalingsgegevens (IBAN uit bedrijfsinstellingen)
- Notities

### Status Flow
```
concept → verzonden → betaald
                  ↘ te_laat (automatisch als vervaldatum verstreken)
```

- **Concept:** Bewerkbaar. Knoppen: Bewerken, Verwijderen.
- **Verzonden:** Niet meer bewerkbaar. Knoppen: Download PDF, Markeer als betaald.
- **Betaald:** Knoppen: Download PDF.
- **Te laat:** Zelfde als verzonden + rode waarschuwing.

---

## 4. Factuur Bewerken (`/financien/[id]/bewerken`)

Zelfde layout als aanmaken, maar voorgevuld met bestaande data. Alleen beschikbaar voor facturen met status "concept".

---

## 5. PDF Generatie

Server-side PDF generatie via `@react-pdf/renderer` (React components → PDF).

### PDF Layout

**Header:**
- Autronis logo (uit `bedrijfsinstellingen.logo_pad` of `/public/logo.png`)
- Bedrijfsgegevens: naam, adres, KvK, BTW-nummer, e-mail, telefoon

**Factuurinfo:**
- "FACTUUR" als titel
- Factuurnummer, factuurdatum, vervaldatum
- Klantgegevens: bedrijfsnaam, contactpersoon, adres, e-mail

**Regels tabel:**
- Kolommen: Omschrijving, Aantal, Prijs, BTW%, Totaal
- Per regel de waarden
- Subtotaal, BTW bedrag, Totaal incl. BTW (vetgedrukt)

**Footer:**
- Betalingsgegevens: "Gelieve te betalen op IBAN [iban] t.n.v. [bedrijfsnaam]"
- Betalingstermijn: "Betalingstermijn: [X] dagen"
- Notities (indien aanwezig)

### API Route
`GET /api/facturen/[id]/pdf` — genereert en retourneert de PDF als download.

---

## 6. E-mail Versturen (Resend)

### Setup
- Resend API key in `.env`: `RESEND_API_KEY=re_xxxxx`
- Verzend-adres: `factuur@autronis.com` (of configureerbaar via bedrijfsinstellingen)
- Domein verificatie vereist in Resend dashboard

### API Route
`POST /api/facturen/[id]/verstuur` — genereert PDF, stuurt e-mail, zet status op "verzonden".

### E-mail Template
- **Aan:** klant e-mailadres
- **Onderwerp:** `Factuur {factuurnummer} — Autronis`
- **Body (plain text + HTML):**
  ```
  Beste {contactpersoon},

  Hierbij ontvangt u factuur {factuurnummer} ter hoogte van {bedragInclBtw}.

  Gelieve het bedrag binnen {betalingstermijn} dagen over te maken op:
  IBAN: {iban}
  T.n.v.: {bedrijfsnaam}
  O.v.v.: {factuurnummer}

  Met vriendelijke groet,
  Autronis
  ```
- **Bijlage:** PDF bestand (`Autronis_Factuur_{nummer}.pdf`)

---

## 7. Factuurnummer Generatie

Format: `AUT-YYYY-NNN` (bijv. `AUT-2026-001`)

- YYYY = huidig jaar
- NNN = volgnummer, reset per jaar
- Berekend door hoogste bestaande nummer in dat jaar + 1
- Bewerkbaar bij aanmaken (voor uitzonderingen)

---

## 8. API Routes

| Methode | Route | Beschrijving |
|---------|-------|-------------|
| GET | `/api/facturen` | Alle facturen met klantgegevens (filter: status) |
| GET | `/api/facturen/[id]` | Factuur detail met regels en klantgegevens |
| POST | `/api/facturen` | Nieuwe factuur aanmaken met regels |
| PUT | `/api/facturen/[id]` | Factuur bijwerken (alleen concept) |
| DELETE | `/api/facturen/[id]` | Factuur verwijderen (soft-delete, alleen concept) |
| GET | `/api/facturen/[id]/pdf` | PDF genereren en downloaden |
| POST | `/api/facturen/[id]/verstuur` | PDF genereren + e-mail versturen via Resend |
| PUT | `/api/facturen/[id]/betaald` | Markeer als betaald (zet betaaldOp datum) |

---

## 9. Dependencies

- `@react-pdf/renderer` — PDF generatie (React → PDF)
- `resend` — E-mail versturen (optioneel, kan later toegevoegd)

---

## 10. Mobiele Layout

- KPI balk: 2 kolommen
- Facturentabel: horizontaal scrollbaar of card-weergave
- Factuur aanmaken: velden gestackt, regels als cards i.p.v. tabel
- PDF preview: scrollbaar

---

## 11. Wat Niet in Scope Is

- Terugkerende facturen (veld bestaat in schema maar wordt niet gebouwd)
- Credit nota's
- Integratie met boekhoudpakket
- Automatische herinneringen bij te laat
- Inkomsten/uitgaven tracking (aparte module)
