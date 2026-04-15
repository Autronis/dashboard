# Synchronisatie flow — Sem's Mac & Syb's Windows laptop

Alles in dit document is hoe de twee laptops en twee Claude Code sessies samenwerken zonder elkaar in de wielen te rijden. Lees dit als je snapt dat er iets "niet sync't" of als je setup doet op een nieuwe machine.

## Eén bron van waarheid: Turso

Het dashboard draait lokaal én live op **dezelfde Turso (libsql) database**. Geen lokale SQLite voor echt werk — die is alleen een fallback als `TURSO_DATABASE_URL` ontbreekt.

```
                      ┌──────────────────────┐
                      │       Turso          │
                      │   (libsql remote)    │
                      │                      │
                      │  taken, projecten,   │
                      │  klanten, fases,     │
                      │  team_activiteit,    │
                      │  etc.                │
                      └──────┬──────┬────────┘
                             │      │
         ┌───────────────────┘      └────────────────────┐
         │                                                │
   ┌─────┴────────┐                              ┌────────┴─────┐
   │  Sem's Mac   │                              │ Syb's laptop │
   │              │                              │              │
   │  Next.js dev │                              │  Next.js dev │
   │  localhost   │                              │  localhost   │
   │  :3000       │                              │  :3000       │
   │              │                              │              │
   │  Claude Code │                              │  Claude Code │
   │  sessies     │                              │  sessies     │
   └──────────────┘                              └──────────────┘
         │                                                │
         └──────────────────┬─────────────────────────────┘
                            │
                   ┌────────┴───────────┐
                   │  Vercel (prod)     │
                   │  dashboard.        │
                   │  autronis.nl       │
                   └────────────────────┘
```

Alles schrijft naar Turso. Alles leest van Turso. Geen file-based "local fork" die achterloopt.

## Wie schrijft wat

| Bron | Schrijft via | Wanneer |
|---|---|---|
| **Sem's browser op localhost** | Next.js API routes (`PUT /api/taken/[id]`, etc) | Directe user actions in de UI |
| **Syb's browser op localhost** | Idem | Directe user actions |
| **Sem's Claude Code sessies** | `auto-sync-taken.py` hook → `POST /api/projecten/sync-taken` | Na elke `git commit` of `TodoWrite` |
| **Syb's Claude Code sessies** | Idem (Windows equivalent van de hook) | Idem |
| **Vercel productie** | Vercel deploy pakt elke git push op; runtime = zelfde API routes + zelfde Turso | Na elke push naar `main` |
| **n8n workflows** | Hit Dashboard API endpoints met Bearer token (`atr_12e5e7c3...`) | Scheduled / event-driven |

## De auto-sync hook in detail

Op Sem's Mac staat `~/.claude/hooks/auto-sync-taken.py` en de config in `~/.config/autronis/claude-sync.json`. Deze wordt door Claude Code getriggerd bij twee events:

1. **Git commits** — na een `git commit` scant de hook de commit message en gewijzigde files, bepaalt welk project het is, en stuurt gewijzigde taken naar `/api/projecten/sync-taken`. Zo worden taken die Claude afrondt automatisch gemarkeerd in het dashboard.
2. **TodoWrite** — als Claude zijn interne todo list updatet (via de `TodoWrite` tool), stuurt de hook ook nieuwe/afgeronde taken door. Zo zie je in het dashboard realtime wat Claude aan het doen is.

De config ziet er zo uit:

```json
{
  "dashboard_url": "https://dashboard.autronis.nl",
  "api_key": "atr_12e5e7c3..."
}
```

**Syb heeft een Windows equivalent** van deze hook in `syb-windows-setup/` (in de dashboard repo). Die zet dezelfde POST calls op met een `.cmd` wrapper i.p.v. `.py`.

## Claim semantiek — wie heeft welke taak

Binnen dezelfde database is de ownership van taken geregeld via drie velden:

