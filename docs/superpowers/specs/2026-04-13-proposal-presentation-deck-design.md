# Proposal Presentation Deck — Design

**Datum:** 2026-04-13
**Project:** Autronis Dashboard
**Status:** Approved — ready for implementation plan
**Aanleiding:** Er is een concrete lead. De huidige proposal-PDF voelt als een traditionele offerte; we willen de klant een bold, dark, agency-stijl pitch deck kunnen laten zien — zowel live op een call als als PDF-download in de inbox. Daarnaast is `/proposals/nieuw` nu een dode link (404) waardoor nieuwe proposals niet via de UI kunnen worden aangemaakt.

---

## Scope

### In scope

1. **`/proposals/nieuw` aanmaakformulier** — fixt de huidige dode link. Klant selecteren, titel, geldig-tot, slides bewerken (structuur uit "default template"), prijsregels, opslaan als concept.
2. **Presentatie-layout** voor zowel de publieke klant-view (`/proposal/[token]`) als de PDF (`src/lib/proposal-pdf.tsx`). Bold-agency typografie in dark Autronis palette, full-bleed slides, één slide per "pagina".
3. **Demo-modus** op de publieke view: fullscreen, keyboard navigation, fade transities, progress bar, slide-counter. Werkt zowel vanuit de publieke view als vanuit een interne preview in `/proposals/[id]`.

### Out of scope (expliciet geparkeerd)

- AI-generator voor proposal inhoud (Claude schrijft slides)
- Template-bibliotheek (meerdere herbruikbare proposal structuren)
- Video / YouTube / Vimeo embed op slides
- Klant-logo upload op `klanten` entity
- Slide thumbnail navigator in demo-modus (Keynote-stijl)
- Print-CSS variant van de PDF
- Concurrency-locking (twee users editen dezelfde proposal tegelijk)
- Herintroductie van de digitale ondertekening (signing canvas) op de publieke view

---

## Design beslissingen (samenvatting)

| Beslissing | Keuze | Rationale |
|---|---|---|
| Visuele stijl | **B + D** — Bold agency typografie op dark Autronis palette | De proposal voelt als het product (dashboard) dat we pitchen; consistent met bestaande tokens |
| Slide-structuur | **B** — default 8 slides, bewerkbaar | Strakke consistentie + flexibiliteit voor edge cases; Cover en Investering zijn system slides |
| Content model | **C** — gestructureerd per slide-type + per-slide escape hatch naar free markdown | Elke slide rendert optimaal voor z'n type, maar rare gevallen blijven mogelijk |
| Media support | **B** — afbeeldingen only (background + inline) | Genoeg visuele knal zonder PDF-video complicaties |
| PDF parity | **A** — PDF render identiek aan web deck | Eén render-path, één WYSIWYG, geen "oude prijs in PDF" bugs |
| Demo-modus | **B** — fullscreen + fade + progress bar + slide-counter | Voelt als pro deck zonder overengineering |
| Signing flow | **D** — geen signing canvas; interne "Markeer als geaccepteerd" knop | Gebruik is toch altijd call + mail; DB kolommen blijven staan |
| Editor UX | **A** — linear stacked cards | Overzicht van hele deck op één pagina, snelle copy-edit |
| Image storage | **A** — Vercel Blob | Officiële Vercel oplossing, werkt lokaal en live identiek |

---

## Datamodel

De bestaande tabellen `proposals` en `proposalRegels` (`src/lib/db/schema.ts:733`) blijven ongewijzigd. Geen DB-migratie. Alleen de **inhoud** van de `secties` TEXT-kolom (JSON) krijgt een nieuwe shape.

### Nieuwe `Slide` discriminated union

