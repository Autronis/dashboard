# Project Intake Flow — complete 6-fase spec

Dit document is de **volledige specificatie** van de Project Intake Flow voor Autronis. Het beschrijft wat er gebeurt vanaf het moment dat Sem of Syb iets zegt als "voor klant X willen we Y bouwen" tot en met het moment dat de klant akkoord geeft en het echte werk begint.

**Deze doc gebruik je op twee manieren:**
1. Als checklist voor Claude Code sessies om de flow correct uit te voeren
2. Als referentie voor wat er al af is (✅) en wat nog open staat

## Status overview (per 2026-04-14)

| Fase | Naam | Status |
|---|---|---|
| 1 | Concept + eigenaar + project aanmaken | ✅ gedeployed |
| 2 | Schema + Vercel Blob storage | ⏳ open — wacht op go |
| 3 | Scope-generator integratie | ⏳ open |
| 4 | Merge offertes + proposals | ⏳ open |
| 5 | Wizard UI (`/projecten/intake`) | ⏳ open |
| 6 | Chat-trigger detectie in CLAUDE.md | ✅ gedeployed (regels staan erin) |

Fases 2-6 zijn gedocumenteerd in detail hieronder zodat Claude (Sem's of Syb's) ze kan uitvoeren wanneer Sem expliciet zegt "ga voor fase 2".

---

## Fase 1 — Concept + eigenaar + project aanmaken ✅

**Wat werkt:**

### Intent detectie (in CLAUDE.md)

Claude Code herkent trigger-zinnen in chat en start automatisch de intake flow:

- "voor klant X willen we Y bouwen / opzetten / automatiseren"
- "we hebben een nieuwe klant en die wil ..."
- "kunnen we voor [bedrijfsnaam] een [systeem] maken"
- "ik heb een idee voor [bedrijf/klant]: ..."
- "nieuw project: [naam]"

Bij match reageert Claude NIET met "goed idee, laten we het aanpakken" — hij start de flow.

### De 6 stappen binnen fase 1

**Stap 1: Concept herhalen + eigenaar vragen**
Claude vraagt expliciet: "Voor wie is dit project? sem, syb, team, of vrij?"

| Code | Betekenis |
|---|---|
| `sem` | Alleen Sem (klant of intern) — Syb ziet 'm niet |
| `syb` | Alleen Syb — Sem ziet 'm niet |
| `team` | Beiden — beiden zien 'm |
| `vrij` | Niet toegewezen — beiden zien 'm |

De API weigert sinds deze fase elke nieuw-project call zonder geldige `eigenaar` met een **HTTP 400**. De `auto-sync-taken.py` hook herkent die 400 en print een systemMessage zodat Claude weet: vraag eerst de eigenaar.

**Stap 2: Project aanmaken in dashboard**

```bash
curl -X POST "$URL/api/projecten" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"naam":"Klant X automation","eigenaar":"team","omschrijving":"..."}'
```

Dit triggert automatisch:
- GitHub repo aanmaken onder `github.com/Autronis/<slug>`
- Project in dashboard met juiste eigenaar-visibiliteit

Claude bevestigt: *"Project '[naam]' aangemaakt in dashboard. GitHub repo: [url]."*

**Stap 3: Creatieve invalshoeken (3-5)**

Claude brainstormt proactief 3-5 concrete richtingen waar dit project waarde kan leveren:

```markdown
Ik zie deze invalshoeken:

1. **[richting naam]** — [wat het is, wat het oplost, voor wie waarde]
2. **[richting naam]** — [...]
3. ...

Welke richting (of combinatie) spreekt je het meest aan?
```

Wacht op Sem's selectie. Sla die op voor stap 4.

**Stap 4: Scope generatie aanbieden**

Claude vraagt: *"Wil je dat ik nu het volledige scope-plan opstel? Ik gebruik de scope-generator skill die door 6 fases gaat (klantinfo, processen, advies, pricing, format, bevestiging) en levert een PDF op."*

- **JA** → invoke de `/scope` skill (zit in `~/.claude/skills/scope/`). Output = JSON + PDF.
- **NEE** → skip naar stap 5 met de melding "OK, scope kan later via dashboard. Project staat klaar."

**Stap 5: Klant koppeling — UITGESTELD** ⚠️ **KRITIEK**

**Maak in deze stap NU GEEN klant aan in het dashboard**. Project bestaat prima zonder klant zolang er nog geen deal is. Claude meldt:

*"Klant koppeling staat uit tot er akkoord is. Ping me wanneer 't zover is."*

**Stap 6: Klant aanmaken + project koppelen (later, na akkoord)**