| Veld | Betekenis |
|---|---|
| `projecten.eigenaar` | `sem` / `syb` / `team` / `vrij` — bepaalt visibiliteit op project-niveau. Sem ziet projecten met `sem`/`team`/`vrij`. Syb ziet `syb`/`team`/`vrij`. |
| `taken.toegewezenAan` | FK naar `gebruikers.id`. Wie deze specifieke taak doet. Wordt gezet door: user claim, cluster propagation, historische owner lookup, of AI Plan. |
| `taken.cluster` | Groepeert samenhangende taken (bv. `backend-infra`, `frontend`). Zie [`cluster-briefing-voor-syb.md`](./cluster-briefing-voor-syb.md) voor details. |

**De sleutel om geen conflicten te hebben**: als iemand een taak oppakt (`status = bezig` of `ingeplandStart` wordt gezet), runt de backend in [`PUT /api/taken/[id]`](../src/app/api/taken/[id]/route.ts) drie checks:

1. **Cluster cascade** — alle open taken in `(projectId, cluster)` tuple worden aan dezelfde persoon toegewezen
2. **Historische owner** — bij nieuwe taken wordt gekeken wie eerder in `(projectId, cluster)` werk heeft gedaan
3. **Lazy classify** — als de taak nog geen cluster heeft, vraagt de backend aan Claude Haiku om 'm te classificeren

Resultaat: zodra Syb vanochtend één backend-infra taak in Project X start, verschijnen alle gerelateerde taken van die dag op zijn naam, en worden ze onzichtbaar (gedimd) in Sem's view.

## Parallelle Claude Code sessies — worktrees first

Als er twee Claude Code sessies tegelijk aan hetzelfde project willen werken, MUST je `worktree first`:

```bash
cd ~/Autronis/Projects/autronis-dashboard
/worktree <sectie>   # bv /worktree clusters, /worktree intake-flow, /worktree sync
```

Dit maakt een aparte branch `feat/<sectie>` in `.worktrees/<sectie>/`. De main worktree blijft gereserveerd voor één chat tegelijk. De parallel sessie werkt op haar eigen worktree. Gitpush gebeurt per branch, merges doe je via PR of lokaal `git merge feat/<sectie>`.

**Voorbeeld van een verleden scenario**: 2026-04-14 werkten er drie sessies tegelijk:

- Session A (main worktree) — uren refactor + project intake flow fase 1
- Session B (feat/clusters) — cluster systeem bouwen (deze docs)
- Session C — iets anders op een derde branch

Elke sessie kon z'n eigen werk committen zonder de ander te raken. Bij het mergen kwamen er wel wat conflicten, maar alleen op bestanden die echt overlappen (CLAUDE.md, schema.ts met nieuwe migraties, etc).

## Secret sharing tussen laptops

Beide laptops hebben dezelfde `.env.local` in de dashboard repo nodig:

```
SESSION_SECRET=...               # iron-session, ≥32 chars
TURSO_DATABASE_URL=...           # libsql://... — dezelfde voor beide
TURSO_AUTH_TOKEN=...             # match bij de url
ANTHROPIC_API_KEY=sk-ant-...     # voor auto-cluster, lazy classify, etc
RESEND_API_KEY=...               # factuur emails
MOLLIE_API_KEY=...               # betaalintegratie
SUPABASE_LEADS_URL=...           # lead-dashboard-v2 project
SUPABASE_LEADS_SERVICE_KEY=...   # service role voor leads
SUPABASE_LEADS_JWT_SECRET=...    # voor lazy user-JWT minting naar edge functions
```

**Deel ze veilig** (1Password / Bitwarden, niet via Discord/WhatsApp). Als één van de keys roteert, beide laptops + Vercel updaten tegelijk.

## Op Sem's Mac — verse install checklist

Voor een nieuwe Mac (of als Sem een laptop verliest):

