# Autronis Business Dashboard — Fase 2: Core Business

## Overzicht

Fase 2 bouwt de drie kernmodules: **Klantenbeheer**, **Projectenbeheer** en **Tijdregistratie**. Samen vormen ze het dagelijkse werkproces van Autronis — klanten aanmaken, projecten toewijzen, en uren bijhouden met een timer of handmatige invoer.

**Uitgangspunten:**
- Database tabellen bestaan al (aangemaakt in Fase 1)
- Alle tekst in het Nederlands
- Dark theme als standaard, light theme volledig ondersteund
- Autronis branding (turquoise accent, donkere achtergrond)
- Formulieren via modale dialogen
- Soft-delete patroon (is_actief vlag)

---

## 1. Klantenbeheer

### Klantenoverzicht (`/klanten`)

**Layout:** Kaartweergave (cards) in een responsive grid (auto-fill, min 300px).

**Per kaart:**
- Bedrijfsnaam (titel)
- Contactpersoon (subtitel)
- Korte beschrijving (uit notities veld, max 2 regels)
- Email en telefoon met iconen
- Status badge (Actief = groen, Inactief = grijs)
- Footer met KPI's: aantal projecten, totaal uren, uurtarief

**Bovenaan:**
- Titel "Klanten" met teller ("3 actieve klanten")
- Zoekbalk (filtert op bedrijfsnaam, contactpersoon, email)
- Knop "+ Nieuwe klant" → opent modal

**Sortering:** Alfabetisch op bedrijfsnaam (standaard). Gearchiveerde klanten worden niet getoond (toggle optie om ze te tonen).

### Klant Detailpagina (`/klanten/[id]`)

**Layout:** Twee kolommen op desktop, één kolom op mobiel.

**Bovenaan:**
- Terug-link naar klantenoverzicht
- Bedrijfsnaam als titel + korte beschrijving
- Knoppen: "Bewerken" (modal) en "Archiveren" (bevestiging)

**KPI balk (4 kaarten):**
- Aantal projecten
- Totaal gewerkte uren
- Berekende omzet (uren × uurtarief)
- Uurtarief

**Linker kolom:**
- **Klantgegevens** — contactpersoon, email, telefoon, adres in een grid
- **Documenten & Links** — lijst van bijlagen (contract, offerte, extern links). Per item: icoon (per type), naam, type label, aangemaakt_op datum, "Openen" link. Knop "+ Toevoegen" (modal). Documenten worden opgeslagen in `uploads/klanten/[id]/` directory (bestandsnaam volgt Fase 1 conventie: `Autronis_[Type]_[KlantNaam]_[Datum].[ext]`). **Schemawijziging:** voeg `url TEXT` kolom toe aan `documenten` tabel. Voor externe links: `bestandspad` blijft leeg (""), `url` bevat de link. Toegestane type waarden worden uitgebreid: `contract`, `offerte`, `link`, `overig`.
- **Notities & Afspraken** — chronologische lijst van notities. Per notitie: kleurcode rand (rood = belangrijk, groen = afspraak, grijs = notitie), tekst, datum. Knop "+ Notitie" (modal). **Schemawijziging:** voeg `type TEXT DEFAULT 'notitie'` kolom toe aan `notities` tabel via Drizzle migratie. Toegestane waarden: `belangrijk`, `afspraak`, `notitie`.

**Rechter kolom:**
- **Projecten** — lijst van projecten met naam, beschrijving, voortgangsbalk (percentage), uren (werkelijk/geschat), deadline, status badge, "Bekijk project" link. Knop "+ Project" (modal).
- **Recente tijdregistraties** — laatste 5 registraties voor deze klant. Per entry: omschrijving, project, wie, datum, duur. Link "Alle bekijken" → gefilterd tijdregistratie overzicht.

### Klant Modal (Aanmaken/Bewerken)

**Velden:**
- Bedrijfsnaam (verplicht)
- Contactpersoon
- Email
- Telefoon
- Adres (textarea)
- Uurtarief (getal, optioneel — valt terug op standaard gebruiker uurtarief)
- Notities (textarea, dient ook als beschrijving op de kaart)

**Validatie:** Bedrijfsnaam is verplicht. Email formaat check indien ingevuld. Uurtarief moet positief getal zijn.

**Bij opslaan:** Toast notificatie "Klant aangemaakt" / "Klant bijgewerkt". Pagina ververst automatisch.

---

## 2. Projectenbeheer

Projecten worden beheerd vanuit de klant detailpagina — er is geen aparte `/projecten` pagina. Dit houdt de navigatie simpel: klant → project.

