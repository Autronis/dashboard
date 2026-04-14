# Autronis Time Tracking — Volledige Spec

> Single source of truth voor hoe time tracking werkt: van wat de desktop agent
> opslaat tot hoe de flow score wordt uitgerekend. Voor identieke setup tussen
> Sem (Mac) en Syb (Windows/Mac).

---

## 1. Architectuur in het kort

```
┌──────────────────┐    POST /api/screen-time/sync    ┌─────────────────────┐
│ Desktop Agent    │ ───────────────────────────────► │ Sync endpoint       │
│ (Tauri/Rust)     │  elke 30s batch                   │ - validatie          │
│ Mac of Windows   │                                   │ - splitten >5min     │
└──────────────────┘                                   │ - auto-categoriseer  │
                                                       │ - project matchen    │
                                                       │ - opslaan in DB      │
                                                       └─────────────────────┘
                                                                │
                                                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Live op /tijd, /, /team:                                                │
│ - GET /api/screen-time/sessies → 30-min slot merging + flow score       │
│ - berekenActieveUren()        → canonical "uren" voor heel dashboard    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Desktop Agent (data capture)

### Locatie
`desktop-agent/` (Tauri v2 + Rust). Belangrijke files:
- [src-tauri/src/lib.rs](src-tauri/src/lib.rs) — main loop, idle detectie, tray menu
- [src-tauri/src/tracker.rs](src-tauri/src/tracker.rs) — actieve venster ophalen per platform
- [src-tauri/src/storage.rs](src-tauri/src/storage.rs) — lokale SQLite + merge logic
- [src-tauri/src/sync.rs](src-tauri/src/sync.rs) — batch POST naar dashboard
- [src-tauri/src/config.rs](src-tauri/src/config.rs) — config.json beheer

### Wat wordt gemeten
Elke 5 sec wordt het actieve venster gelogd:
- **app**: process naam (bijv. "Code", "Google Chrome", "Terminal")
- **vensterTitel**: volledige titel (bijv. "tracker.rs — autronis-dashboard — Visual Studio Code")
- **url**: alleen voor Chromium-browsers (Chrome, Brave, Arc, Edge, Safari) via AppleScript/Win32
- **duurSeconden**: tijd sinds vorige sample
- **idle status**: ms sinds laatste keyboard/mouse event

### Sampling intervals
| Constante | Waarde | Doel |
|---|---|---|
| `track_interval_secs` | **5** | Hoe vaak actieve venster wordt gepolld |
| `sync_interval_secs` | **30** | Hoe vaak entries naar de server worden gepushed |

### Warmup (opstartblokkade)
| Drempel | Waarde | Gedrag |
|---|---|---|
| Warmup tijd | **120s (2 min)** | Eerst 2 min activiteit nodig voordat opnames starten |
| Reset bij idle | > 120s idle | Warmup teller springt terug naar 0 |

Doel: geen ruis tijdens opstarten of langer-niet-gewerkt.

### Idle thresholds
| Idle tijd | Gedrag |
|---|---|
| ≤ 120s | Normaal opnemen, warmup blijft staan |
| 120–600s | Sample wordt overgeslagen, warmup reset |
| > 600s (10 min) | Tracking volledig gestopt tot eerstvolgende activiteit |

Idle detectie:
- **Windows**: `GetLastInputInfo()` Win32 API (zeer betrouwbaar)
- **macOS**: `ioreg -c IOHIDSystem` parsing van `HIDIdleTime`. Bij parsing-fout valt 'ie terug op 1u idle (= overslaan) i.p.v. stilletjes recorden.

### Lock screen / sleep
- Lock screen → window capture geeft `None` → idle teller loopt door → na 10 min stop
- Wake → tracking herstart, warmup begint opnieuw bij 0
- Sleep → SQLite slaat unsynced entries naar disk vóór suspend

### Payload naar `/api/screen-time/sync`
```json
POST https://dashboard.autronis.nl/api/screen-time/sync
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "entries": [
    {
      "clientId": "uuid-v4",
      "app": "Google Chrome",
      "venstertitel": "Claude — Google Chrome",
      "url": "https://claude.ai",
      "startTijd": "2026-04-14T10:23:45.123Z",
      "eindTijd": "2026-04-14T10:28:45.123Z",
      "duurSeconden": 300
    }
  ],
  "locatie": "kantoor"
}
```

### Required permissions

**macOS**:
- **Accessibility** (Systeeminstellingen → Privacy & Security → Accessibility) — voor venstertitels lezen
- **AppleScript naar browser** — automatisch bij eerste run, gebruiker accepteert de prompt
- Geen aparte permission voor idle (gebruikt `ioreg`)

**Windows**:
- Geen UAC-elevatie nodig
- Wel Defender/SmartScreen acceptatie bij eerste install (unsigned binary)

### Autostart
- Mac: LaunchAgent `~/Library/LaunchAgents/nl.autronis.dashboard.plist` (via `tauri-plugin-autostart`)
- Windows: ingeschreven in `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (via Tauri plugin)

