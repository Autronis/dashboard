# HANDOFF — Leads Redesign (parallel chats)

**Status**: shared design-system componenten zijn af, nu tabs upgraden. Werk is gesplitst in onafhankelijke chunks zodat 2 chats parallel kunnen draaien zonder merge-conflicten.

**Doel**: alle `/leads/*` pagina's mooier/cleaner, functioneel niks missen t.o.v. Syb's [`lead-dashboard-v2`](https://github.com/Autronis/lead-dashboard-v2). Plus een `/leads/errors` viewer toevoegen voor volledige parity.

---

## Wat al af is (niet opnieuw doen)

Nieuwe shared componenten in [`src/components/leads/`](src/components/leads/):

| Bestand | Wat |
|---|---|
| [kpi-tile.tsx](src/components/leads/kpi-tile.tsx) | `<LeadsKpiTile>` — klikbare KPI tile met 7 accent-kleuren (cyan/blue/green/purple/red/amber/pink), optionele `active` state, `sub`-tekst, staggered fade-in. Gebruik op Dashboard + Overzicht + Enrichment stats. |
| [source-badge.tsx](src/components/leads/source-badge.tsx) | `<SourceBadge source={lead.source}>` — LinkedIn / Maps / Website pill met icon, ring-border. `compact` prop voor tight tabel-cellen. |
| [lead-status-badge.tsx](src/components/leads/lead-status-badge.tsx) | `<LeadStatusBadge status={...}>` — één badge voor àlle statussen (email pipeline, enrichment, website-confidence, scraper runs). Spin-animatie voor pending/generating/sending automatisch. |
| [folder-chip.tsx](src/components/leads/folder-chip.tsx) | `<FolderChip folder={l.folder}>` — klikbare link naar `/leads/folders/[naam]`. Valt terug op "geen" pill als folder null. |
| [bulk-action-bar.tsx](src/components/leads/bulk-action-bar.tsx) | `<BulkActionBar selectedCount actions onDelete onClear>` — uniforme bulk-action bar. `actions` is een array `{ key, label, icon, onClick, tone, busy }`. |
| [section-card.tsx](src/components/leads/section-card.tsx) | `<SectionCard title icon aside padding="none\|compact\|default">` — vervangt overal `rounded-2xl border bg-autronis-card` + header-bar. Past binnen elke tab. |

**Regel**: als je in een tab een pattern tegenkomt dat ergens anders ook zit, check eerst of één van deze 6 componenten het dekt — NIET een zevende inline-oplossing schrijven.

---

## Design conventies

- **Header per pagina**: gebruik `<PageHeader title description actions>` uit [components/ui/page-header.tsx](src/components/ui/page-header.tsx). Geen handmatige `<h1>` meer.
- **Filter/search rij**: gebruik `<FilterBar search filters actions activeCount onClear>` uit [components/ui/filter-bar.tsx](src/components/ui/filter-bar.tsx) direct onder de KPI-tiles.
- **KPI grid**: altijd `grid grid-cols-2 lg:grid-cols-4 gap-4`.
- **Page spacing**: `<div className="space-y-7">` als root.
- **Kleuren**: ALLEEN via `autronis-*` tokens of de 7 LeadsKpiAccent-kleuren. Geen losse hex codes.
- **Motion**: `framer-motion` fade-in op KPI-tiles en bulk bar is al ingebakken. Voor lijst-items: `stagger` via delay = index * 0.03 max. Niet te druk.
- **Empty/error state**: `<EmptyState>` uit [components/ui/empty-state.tsx](src/components/ui/empty-state.tsx). Voor errors: inline rood card zoals Overzicht nu doet — dat is oké.
- **Polling**: houd `usePoll(fn, 12000-15000)` zoals het nu is. Niet versnellen.

---

## Werkverdeling — claim je chunk

Elke chunk is **onafhankelijk** — andere files, geen gedeelde state. Commit pas na tsc-check.

### Chunk A — Dashboard + Overzicht (showcase, wordt door Sem's Atlas chat gedaan)
- [ ] [src/app/(dashboard)/leads/dashboard/page.tsx](src/app/(dashboard)/leads/dashboard/page.tsx) — 8 KPI-tiles → `<LeadsKpiTile>`, activity feed → `<SectionCard>`, top-folders → `<SectionCard>`
- [ ] [src/app/(dashboard)/leads/_tabs/OverzichtTab.tsx](src/app/(dashboard)/leads/_tabs/OverzichtTab.tsx) — ClickableStat weg, SourceBadge/FolderChip/BulkActionBar inzetten

### Chunk B — Contacten + Enrichment
- [ ] [src/app/(dashboard)/leads/_tabs/ContactenTab.tsx](src/app/(dashboard)/leads/_tabs/ContactenTab.tsx) (836 regels) — meerdere stat-tiles + advanced filters + export
- [ ] [src/app/(dashboard)/leads/_tabs/EnrichmentTab.tsx](src/app/(dashboard)/leads/_tabs/EnrichmentTab.tsx) (856 regels) — tab-gestuurde stats + TriState filters

### Chunk C — Emails (grootste file)
- [ ] [src/app/(dashboard)/leads/emails/page.tsx](src/app/(dashboard)/leads/emails/page.tsx) (1089 regels) — STATUS_CONFIG is nu al in `<LeadStatusBadge>` gemerged, hele `StatusBadge` function kan weg. Check dat alle statussen gedekt zijn. Behoud collapse/expand, copy-to-clipboard, inline edit functionaliteit.

### Chunk D — Folders + Website Leads
- [ ] [src/app/(dashboard)/leads/folders/page.tsx](src/app/(dashboard)/leads/folders/page.tsx) (353 regels) — grid van folder-cards, count-badges per bron (LinkedIn vs Maps)
- [ ] [src/app/(dashboard)/leads/folders/[naam]/page.tsx](src/app/(dashboard)/leads/folders/[naam]/page.tsx) (489 regels) — detail view, tabel opruimen
- [ ] [src/app/(dashboard)/leads/website-leads/page.tsx](src/app/(dashboard)/leads/website-leads/page.tsx) (614 regels) — CONFIDENCE_BADGE is al in `<LeadStatusBadge>` (HIGH/MEDIUM/LIKELY_UNVERIFIED/NONE). Behoud WebsitePromptModal.

### Chunk E — Automations + Instellingen + Handmatig
- [ ] [src/app/(dashboard)/leads/automations/page.tsx](src/app/(dashboard)/leads/automations/page.tsx) (662 regels) — scraper runs list, STATUS-map weg → `<LeadStatusBadge>`
- [ ] [src/app/(dashboard)/leads/instellingen/page.tsx](src/app/(dashboard)/leads/instellingen/page.tsx) (280 regels) — settings, weinig te doen maar PageHeader + SectionCard
- [ ] [src/app/(dashboard)/leads/handmatig/page.tsx](src/app/(dashboard)/leads/handmatig/page.tsx) (493 regels) — manual follow-up form

### Chunk F — Errors viewer (nieuw)
- [ ] Nieuwe route `/leads/errors` toevoegen
- [ ] Sidebar entry onder "Sales" in [src/components/layout/sidebar.tsx](src/components/layout/sidebar.tsx)
- [ ] Parity met Syb's [`src/pages/Errors.tsx`](https://github.com/Autronis/lead-dashboard-v2/blob/main/src/pages/Errors.tsx) — leest uit `log-workflow-error` tabel via nieuwe route `/api/leads/workflow-errors`
- [ ] API-route: `src/app/api/leads/workflow-errors/route.ts` — queryet Syb's Supabase zoals `/api/leads/route.ts` dat doet

### Chunk G — Rebuild Prep (optioneel)
- [ ] [src/app/(dashboard)/leads/rebuild-prep/page.tsx](src/app/(dashboard)/leads/rebuild-prep/page.tsx) (826 regels) — eigen tool, check of `<SectionCard>` en `<LeadsKpiTile>` ook hier zin hebben

---

## Coördinatie

**Waar Sem's Atlas chat aan werkt**: Chunk A (Dashboard + Overzicht).
**Wat de andere chat mag pakken**: elke chunk B t/m G.

**Regels**:
- Pak **één chunk tegelijk**.
- Eerst een kleine commit met alleen het chunk-werk → `npx tsc --noEmit` → check → dan pas volgende chunk.
- Niet pushen; één push aan het eind door Sem (CLAUDE.md: batch commits in één push).
- Bij twijfel over een pattern: lees éérst hoe Chunk A (dashboard/page.tsx + OverzichtTab.tsx) het doet als die al gecommit is — volg dat recept.
- Als je een patroon ziet dat in 3+ tabs terugkomt maar nog niet in een shared component zit: schrijf **eerst** het shared component, dan pas gebruik in je chunk. Voeg 'm toe aan de tabel bovenin deze handoff.

## Wat NIET weghalen

- Functioneel niks kwijt. Elke knop, filter, bulk-actie, polling loop en toast die er nu staat moet blijven werken. Check voor elke refactor: "als Syb's versie dit heeft, hebben wij het nog?"
- Vergelijkingspoint: <https://github.com/Autronis/lead-dashboard-v2/tree/main/src/pages>
- RedactText wrapper om namen/emails **moet** overal blijven (demo-mode).
- `usePoll(..., 12000)` / `usePoll(..., 15000)` blijven.
- Realtime `setLeads` updates na bulk-acties (optimistic UI) blijven.

## Verificatie per chunk

1. `npx tsc --noEmit` — moet schoon zijn
2. `npm run dev` — pagina laden, bulk-acties proberen, polling checken
3. Vergelijk side-by-side met Syb's equivalent pagina (als die er is) — check of alle data-velden nog zichtbaar zijn
4. Commit met conventional message, bv. `refactor(leads): migrate Contacten tab to shared KPI/Badge components`

## Na alles
- `/leads/errors` route toegevoegd → `ALLOWED_FUNCTIONS` check niet nodig (geen edge-function, direct Supabase read)
- Volledige tsc + `npm run build`
- Eén commit bundel OF één push aan het einde
