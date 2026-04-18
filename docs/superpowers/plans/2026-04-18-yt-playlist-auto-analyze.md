# YT Playlist Auto-Analyze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** n8n workflow die dagelijks 08:00 één YouTube-playlist polled, nieuwe videos toevoegt aan het dashboard en direct door de `yt-knowledge` analyse-pipeline laat lopen.

**Architectuur:** n8n cron → RSS fetch → XML parse → per video POST naar bestaande dashboard endpoints (`/api/yt-knowledge` + `/api/yt-knowledge/analyze`). Geen dashboard code-changes — alleen n8n config + documentatie.

**Tech Stack:** n8n (op `n8n.srv1380442.hstgr.cloud`), YouTube RSS Atom feed, Next.js dashboard API (bestaand), Claude Anthropic SDK (bestaand via analyze route).

**Spec:** [docs/superpowers/specs/2026-04-18-yt-playlist-auto-analyze-design.md](../specs/2026-04-18-yt-playlist-auto-analyze-design.md)

---

## File Structure

Dit plan wijzigt **geen** dashboard source code. Alle acties zijn:
- Één n8n workflow (UI-based) — export JSON commit naar `Projects/autronis-dashboard/n8n/yt-playlist-sync.workflow.json` voor versionering
- Update in [CLAUDE.md](../../../CLAUDE.md) onder sectie "n8n workflows" (één regel vermelding)
- Update van [.env.local.example](../../../.env.local.example) als `DASHBOARD_API_KEY` daar nog niet staat (voor Sem's eigen referentie)

De playlist-ID wordt opgeslagen als Set-node waarde binnen de n8n workflow (niet als env var in het dashboard) — zo blijft 't een n8n-config, geen dashboard-config.

---

## Task 1: YouTube playlist aanmaken + ID vaststellen

**Files:** geen (handmatige actie op youtube.com)

- [ ] **Step 1: Maak de playlist aan**

Ga naar youtube.com, log in, klik op "Playlists" in de sidebar → "New playlist". Naam bijv. `Autronis Knowledge`. Privacy mag privé (RSS werkt ook voor privé playlists, mits je owner bent).

- [ ] **Step 2: Voeg één test-video toe**

Zoek een video over AI coding / Claude Code / automation (een paar minuten werk). Rechtermuisknop → "Save to playlist" → kies jouw playlist. Eén test-video is genoeg voor nu.

- [ ] **Step 3: Noteer de playlist-ID**

Open de playlist, kijk naar de URL. Format: `https://www.youtube.com/playlist?list=PL<base64-id>`. Het stuk na `list=` is de playlist-ID (begint met `PL`, `OL`, of vergelijkbaar — bewaar volledig).

Schrijf 'm ergens op — je hebt 'm nodig bij Task 3 en daarna.

- [ ] **Step 4: Verifieer de RSS feed werkt**

```bash
curl -s "https://www.youtube.com/feeds/videos.xml?playlist_id=<JOUW_PLAYLIST_ID>" | head -40
```

Expected: XML response met `<feed>` root en minimaal één `<entry>` element met `<yt:videoId>` erin. Als je een 404 of lege response krijgt, is de playlist-ID fout of de playlist is nog echt leeg.

- [ ] **Step 5: Commit placeholder** (nog niks om te committen)

Skip — eerst na Task 3 committen we de workflow JSON.

---

## Task 2: n8n workflow skeleton aanmaken

**Files:** n8n UI actie (workflow wordt later JSON-export naar repo)

- [ ] **Step 1: Log in op n8n**

Open `https://n8n.srv1380442.hstgr.cloud` in de browser. Login met je n8n credentials.

- [ ] **Step 2: Nieuwe workflow**

Klik "+ Add Workflow". Geef naam: `yt-playlist-sync`. Description: `Dagelijks RSS poll van Autronis YouTube playlist → dashboard yt-knowledge pipeline`.

- [ ] **Step 3: Voeg Cron trigger node toe**

Klik "+" op canvas → zoek "Schedule Trigger" → configure:
- Trigger Interval: `Days`
- Days Between Triggers: `1`
- Trigger at Hour: `8`
- Trigger at Minute: `0`
- Timezone: `Europe/Amsterdam` (workflow settings → Timezone)

Save. De node verschijnt als "Schedule Trigger" op canvas.

- [ ] **Step 4: Voeg Set node toe (playlist config)**

Klik "+" rechts van Schedule Trigger → zoek "Set" → mode: `Manual Mapping`. Voeg één string field toe:
- Name: `playlistId`
- Value: `<JOUW_PLAYLIST_ID>` (de string die je in Task 1 noteerde)

Save. Deze node bundelt de config op één plek zodat je 'm later makkelijk kan aanpassen.

- [ ] **Step 5: Handmatig test uitvoeren**

Klik "Execute Workflow" (bovenin). Beide nodes moeten groen worden. Output van Set node = `{playlistId: "PL..."}`.

Als groen → doorgaan. Als rood → check dat playlistId gevuld is.

---

## Task 3: RSS feed ophalen + parsen in n8n

**Files:** n8n UI actie

- [ ] **Step 1: Voeg HTTP Request node toe**

Klik "+" rechts van Set node → zoek "HTTP Request" → configure:
- Method: `GET`
- URL: `https://www.youtube.com/feeds/videos.xml?playlist_id={{$json.playlistId}}`
- Response → Response Format: `File` (zodat we de raw XML krijgen) OR `String` (beide werken, String is simpeler)
- Response → Include Response Headers: off
- Options → Timeout: `30000` (30 sec)

Save.

- [ ] **Step 2: Voeg XML node toe**

Klik "+" → zoek "XML" → Operation: `Convert to JSON`. Input from: `data` (het response veld). Options:
- Attribute Prefix: `@`
- Explicit Array: `false`

Save.

- [ ] **Step 3: Execute workflow, verifieer XML → JSON conversie**

Klik "Execute Workflow". XML node output moet er ongeveer zo uitzien:

```json
{
  "feed": {
    "entry": [
      {
        "yt:videoId": "dQw4w9WgXcQ",
        "title": "...",
        "published": "..."
      }
    ]
  }
}
```

Let op: als je playlist maar één video heeft, is `entry` mogelijk geen array maar een enkel object. Dit lossen we in de volgende node op.

- [ ] **Step 4: Voeg Code node toe (normalize + extract)**

Klik "+" → zoek "Code" → Mode: `Run Once for All Items`. Language: `JavaScript`. Paste:

```javascript
// Normalize entry to always be an array, extract relevant fields
const feed = $input.first().json.feed;
const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : []);

return entries.map(e => ({
  json: {
    videoId: e['yt:videoId'],
    title: e.title,
    published: e.published,
    url: `https://youtu.be/${e['yt:videoId']}`
  }
}));
```

Save.

- [ ] **Step 5: Execute, verifieer lijst items**

Execute Workflow. Code node moet N items outputten met `{videoId, title, published, url}`. Check dat `url` er goed uitziet (`https://youtu.be/dQw4w9WgXcQ`).