### Locatie config
| Platform | Default `locatie` |
|---|---|
| macOS | `kantoor` |
| Windows | `thuis` |

Aan te passen in `config.json`. Wordt meegestuurd met elke sync — bepaalt hoe entries getagd worden voor latere kantoor/thuis splitsing.

---

## 3. Sync endpoint (`/api/screen-time/sync`)

[src/app/api/screen-time/sync/route.ts](../src/app/api/screen-time/sync/route.ts)

### Verwerkingsstappen
1. **Validatie**: `clientId`, `app`, `startTijd`, `eindTijd`, `duurSeconden` verplicht
2. **Splitsen**: entries > 300s worden opgeknipt in stukken van max 300s. Nieuwe `clientId` per chunk: `{origineel}_chunk0`, `_chunk1`, … Doel: voorkomt dat 1 lange idle-periode een hele sessie opblaast.
3. **Nacht-override**: tussen 22:00 en 08:00 NL-tijd wordt categorie geforceerd op `overig` (telt niet als werk)
4. **User rules**: load `screen_time_regels` waar `is_actief = 1`, gesorteerd op `prioriteit DESC`. Eerste regel die matcht wint en levert categorie + projectId + klantId.
5. **Auto-categoriseer** (als geen user rule): door regex regels (zie tabel hieronder)
6. **Project matchen**: probeer projectId af te leiden uit venstertitel
7. **Default toewijzing**: alles wat productief is en geen project heeft → `projectId=9` (Autronis Dashboard), `klantId=4` (Autronis intern)
8. **Insert** in `screen_time_entries` tabel

### Categorieën
| Categorie | Wat valt eronder |
|---|---|
| `development` | Code editors, terminals, AI code chat, docs/repos, hosting/dev tools |
| `communicatie` | Email, Slack/Discord/Teams, calls, kalender, LinkedIn |
| `meeting` | Expliciet als meeting getagged (handmatig of via rule) |
| `design` | Figma, Sketch, Photoshop, Canva |
| `administratie` | Spreadsheets, boekhoudtools, KVK, belastingdienst, banken |
| `finance` | TradingView, exchanges, crypto trackers |
| `afleiding` | YouTube (niet-edu), Reddit, social, streaming, muziek |
| `overig` | Niet-gecategoriseerd (default fallback) |
| `inactief` | LockApp / SearchHost / etc — telt als idle |

### Auto-categorisatie regels (volgorde = prioriteit, eerste match wint)

**FINANCE** (hoogste prio: titel/URL overrulen alles)
- App: `tradingview`
- Titel: `System Investing`, `Investing V*`
- URL: `tradingview.com`, `binance.com`, `coinbase.com`, `coingecko.com`, `coinank`, `coinglass`
- Spreadsheet met "invest" in titel

