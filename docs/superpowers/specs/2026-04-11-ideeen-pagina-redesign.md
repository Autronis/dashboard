# Ideeën Pagina Redesign — "Focus Dashboard"

**Datum:** 2026-04-11
**Status:** Goedgekeurd
**Aanpak:** B — Focus Dashboard

## Samenvatting

Complete redesign van de ideeën-pagina. Twee modi (Decide/Capture), AI-berekende confidence scores op basis van echte dashboard data, auto-capture vanuit meetings/leads/radar, snellere idee-naar-project flow, en strakker UI met minder ruis.

---

## 1. Pagina-structuur & Layout

### Twee tabs bovenaan
- **Decide** (default) — wat ga ik bouwen?
- **Capture** — ideeën vastleggen en binnenkrijgen

### Decide tab

**Hero: "Bouw dit als eerste" (Top 3)**
- 3 grote kaarten naast elkaar, de 3 ideeën met hoogste confidence score
- Elke kaart toont:
  - Naam + korte omschrijving (max 2 regels)
  - Confidence score (0-100) met kleur (rood < 30, oranje 30-60, groen > 60)
  - Signalen in één zin: "2 klanten vroegen hierom, past bij lopend project X"
  - Prominente "Start project" knop
  - Secundaire "Parkeer" knop (zet `geparkeerd: true` vlag — wordt uitgesloten van top 3 selectie, blijft zichtbaar in parkeerplaats)
- Alleen ideeën met status "idee" of "uitgewerkt" komen in aanmerking

**Parkeerplaats**
- Compacte grid van alle overige ideeën, gesorteerd op confidence
- Kaart: naam, confidence getal + kleur, categorie badge, één-regel signaal
- Hover: toont korte omschrijving
- Click: opent detail panel rechts (split view, zoals meetings pagina)

**Pipeline mini-bar**
- Kleine horizontale balk boven de parkeerplaats
- Toont: X ideeën → Y uitgewerkt → Z actief → W gebouwd
- Subtiel, niet dominant

**Filters (minimaal)**
- Categorie: dropdown (niet 9 horizontale tabs)
- Status: inline pills (idee, uitgewerkt, actief, gebouwd)
- Sortering: Confidence (default), Nieuwste, Categorie
- Zoekbalk

### Capture tab

**Quick input bovenaan**
- Tekstveld, Enter om toe te voegen
- Wordt aangemaakt als `categorie: "inzicht"`, `status: "idee"`

**Auto-capture feed**
- Chronologische lijst, nieuwste bovenaan
- Elk item toont:
  - Bron-icoon + label (Meeting, Lead, Radar)
  - Tekst (de originele quote/context)
  - Datum
- Twee knoppen per item:
  - "Toevoegen aan backlog" — promoveert naar echt idee, kiest categorie
  - "Negeer" — verwijdert uit feed
- Items die >30 dagen oud zijn en niet gepromoveerd worden automatisch verborgen

**Genereer knop**
- "AI: Genereer ideeën" verplaatst hierheen vanuit de huidige AI Suggesties tab
- Werkt zoals nu: Claude genereert 5 ideeën met context

### Detail panel (rechts, split view)
- Opent bij click op een idee in de parkeerplaats
- Toont:
  - Naam, status, categorie, confidence score
  - Confidence breakdown: 4 categorieën met scores en bronnen (klikbaar)
  - Volledige omschrijving + uitwerking (markdown)
  - Start project preview (inline, zie sectie 4)
  - Edit inline (naam, categorie, status, omschrijving, uitwerking — direct bewerkbaar)
  - "Verwijder" knop onderaan
  - Bron info als het een auto-capture was

---

## 2. Confidence Score

### Formule
Score 0-100, berekend uit 4 gewogen categorieën:

**Klantbehoefte (40%)**
- Scant: meeting transcripts (keyword matching op idee naam + omschrijving), lead notities, klant-gezondheid alerts
- Telt unieke klanten/leads die iets vergelijkbaars noemden
- Scoring: 0 mentions = 0, 1 = 25, 2 = 50, 3+ = 100
- Slaat matched bronnen op (meeting ID, lead ID) voor de breakdown

**Marktvalidatie (25%)**
- Scant: Radar artikelen (titel + samenvatting matching), concurrenten-data
- Scoring: geen match = 0, radar artikel match = 50, concurrent biedt het aan = 100
- Slaat matched bronnen op (radar bron ID, concurrent naam)