Triggert pas wanneer Sem of Syb zegt: *"klant heeft akkoord", "scope geaccepteerd", "we mogen beginnen", "deal rond"*.

```bash
# 1. Klant aanmaken
curl -X POST "$URL/api/klanten" -H "..." -d '{
  "bedrijfsnaam": "Klant X BV",
  "contactpersoon": "Jan Jansen",
  "email": "jan@klantx.nl",
  "telefoon": "+31 ...",
  "adres": "...",
  "kvkNummer": "...",
  "btwNummer": "...",
  "uurtarief": 95,
  "branche": "..."
}'
# Krijg klantId terug

# 2. Koppel aan project
curl -X PUT "$URL/api/projecten/[id]" -H "..." -d '{"klantId": 42}'
```

Claude bevestigt: *"Klant [naam] aangemaakt en gekoppeld aan project. Alles staat in dashboard onder /klanten/[id]."*

### Skip condities voor fase 1

Claude slaat (delen van) de flow over als:

- Project bestaat al in dashboard → niet opnieuw aanmaken, sluit aan bij bestaande
- Sem zegt expliciet "skip de scope" → spring naar stap 5
- Het is een intern Autronis project zonder externe klant → stappen 5+6 niet van toepassing
- Sem zegt "alleen aanmaken, ik vul de rest later in" → doe alleen stappen 1+2, sla 3-6 over

### Wat Claude NOOIT doet in fase 1

- Aannames over eigenaar — altijd vragen
- Klant aanmaken voor er akkoord is
- Scope genereren zonder uitdrukkelijke OK in stap 4
- Project aanmaken zonder stap 1 (eigenaar) eerst af te ronden

### Files die fase 1 raakte (al gedeployed)

- [`src/app/(dashboard)/projecten/page.tsx`](../src/app/(dashboard)/projecten/page.tsx) — Nieuw Project modal met eigenaar selector
- [`src/components/projecten/klant-picker.tsx`](../src/components/projecten/klant-picker.tsx) — searchable klant dropdown
- [`src/app/api/projecten/route.ts`](../src/app/api/projecten/route.ts) — eigenaar enforcement (400 bij missing)
- [`src/app/api/projecten/sync-taken/route.ts`](../src/app/api/projecten/sync-taken/route.ts) — idem voor auto-create
- `~/Autronis/CLAUDE.md` — intake intent detectie regels
- `~/.claude/hooks/auto-sync-taken.py` — 400 error → systemMessage

---

## Fase 2 — Schema + Vercel Blob storage ⏳

**Niet zomaar starten zonder Sem's expliciete go ("ga voor fase 2").** Reken op ~2 uur werk.

### DB migratie

Voeg kolommen toe aan `projecten`:

```ts
// src/lib/db/schema.ts — projecten table
scope_data: text("scope_data"),         // JSON payload van scope-generator skill
scope_pdf_url: text("scope_pdf_url"),   // Vercel Blob URL
```

Nieuwe tabel voor wizard state:

```ts
export const projectIntakes = sqliteTable("project_intakes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projecten.id),
  stap: text("stap").default("concept"),
    // "concept" | "eigenaar" | "aangemaakt" | "invalshoeken" | "scope" | "klant" | "compleet"
  klantConcept: text("klant_concept"),
  creatieveIdeeen: text("creatieve_ideeen"),  // JSON array van 3-5 richtingen
  gekozenInvalshoek: text("gekozen_invalshoek"),
  scopeStatus: text("scope_status").default("niet_gestart"),
    // "niet_gestart" | "bezig" | "klaar" | "mislukt"
  bron: text("bron").default("dashboard"),    // "chat" | "dashboard"
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});
```

Auto-migrate in [`src/lib/db/index.ts`](../src/lib/db/index.ts) — zowel Turso als lokale SQLite:

```ts
// Turso
client.execute("ALTER TABLE projecten ADD COLUMN scope_data TEXT").catch(() => {});
client.execute("ALTER TABLE projecten ADD COLUMN scope_pdf_url TEXT").catch(() => {});
client.execute(`CREATE TABLE IF NOT EXISTS project_intakes (...)`).catch(() => {});
```

### Vercel Blob setup

1. In Vercel dashboard: enable Blob storage voor autronis-dashboard project
2. Kopieer `BLOB_READ_WRITE_TOKEN` naar:
   - Lokaal `.env.local`
   - Vercel env vars (alle 3 environments: production + preview + development)
   - 1Password voor sharing met Syb
3. Install: `npm install @vercel/blob`

### Upload endpoint