Als `entries` leeg is, check in vorige node of `feed.entry` echt bestaat.

---

## Task 4: POST naar dashboard /api/yt-knowledge

**Files:** n8n UI actie, credentials config

- [ ] **Step 1: Voeg n8n credential toe voor dashboard API key**

Als 'ie nog niet bestaat: Credentials (linker sidebar) → "+ Add Credential" → zoek "Header Auth" → configure:
- Name: `Autronis Dashboard API`
- Header Name: `Authorization`
- Header Value: `Bearer <INTERNAL_API_KEY>` (waarde uit Vercel env vars / `.env.local`)

Save.

- [ ] **Step 2: Voeg HTTP Request node toe — add video**

Klik "+" rechts van Code node → "HTTP Request" → configure:
- Method: `POST`
- URL: `https://dashboard.autronis.nl/api/yt-knowledge`
- Authentication: `Predefined Credential Type` → `Header Auth` → select `Autronis Dashboard API`
- Send Headers: toggle on → add `Content-Type: application/json`
- Send Body: toggle on → Body Content Type: `JSON` → Specify Body: `Using JSON` → Body:

```json
{
  "url": "{{$json.url}}"
}
```

- Options → Continue On Fail: `true`
- Options → Response → Response Format: `JSON`

Save. Deze node roept per video uit de lijst de POST aan.