```ts
type Slide =
  | CoverSlide
  | InvesteringSlide
  | MarkdownSlide
  | DeliverablesSlide
  | TijdlijnSlide
  | VrijSlide;

type CoverSlide = {
  id: string;
  type: "cover";
  actief: true;          // system slide, altijd actief
  bgImageUrl?: string;
};

type InvesteringSlide = {
  id: string;
  type: "investering";
  actief: true;          // system slide, altijd actief
  bgImageUrl?: string;
};

type MarkdownSlide = {
  id: string;
  type: "situatie" | "aanpak" | "waarom" | "volgende_stap";
  titel: string;
  body: string;          // markdown
  bgImageUrl?: string;
  actief: boolean;
};

type DeliverablesSlide = {
  id: string;
  type: "deliverables";
  titel: string;
  items: string[];       // bullet array
  bgImageUrl?: string;
  actief: boolean;
};

type TijdlijnSlide = {
  id: string;
  type: "tijdlijn";
  titel: string;
  fases: { naam: string; duur: string; omschrijving: string }[];
  bgImageUrl?: string;
  actief: boolean;
};

type VrijSlide = {
  id: string;
  type: "vrij";
  titel: string;
  body: string;          // markdown (escape hatch)
  bgImageUrl?: string;
  actief: boolean;
};
```

### Default template

Nieuwe proposal start met 8 slides:

1. Cover (system) — titel + klantnaam + datum + Autronis logo, auto
2. Situatie — `{ titel: "De situatie", body: "" }`
3. Aanpak — `{ titel: "Onze aanpak", body: "" }`
4. Deliverables — `{ titel: "Wat je krijgt", items: [] }`
5. Tijdlijn — `{ titel: "Tijdlijn", fases: [] }`
6. Investering (system) — leest auto uit `proposalRegels`
7. Waarom — `{ titel: "Waarom Autronis", body: "" }`
8. Volgende stap — `{ titel: "Volgende stap", body: "" }`

Cover en Investering kunnen niet verwijderd of verplaatst. De rest wel.

### Backwards compatibility

Bestaande proposals in productie hebben oude shape:
```ts
{ id, titel, inhoud, actief }[]
```

**Read path** (`parseSlides` helper in `src/lib/proposal-schema.ts`):
1. Probeer zod parse op nieuwe `Slide[]` shape
2. Als dat faalt: detecteer oude shape en map elke entry naar `{ id, type: "vrij", titel, body: inhoud, actief }`
3. Als dat óók faalt: return empty array, log error

**Write path:** bij elke `PUT /api/proposals/[id]` wordt het nieuwe format weggeschreven. Oude proposals migreren zichzelf bij eerste edit.

Geen bulk-migratie, geen downtime.

---

## Architectuur

### Directory layout

```
src/
├── app/(dashboard)/proposals/
│   ├── page.tsx                         # lijst — ongewijzigd
│   ├── nieuw/page.tsx                   # NIEUW
│   └── [id]/page.tsx                    # herschreven (gebruikt DeckEditor)
├── app/proposal/[token]/
│   └── page.tsx                         # publieke view — herschreven (gebruikt DeckViewer)
├── app/api/proposals/
│   ├── route.ts                         # GET/POST — POST accepteert nieuwe shape
│   ├── [id]/route.ts                    # GET/PUT/DELETE
│   ├── [id]/pdf/route.ts                # ongewijzigd, gebruikt nieuwe proposal-pdf module
│   ├── [id]/verstuur/route.ts           # ongewijzigd
│   ├── [id]/accepteren/route.ts         # NIEUW — markeer als ondertekend
│   └── upload-image/route.ts            # NIEUW — Vercel Blob upload
├── components/proposal-deck/
│   ├── Deck.tsx                         # container, rendert Slide[]
│   ├── DeckViewer.tsx                   # scroll + demo mode
│   ├── DeckEditor.tsx                   # linear stacked editor
│   ├── DemoMode.tsx                     # fullscreen wrapper + nav + transitions
│   ├── types.ts                         # re-export van Slide types
│   ├── defaults.ts                      # defaultSlides() template
│   ├── styles.ts                        # gedeelde kleuren/spacing tokens
│   ├── slides/
│   │   ├── CoverSlide.tsx
│   │   ├── MarkdownSlide.tsx            # situatie/aanpak/waarom/volgende_stap/vrij
│   │   ├── DeliverablesSlide.tsx
│   │   ├── TijdlijnSlide.tsx
│   │   └── InvesteringSlide.tsx
│   ├── editors/
│   │   ├── SlideCardShell.tsx           # drag handle, type badge, delete, bg uploader
│   │   ├── MarkdownEditor.tsx
│   │   ├── DeliverablesEditor.tsx
│   │   └── TijdlijnEditor.tsx
│   └── BackgroundImageUploader.tsx      # upload + URL paste
├── lib/
│   ├── proposal-schema.ts               # NIEUW — zod schema + parseSlides helper
│   └── proposal-pdf/                    # herschreven (was proposal-pdf.tsx)
│       ├── index.tsx                    # ProposalPDF export
│       ├── fonts.ts                     # Font.register() calls
│       ├── styles.ts                    # @react-pdf/renderer StyleSheet
│       ├── primitives.tsx               # Heading/Body/Bullet helpers
│       └── pages/
│           ├── CoverPage.tsx
│           ├── MarkdownPage.tsx
│           ├── DeliverablesPage.tsx
│           ├── TijdlijnPage.tsx
│           └── InvesteringPage.tsx
```

