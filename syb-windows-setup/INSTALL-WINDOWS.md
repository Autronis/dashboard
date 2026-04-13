# Autronis Setup voor Syb (Windows — laptop én PC)

Deze map bevat alles wat je nodig hebt om op je Windows machines hetzelfde
auto-sync gedrag te krijgen als Sem op zijn Mac heeft. Doe deze installatie
**op beide apparaten** (laptop én PC), eenmalig per machine.

Resultaat na installatie:
- Elke `git commit` van Claude Code synct automatisch voltooide taken
  naar `dashboard.autronis.nl` onder jouw account
- Elke `TodoWrite` van Claude Code synct nieuwe taken met fase-detectie
- Bij sessiestart pakt Claude de openstaande taken automatisch op uit het
  dashboard (via de CLAUDE.md regels)

---

## 0. Vereisten

| Wat | Hoe te checken | Installatielink |
|---|---|---|
| Python 3.10+ | `python --version` | https://python.org/downloads (vink "Add to PATH") |
| Git | `git --version` | https://git-scm.com/downloads |
| Claude Code | `claude --version` | https://claude.ai/code |

Als `python` je Python 2 geeft, gebruik `python3` overal (of installeer Python 3 opnieuw met "Add to PATH" aangevinkt).

---

## 1. API key aanmaken (eenmalig — voor beide devices dezelfde key)

1. Open https://dashboard.autronis.nl en login als Syb (vraag Sem het wachtwoord als je 'm nog niet hebt)
2. Ga naar **Instellingen → API Keys**
3. Klik **Nieuwe API key**
4. Naam: `claude-sync-syb`
5. Kopieer de key (begint met `atr_...`) — bewaar 'm in je password manager, je ziet 'm maar één keer

---

## 2. Bestanden plaatsen

Open een PowerShell venster en run:

```powershell
# Hooks dir aanmaken
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\hooks"

# Config dir aanmaken
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.config\autronis"
```

Kopieer dan de bestanden uit deze setup map:

| Vanaf | Naar |
|---|---|
| `hooks\auto-sync-taken.py` | `%USERPROFILE%\.claude\hooks\auto-sync-taken.py` |
| `hooks\auto-sync-taken.cmd` | `%USERPROFILE%\.claude\hooks\auto-sync-taken.cmd` |
| `config\claude-sync.json.example` | `%USERPROFILE%\.config\autronis\claude-sync.json` (rename!) |

Open `%USERPROFILE%\.config\autronis\claude-sync.json` en vervang `PLAK_HIER_JE_API_KEY_VAN_DASHBOARD` met de echte key uit stap 1.

---

## 3. Claude Code settings.json aanpassen

Open `%USERPROFILE%\.claude\settings.json` (of maak hem aan als hij niet bestaat).

Plak de inhoud van `config\settings.json.snippet` in. **Belangrijk**: als je settings.json al een `hooks` sectie heeft, voeg dan de `PostToolUse` array van het snippet toe in plaats van de hele file vervangen. Als hij leeg is, gebruik gewoon dit:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash|TodoWrite",
        "hooks": [
          {
            "type": "command",
            "command": "%USERPROFILE%\\.claude\\hooks\\auto-sync-taken.cmd",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Sla op. Restart Claude Code als hij open staat.

---

## 4. CLAUDE.md plaatsen (one shot per machine)

Het bestand `config\CLAUDE.md.template` bevat de Autronis project regels die zorgen dat Claude Code automatisch taken ophaalt aan het begin van elke sessie. Plaats het in je project root:

```powershell
# Voor je hoofd projectmap (één keer per device)
mkdir "$env:USERPROFILE\Autronis"
copy "config\CLAUDE.md.template" "$env:USERPROFILE\Autronis\CLAUDE.md"
```

Als je `~\Autronis\Projects\` als hoofdmap voor projecten gebruikt (zoals Sem) wordt deze CLAUDE.md voor alle subprojecten herkend.

---

## 5. Test of het werkt

```powershell
# Test dat Python werkt
python --version

# Test de hook handmatig met dummy input (in PowerShell)
echo '{"tool_name":"TodoWrite","tool_input":{"todos":[{"content":"test taak van Syb device","status":"pending"}]},"tool_response":{},"cwd":"C:\\Users\\Syb\\Autronis"}' | python "$env:USERPROFILE\.claude\hooks\auto-sync-taken.py"
```

Als alles werkt, zie je een JSON respons met `"systemMessage"` en de tekst "Auto-sync (...) ... nieuwe taken aangemaakt".

Check daarna op het dashboard onder Taken → er moet een nieuwe taak "test taak van Syb device" staan.

Als je dat ziet → hook werkt. Verwijder de test taak weer.

---

## 6. Project mappen ophalen (optioneel — Desktop Agent)

De auto-sync hook is alleen voor **taken**. Als je ook **schermtijd** wilt
laten tracken en project mappen automatisch wilt laten klonen vanaf het
dashboard, installeer je de Desktop Agent. Zie `desktop-agent\INSTALLATIE-SYB.md`
in de `autronis-dashboard` repo voor de Tauri build instructies.

Belangrijk: als de Desktop Agent draait en het dashboard heeft `github_url`
voor een project, kloont hij automatisch de GitHub repo naar
`C:\Users\<jij>\Autronis\Projects\<project-naam>` ipv een lege map te maken.
Dat betekent dat Sem en jij dezelfde werkboom hebben zodra het project bestaat.

---

## 7. Wat als iets niet werkt?

| Probleem | Oplossing |
|---|---|
| `python` command niet gevonden | Reinstall Python met "Add to PATH" aangevinkt |
| Hook fired maar geen sync zichtbaar | Check `claude-sync.json` — staat de juiste API key erin? |
| `401 Niet geauthenticeerd` | API key is ongeldig of verlopen, maak nieuwe |
| Sync werkt op laptop niet PC | Beide devices moeten dezelfde stappen doorlopen — config is per machine |
| Settings.json wordt niet gelezen | Restart Claude Code volledig (sluit alle vensters) |
| Wil debuggen | Check de output van de cmd handmatig: `type input.json | python %USERPROFILE%\.claude\hooks\auto-sync-taken.py` |

---

## 8. Wat je NIET hoeft te doen

- **Eigen dashboard URL** — die is `dashboard.autronis.nl`, geen lokale instance
- **Eigen database** — Sem en jij delen dezelfde Turso db (productie = enige db)
- **Tijdregistratie scripts** — die werken op Mac via auto-timer.sh, op Windows niet nodig (gebruik Desktop Agent als je tijd wilt tracken)
- **Discord/Slack hooks** — alleen Sem heeft dat momenteel ingericht

---

## 9. Eindstaat na complete setup

| Wat | Locatie | Status |
|---|---|---|
| Python hook script | `%USERPROFILE%\.claude\hooks\auto-sync-taken.py` | ✅ |
| Windows wrapper | `%USERPROFILE%\.claude\hooks\auto-sync-taken.cmd` | ✅ |
| Config met API key | `%USERPROFILE%\.config\autronis\claude-sync.json` | ✅ |
| Settings.json hook entry | `%USERPROFILE%\.claude\settings.json` | ✅ |
| CLAUDE.md project regels | `%USERPROFILE%\Autronis\CLAUDE.md` | ✅ |
| Restart Claude Code | n.v.t. | ✅ |

Doe deze setup op je laptop, dan op je PC. Beide devices syncen daarna naar
hetzelfde Syb account in het dashboard, met dezelfde API key. Nieuwe taken,
voltooide taken, en fase-detectie werken precies hetzelfde als bij Sem.

Vraag Sem als je vastloopt.
