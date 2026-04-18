# HANDOFF — autronis-dashboard sessie 2026-04-18

## Status
- **Branch**: main (clean voor mijn werk)
- **Laatste eigen commit gepushed**: `45e12643` (3 verbeteringen — bulk-scan confirm, replies polling, pitch+scan combo)
- **5 lokale commits NIET door mij gepushed** (van Sem zelf):
  - `3b3a76f6` feat(upwork): AES-256-GCM cookie encryption met auth tag
  - `cad14dd8` fix(upwork): guard classifyBudgetTier against NaN/Infinity
  - `ad865971` Auto-sync: autronis-dashboard
  - `0d7fadad` refactor(upwork): add ok discriminator to EmailParseResult
  - `04072771` docs: Insta Knowledge Pipeline — design spec (Fase 1)
- **Untracked**: `src/lib/upwork/dedup.test.ts`
- **Volgende sessie**: vraag Sem of die 5 commits gepushed moeten worden, of dat hij ze nog wil aanpassen

## Wat is er deze sessie gebouwd

### Sales Engine — grote refactor
1. **Queue list** op `/sales-engine` — leads aangedragen vanuit alle scan-knoppen verschijnen als lijst met per-row "Scan" knoppen + "Alle N scannen" bulk
2. **Auto-fill queue** met alle Supabase-leads + website-leads + Turso klanten met website (minus reeds-gescand). Cross-section accumulatie via localStorage. Dismissed tracking zodat verwijderde items niet terugkomen.
3. **API**: `GET /api/sales-engine/queue-candidates` — aggregeert kandidaten met dedupe op hostname + supabaseLeadId
4. **Bulk-scan confirm modal** bij N>20 met geschatte kosten + duur (voorkomt per-ongeluk gigantische batch)

### Replies inbox bovenaan Sales Engine
- **API**: `GET /api/leads/emails/replies` — fetch uit Syb's `emails` tabel waar `reply_body IS NOT NULL`
- **API**: `POST /api/sales-engine/reply-plan` — Claude Sonnet 4.5 genereert antwoord-mail + plan, joint met Sales Engine kansen indien beschikbaar
- **Component**: `RepliesInbox` — uitklapbare kaarten met originele cold mail + reply + Scan + Genereer antwoord
- **Polling**: elke 30s, toast bij nieuwe reply

### Website-prompt + pitch-mail flow op `/leads/website-leads`
- **API**: `POST /api/leads/website-leads/generate-prompt` — Claude genereert Lovable/v0 website-prompt
- **API**: `POST /api/leads/website-leads/pitch-mail` — Claude genereert pitch-mail (subject + body)
- **API**: `POST /api/leads/website-leads/pitch-mail/send` — insert in Supabase `emails` met `source='website_builder'`, POST naar Syb's n8n send webhook
- **Component**: `WebsitePromptModal` — drie secties: Sales Engine scan + website-prompt + pitch-mail
- **Combo**: checkbox in pitch-mail "Bij verzenden ook scan starten"
- **Knop**: per-row in website-leads, altijd zichtbaar (geen expand nodig)

### Misc
- Dev-script in `package.json` gefixt (Windows `set` syntax → POSIX) + 6GB heap
- Folder pill wrap fix in ContactenTab
- Tab-bar beschrijvingen verduidelijkt (Overzicht/Contacten/Enrichment)

## Beslissingen onderweg
- **Pitch-mails gaan via Syb's n8n** (zakelijk@autronis sender + signature uit n8n-config). Geen eigen template/PDF flow.
- **Single-scan URL-prefill verwijderd** in favor van queue-only flow (alles via `/sales-engine`)
- **localStorage voor queue + dismissed set** — cross-session persistent
- **Scan estimate**: €0,05 per scan, ~30s per scan (ruwe schatting Anthropic kosten)

## Bekende risico's / nog te valideren
- **Pitch-mail send naar Syb's n8n**: insert gebruikt `SYB_USER_ID`. Als RLS dat blokkeert voor service-key faalt de eerste send. Test eerst met 1 lead.
- **Replies inbox**: empty state werkt, maar daadwerkelijke reply-rendering met data heb ik niet kunnen testen (geen replies in Syb's tabel ten tijde van bouw).
- **Auto-fill 591 candidates**: localStorage limiet 5MB — bij groei naar 5000+ wordt krap.

## Memory
Tijdens sessie opgeslagen:
- `feedback_push_notifications.md` — geen automatische PUSH naar #handoffs
- `project_sales_engine_entrypoints.md` — Sales Engine triggert vanuit 5 UI plekken (verouderd nu — flow is veranderd naar queue-based, update bij volgende sessie indien nodig)

## Volgende sessie kan oppakken
1. Sem's 5 lokale commits checken/pushen
2. End-to-end test pitch-mail send (eerste keer met 1 lead)
3. Reply-inbox testen met echte data (nog geen replies in Supabase ten tijde van bouw)
4. Memory `project_sales_engine_entrypoints.md` updaten — flow is gewijzigd van directe POST naar queue-based via `/sales-engine`