```ts
// src/app/api/projecten/[id]/scope/upload/route.ts
import { put } from "@vercel/blob";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const file = await req.blob();
  const blob = await put(`scope-${id}-${Date.now()}.pdf`, file, {
    access: "public",
    contentType: "application/pdf",
  });
  await db.update(projecten)
    .set({ scope_pdf_url: blob.url })
    .where(eq(projecten.id, Number(id)));
  return NextResponse.json({ url: blob.url });
}
```

### Acceptance criteria

- [ ] Migratie lokaal + Turso toegepast, schema.ts matches
- [ ] `BLOB_READ_WRITE_TOKEN` staat in alle 3 Vercel envs
- [ ] Upload endpoint geeft public URL terug
- [ ] Test: PDF uploaden via `curl -X POST ... -T test.pdf` werkt

---

## Fase 3 — Scope-generator integratie ⏳

Reken op ~2 uur.

### Context

De scope-generator is een **bestaande repo**: `https://github.com/Autronis/scope-generator.git`. Die heeft een Claude skill die door 6 fases loopt (klantinfo → processen → advies → pricing → format → bevestiging) en een JSON output produceert. Een aparte Node script `generate-pdf.js` zet die JSON om naar een PDF via `@react-pdf/renderer`.

### Cross-platform fix

Het script heeft een **hardcoded Windows path** die we moeten vervangen:

```js
// generate-pdf.js line 8 — HUIDIG (werkt alleen op Syb's laptop):
const OUTPUT_DIR = path.join('C:', 'Users', 'syb20', 'Projects', 'scope-plans');

// VERVANGEN DOOR:
const OUTPUT_DIR = path.join(os.homedir(), 'Autronis', 'scope-plans');
```

**Ook checken**: line 7 heeft een hardcoded logo path. Verifieer dat `~/.claude/brand-assets/logo/autronis logo no background.png` bestaat op beide laptops.

### Setup beide laptops