- [ ] **Step 3: Execute + verify — toevoegen werkt**

Execute Workflow. Bij elke video moet je response krijgen: `{id: "uuid", youtube_id: "...", status: "pending"|"analyzed"|...}`.

Bij eerste run met nieuwe videos: `status: "pending"` voor alle (omdat ze nog niet in DB stonden).

Check in `https://dashboard.autronis.nl/yt-knowledge` of de video(s) verschijnen als "pending".

---

## Task 5: Conditional trigger naar /analyze

**Files:** n8n UI actie

- [ ] **Step 1: Voeg IF node toe**

Klik "+" rechts van POST node → "IF" → configure Condition:
- Value 1: `{{$json.status}}`
- Operation: `equal`
- Value 2: `pending`

Save. Deze node splitst de flow: alleen `status === "pending"` gaat door naar analyze, rest (bestaande videos) wordt geskipt.

- [ ] **Step 2: Voeg HTTP Request node toe — trigger analyze**

Klik "+" op de TRUE output van IF node → "HTTP Request" → configure:
- Method: `POST`
- URL: `https://dashboard.autronis.nl/api/yt-knowledge/analyze`
- Authentication: `Header Auth` → `Autronis Dashboard API`
- Send Headers: on → `Content-Type: application/json`
- Send Body: on → JSON → Body:

```json
{
  "id": "{{$json.id}}"
}
```

- Options → Continue On Fail: `true`
- Options → Timeout: `120000` (2 min — Claude calls kunnen lang duren, `maxDuration: 60` staat op de route maar retry mogelijk)

Save.

- [ ] **Step 3: Execute + verify — analyze wordt aangeroepen**

Execute Workflow. Als er nieuwe videos waren (status "pending"), gaan die nu door de analyze endpoint.

Check:
- Response van analyze call = 200 met `{id, status: "analyzed"}`
- In `/yt-knowledge` UI: video heeft nu `summary`, `features`, `steps`, etc. gevuld

Als 500: check response body, waarschijnlijk transcript niet beschikbaar voor die video. Niet blockeren — IF blok correct geconfigureerd dus volgende run skipt 'm.

---

## Task 6: Smoke test + duplicate test

**Files:** geen (verificatie)

- [ ] **Step 1: Duplicate test**

Klik meteen opnieuw "Execute Workflow" (binnen een minuut na Task 5 run).

Expected:
- POST `/api/yt-knowledge` responses: `status != "pending"` voor alle videos (ze bestaan nu al)
- IF node: FALSE branch — 0 analyze calls
- Geen Claude kosten, geen DB writes

Als er alsnog analyze calls gaan = dedup is kapot op server, check `ytk_videos.youtube_id` UNIQUE constraint.

- [ ] **Step 2: Voeg 2e test-video toe aan playlist**

Ga naar YouTube, voeg een 2e video toe aan je playlist (iets anders dan de eerste). RSS cache kan tot 15 min hebben dus wacht kort.

- [ ] **Step 3: Execute workflow opnieuw**

Expected:
- 1e video: `status != "pending"` → skip
- 2e video: `status: "pending"` → analyze call → resultaat in UI

Dit bevestigt dat de workflow incrementeel werkt (dedup + nieuwe videos detect).

- [ ] **Step 4: Fail case test (optioneel)**

Voeg een muziek-video toe (die meestal geen transcript heeft, bijv. een official music video van een artiest). Execute workflow.