(sibling aan `src/`:)

```
public/
└── fonts/
    ├── Inter-Regular.ttf
    ├── Inter-SemiBold.ttf
    ├── Inter-Bold.ttf
    └── SpaceGrotesk-Bold.ttf
```

### Kernprincipe: één bron voor slide-content, twee render-paths

- **Web render path** — React components met Tailwind, gebruikt `components/proposal-deck/slides/*`
- **PDF render path** — `@react-pdf/renderer` primitives, gebruikt `lib/proposal-pdf/pages/*`

Beide paths lezen hetzelfde `Slide[]` object en delen constants via:
- `components/proposal-deck/styles.ts` — kleuren, spacing, font-sizes (voor web)
- `lib/proposal-pdf/styles.ts` — dezelfde waardes opnieuw als `@react-pdf` `StyleSheet`

De twee style files zijn DRY-gehouden door een gedeelde `src/lib/proposal-deck-tokens.ts` die alleen de raw values exporteert (`COLORS`, `FONT_SIZES`, `SPACING`), welke beide styles.ts files importeren.

---

## Frontend — Editor UX

### `/proposals/nieuw`

1. Klant-select modal opent direct bij page load (vereist voor Cover slide)
2. Na klant-select → linear stacked editor met `defaultSlides()` template (8 slides, leeg)
3. Metadata card bovenaan: klant (read-only na select), titel (required), geldig-tot (optional)
4. Slides sectie: scrollend onder elkaar, elke slide is een `SlideCardShell` met type-specifieke editor binnenin
5. Prijsregels sectie onderaan (bestaande UI hergebruiken uit `[id]/page.tsx`)
6. Actie-knoppen onderaan: Annuleren / Opslaan als concept / Preview ↗

### `/proposals/[id]`

Identieke component (`DeckEditor`), alleen:
- Initial state wordt geladen uit `GET /api/proposals/[id]` en door `parseSlides` gehaald
- Extra knop bovenaan: **"Markeer als geaccepteerd"** → `POST /api/proposals/[id]/accepteren`
- Extra knop: **"Download PDF"** (bestaand endpoint)
- Extra knop: **"Verstuur per e-mail"** (bestaand endpoint)

### SlideCardShell gedrag

- Drag handle (`@dnd-kit` — al in dependencies) links voor reorder
- Type badge bovenaan (bv. "Situatie", "Deliverables")
- ✕-knop rechts voor verwijderen (niet aanwezig op system slides)
- 🔒-icoon i.p.v. ✕ op Cover en Investering
- Collapsible "Achtergrondafbeelding" sub-section: upload button of URL paste
- Per slide een kleine toggle "Free markdown modus" die de type wisselt naar `vrij` (alleen voor niet-system slides)