Clone naar `~/.claude/skills/scope/` (op Windows: `%USERPROFILE%\.claude\skills\scope\`):

```bash
# Mac
cd ~/.claude/skills
git clone https://github.com/Autronis/scope-generator.git scope

# Windows (PowerShell)
cd $env:USERPROFILE\.claude\skills
git clone https://github.com/Autronis/scope-generator.git scope
```

### Dashboard endpoint

```ts
// src/app/api/projecten/[id]/genereer-scope/route.ts
// Body: { scopeData: ScopeJSON } — output van de skill
// Response: { scope_pdf_url }

export async function POST(req, { params }) {
  await requireAuth();
  const { id } = await params;
  const { scopeData } = await req.json();

  // Opslaan van JSON
  await db.update(projecten).set({
    scope_data: JSON.stringify(scopeData),
  }).where(eq(projecten.id, Number(id)));

  // Spawn de PDF generator als subprocess
  // Of: inline import als het een pure lib is
  // Stream PDF naar /api/projecten/[id]/scope/upload uit fase 2
  // Update scope_pdf_url

  return NextResponse.json({ scope_pdf_url: blobUrl });
}
```

### Acceptance criteria

- [ ] `generate-pdf.js` path fix gepushd naar `Autronis/scope-generator`
- [ ] Beide laptops hebben `scope` skill gecloned in `.claude/skills/`
- [ ] Dashboard endpoint ontvangt scopeData, roept skill aan, uploadt PDF naar Blob, schrijft URL naar DB
- [ ] Getest met dummy scope data end-to-end

---

## Fase 4 — Merge offertes + proposals ⏳

Reken op ~1 uur.

### Context

Momenteel zijn er twee overlappende tabellen:
- `offertes` — uitgebreider schema, gebruikt in facturatie flow
- `proposals` — simpeler, gebruikt in nog te ontwikkelen sales flow

Beide zijn **LEEG** (0 rows elk, geverifieerd). Geen data migratie risico.

### Actie

1. `offertes` wordt de canonical tabel
2. Verwijder `/proposals` pages + `/api/proposals/*` routes
3. Verwijder `proposals` tabel uit `schema.ts`
4. Update sidebar nav (haal "Proposals" weg)
5. Verifieer dat `/offertes` alle use cases dekt (offerte opstellen, aanpassen, versturen, akkoord)

### Acceptance criteria

- [ ] `proposals` tabel weg uit schema
- [ ] `/proposals` pages weg
- [ ] `/api/proposals/*` routes weg
- [ ] Sidebar entry weg
- [ ] Geen verwijzingen meer in codebase (`grep -r "proposals" src/` clean)

---

## Fase 5 — Wizard UI (`/projecten/intake`) ⏳

Reken op ~halve dag.

### Pagina structuur

Nieuwe pagina `/projecten/intake` met multi-step wizard:

```
┌──────────────────────────────────────────┐
│  Nieuwe Project Intake                  │
│  ●───○───○───○───○  (stap 1 van 5)      │
├──────────────────────────────────────────┤
│                                          │
│  Stap 1: Concept & creatieve invalshoeken│
│                                          │
│  [Klant / bedrijf naam]                  │
│  [Wat willen ze bereiken?]               │
│                                          │
│  ⚡ Genereer invalshoeken                │
│                                          │
│  [3-5 cards met AI suggesties]           │
│                                          │
│  [Volgende stap →]                       │
└──────────────────────────────────────────┘
```

Stappen:
1. **Concept + AI invalshoeken** — input velden + Claude API call voor 3-5 richtingen
2. **Eigenaar kiezen** — 4-knop selector (sem/syb/team/vrij)
3. **Project basis aanmaken** — POST `/api/projecten` + bevestigingscard
4. **Scope generatie** — loopt door de 6 scope-generator fases inline, toont progress, uploadt PDF
5. **Klant gegevens** — uitgesteld tot akkoord, met "Stuur scope naar klant" knop

### State management

Elke stap schrijft naar `project_intakes` tabel (uit fase 2). Zo kan je intake halverwege onderbreken en later oppakken. Query key: `project-intakes`.

### Dashboard home widget

Nieuwe widget "Open intakes" onder `/` (dashboard home):

```
📋 Open intakes (2)
├── Klant X — stap 3 (project aangemaakt)
└── Klant Y — stap 5 (wachten op akkoord)
```

### Acceptance criteria

- [ ] `/projecten/intake` page met multi-step wizard
- [ ] State persist via `project_intakes`
- [ ] AI invalshoeken werkt end-to-end
- [ ] Scope generatie inline werkt (niet losse skill run)
- [ ] Home widget "Open intakes" zichtbaar
- [ ] Resumable — refresh midden in een wizard herstelt de state

---

## Fase 6 — Chat-trigger detectie ✅

**Wat werkt:**

In `~/Autronis/CLAUDE.md` staat een sectie "Project Intake — Intent detectie & flow" die Claude leert wanneer hij de intake moet triggeren bij trigger-zinnen in chat.

Dit hoeft niet opnieuw gedeployed. Als Sem of Syb iets zegt als "voor klant X willen we Y bouwen", begint Claude automatisch fase 1.

**Wat er nog kan verbeteren (later):**

- Bij het triggeren van de flow kan Claude nu nog geen knop in het dashboard openen (jij moet 'm handmatig naar `/projecten/intake` sturen). Zou automatisch kunnen: Claude opent een Deep Link in een popup of toast op het dashboard.

---

## Setup checklist voor beide laptops

### Files die beide laptops nodig hebben

1. **`~/Autronis/CLAUDE.md`** met de "Project Intake" sectie (al gedeployed, in git)
2. **`~/.claude/skills/scope/`** — scope-generator repo cloned (fase 3)
3. **`~/.claude/brand-assets/logo/autronis logo no background.png`** — voor PDF generator
4. **`~/.claude/hooks/auto-sync-taken.py`** (Mac) of `.cmd` (Windows) — zodat sync hooks werken
5. **`~/.config/autronis/claude-sync.json`** met dashboard_url + api_key

### Env vars die beide laptops nodig hebben

Zie [`synchronisatie-flow.md`](./synchronisatie-flow.md) voor de volledige lijst. Specifiek voor intake flow:

- `BLOB_READ_WRITE_TOKEN` — vanaf fase 2
- `ANTHROPIC_API_KEY` — voor invalshoeken + scope generatie

### Scope-generator cross-platform fix

Zie fase 3. Deze moet gepushed zijn naar `Autronis/scope-generator` op GitHub voor Syb 'm via `git pull` kan ophalen.

### Claude Code restart

Na elke wijziging in `CLAUDE.md` of `~/.claude/hooks/` moet Claude Code opnieuw gestart worden om de nieuwe regels/hooks te laden.

---

## Hoe je dit document bijwerkt

Elke keer dat een fase wordt uitgevoerd:
1. Wijzig de status in de tabel bovenaan (⏳ → ✅)
2. Voeg nieuwe subsecties toe als er details boven water komen
3. Commit naar `feat/<sectie>` worktree indien parallel werk, anders direct `main`
4. Auto-sync hook meldt de voortgang automatisch in het dashboard

## Gerelateerde docs

- [`synchronisatie-flow.md`](./synchronisatie-flow.md) — hoe beide laptops samenwerken
- [`cluster-briefing-voor-syb.md`](./cluster-briefing-voor-syb.md) — cluster systeem voor Syb