1. Clone de repo: `gh repo clone Autronis/dashboard ~/Autronis/Projects/autronis-dashboard`
2. Kopieer `.env.local` van 1Password naar de repo root
3. `npm install`
4. `npm run dev` — start op `http://localhost:3000`
5. Claude Code: installeer via `brew install anthropic/claude/claude` of via de official download
6. Claude config: `~/.config/autronis/claude-sync.json` aanmaken met dashboard_url + api_key
7. Claude hook: `~/.claude/hooks/auto-sync-taken.py` plaatsen (staat in de dashboard repo onder `syb-windows-setup/hooks/` als referentie, de Python versie is hetzelfde)
8. CLAUDE.md in `~/Autronis/CLAUDE.md` met de gedeelde regels (staat in de repo als `CLAUDE.md` als template)

Log in op `http://localhost:3000` met je Autronis account en je bent klaar.

## Op Syb's Windows laptop — verse install checklist

Staat compleet gedocumenteerd in `syb-windows-setup/INSTALL-WINDOWS.md` in de dashboard repo. Het komt hierop neer:

1. Clone de repo naar een willekeurige dir (Syb gebruikt `C:\Users\syb20\Projects\dashboard\` — de folder naam maakt niks uit, alleen de dir zelf moet bestaan)
2. `.env.local` kopiëren uit 1Password
3. `npm install` (node 20+ vereist)
4. `npm run dev`
5. Claude Code voor Windows installeren
6. Hook: `syb-windows-setup/hooks/auto-sync-taken.py` + `auto-sync-taken.cmd` kopiëren naar `%USERPROFILE%\.claude\hooks\`
7. Config: `%USERPROFILE%\.config\autronis\claude-sync.json` aanmaken (**niet** `%APPDATA%` — de hook leest `os.path.expanduser("~/.config/autronis/claude-sync.json")`)
8. `CLAUDE.md` in Syb's home dir plaatsen

**De `syb-windows-setup.zip` in de dashboard repo root** bevat alle Windows-specifieke files bij elkaar. Sem heeft die al klaar staan om naar Syb te sturen.

## Troubleshooting — als sync niet werkt

### "Mijn taak verschijnt niet in het dashboard nadat Claude 'm heeft gecommit"

1. Check of de hook geïnstalleerd is: `ls ~/.claude/hooks/auto-sync-taken.py`
2. Check of `claude-sync.json` bestaat en een geldige `api_key` heeft
3. Kijk in je terminal na de commit — de hook logt foutmeldingen direct
4. Fallback: doe een handmatige sync met `curl`:
   ```bash
   CONFIG=$(cat ~/.config/autronis/claude-sync.json)
   URL=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['dashboard_url'])")
   KEY=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
   curl -X POST "$URL/api/projecten/sync-taken" \
     -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"projectNaam":"Autronis Dashboard","voltooide_taken":["Taak X"],"nieuwe_taken":[]}'
   ```

### "Ik zie Syb's taken maar ze zijn allemaal gedimd met een 🔒"

Dat is het cluster lock systeem. Syb heeft werk in dat cluster en jij zou ze niet moeten doen. Als je toch moet (Syb is ziek / op vakantie), klik door de waarschuwingsdialog.

### "Mijn `.env.local` op beide laptops is verschillend"

Dan ga je problemen krijgen. Trek ze gelijk via 1Password. **`TURSO_DATABASE_URL` en `SUPABASE_LEADS_*` moeten IDENTIEK zijn** — anders kijk je naar verschillende databases.

### "Claude Code start, maar geen enkele hook wordt getriggerd"

Controleer de Claude Code settings file (`~/.claude/settings.json` op Mac, `%USERPROFILE%\.claude\settings.json` op Windows) of de hooks zijn geregistreerd. Als de hooks uit staan: zet ze aan en start Claude Code opnieuw.

## Gerelateerde docs

- [`cluster-briefing-voor-syb.md`](./cluster-briefing-voor-syb.md) — cluster systeem uitleg voor Syb
- [`project-intake-flow.md`](./project-intake-flow.md) — complete 6-fase intake flow