### Validatie + error handling

- Client-side: alleen "klant" en "titel" als required check vóór submit
- Server-side: zod parse op `Slide[]` bij POST/PUT — returns 400 met `{ fout: "Slide X ongeldig: ..." }` bij mismatch
- Dirty state: `beforeunload` browser confirm bij navigeren met unsaved changes
- Auto-save: **nee**. Expliciet opslaan.

---

## Frontend — Publieke view (`/proposal/[token]`)

### Scroll-modus (default)

- Vertical scroll, `snap-y snap-mandatory`, elke slide `h-screen`
- Vast header boven: Autronis logo + slide teller (1/8), fade out na 3s inactiviteit
- Floating rechtsonder: **"Presenteren"** knop + **"Download PDF"** knop
- Op mobile (`< md` breakpoint): "Presenteren" verborgen — fullscreen API is onbetrouwbaar op iOS Safari

### Demo-modus (fullscreen)

- Klik "Presenteren" → `document.documentElement.requestFullscreen()`
- Volgende slide: → / Spatie / klik
- Vorige: ←
- Eerste/laatste: Home/End
- Toggle fullscreen: F
- Uit demo-modus: Esc (auto exit fullscreen)
- Fade transitie 200ms via `framer-motion` `AnimatePresence` (`opacity` + kleine `y-shift`)
- Progress bar 2px hoog onderin, teal, `width = (idx + 1) / total * 100%`
- Slide counter pill rechtsonder ("3 / 8")
- Cursor verdwijnt na 2s idle, komt terug bij muisbeweging

### Bekeken tracking

Bestaande logica op `/proposal/[token]` GET zet status op "bekeken" bij eerste view. Behouden. Interne preview vanuit `/proposals/[id]` opent `/proposal/[token]?preview=1` → tracking skippen als query param aanwezig én er is een geldige session.

---

## PDF rendering

### Page-formaat

**A4 landscape** (842×595 pt). Reden: bold-agency typografie en full-bleed kleurvlakken werken beter op breedte. In Acrobat fullscreen voelt de output als een keynote.

### Fonts

`Font.register()` in `src/lib/proposal-pdf/fonts.ts`:
- Inter Regular / SemiBold / Bold — body
- Space Grotesk Bold — headlines

TTF files gevendord in `public/fonts/`. `fonts.ts` wordt top-level geïmporteerd door `index.tsx` zodat registratie vóór de eerste render plaatsvindt.

### Kleuren

Hardcoded in `styles.ts` uit de gedeelde tokens file:
- bg `#0E1719`, card `#192225`, accent `#17B8A5`
- text primary `#FFFFFF`, text secondary `#A1AEB1`

### Per slide-type

Elke slide rendert als exact één `<Page>`:

- **CoverPage** — gigantische klantnaam (Space Grotesk Bold, ~72pt), project titel als subheading, datum rechtsonder, Autronis logo linksboven. Optional `bgImageUrl`.
- **MarkdownPage** — titel bovenaan (~40pt), body markdown → rendered als `<Text>` blocks. Subset van markdown: headings, bold, italic, bullets, links. Geen code blocks, geen images in-body (alleen als bg).
- **DeliverablesPage** — titel bovenaan, elke bullet als row met nummer (`01`, `02`, ...) in accent kleur + item text in groot font.
- **TijdlijnPage** — titel bovenaan, fases als horizontale row van cards (of vertical stacked bij > 4 fases). Elke card: `naam` groot, `duur` in accent, `omschrijving` klein.
- **InvesteringPage** — tabel met prijsregels compact bovenin (omschrijving, aantal, eenheidsprijs, subtotaal), **totaalbedrag groot in het midden** als impact-getal (Space Grotesk Bold, ~100pt, accent color).

