# Second Brain Module — Design Spec

## Overzicht

Standalone AI-powered kennismodule op `/second-brain`. Één plek waar je alles in gooit — tekst, URLs, afbeeldingen, PDFs, code snippets. AI organiseert het automatisch (tags, samenvattingen) en maakt het doorzoekbaar via natuurlijke vragen.

## Scope v1

**In scope:**
- Quick-add bar met auto-detectie van type (tekst, URL, code)
- Bestandsupload (afbeeldingen, PDFs)
- AI auto-categorisering (tags + samenvatting via Claude)
- AI-powered zoeken (conversational antwoorden met bronverwijzingen)
- Feed view met filters op type en tag
- Detail modal per item
- Favorieten en archiveren
- Globale quick-add via CommandPalette (⌘K)
- Dashboard widget "Recent opgeslagen"

**Buiten scope (v2):**
- Auto-linking ("dit lijkt op je notitie over X")
- Wekelijkse digest
- Voice notes / Whisper transcriptie
- Koppelingen met wiki/meetings/learning radar UI
- Vector database / embeddings

## Aanpak

Standalone module (Aanpak A). Eigen tabel, eigen API routes, eigen pagina. Hergebruikt bestaande patronen: query hooks, file uploads, Claude API, toast notificaties, CommandPalette.

## Database

Eén nieuwe tabel `second_brain_items`:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| `id` | integer PK | Auto-increment |
| `gebruiker_id` | integer FK → gebruikers | Wie heeft het opgeslagen |
| `type` | text | `tekst`, `url`, `afbeelding`, `pdf`, `code` |
| `titel` | text | Door gebruiker of AI gegenereerd |
| `inhoud` | text | Ruwe inhoud (tekst, URL, code snippet, transcriptie) |
| `ai_samenvatting` | text | Door Claude gegenereerde samenvatting |
| `ai_tags` | text (JSON) | Auto-gegenereerde tags (`["technologie", "n8n", "webhook"]`) |
| `bron_url` | text | Originele URL (voor bookmarks) |
| `bestand_pad` | text | Pad naar upload (afbeeldingen, PDFs) |
| `taal` | text | Voor code snippets (bijv. `typescript`, `python`) |
| `is_favoriet` | integer | 0/1 boolean |
| `is_gearchiveerd` | integer | 0/1 boolean, soft delete |
| `aangemaakt_op` | text | ISO timestamp |
| `bijgewerkt_op` | text | ISO timestamp |

Geen aparte tags-tabel — JSON array in `ai_tags` volstaat voor 2 gebruikers. Geen vector database — Claude's context window + tekst-matching is voldoende voor honderden items.

## API Routes

```
/api/second-brain/
├── route.ts              — GET (lijst + filters) / POST (nieuw item)
├── [id]/
│   └── route.ts          — GET / PUT / DELETE (enkel item)
├── zoeken/
│   └── route.ts          — POST (AI-powered zoeken via Claude)
└── verwerken/
    └── route.ts          — POST (upload + AI verwerking)
```

### GET /api/second-brain

Query params: `?type=`, `?tag=`, `?zoek=` (tekst search), `?favoriet=1`, `?gearchiveerd=0` (default).

Response:
```json
{
  "items": [...],
  "kpis": {
    "totaal": 42,
    "deze_week": 7,
    "per_type": { "tekst": 20, "url": 15, "code": 7 }
  }
}
```

### POST /api/second-brain

Body: `{ type, titel?, inhoud, taal? }`

Voor tekst en code. Claude genereert titel (als ontbreekt), samenvatting en tags async na opslaan. Item verschijnt direct in de feed, AI-velden vullen zich later aan.

### POST /api/second-brain/verwerken

FormData met `file` + `type`. Voor afbeeldingen en PDFs:
1. Bestand opslaan in `/data/uploads/second-brain/`
2. Claude Vision analyseert de inhoud (afbeeldingen) of tekst extractie (PDFs)
3. Genereert titel, samenvatting, tags
4. Slaat item op met `bestand_pad`

Voor URLs: body `{ type: "url", bron_url: "https://..." }`
1. Fetch URL metadata (titel, description via HTML parsing)
2. Claude genereert samenvatting + tags
3. Slaat item op

### POST /api/second-brain/zoeken