### Project Detailpagina (`/klanten/[klantId]/projecten/[projectId]`)

**Bovenaan:**
- Breadcrumb: Klanten > TechStart BV > Webshop Redesign
- Projectnaam als titel
- Status badge (actief/afgerond/on-hold)
- Knoppen: "Bewerken" (modal), "Status wijzigen" (dropdown)

**KPI balk (4 kaarten):**
- Voortgang percentage (met visuele balk)
- Uren: werkelijk / geschat
- Budget: gewerkte uren × klant uurtarief
- Dagen tot deadline (of "Verlopen" in rood)

**Secties:**
- **Omschrijving** — projectbeschrijving
- **Tijdregistraties** — alle entries voor dit project, gegroepeerd per dag. Zelfde weergave als tijdregistratie pagina maar gefilterd.
- **Notities** — project-specifieke notities (zelfde component als klant notities)

### Project Modal (Aanmaken/Bewerken)

**Velden:**
- Naam (verplicht)
- Omschrijving (textarea)
- Status (select: actief/afgerond/on-hold)
- Geschatte uren (getal)
- Deadline (date picker)
- Voortgang percentage (slider of getal, 0-100)

**Validatie:** Naam is verplicht. Geschatte uren moet positief zijn indien ingevuld.

---

## 3. Tijdregistratie

### Tijdregistratie Pagina (`/tijdregistratie`)

**Timer sectie (bovenaan, altijd zichtbaar):**
- Groot tijddisplay (H:MM:SS, monospace font)
- Project selector (dropdown: "Projectnaam — Klantnaam")
- Omschrijving input ("Waar werk je aan?")
- Categorie selector (development/meeting/administratie/overig)
- Start/Stop knop (groen voor start, rood voor stop)
- Timer state wordt opgeslagen in Zustand + localStorage zodat het bewaard blijft bij pagina navigatie

**Actie balk:**
- Titel "Registraties" met periode totaal ("Deze week — 18u 30m")
- Periode filter: Dag / Week / Maand (toggle buttons)
- Knop "+ Handmatig" → opent modal voor handmatige invoer

**Registratielijst:**
- Gegroepeerd per dag met dagkop: "Vandaag — Wo 12 mrt — 4u 12m"
- Per entry (card):
  - Groen pulserend bolletje als timer loopt, grijs bolletje als afgerond
  - Omschrijving (titel)
  - Project — Klant (subtitel)
  - Categorie badge
  - Tijden (start – eind) voor afgeronde entries
  - Duur (H:MM, monospace, rechts uitgelijnd)
  - Groene rand als het de actieve/lopende timer is
- Hover: bewerk- en verwijder-iconen verschijnen

**Extra features:**
- **Herhaal laatste entry** — play-knop naast afgeronde entries om dezelfde taak opnieuw te starten
- **Weekoverzicht** — klein staafdiagram boven de lijst dat uren per dag toont (ma-zo). Gebouwd met pure CSS (gekleurde divs met percentage-based height), geen externe charting library nodig.
- **Bewerken** — klik op entry opent modal met dezelfde velden
- **Verwijderen** — bevestiging dialoog, dan hard delete (geen soft-delete voor tijdregistraties)
- **Export CSV** — knop om huidige periode te exporteren (datum, project, klant, omschrijving, categorie, duur)

### Handmatige Invoer Modal

**Velden:**
- Project (dropdown, verplicht)
- Omschrijving (verplicht)
- Datum (date picker, standaard vandaag)
- Starttijd (time input)
- Eindtijd (time input)
- Of: Duur in minuten (alternatief voor start/eind)
- Categorie (select)

**Validatie:** Project en omschrijving verplicht. Eindtijd moet na starttijd. Duur wordt automatisch berekend uit start/eind of handmatig ingevoerd.

**Bij opslaan:** `is_handmatig` wordt op 1 gezet. werkelijke_uren op het project wordt herberekend.

### Timer Gedrag

- Timer start: maakt een tijdregistratie record aan met `start_tijd` en `eind_tijd = null`
- Timer stop: update het record met `eind_tijd` en berekent `duur_minuten`
- Slechts één timer tegelijk actief per gebruiker (bij het starten van een nieuwe timer wordt de vorige automatisch gestopt)
- Timer state in Zustand store + localStorage backup
- Bij pagina refresh: check of er een lopende registratie is (eind_tijd = null) en hervat de timer
- Timer is zichtbaar in de header (klein, naast gebruikersnaam) zodat je altijd ziet dat er een timer loopt. **Dit vereist aanpassing van de bestaande `header.tsx` component uit Fase 1** — een klein timer-indicator element wordt toegevoegd naast de gebruikersnaam.

