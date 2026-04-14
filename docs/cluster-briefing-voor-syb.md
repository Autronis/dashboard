# Cluster-systeem briefing voor Syb

Hey Syb — Sem stuurt je dit zodat jouw Claude op je Windows laptop op dezelfde manier met taken omgaat als mijn Claude op de Mac. Lees dit één keer door en zet de regels daarna in je eigen `CLAUDE.md` op je laptop.

## Waarom dit bestaat

Tot nu toe hadden we alleen `fase` als groepering op taken. Maar in één fase zitten vaak taken die bij verschillende mensen horen — bv. fase "Setup" kan zowel Supabase schema's (jij) als Lovable prototypes (Sem) bevatten. Als Sem een taak uit die fase pakt, kwam de rest soms verkeerd bij hem terecht.

Nu hebben taken óók een `cluster` veld. Een cluster groepeert taken die door **dezelfde persoon** uitgevoerd moeten worden omdat ze dezelfde context/expertise delen. Als iemand een taak in een cluster oppakt (status → bezig of agenda-planning), worden de andere open taken in datzelfde cluster automatisch aan die persoon toegewezen.

**Belangrijk:** fase ≠ cluster. Ze leven naast elkaar. Fase = fase in het project (Setup, Ontwikkeling, Lancering). Cluster = wie kan het doen (backend-infra, frontend, klantcontact, etc).

## De zes standaard cluster-namen

Gebruik ALTIJD één van deze namen. Verzin geen nieuwe tenzij het écht niet past in de zes. Als je het ene keer `backend` en de andere keer `supabase-dingen` schrijft, kan het systeem ze niet matchen en werkt de auto-cascade niet.

| Cluster | Wat erin hoort | Wie doet dit meestal |
|---|---|---|
| `backend-infra` | Supabase (schemas, edge functions, RLS), n8n workflows, scripts, API routes, database migraties, server-side integraties, DevOps, hosting, webhooks | Jij (Syb) |
| `frontend` | Lovable prototypes, dashboard widgets, UI componenten, Next.js pages, HTML email templates, React code, Tailwind styling, animaties | Sem |
| `klantcontact` | Intake calls, offerte opstellen, klant onboarden, follow-up mails, afspraken, presentaties, klantenservice, demo's | Sem |
| `content` | Copy schrijven, blog posts, social media content, video scripts, design werk, branding assets | Sem |
| `admin` | Facturen, financiën, planning, belasting, administratie, urenregistratie, documentatie updates | Beiden |
| `research` | Concurrentie analyse, tool vergelijk, YouTube research, markt onderzoek, technische spikes | Beiden |

## Regels voor JOUW Claude wanneer hij taken aanmaakt

Als jouw Claude nieuwe taken aanmaakt via de sync-taken API (of direct via `POST /api/taken`), **moet hij altijd een `cluster` meegeven** als de taak duidelijk in één van de zes categorieën valt.

### Voorbeeld van goed cluster-gebruik

```json
{
  "projectNaam": "Klant X leads pipeline",
  "eigenaar": "team",
  "nieuwe_taken": [
    {
      "titel": "Supabase tabel leads_enriched aanmaken",
      "fase": "Fase 1: Setup",
      "cluster": "backend-infra",
      "omschrijving": "..."
    },
    {
      "titel": "n8n webhook voor enrichment ontvangen",
      "fase": "Fase 1: Setup",
      "cluster": "backend-infra",
      "omschrijving": "..."
    },
    {
      "titel": "Lovable prototype van contactenlijst",
      "fase": "Fase 1: Setup",
      "cluster": "frontend",
      "omschrijving": "..."
    },
    {
      "titel": "Klant bellen voor intake",
      "fase": "Fase 0: Discovery",
      "cluster": "klantcontact",
      "omschrijving": "..."
    }
  ]
}
```

Drie taken in "Fase 1: Setup", maar twee clusters: `backend-infra` (2x) en `frontend` (1x). Als jij dan op de eerste Supabase-taak klikt, worden de n8n-taak ook automatisch aan jou toegewezen. De Lovable prototype taak blijft vrij voor Sem.