**DEVELOPMENT**
- App: `code|cursor|vim|neovim|webstorm|intellij`
- App: `terminal|cmd|powershell|warp|iterm|hyper|alacritty`
- Titel met file extensie: `.tsx`, `.jsx`, `.rs`, `.py`, `.go`, `.css`, `.html`, `.json`, `.md`
- URL: `github.com`, `gitlab.com`, `bitbucket.org`, `stackoverflow.com`
- URL: `claude.ai`, `chat.openai.com`, `anthropic.com`, `platform.openai.com`
- URL: `localhost`, `127.0.0.1`, `0.0.0.0`
- URL: `vercel.com`, `netlify.com`, `railway.app`, `supabase.com`
- URL: `npmjs.com`, `docs.rs`, `crates.io`, `pypi.org`
- URL: `notion.so`
- URL: `make.com`, `n8n.io`, `zapier.com`, `autronis.nl`, `autronis.com`
- Titel: `Lovable`, `Remix of Autronis`
- Titel: `Claude.*Google Chrome`, `Claude - …`
- Titel: `Tailwind`, `React`, `Next.js`, `MDN`, `W3Schools`
- Titel: `localhost:<port>`

**COMMUNICATIE**
- App: `discord|slack|teams|zoom|telegram|whatsapp|signal`
- URL: `mail.google.com`, `outlook.live.com`, `outlook.office`
- URL: `discord.com`, `slack.com`, `teams.microsoft.com`
- URL: `meet.google.com`, `zoom.us`
- URL: `calendar.google.com`
- URL: `linkedin.com`

**DESIGN**
- App: `figma|sketch|photoshop|illustrator|canva|affinity`
- URL: `figma.com`, `canva.com`, `dribbble.com`, `behance.net`

**ADMINISTRATIE**
- URL: `moneybird.com`, `exactonline`, `twinfield`, `e-boekhouden`
- URL: `mijnbelastingdienst`, `belastingdienst.nl`
- URL: `kvk.nl`, `ing.nl`, `rabobank.nl`, `abnamro.nl`
- URL: `digid.nl`
- Titel: `KVK`, `Kamer van Koophandel`, `eenmanszaak`, `vennootschap`, `VOF`, `DigiD`
- URL: Google Sheets / Excel
- App: `excel|numbers`

**YOUTUBE → DEVELOPMENT** (tech tutorials redden van afleiding)
- URL: youtube.com met keywords `claude|code|programming|tutorial|dev|react|next|rust|agent|cursor|api|typescript|javascript|python|automation|n8n|make`
- Titel: YouTube met `Claude|Code|Agent|Team|Programming|Tutorial|Developer|Coding|API|Build|Setup|Cursor|n8n`

**AFLEIDING**
- URL: youtube.com (niet-edu)
- URL: `reddit.com` (behalve programming/webdev/react/rust subs)
- URL: `twitter.com|x.com|instagram.com|facebook.com|tiktok.com`
- URL: `netflix.com|disney|primevideo|twitch.tv`
- App: `spotify|music`

**Geen match** → `overig`

### User rules (custom regels)
Tabel: `screen_time_regels`
- `type`: `app` | `url` | `titel`
- `patroon`: regex (case-insensitive)
- `categorie`: target categorie
- `projectId`, `klantId`: optional auto-toewijzing
- `prioriteit`: hoger = eerder toegepast
- `isActief`: 0 of 1

User rules worden VÓÓR de auto-regels gecheckt. Eerste match wint.

### Project matching uit venstertitel
Voor VS Code / Cursor: titel format is `{file} — {workspace} — Visual Studio Code`. Workspace naam wordt geëxtraheerd, generieke namen (`src`, `app`, `test`, `dist`, `build`, etc) worden uitgefilterd, en gematcht tegen actieve projecten met 80%+ overeenkomst. Alleen toewijzen als precies 1 match.

Voor Terminal: directory naam aan einde van titel wordt gebruikt.

---

## 4. Sessies & metrics (`/api/screen-time/sessies`)

[src/app/api/screen-time/sessies/route.ts](../src/app/api/screen-time/sessies/route.ts)

### Skip apps (volledig genegeerd)
```
LockApp, SearchHost, ShellHost, ShellExperienceHost, Inactief
```

### 30-minuten slot algoritme
1. Filter: skip-apps + inactief weg
2. Voor de dag: vind `firstTime` en `lastTime`
3. Round `firstTime` af naar dichtstbijzijnde 30-min boundary: `floor(firstTime / 1800000) * 1800000`
4. Maak 30-min slots: `[t, t+30min)`, `[t+30min, t+60min)`, ...
5. Verdeel entries over slots op basis van `startTijd`
6. Skip lege slots