Expected:
- POST add → `status: "pending"`
- Analyze call → 500 error ("geen transcript")
- IF + Continue on Fail: workflow gaat door, andere items niet geraakt
- Video blijft op `pending` in DB

Niet nodig om te doen als je geen zin hebt — de logica zit erin.

---

## Task 7: Workflow activeren + documenteren

**Files:** Create `n8n/yt-playlist-sync.workflow.json`, Modify `CLAUDE.md`

- [ ] **Step 1: Workflow activeren (cron aan)**

In n8n workflow editor, linksboven is een toggle "Inactive/Active". Klik om naar **Active**. Vanaf nu draait hij dagelijks 08:00 CET.

- [ ] **Step 2: Export workflow als JSON**

In n8n workflow editor: kebab menu (...) → "Download". Je krijgt een `yt-playlist-sync.json`. Verplaats naar de dashboard repo:

```bash
mkdir -p ~/Autronis/Projects/autronis-dashboard/n8n
mv ~/Downloads/yt-playlist-sync.json ~/Autronis/Projects/autronis-dashboard/n8n/yt-playlist-sync.workflow.json
```

**Belangrijk:** check of de export geen plaintext credentials bevat. Open 'm kort, zoek naar `INTERNAL_API_KEY` of `Bearer`. Als je iets ziet dat niet gecommit mag worden → sanitize: zet `"credentials": {}` per HTTP node, of vervang API key met `"<REDACTED>"`. n8n exports tonen standaard alleen credential-NAMES, niet values, maar dubbelcheck.

- [ ] **Step 3: Update dashboard CLAUDE.md**

Open [CLAUDE.md](../../../CLAUDE.md). Zoek de sectie over n8n workflows (als die niet bestaat, voeg toe onder "## Deployment" of vergelijkbaar). Voeg toe:

```markdown
### n8n workflows
- `yt-playlist-sync` — dagelijks 08:00, RSS poll van Autronis Knowledge YouTube playlist, POST naar `/api/yt-knowledge` + auto-analyze. Workflow JSON in `n8n/yt-playlist-sync.workflow.json`. Config: playlist-ID zit in de Set-node binnen n8n (handmatig aanpassen bij playlist-wissel).
```

- [ ] **Step 4: Commit workflow JSON + CLAUDE.md update**

```bash
cd ~/Autronis/Projects/autronis-dashboard
git add n8n/yt-playlist-sync.workflow.json CLAUDE.md
git commit -m "feat(n8n): yt-playlist-sync workflow voor auto-analyze van playlist videos

Dagelijkse RSS poll van Autronis Knowledge YouTube playlist. Nieuwe videos
worden gequeued via /api/yt-knowledge + direct gestuurd naar /analyze. Geen
dashboard code changes — puur n8n workflow + documentatie."
```

**Niet pushen** — docs-only change. Pushen bij eerstvolgende echte code-deploy.

- [ ] **Step 5: Dashboard taak afmaken**

Mark het dashboard-taak gerelateerd aan deze feature als afgerond (als er een bestaat — anders skippen).

```bash
CONFIG=$(cat ~/.config/autronis/claude-sync.json)
URL=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['dashboard_url'])")
KEY=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
curl -X POST "$URL/api/projecten/sync-taken" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"projectNaam":"YT Knowledge Pipeline","voltooide_taken":["YT playlist auto-analyze workflow"],"nieuwe_taken":[]}'
```

Eventueel niks te doen als de pipeline nog geen eigen project heeft in dashboard.

---

## Verificatie na 24 uur

De volgende dag om 08:05: check in n8n "Executions" tab of de workflow automatisch is gedraaid. Succesvol = groen, geen handmatige interventie nodig.

Voeg af en toe een nieuwe video toe aan de playlist en check de volgende dag of de analyse in dashboard verschijnt. Als alles werkt: Sem heeft nu een autonome YouTube knowledge feed.
