# YT Playlist → Auto-Analyze Pipeline

**Datum:** 2026-04-18
**Auteur:** Sem (via Atlas brainstorm `SEM-DASH-006`)
**Status:** Design approved, ready for implementation plan

## Doel

Automatisch YouTube-videos uit één specifieke playlist ontdekken en door de bestaande `yt-knowledge` analyse-pipeline laten lopen. Sem voegt videos toe aan de playlist op YouTube, en binnen 24 uur verschijnen ze geanalyseerd in `/yt-knowledge` op het dashboard.

## Context

Het dashboard heeft al een werkende YT Knowledge Pipeline ([src/app/api/yt-knowledge/](../../../src/app/api/yt-knowledge/)) die single videos uit een URL accepteert en via Claude analyseert tot features, steps, tips, links + relevance_score. Maar alles is handmatig: elke video moet via de UI worden toegevoegd en aangeklikt voor analyse. Deze spec voegt auto-discovery + auto-analyze toe voor één playlist.

Instagram-integratie is **expliciet out-of-scope** — die krijgt een eigen Insta Knowledge Pipeline in een aparte chat.

## Beslissingen (uit brainstorm)

| Onderwerp | Keuze | Reden |
|---|---|---|
| Platform | n8n workflow | Goedkoper + sneller te bouwen dan Vercel cron (2-3u vs 4-6u), geen YouTube API key nodig, ~95% functionele dekking |
| Discovery bron | YouTube RSS feed | Geen API key, geen quota |
| Aantal playlists | 1 (hardcoded) | MVP; `ytk_playlists` tabel niet nodig |
| Poll frequentie | Dagelijks 08:00 | Bundelt Claude API kosten; RSS cache maakt sneller overkill |
| Backlog | N.v.t. | Playlist is nieuw, begint leeg |
| Auto-analyze | n8n roept `/analyze` direct aan | Simpelste flow, geen extra cron nodig |
| Dedup | Server-side op `ytk_videos.youtube_id` | Bestaat al |

## Architectuur

```
YouTube Playlist (RSS)
      │ poll dagelijks 08:00
      ▼
n8n workflow "yt-playlist-sync"
      │ per nieuwe video
      ▼
POST /api/yt-knowledge {url}     →  insert ytk_videos (pending)
      │ if response.status === "pending"
      ▼
POST /api/yt-knowledge/analyze {id}  →  transcript + Claude → ytk_analyses
      │
      ▼
Video zichtbaar in /yt-knowledge dashboard UI, klaar gescoord
```

## Componenten

### 1. n8n workflow `yt-playlist-sync` (NIEUW)

Locatie: n8n instance op `n8n.srv1380442.hstgr.cloud`, nieuwe workflow

**Nodes in volgorde:**

1. **Cron trigger** — elke dag 08:00 Europe/Amsterdam
2. **Set playlist URL** — Set-node met `{playlistId: "PL..."}` (hardcoded, Sem configureert in workflow UI na aanmaken)
3. **HTTP Request** — GET `https://www.youtube.com/feeds/videos.xml?playlist_id={{$json.playlistId}}`
   - Response format: XML (Atom feed)
4. **XML parse** — converteer naar JSON, extract `entry[]`
5. **Split in Items** — één item per entry
6. **Extract videoId** — pak `yt:videoId` uit elk entry → `{videoId, title, published}`
7. **HTTP Request (add to dashboard)** — POST `https://dashboard.autronis.nl/api/yt-knowledge`
   - Headers: `Authorization: Bearer {{$env.DASHBOARD_API_KEY}}`, `Content-Type: application/json`
   - Body: `{url: "https://youtu.be/{{$json.videoId}}"}`
   - Continue on error: true
8. **IF node** — `{{$json.status === "pending"}}` (alleen nieuwe videos)
9. **HTTP Request (trigger analyze)** — POST `https://dashboard.autronis.nl/api/yt-knowledge/analyze`
   - Headers: zelfde
   - Body: `{id: "{{$json.id}}"}`
   - Continue on error: true (één faalt ≠ andere falen)
10. **Log** — console log van aantal toegevoegd + aantal geanalyseerd

**n8n credentials nodig:** `DASHBOARD_API_KEY` — zelfde `INTERNAL_API_KEY` die auto-sync al gebruikt.

### 2. Dashboard — geen wijzigingen

De twee endpoints bestaan al en werken:

- `POST /api/yt-knowledge` — accepteert `{url}`, extract video ID, insert als `pending`, dedup op `youtube_id` UNIQUE
- `POST /api/yt-knowledge/analyze` — fetch transcript, Claude analyse, opslag in `ytk_analyses`, status → `analyzed` of `failed`

Geen schema changes. Geen UI changes. Geen nieuwe routes.

## Data flow

**RSS feed response** (YouTube Atom XML, gekort):
```xml
<entry>
  <yt:videoId>dQw4w9WgXcQ</yt:videoId>
  <title>Video titel</title>
  <published>2026-04-18T10:00:00+00:00</published>
  <author><name>Channel naam</name></author>
</entry>
```

n8n pakt hieruit alleen `videoId` — titel + channel worden server-side opgehaald tijdens analyse.

**Dashboard POST `/api/yt-knowledge` response:**
- Nieuwe video → `{id: "uuid", youtube_id: "dQw...", status: "pending"}` → n8n roept analyze
- Bestaande video → `{id: "uuid", youtube_id: "dQw...", status: "analyzed"|"failed"|"pending"}` → n8n skipt

**Dashboard POST `/api/yt-knowledge/analyze` response:**
- Success → `{id: "...", status: "analyzed"}` (video is klaar gescoord in UI)
- Fail → 500 met error bericht, video blijft `pending`

## Foutafhandeling

| Scenario | Gedrag |
|---|---|
| RSS feed 404 (playlist verwijderd/private) | n8n error in workflow, geen items verwerkt, volgende dag opnieuw |
| Dashboard 500 op add-endpoint | n8n continue on error, workflow gaat door met volgende items |
| Analyze 500 (geen transcript, rate limit, Claude fail) | Video blijft op `pending`, kan handmatig via UI opnieuw worden getriggerd |
| n8n workflow zelf faalt | n8n's eigen error tracking; geen Discord notificatie (YAGNI) |
| Dashboard tijdelijk offline | HTTP retry 3x (n8n default), daarna skip, morgen weer proberen |

## Testing

Handmatige acceptatie test na bouw:

1. **Dry run** — n8n `Execute Workflow` knop, check run log:
   - HTTP response `/api/yt-knowledge` = 201 + `status: "pending"` voor elke nieuwe
   - Analyze response = 200
   - Toegevoegde videos zichtbaar in `/yt-knowledge` UI met gevulde `features`/`steps`/`tips`
2. **Duplicate test** — direct 2e keer draaien:
   - Alle items geven `status != "pending"` terug
   - 0 analyze calls → 0 Claude kosten
3. **Fail case** — voeg video toe met disabled transcript (bijv. music video):
   - Analyze geeft 500
   - Video blijft op `pending` in DB
   - n8n workflow klaar zonder error (continue on error werkt)
4. **Cron test** — wacht tot volgende 08:00 OF forceer via n8n UI

## Edge cases

- **Private/unlisted videos in playlist** — RSS feed toont deze niet, dus impliciet uitgesloten
- **Videos >1u** — transcript kan Claude context overschrijden; bestaande `analyze` handelt truncation af
- **Playlist hernoemd** — playlist-ID blijft hetzelfde, geen issue
- **Playlist verwijderd** — RSS 404, workflow faalt graceful, Sem moet handmatig nieuwe URL invullen
- **Rate limit op YouTube RSS** — RSS is cached door YouTube, bij dagelijkse polling geen issue

## YAGNI — expliciet NIET in scope

- Meerdere playlists tegelijk
- `ytk_playlists` DB tabel
- UI voor playlist toevoegen/verwijderen in dashboard
- Notificaties bij nieuwe videos (Discord, email)
- Instagram / andere platforms — aparte pipeline
- Retry queue voor gefaalde analyses
- Bulk re-analyze knop
- Metadata-only mode (alleen toevoegen zonder analyseren)

Deze kunnen later als apart design komen als ze nodig blijken.

## Implementatie schatting

- **n8n workflow opzetten:** 1u (RSS node config, XML parse, 2 HTTP calls, error handling)
- **Playlist aanmaken op YouTube + URL in n8n:** 15min (handmatig door Sem)
- **Testen + fine-tunen:** 30-60min
- **Documentatie update** (vermelding in dashboard CLAUDE.md onder "n8n workflows"): 15min

**Totaal: ~2-3u werk**

## Open actie vooraf

Sem maakt een YouTube-playlist aan (privé of publiek — RSS werkt voor beide mits de playlist bestaat) en levert de playlist-ID aan tijdens implementatie.