### Achtergrondafbeeldingen

```tsx
<Page size="A4" orientation="landscape" style={pageStyle}>
  {slide.bgImageUrl && (
    <>
      <Image src={slide.bgImageUrl} style={absoluteFillStyle} />
      <View style={darkOverlayStyle} /> {/* rgba(14,23,25,0.75) */}
    </>
  )}
  <View style={contentStyle}>...</View>
</Page>
```

`@react-pdf/renderer` fetcht remote URLs server-side tijdens render. Blob URLs zijn publiek bereikbaar, dus dit werkt out-of-the-box. Eerste render duurt ~1-2s extra per image; acceptabel voor een download endpoint.

### Overflow

Voor MVP: vaste font-sizes. Als tekst overflowt, `<Text wrap>` handelt het binnen de page. Geen dynamic font-sizing; als het echt te lang wordt is dat een content probleem, niet een layout probleem. Edge case voor later.

### Interface compatibility

`src/lib/proposal-pdf/index.tsx` exporteert `ProposalPDF` met exact dezelfde props als de huidige `src/lib/proposal-pdf.tsx`:

```ts
{
  proposal: { titel, klantNaam, klantContactpersoon, klantAdres, datum, geldigTot, totaalBedrag },
  secties: Slide[],      // was: oude shape
  regels: ProposalRegel[],
  bedrijf: Bedrijfsinstellingen,
}
```

`api/proposals/[id]/pdf/route.ts` hoeft dus niet te wijzigen behalve dat `secties` nu door `parseSlides` gehaald wordt voordat het naar de component gaat.

---

## API endpoints

### Bestaande (interne update)

- `GET /api/proposals` — ongewijzigd
- `POST /api/proposals` — body valideert nu tegen `Slide[]` via zod
- `GET /api/proposals/[id]` — returnt inclusief `parseSlides(row.secties)` → gegarandeerd nieuwe shape naar frontend
- `PUT /api/proposals/[id]` — body valideert tegen `Slide[]` via zod
- `DELETE /api/proposals/[id]` — ongewijzigd
- `GET /api/proposals/[id]/pdf` — update: laadt `parseSlides` voordat render
- `POST /api/proposals/[id]/verstuur` — ongewijzigd

### Nieuw

- **`POST /api/proposals/upload-image`**
  - Auth: `requireAuth()`
  - Body: `multipart/form-data` met `file`
  - Validatie: MIME `image/jpeg` | `image/png` | `image/webp`, max 5MB
  - Actie: `put(filename, file, { access: 'public' })` via `@vercel/blob`
  - Response: `{ url: string }`
  - Error: `{ fout: string }` met 400 (mime/size) of 500 (blob error) of 401 (auth)

- **`POST /api/proposals/[id]/accepteren`**
  - Auth: `requireAuth()`
  - Actie: zet `status = 'ondertekend'`, `ondertekendOp = datetime('now')`, `ondertekendDoor = <handmatig ingevulde naam of null>`
  - Body: `{ naam?: string }` — optioneel, handmatige input door user
  - Response: `{ succes: true }`
  - Vervangt de klant-facing signing canvas uit de oude versie

### Zod schema

Nieuwe file `src/lib/proposal-schema.ts`:

```ts
export const slideSchema = z.discriminatedUnion("type", [
  coverSchema,
  investeringSchema,
  markdownSchema,
  deliverablesSchema,
  tijdlijnSchema,
  vrijSchema,
]);

export const slidesSchema = z.array(slideSchema);

export function parseSlides(raw: string | null): Slide[] {
  if (!raw) return defaultSlides();
  try {
    const parsed = JSON.parse(raw);
    const result = slidesSchema.safeParse(parsed);
    if (result.success) return result.data;
    // backwards-compat: map oude {titel, inhoud} shape
    if (Array.isArray(parsed) && parsed.every(s => "titel" in s && "inhoud" in s)) {
      return parsed.map(s => ({
        id: s.id ?? crypto.randomUUID(),
        type: "vrij" as const,
        titel: s.titel ?? "",
        body: s.inhoud ?? "",
        actief: s.actief ?? true,
      }));
    }
    console.error("parseSlides: onbekende shape", result.error);
    return [];
  } catch (err) {
    console.error("parseSlides: JSON parse failed", err);
    return [];
  }
}
```