Body: `{ vraag: "wat weet ik over n8n webhooks?" }`

Flow:
1. Haal alle niet-gearchiveerde items op van de gebruiker
2. Bij 100+ items: stuur alleen titels + samenvattingen + tags naar Claude
3. Claude geeft conversational antwoord + verwijst naar items by ID
4. Response: `{ antwoord: "...", bronnen: [{ id, titel }] }`

### GET/PUT/DELETE /api/second-brain/[id]

Standaard CRUD. PUT voor titel/inhoud/tags bewerken, favoriet toggle. DELETE zet `is_gearchiveerd = 1`.

## UI

### /second-brain pagina

Drie zones:

1. **Quick-add bar** — groot invoerveld bovenaan met placeholder "Typ, plak een URL, of sleep een bestand...". Auto-detectie: URL pattern → bookmark, code fencing → code snippet, anders → tekst. Upload knop (icoon) voor bestanden.

2. **Filter bar** — type-knoppen (Alles / Tekst / URLs / Afbeeldingen / PDFs / Code) + tag-filter dropdown + zoekbalk. Zelfde patroon als Taken-pagina.

3. **Feed** — chronologische lijst van cards. Elke card: type-icoon, titel, AI-samenvatting preview, tags als pills, datum. Click opent detail modal.

### AI Zoekpagina

Aparte tab binnen /second-brain (tabs: "Feed" en "AI Zoeken"). Zoekbalk bovenaan, conversational antwoord eronder met klikbare bronverwijzingen naar items. Vergelijkbaar met AI Assistent maar scoped naar Second Brain data.

### Detail Modal

Bij click op item: modal met volledige inhoud, AI-samenvatting, bewerkbare tags, favoriet toggle, verwijder knop. Type-specifiek: afbeelding preview, code met syntax highlighting, URL met klikbare link.

### Globale Quick-Add (⌘K)

Bestaande `CommandPalette` krijgt "Opslaan in Second Brain" actie. Input → auto-detectie type → POST → toast bevestiging. Geen navigatie nodig.

### Dashboard Widget

"Recent opgeslagen" card in homepage grid. Toont 5 recentste items met type-icoon, titel, tijdstip. Click navigeert naar /second-brain.

## AI Integratie

### Auto-categorisering

Bij elk nieuw item stuurt de API de inhoud naar Claude:

```
Analyseer dit item en geef JSON terug:
1. titel (als die ontbreekt, genereer een korte titel)
2. samenvatting (1-2 zinnen)
3. tags uit: technologie, klant, idee, geleerde-les, tool, referentie, proces, inspiratie
4. vrije tags die relevant zijn
```

Gebeurt async — item is direct zichtbaar, AI-velden laden na. Optimistic UI met loading state op tags/samenvatting.

### Async AI verwerking

Na opslaan van een item: de API response gaat direct terug (item zonder AI-velden). Vervolgens wordt Claude aangeroepen in dezelfde request via een fire-and-forget patroon (geen `await` op de Claude call). De frontend pollt het item na 3-5 seconden om de AI-velden op te halen. Alternatief: client pollt via `useQuery` met korte `refetchInterval` totdat `ai_tags` gevuld is.

### AI-zoeken

Prompt structuur:
```
Je bent een kennisassistent. De gebruiker heeft deze items opgeslagen:
[items met titel, samenvatting, tags, id]

Beantwoord de volgende vraag op basis van deze kennis.
Verwijs naar specifieke items met hun ID.
Vraag: {gebruiker_vraag}
```

Bij 100+ items: eerst titels + tags sturen, Claude selecteert relevante items, dan full content van die items meesturen voor gedetailleerd antwoord.

## Sidebar Navigatie

Nieuw item in de "Content & Kennis" groep:
- Icoon: `Brain` (lucide-react)
- Label: "Second Brain"
- Route: `/second-brain`

## Bestandsopslag

Lokale opslag in `/data/uploads/second-brain/` — consistent met bestaande upload patronen. Bestandsnaam: `{timestamp}-{originele-naam}`.

## Koppelingen (v1)

- **CommandPalette:** Nieuwe actie "Opslaan in Second Brain"
- **Dashboard:** Nieuwe widget "Recent opgeslagen"
- **Overige modules:** Geen directe koppelingen in v1. De API staat open voor toekomstige integraties.