### Per slot: dominante categorie
Som duurSeconden per categorie binnen de slot. Categorieën krijgen weights:
- `finance`: **2x**
- `meeting`: **2x**
- alle andere: 1x

Hoogste gewogen categorie wint = sessie categorie.

Reden voor 2x: finance/meeting zijn vaak passieve apps (browser tab open) terwijl er actief mee gewerkt wordt.

### Productieve categorieën
```
development, design, administratie, finance, communicatie
```

### Deep work blok detectie
| Constante | Waarde |
|---|---|
| `DEEP_WORK_GAP_MAX_MIN` | **15 min** — max gap tussen sessies om in 1 blok te blijven |
| `DEEP_WORK_INTERRUPT_MAX_MIN` | **5 min** — korte non-productieve onderbreking is OK |
| `DEEP_WORK_BLOCK_MIN` | **15 min** — minimum duur van een deep work blok |
| `DEEP_WORK_TARGET` | **240 min (4u)** — dagelijks doel |

Algoritme:
```
for elke sessie in volgorde:
  if productieve categorie:
    if er is een actief blok:
      if gap ≤ 15 min → blok uitbreiden
      else → blok afsluiten (als ≥15 min actief), nieuw blok starten
    else → nieuw blok starten
  else (non-productief):
    if er is een actief blok:
      if interrupt > 5 min → blok afsluiten
      else → blok span uitbreiden, maar NIET bij actieve tijd optellen
```

### Deep work uren (canonical)
```
deepWorkMinuten = (totaalActief - afleidingSec) / 60
```
Waar:
- `totaalActief` = som van `(slot.eindTijd - slot.startTijd)` over ALLE sessies (= span, incl. gaps binnen slot)
- `afleidingSec` = som van slot spans waar dominante categorie = afleiding

### Productiviteit %
```
productiefSec = som van slot spans waar categorie ∉ [afleiding, inactief, overig]
productiefPercentage = productiefSec / totaalActief * 100
```

### Flow score (0–100)
```
deepWorkRatio    = min(1, deepWorkMinuten / 240)            # 0–1, hoeveel van 4u target
sessieLengteScore = min(1, gemSessieLengte / 45)            # 45 min = perfect
switchPenalty    = max(0, 1 - contextSwitches / aantalSessies)
afleidingPenalty = max(0, 1 - (afleidingSec / totaalActief) * 3)

focusScore = round(
  deepWorkRatio    * 35 +    # 35% gewicht
  sessieLengteScore * 25 +    # 25% gewicht
  switchPenalty    * 20 +    # 20% gewicht
  afleidingPenalty * 20      # 20% gewicht
)
```

### Context switches
Aantal keer dat opeenvolgende sessies een andere categorie hebben.

### Pauzes
Gaps tussen sessies ≥ 5 min worden als pauze geteld.

---

## 5. Canonical uren (`berekenActieveUren`)

[src/lib/screen-time-uren.ts](../src/lib/screen-time-uren.ts)

Single source of truth voor "uren werken" in HEEL het dashboard. Repliceert exact de /tijd page deep work calc, maar dan voor een willekeurige date range:

1. Fetch entries voor user in NL date range (UTC ±1 dag voor boundary safety)
2. Filter skip-apps + inactief weg
3. Filter op NL local date
4. Group per dag → bouw 30-min slots → bepaal dominante categorie per slot (met 2x finance/meeting weight)
5. Skip afleiding slots
6. Sommeer (laatste entry eindTijd − eerste entry startTijd) per slot
7. Return totaal in uren (2 decimalen)

Gebruikt door:
- `/api/dashboard` (uren deze week)
- `/api/team/overzicht` (deep work deze week per user)
- `/api/team/capaciteit` (gepland uren per user)
- `/api/analytics/vergelijk` (Sem vs Syb widget)
- `/api/analytics/decision-engine` (urenDezeMaand, billable split)
- `/api/belasting/uren-criterium` (1225u/jaar voortgang)

**Als ergens een ander getal staat: bug — debug deze functie, niet fork.**

---

## 6. Display thresholds

[src/app/(dashboard)/tijd/page.tsx](../src/app/(dashboard)/tijd/page.tsx)