**Autronis Fit (20%)**
- AI beoordeelt overlap met:
  - Actieve projecten (vergelijkbare scope/tech)
  - Team expertise (op basis van wat jullie al gebouwd hebben)
- Scoring: 0-100, AI bepaalt

**Effort/ROI (15%)**
- Geschatte uren: AI schat op basis van vergelijkbare afgeronde projecten (uit projecten tabel)
- Potentiële omzet: geschatte uren * gemiddeld uurtarief (uit tijdregistraties/facturen)
- Scoring: ROI ratio = omzet / uren. Ratio > 150 = 100 punten, 100-150 = 75, 50-100 = 50, < 50 = 25, onbekend = 50 (neutraal)

### Weergave
- Op kaart: getal (bijv. "73") met kleurcode
- Daaronder: één-zin samenvatting van de belangrijkste signalen
- In detail panel: volledige breakdown per categorie met klikbare bronnen

### Herberekening
- **Automatisch:** Elke nacht via cron voor alle ideeën in status "idee" of "uitgewerkt"
- **Handmatig:** "Herbereken" knop in detail panel
- **Trigger:** Bij nieuwe relevante data (meeting verwerkt, lead aangemaakt, radar scan) worden betreffende ideeën gemarkeerd voor herberekening

### Database wijzigingen
Bestaande velden hergebruiken + nieuwe:
- `aiScore` → wordt confidence score (0-100 in plaats van 1-10)
- Nieuw: `confidenceBreakdown` (text/JSON) — opslag van de 4 categorie-scores + matched bronnen
- Nieuw: `confidenceBijgewerktOp` (text) — timestamp laatste berekening
- Bestaande velden `impact`, `effort`, `revenuePotential`, `aiHaalbaarheid`, `aiMarktpotentie`, `aiFitAutronis` → deprecated, niet meer gebruikt in UI maar behouden voor backwards compatibility

---

## 3. Auto-Capture

### Bron 1: Meetings
- **Wanneer:** Na `processMeeting()` (status wordt "klaar")
- **Hoe:** Extra AI stap in de meeting processing pipeline
  - Prompt scant transcript op idee-signalen: "we zouden kunnen...", "klant vraagt om...", "het zou handig zijn als...", "idee:", vergelijkbare patronen
  - Per gevonden signaal: extract korte tekst + context quote
- **Resultaat:** Idee aangemaakt met:
  - `bron`: `"meeting:${meetingId}"`
  - `bronTekst`: relevante quote uit transcript
  - `categorie`: "inzicht"
  - `status`: "idee"
  - `naam`: AI-gegenereerde korte titel
  - `omschrijving`: de geextraheerde context

### Bron 2: Leads & Klantgesprekken
- **Wanneer:** Bij aanmaken of updaten van een lead notitie (POST/PUT /api/leads)
- **Hoe:** AI scant notitie-tekst op kans-signalen
  - "Klant zoekt X maar dat bieden we niet aan"
  - "Zou interessant zijn om Y te bouwen voor dit type klant"
- **Resultaat:** Idee aangemaakt met:
  - `bron`: `"lead:${leadId}"`
  - `bronTekst`: relevante passage uit notitie
  - Overige velden zoals bij meetings

### Bron 3: Learning Radar
- **Wanneer:** Bij radar scan wanneer een artikel hoog scoort (must-read)
- **Hoe:** AI checkt of het artikel een kans voor Autronis bevat
  - "Nieuwe trend die past bij jullie diensten"
  - "Tool/technologie die jullie workflow kan verbeteren"
- **Resultaat:** Idee aangemaakt met:
  - `bron`: `"radar:${bronId}"`
  - `bronTekst`: relevante passage uit artikel
  - Overige velden zoals bij meetings

### Database wijzigingen
Nieuwe velden op `ideeen` tabel:
- `bron` (text, nullable) — format: "meeting:123", "lead:45", "radar:67", null (handmatig)
- `bronTekst` (text, nullable) — originele quote/context uit de bron

---

## 4. Verbeterde Idee → Project flow

### Huidige flow (wordt vervangen)
Klik "Start project" → modal team/solo → wacht op AI → project aangemaakt

### Nieuwe flow

**Stap 1: Inline preview**
- "Start project" op een kaart expandeert een preview panel (geen modal)
- AI genereert in 3-5 seconden:
  - Geschatte scope: "~20 uur, 3 fases"
  - Geschatte doorlooptijd: "~2 weken"
  - Top 3 eerste taken
  - Vergelijkbaar afgerond project (als dat er is)