---

## Risico's en mitigaties

| Risico | Kans | Impact | Mitigatie |
|---|---|---|---|
| `@react-pdf/renderer` crasht op onbekende slide-type | Laag | Medium | Catch-all `default` case in PDF page switch → rendert fallback page met alleen titel, log error naar server |
| `BLOB_READ_WRITE_TOKEN` ontbreekt lokaal bij dev | Hoog | Laag | Upload endpoint returnt duidelijke 500 met "BLOB_READ_WRITE_TOKEN niet ingesteld in env"; niet stilletjes falen |
| Custom fonts niet bereikbaar tijdens PDF render | Laag | Hoog | Fonts gevendord in `public/fonts/*.ttf`, niet via CDN. Register met absolute paths via `path.join(process.cwd(), ...)` |
| iOS Safari fullscreen werkt half | Zeker | Laag | "Presenteren" knop verborgen op `< md` breakpoint; scroll-modus blijft volledig functioneel |
| Achtergrondafbeelding té licht → tekst onleesbaar | Medium | Medium | Vaste dark overlay `rgba(14,23,25,0.75)` over bgImage, niet door user configureerbaar |
| Editor state verloren bij page refresh | Medium | Laag | `beforeunload` browser confirm bij dirty state. Geen localStorage drafts (overengineering) |
| Oude proposals breken na deploy | Medium | Hoog | Backwards-compat read path in `parseSlides` + handmatige smoke test op een bestaande proposal vóór merge |
| Vercel Blob gratis tier overschreden | Laag | Laag | 1GB gratis = ruim voor een paar proposals per maand; monitor via Vercel dashboard |

---

## Testing strategie

Project heeft geen unit test infrastructure. Wel:

1. **Type check verplicht na elke wijziging**: `npx tsc --noEmit`
2. **Manual smoke test matrix vóór merge**:
   - ✅ Open een bestaande proposal uit productie in `/proposals/[id]` — verifieer backwards-compat mapping (alle oude secties komen door als `vrij` slides, inhoud klopt)
   - ✅ Maak nieuwe proposal via `/proposals/nieuw` met alle 8 default slides + 2 afbeeldingen (één bg, één inline) + 3 prijsregels
   - ✅ Open via `/proposal/[token]` in incognito, scroll door alle slides
   - ✅ Klik "Presenteren" → fullscreen, arrow keys, progress bar, fade transitions, Esc
   - ✅ Klik "Download PDF" → open in Preview → vergelijk visueel met web view
   - ✅ Edge cases: lege body slide, zeer lange body (overflow check), afbeelding van 4MB, klant zonder `contactpersoon`
   - ✅ `/proposals/[id]` → "Markeer als geaccepteerd" → verifieer status en `ondertekendOp` in DB
3. **Visual check op Vercel preview deployment** voordat merge naar `main`

---

## Plan voor later (niet nu)

- Klant-logo veld op `klanten` entity + upload → Cover slide toont klant-logo naast Autronis logo
- AI-generator die Claude inzet om slide-inhoud te drafteren vanuit een korte klant-brief
- Template-bibliotheek met meerdere opinionated deck-structuren (korte pitch, lange statement of work, workshop-deck)
- Video embed op slides (met poster fallback voor PDF)
- Concurrency locking voor twee users die tegelijk bewerken
- Print-optimized PDF variant (wit bg, donkere tekst) voor klanten die toch willen printen
- Herintroductie van digitale ondertekening als een "Ondertekenen" knop onderaan de scroll view (niet inline op een slide)
