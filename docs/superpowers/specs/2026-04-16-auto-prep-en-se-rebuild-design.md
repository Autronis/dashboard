# Auto-Prep Alle Leads + Sales Engine Rebuild Voorstel

**Datum:** 2026-04-16
**Status:** Goedgekeurd

## Feature A: "Prep alle zichtbare" op /leads/rebuild-prep

### Doel
Alle zichtbare leads in één klik door de prep pipeline halen, in plaats van handmatig 20 stuks selecteren en klikken.

### UI wijzigingen
- **Nieuwe knop** "Prep alle zichtbare" naast bestaande "Prep N leads" knop
- **Progress bar** bij actieve batch: `"Chunk 2/48 — 35 van 958 leads verwerkt"` met percentage
- **Stop knop** om halverwege te annuleren (resultaten tot dan blijven staan)
- Resultaten **streamen in** per chunk — niet wachten tot alles klaar is

### Technisch
- Frontend splitst alle zichtbare lead IDs in chunks van 20
- Per chunk: `POST /api/leads/prep-rebuild` (bestaand endpoint, geen wijziging)
- Chunks **sequentieel** (niet parallel) — vermijdt server overload en Jina rate limits
- Results accumuleren in bestaande `results[]` state
- Geen DB persistence — prompts leven in page state

### Edge cases
- Filter wijzigen tijdens prep → waarschuwing + stop optie
- Lead zonder naam → skip, toon in "overgeslagen" counter
- Scrape failures → result card met foutmelding (bestaand gedrag)

### Bestanden die wijzigen
- `src/app/(dashboard)/leads/rebuild-prep/page.tsx` — UI: knop, progress bar, chunk logic

### Bestanden die NIET wijzigen
- `src/app/api/leads/prep-rebuild/route.ts` — API blijft identiek
- `src/lib/lead-rebuild-prep.ts` — prompt functies blijven identiek
- `src/lib/scraper.ts` — scraper blijft identiek

---

## Feature B: "Website Rebuild Voorstel" op /sales-engine/[id]

### Doel
Elke voltooide Sales Engine scan toont automatisch een rebuild prompt die klaar is om te kopieren naar Claude.

### UI wijzigingen
- **Nieuwe card** na "Automatiseringskansen", voor "Samenvatting"
- Titel: "Website Rebuild Voorstel"
- Teal/accent rand (zelfde stijl als samenvatting card)
- Inhoud:
  - Mode badge: "Upgrade" (heeft website) of "Fresh" (geen website)
  - Sector-fit badge via `classifyFit()`
  - "Kopieer prompt" knop → clipboard
  - "Open in Claude" link → claude.ai/new
  - Collapsible prompt preview (eerste 5 regels zichtbaar, klik voor volledig)

### Technisch
- Prompt wordt **client-side gegenereerd** bij page load — geen nieuw API endpoint
- Data uit bestaande `scan.scrapeData`:
  - `homepage.title` + `homepage.headings` + `homepage.bodyText` → markdown string
  - Subpagina content meegenomen voor rijkere prompt
- Route:
  - Website bestaat → `buildUpgradePrompt()` met geconverteerde scrape data
  - Geen website → `buildFreshPrompt()` met bedrijfsnaam
- `classifyFit()` met `googlePlaces?.categorieen[0]` + `bedrijfsnaam`
- Altijd tonen bij voltooide scans (geen conditie op website kwaliteit)

### Conversie functie
```typescript
function seScrapeToMarkdown(scrapeData: ScrapeResult): string {
  const parts: string[] = [];
  if (scrapeData.homepage.title) parts.push(`# ${scrapeData.homepage.title}`);
  for (const h of scrapeData.homepage.headings) parts.push(`## ${h}`);
  if (scrapeData.homepage.bodyText) parts.push(scrapeData.homepage.bodyText);
  for (const sub of scrapeData.subpaginas || []) {
    if (sub.title) parts.push(`\n## ${sub.title}`);
    if (sub.bodyText) parts.push(sub.bodyText);
  }
  return parts.join('\n\n');
}
```

### Bestanden die wijzigen
- `src/app/(dashboard)/sales-engine/[id]/page.tsx` — nieuwe card sectie + conversie logica

### Bestanden die NIET wijzigen
- `src/lib/lead-rebuild-prep.ts` — functies worden geimporteerd, niet gewijzigd
- `src/lib/lead-rebuild-fit.ts` — `classifyFit` wordt geimporteerd, niet gewijzigd
- `src/lib/sales-engine/scraper.ts` — blijft identiek
- `src/lib/sales-engine/analyzer.ts` — blijft identiek

---

## Beslissingen
- **Geen DB persistence voor prompts** — gratis te regenereren, template kan wijzigen
- **Altijd rebuild voorstel tonen** in SE — geen false negatives, user beslist zelf
- **SE scrape data converteren** naar markdown i.p.v. re-scrape met Jina — instant, geen latency
- **Chunks sequentieel** — Jina Reader heeft geen officieel rate limit maar we willen geen 50 parallel calls