---

## 4. API Routes

### Klanten

| Methode | Route | Beschrijving |
|---------|-------|-------------|
| GET | `/api/klanten` | Alle actieve klanten (met project count, uren totaal) |
| GET | `/api/klanten/[id]` | Klant details met projecten, notities, documenten |
| POST | `/api/klanten` | Nieuwe klant aanmaken |
| PUT | `/api/klanten/[id]` | Klant bijwerken |
| DELETE | `/api/klanten/[id]` | Soft-delete (is_actief = 0) |

### Projecten

| Methode | Route | Beschrijving |
|---------|-------|-------------|
| GET | `/api/klanten/[klantId]/projecten` | Projecten voor een klant |
| GET | `/api/klanten/[klantId]/projecten/[id]` | Project details met tijdregistraties |
| POST | `/api/klanten/[klantId]/projecten` | Nieuw project aanmaken |
| PUT | `/api/klanten/[klantId]/projecten/[id]` | Project bijwerken |
| DELETE | `/api/klanten/[klantId]/projecten/[id]` | Soft-delete |

### Tijdregistraties

| Methode | Route | Beschrijving |
|---------|-------|-------------|
| GET | `/api/tijdregistraties` | Registraties (filter: periode, project, gebruiker) |
| POST | `/api/tijdregistraties` | Nieuwe registratie (timer start of handmatig) |
| PUT | `/api/tijdregistraties/[id]` | Bijwerken (timer stop of bewerken) |
| DELETE | `/api/tijdregistraties/[id]` | Hard delete |
| GET | `/api/tijdregistraties/actief` | Lopende timer voor huidige gebruiker (retourneert `null` als er geen timer loopt) |
| GET | `/api/tijdregistraties/export` | CSV export voor periode (UTF-8 met BOM, puntkomma als scheidingsteken voor Excel NL) |

### Notities

| Methode | Route | Beschrijving |
|---------|-------|-------------|
| POST | `/api/notities` | Nieuwe notitie (met klant_id en/of project_id) |
| PUT | `/api/notities/[id]` | Notitie bijwerken |
| DELETE | `/api/notities/[id]` | Notitie verwijderen |

### Documenten

| Methode | Route | Beschrijving |
|---------|-------|-------------|
| POST | `/api/documenten` | Document uploaden of link toevoegen |
| DELETE | `/api/documenten/[id]` | Document verwijderen |
| GET | `/api/documenten/[id]/download` | Bestand downloaden |

---

## 5. Herbruikbare UI Componenten

Deze componenten worden gebouwd als custom Tailwind componenten in `src/components/ui/` (het project gebruikt geen shadcn/ui — alle UI is custom):

- **Modal** — overlay dialoog met titel, content, footer (annuleren/opslaan). Sluit met Escape of klik buiten.
- **Toast** — succes/fout meldingen, auto-verdwijnen na 3 seconden. Zustand store voor state.
- **ConfirmDialog** — "Weet je het zeker?" dialoog voor destructieve acties. Hergebruikt Modal component.
- **StatusBadge** — gekleurde badge voor statussen (actief, afgerond, on-hold, etc.)
- **EmptyState** — placeholder wanneer een lijst leeg is ("Nog geen klanten" + CTA knop)
- **FormField** — wrapper met label, input, error message. Types: text, email, number, textarea, select, date.

---

## 6. Data Flow & State Management

- **Server-side data fetching** — Next.js Server Components voor initiële data. API routes voor mutaties.
- **Client-side state** — Zustand stores voor:
  - Timer state (lopende timer, project, starttijd)
  - Toast notificaties
  - Modal open/close state
- **Optimistic updates** — Na een mutatie direct de UI updaten, dan server response afwachten. Bij fout: revert + toast foutmelding. **Timer-specifiek:** als de server request bij timer start faalt, wordt de timer direct gestopt en krijgt de gebruiker een foutmelding. Bij timer stop falen: de entry wordt lokaal bewaard en opnieuw geprobeerd.
- **Cache invalidation** — Na mutaties `router.refresh()` aanroepen om Server Components te herladen.

---

## 7. Wat Fase 2 Oplevert

Na Fase 2 kan de gebruiker:
- Klanten aanmaken, bewerken, bekijken en archiveren
- Per klant: documenten/links, notities en afspraken bijhouden
- Projecten aanmaken en beheren per klant
- Voortgang en uren per project bijhouden
- Timer starten/stoppen om uren bij te houden
- Handmatig uren invoeren
- Uren bekijken per dag/week/maand
- Uren exporteren naar CSV
- Timer indicator in de header zien