### Wanneer géén cluster meegeven

- Als het écht een mengtaak is (bv. "volledige POC bouwen" — te breed)
- Als je twijfelt welke categorie het is — beter leeg dan verkeerd

### NOOIT

- Cluster verwarren met `eigenaar` — eigenaar is projectniveau (sem/syb/team/vrij), cluster is taakniveau (backend-infra/frontend/etc)
- Fase als cluster gebruiken (bv. `cluster: "fase-1"`) — dat is zinloos want fase staat al op de taak
- Een verzonnen cluster-naam — houd je aan de zes

## Wat er gebeurt als jij een taak oppakt

1. Jij zet een taak met `cluster: "backend-infra"` op status `bezig` (of plant 'm in de agenda)
2. Backend zoekt alle andere open taken in datzelfde `(project, cluster)` tuple
3. Alle gevonden taken krijgen `toegewezenAan = jij`
4. Je ziet een toast: "3 taken uit cluster 'backend-infra' naar jou toegewezen"
5. In Sem's view worden die taken gedimd met een 🔒 badge "Sem is bezig" (of in dit geval: "Syb is bezig")
6. Als Sem toch op één van die taken klikt, krijgt hij een popup: "Deze taak zit in cluster backend-infra dat Syb momenteel oppakt. Weet je zeker?" — hij kan alsnog doorgaan als het echt moet (bv. jij bent ziek)

## Auto-cluster knop voor bestaande taken

In `/taken` staat nu een **"Auto-cluster"** knop (paars sparkles icoon) naast de Sync knop. Die stuurt alle open taken zonder cluster naar Claude (de API), laat ze groeperen in de zes standaard clusters, en slaat het op. Sem heeft 'm al een keer gedraaid voor de bestaande 650+ taken.

**Jij hoeft 'm niet opnieuw te draaien** tenzij je denkt dat er veel ongelabelde taken bij zijn gekomen. Eén run is genoeg.

## Technische details voor jouw Claude

Als je Claude aan het werk zet op jouw laptop, kopieer dit naar jouw `~/Autronis/CLAUDE.md` (of Windows equivalent) onder de "Dashboard Task Sync" sectie. Het leert hem wanneer en hoe cluster te gebruiken:

```markdown
## Clusters — groeperen van samenhangende taken

Taken hebben naast `fase` ook een optioneel `cluster` veld. Een cluster
groepeert taken die door dezelfde persoon uitgevoerd moeten worden.
Wanneer iemand een taak in een cluster oppakt, worden de andere open
taken in datzelfde (project, cluster) tuple automatisch aan die persoon
toegewezen.

BELANGRIJK: fase ≠ cluster. Eén fase kan meerdere clusters bevatten.

### Standaard cluster-namen (Autronis convention)
- `backend-infra` — Supabase / n8n / edge functions / scripts / API routes
- `frontend` — Lovable / dashboard widgets / UI / HTML email / React
- `klantcontact` — intake / offerte / onboarden / follow-ups
- `content` — copy / blog / video / design
- `admin` — factuur / planning / belasting / documentatie
- `research` — concurrentie / tools / markt / spikes

### Bij NIEUWE taken — altijd cluster meegeven

Voorbeeld sync-taken call:
{
  "projectNaam": "Project X",
  "nieuwe_taken": [
    {
      "titel": "Supabase edge function voor enrichment",
      "fase": "Fase 2",
      "cluster": "backend-infra"
    }
  ]
}

Alleen weglaten als de taak echt niet in één categorie past.
```

## Afronden

Dit is alles. Het enige wat jij concreet moet doen:
1. Bovenstaande `## Clusters` sectie in jouw CLAUDE.md plakken (Windows laptop)
2. Claude Code opnieuw starten zodat hij de nieuwe regel leest
3. Vanaf nu: als je Claude vraagt om een nieuw project op te zetten of taken aan te maken, zet hij automatisch clusters. Geen extra werk voor jou.

Vragen? Vraag het Sem, hij heeft dit systeem samen met mijn Claude gebouwd op 2026-04-14.