### Flow score kleur
| Score | Kleur | Label |
|---|---|---|
| ≥ 70 | groen | Sterke focus |
| 40–69 | amber | Gemiddeld |
| < 40 | rood | Zwakke focus |

### Deep work %
| % van 4u target | Kleur |
|---|---|
| ≥ 75% | groen |
| 40–74% | amber |
| < 40% | rood |

### Productiviteit %
| % | Kleur |
|---|---|
| ≥ 80% | groen |
| 60–79% | amber |
| < 60% | rood |

### Dag-assessment tekst (`/tijd` header)
- `dwPct ≥ 75 && prodPct ≥ 70` → "Sterke dag — Xu deep work, X% productief" (groen)
- `dwPct ≥ 75` → "Deep work target gehaald (X%)" (groen)
- Ochtend (< 12u) → "Je dag is net begonnen / goede start"
- Middag (12–17u) → waarschuwingen bij weinig deep work / korte sessies / veel switches
- Avond (> 17u) → eindbeoordeling: "weinig deep work / korte sessies / X% productief"

### Categorie kleuren ([tijd/constants.tsx](../src/app/(dashboard)/tijd/constants.tsx))
```
development:   #17B8A5  (Autronis teal)
communicatie:  #3B82F6  (blauw)
meeting:       #3B82F6  (blauw)
design:        #A855F7  (paars)
administratie: #F97316  (oranje)
finance:       #EAB308  (geel)
afleiding:     #EF4444  (rood)
overig:        #6B7280  (grijs)
inactief:      #4B5563  (donker grijs)
```

---

## 7. Constanten samenvattingstabel

| Constante | Waarde | Locatie |
|---|---|---|
| `track_interval_secs` | 5s | desktop-agent config |
| `sync_interval_secs` | 30s | desktop-agent config |
| Warmup tijd | 120s (2 min) | lib.rs |
| Idle stop threshold | 600s (10 min) | lib.rs |
| Idle skip threshold | 120s (2 min) | lib.rs |
| Max entry duur (split) | 300s (5 min) | sync route |
| Nacht start | 22:00 | sync route |
| Nacht eind | 08:00 | sync route |
| Slot duur | 30 min | sessies route, screen-time-uren |
| Deep work gap max | 15 min | sessies route |
| Deep work interrupt max | 5 min | sessies route |
| Deep work blok min | 15 min | sessies route |
| Deep work target | 240 min (4u) | sessies route |
| Pauze drempel | 5 min | sessies route |
| Categorie weight (finance) | 2x | sessies route, screen-time-uren |
| Categorie weight (meeting) | 2x | sessies route, screen-time-uren |
| Flow score weights | 35/25/20/20 | sessies route |
| AI cache TTL | 5 min | sessies route |

---

## 8. Voor Syb's laptop: identieke setup

1. **Installeer agent** — zie [INSTALLATIE-SYB.md](INSTALLATIE-SYB.md)
2. **Config file** wordt gemaakt in:
   - macOS: `~/.config/autronis-screentime/config.json`
   - Windows: `%APPDATA%\autronis-screentime\config.json`
3. **Verplichte velden**:
   ```json
   {
     "api_url": "https://dashboard.autronis.nl",
     "api_token": "<JWT van /login>",
     "track_interval_secs": 5,
     "sync_interval_secs": 30,
     "locatie": "thuis"
   }
   ```
4. **Permissions**:
   - macOS: Accessibility + AppleScript naar browser
   - Windows: SmartScreen acceptatie
5. **Verifieer**: open dashboard, ga naar /tijd → "Tijdlijn" tab → moet binnen 1 min activiteit eerste sessie tonen
6. **Geen extra config** nodig — alle thresholds en formules zijn hardcoded en identiek tussen beide laptops. Zelfde input → zelfde output.

### Verschil tussen Sem en Syb mag ALLEEN zitten in:
- Wat ze daadwerkelijk doen (welke apps, hoelang)
- `locatie` setting (kantoor vs thuis) — beïnvloedt alleen reporting, niet de uren-berekening

Alle andere afwijkingen = bug. Eerste plek om te debuggen: deze spec, dan [src/lib/screen-time-uren.ts](../src/lib/screen-time-uren.ts).