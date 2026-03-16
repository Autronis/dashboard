# Tijd Pagina — Samenvoeging Tijdregistratie & Schermtijd

**Datum**: 2026-03-16
**Status**: Goedgekeurd

## Probleem

Het dashboard heeft twee aparte tijdgerelateerde pagina's:
- **Tijdregistratie** (`/tijdregistratie`) — handmatige start/stop timer, registratielijst, weekoverzicht
- **Schermtijd** (`/schermtijd`) — automatische tracking, tijdlijn, AI samenvattingen, regels, suggesties

Dit is verwarrend en dubbel werk. Schermtijd doet automatisch wat tijdregistratie handmatig doet. De handmatige timer is echter nog nodig voor offline werk (meetings, bellen, whiteboard).

## Oplossing

Eén samengevoegde `/tijd` pagina. Schermtijd is de primaire databron (automatisch), aangevuld met een compacte timer voor offline werk.

## Layout

### 1. Header + Compacte Timer Strip

Titel "Tijd" links. Rechts een compacte inline timer:
- **Ingeklapt** (standaard): knop "Timer starten"
- **Uitgeklapt** (na klik): project dropdown + omschrijving input + categorie + start/stop knop + elapsed tijd — alles op één regel
- Wanneer timer loopt: altijd zichtbaar met pulserende indicator

### 2. KPI Row (4 kaarten)

Overgenomen van huidige schermtijd:
- Actieve tijd (Clock, teal)
- Idle tijd (Pause, gray)
- Productief % (TrendingUp, green)
- Aantal sessies (Hash, blue)

### 3. Tabs

#### Tab: Tijdlijn (primair)
- Bestaande schermtijd Overzicht tab
- Dag/week toggle, AI samenvatting, tijdlijn visualisatie, sessie-detail panel
- Handmatige timer-entries tonen als sessies met "Handmatig" badge
- Categorie-kleuren en legend behouden

#### Tab: Registraties
- Lijst van alle factureerbare tijdentries (handmatig + schermtijd-sessies gemarkeerd als factureerbaar)
- Gegroepeerd per dag met dagtotalen
- Per entry: omschrijving, project+klant, categorie badge, tijdspan, duur
- Acties: bewerken, verwijderen, herhalen
- "Handmatige invoer" knop → bestaande HandmatigModal
- CSV export knop
- Period filters: dag/week/maand

#### Tab: Team
- Bestaande team tab van schermtijd (per-gebruiker stats, categorie breakdown, top apps)

#### Tab: Regels & Suggesties
- Samenvoeging van huidige Regels en Suggesties tabs
- Bovenaan: regels beheer (CRUD, AI categoriseren knop)
- Onderaan: suggesties lijst met status filter en approve/reject

### 4. AI Samenvatting

Behouden uit schermtijd, getoond in Tijdlijn tab:
- Korte samenvatting inline
- Uitklapbaar detail
- Genereer/opnieuw knop

## Route Wijzigingen

| Oud | Nieuw |
|-----|-------|
| `/tijdregistratie` | Redirect → `/tijd` |
| `/schermtijd` | Redirect → `/tijd` |
| — | `/tijd` (nieuwe pagina) |

## Sidebar Wijziging

Twee items ("Tijdregistratie" + "Schermtijd") worden één item:
- Label: "Tijd"
- Icon: Clock
- Pad: `/tijd`

## Data Integratie

- Tijdlijn toont schermtijd-sessies + handmatige timer entries
- Handmatige entries herkenbaar via `bron` veld of `isHandmatig` flag
- Registraties tab kan items uit beide bronnen tonen
- Geen database schema wijzigingen nodig — bestaande tabellen blijven

## Wat Verdwijnt

- `/tijdregistratie/page.tsx` (functionaliteit verplaatst naar `/tijd`)
- `/schermtijd/page.tsx` (functionaliteit verplaatst naar `/tijd`)
- Week bar chart (tijdlijn vervangt dit)
- Grote timer hero section (vervangen door compacte strip)

## Wat Blijft

- Alle schermtijd functionaliteit (tijdlijn, AI summaries, regels, suggesties, team)
- Timer (compact) + HandmatigModal
- Alle API routes ongewijzigd
- Alle React Query hooks hergebruikt
- Database tabellen ongewijzigd

## Technische Aanpak

- Nieuwe pagina `src/app/(dashboard)/tijd/page.tsx`
- Componenten opsplitsen in subbestanden onder `src/app/(dashboard)/tijd/`:
  - `timer-strip.tsx` — compacte timer
  - `tab-tijdlijn.tsx` — tijdlijn view (uit schermtijd)
  - `tab-registraties.tsx` — registratielijst (uit tijdregistratie)
  - `tab-team.tsx` — team view (uit schermtijd)
  - `tab-regels-suggesties.tsx` — regels + suggesties (uit schermtijd)
- Redirect files in oude routes
- Sidebar aanpassen
