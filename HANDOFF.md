# Handoff — 2026-04-16 (sessie 2)

## Wat is er gedaan

### Slimme taken UX (hoofdtaak)
- Starttijd dropdown (08:00-17:00, 30-min stappen) + duur dropdown in form mode
- Smart default: vandaag = afgerond naar volgende 30-min slot, toekomstige dag = 09:00
- Template velden optioneel bij quick-plan (ingeplandVoor gezet) — frontend + API
- `startTijd` + `duur` override in POST /api/taken/slim
- `fillNaamTemplate` ruimt lege placeholders op (geen `{branche}` in agenda)
- AI stappenplan (paars blok) auto-fetcht bij template selectie
- Stappen worden opgeslagen als omschrijving op de taak
- Modal blijft open na aanmaken (terug naar browse mode ipv sluiten)

### AI suggestie systeem
- Schema: `is_suggestie` + `suggestie_bron` op slimme_taken_templates
- Cron `/api/cron/slimme-taken-suggest` (maandag 07:30 UTC) genereert 5 suggesties
- Project-triggered: bij intake chat-start 3 relevante templates
- Amber blok in browse mode met accept/verwerp per suggestie
- Bij accept: vervangende suggestie via `/api/taken/slim/templates/suggest-and-save`

### Agenda sidebar
- **Syb fix**: slimme acties ook bij 0 open taken
- **Select mode**: checkboxes + bulk Afronden / Uit planning / Verwijder
- **Recent afgerond**: laatste 24u met tijdstip + undo knop
- **Routines systeem**: 19 seeds in 7 categorien, hover = inplannen + afvinken
- **Lucide icons**: emoji's vervangen bij "Wat je nu kunt doen"

### Taken & delete fixes
- FK constraint fix (team_activiteit)
- confirm() verwijderd, directe delete + loading spinner
- Sticky footer in detail panel
- Optimistic unplan
- Responsive detail panel (small screens)

### Responsive financien
- Stat cards: xl breakpoint voor 5-kolom (was lg, te krap met sidebar)

### Prime skill fix
- Stap 3: team/sync met SESSION_SECRET
- Stap 5: SESSION_SECRET uit .env.local
- Auto-timer geschrapt (tijdregistratie pagina is weg)

## Wat nog open staat

### Klant-uren feature (NIEUW — PRIORITEIT)
Sem wil automatische urenregistratie per klant op basis van Claude sessies:

**Concept:**
- Screen-time = algemene activiteitsuren (blijft)
- Klant-uren = apart, per Claude sessie, met auto-samenvatting

**Te bouwen:**
1. Nieuwe tabel `klant_uren`: klant_id, project_id, datum, duur_minuten, omschrijving (auto door Claude), bron
2. Hook in /end skill: check of project klantId heeft → bereken sessieduur → schrijf samenvatting → POST /api/klanten/{id}/uren
3. **Klant detail pagina uitbreiden**:
   - Uren gewerkt per project met breakdown per sessie
   - Wat er per sessie gedaan is (Claude schrijft dit automatisch)
   - Stappenplan / scope plan van het project
4. Zichtbaar bij /klanten/[id] + eventueel klantportals

**Key insight Sem:** "Claude weet perfect wat er gedaan is — de perfecte urenregistratie zonder handmatig werk"

### Andere open items
- project-sync error: taak id 67219 delete loop (500)
- NaN bug in deep work balk bij 0 data
- Supabase RLS waarschuwing
- Lead Rebuild Prep auto-prep + Sales Engine integratie (zie vorige HANDOFF)

## Belangrijke beslissingen
- Modal blijft open na taak aanmaken
- Velden optioneel bij quick-plan
- Geen confirm() bij delete — undo via "Recent afgerond"
- Routines apart van taken (terugkerende checks, geen agenda items)
- Screen-time vs klant-uren = twee losse systemen
- Auto-timer uit prime geschrapt

## Huidige staat
- **Branch**: main
- **Laatste commit**: `057af667` Auto-sync
- **Uncommitted changes**: nee (clean)
- **Dev server**: localhost:3000

## Volgende stappen
1. **Klant-uren feature bouwen** — tabel + API + /end hook + klant pagina
2. **Stappenplan op klant pagina** — scope PDF/plan data tonen
3. **Suggesties testen** — accept + refill op Vercel
4. **Routines testen** — 19 routines zichtbaar, afvinken + inplannen werkt

## Context
- Sem werkt met 4-6 parallel Claude chats
- Screen-time via desktop agent (KeepAlive, 5-min sync)
- Klant-uren is nieuwe laag voor facturatie/verantwoording
- SpeakToText — verwacht STT fouten
- Auto-sync hook commit + pusht automatisch
- Vercel Pro plan actief ($20/maand)