- Toggle: "Zelf doen" / "Team (Ops Room)"
  - Default suggestie op basis van scope: < 10 uur → solo, > 10 uur → team

**Stap 2: Start**
- Klik "Start" → project wordt aangemaakt
- Achterliggend proces (onveranderd):
  - Project record in DB
  - Idee status → "actief", projectId gelinkt
  - PROJECT_BRIEF.md, TODO.md, RULES.md generatie
  - Taken aanmaken in database
  - Notion sync
  - Ops Room trigger bij team mode

**Stap 3: Betere plangeneratie**
- AI krijgt extra context mee:
  - Vergelijkbare afgeronde projecten (scope, doorlooptijd, wat werkte)
  - Confidence signalen (welke klantbehoeften dit idee triggerden)
  - Huidige werkdruk (aantal actieve projecten, open taken)
- Resultaat: realistischer plan met betere schattingen

**Alternatief pad: "Eerst uitwerken"**
- Opent DAAN spar (zoals nu) voor verdere uitwerking
- Na spar: keert terug naar preview met verrijkte data

---

## 5. UI Cleanup

### Wat weg gaat
- 4-kolom pipeline visualisatie → wordt pipeline mini-bar
- Insights row (4 kaartjes: meest waardevolle categorie, etc.) → info zit in confidence score
- Handmatige scoring sliders (impact/effort/revenue per kaart) → confidence score vervangt
- "Backlog opschonen" als prominente knop → klein icoon in header
- 9 categorie-tabs als horizontale scroll → dropdown filter
- Grid/list view toggle → alleen grid
- Aparte "AI Suggesties" tab → gemerged in Capture tab (genereer knop)
- Aparte "Notities" tab → gemerged in Capture tab (quick input + auto-capture feed)
- Detail modal → detail panel rechts (split view)
- Create/edit modal → inline editing in detail panel
- Start project modal → inline preview panel

### Wat blijft
- Zoekbalk
- DAAN spar voor uitwerking
- Notion sync
- Alle bestaande API's (backwards compatible)

### Nieuw
- Decide/Capture tabs
- Hero top 3 sectie
- Parkeerplaats grid
- Pipeline mini-bar
- Auto-capture feed
- Confidence score weergave
- Inline detail panel (split view)
- Inline project preview
- Bron-labels op kaarten

---

## 6. Technische aanpak

### Nieuwe API routes
- `POST /api/ideeen/confidence` — Herbereken confidence score voor een idee (of alle)
- `POST /api/ideeen/capture` — Auto-capture endpoint (aangeroepen vanuit meeting/lead/radar processing)

### Aangepaste API routes
- `GET /api/ideeen` — Voeg confidence data toe aan response, sorteer op confidence als default
- `PUT /api/ideeen/[id]` — Support voor nieuwe velden (bron, bronTekst, confidenceBreakdown)
- `POST /api/ideeen/genereer` — Verplaatst naar Capture tab context

### Aangepaste processing pipelines
- `processMeeting()` in `/src/lib/meetings/analyse-meeting.ts` — Extra stap: idee-signalen extracten
- Lead notitie endpoints — Hook voor idee-capture bij create/update
- Radar scan — Hook voor idee-capture bij hoog-scorende artikelen

### Cron job
- Nachtelijke confidence herberekening voor alle ideeën in status "idee"/"uitgewerkt"
- Kan via bestaande Vercel cron infrastructure

### Database migratie
- Alter `ideeen` tabel:
  - Add `bron` TEXT
  - Add `bron_tekst` TEXT
  - Add `confidence_breakdown` TEXT (JSON)
  - Add `confidence_bijgewerkt_op` TEXT
  - Add `geparkeerd` INTEGER DEFAULT 0
- `aiScore` wordt hergebruikt als confidence score (schaal verandert van 1-10 naar 0-100)
- Bestaande scores * 10 migreren als initiële waarde

### Frontend
- Volledige herschrijving van `/src/app/(dashboard)/ideeen/page.tsx`
- Opsplitsen in componenten:
  - `decide-tab.tsx` — Hero top 3 + parkeerplaats
  - `capture-tab.tsx` — Quick input + auto-capture feed + genereer
  - `idee-detail-panel.tsx` — Rechter panel met detail + edit + project preview
  - `confidence-badge.tsx` — Score weergave component
  - `pipeline-bar.tsx` — Mini pipeline indicator
- Hooks uitbreiden in `use-ideeen.ts`:
  - `useConfidenceRecalc()` — trigger herberekening
  - Bestaande hooks blijven werken
