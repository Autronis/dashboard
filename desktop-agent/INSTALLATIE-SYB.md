# Screentime Tracker — Installatie voor Syb

De tracker draait op de achtergrond en registreert automatisch welke apps je gebruikt. Data wordt gesynchroniseerd naar dashboard.autronis.nl.

## Wat het doet
- Registreert welke app + window title je open hebt (elke 5 sec)
- Synct automatisch naar het dashboard (elke 30 sec)
- Stopt automatisch na 10 min inactiviteit (geen muis/toetsenbord)
- Draait in de system tray (naast de klok)

## Installatie (per apparaat)

### Stap 1: App builden of kopiëren

De app staat al gebuild op Sem's PC:
```
C:\Users\semmi\OneDrive\Claude AI\Projects\autronis-dashboard\desktop-agent\src-tauri\target\release\desktop-agent.exe
```

Kopieer `desktop-agent.exe` naar een vaste plek op je eigen PC, bijv:
```
C:\Users\Syb\Autronis\desktop-agent.exe
```

### Stap 2: Config aanmaken

Maak deze map + bestand aan:
```
C:\Users\Syb\AppData\Local\autronis-screentime\config.json
```

**Config voor je LAPTOP:**
```json
{
  "api_url": "https://dashboard.autronis.nl",
  "api_token": "autronis-dashboard-2026-geheim-minimaal-32-tekens!!",
  "track_interval_secs": 5,
  "sync_interval_secs": 30,
  "excluded_apps": [
    "1Password",
    "KeePass",
    "Windows Security",
    "LockApp",
    "SearchHost",
    "ShellHost",
    "ShellExperienceHost"
  ],
  "tracking_enabled": true,
  "dashboard_dir": "",
  "locatie": "kantoor"
}
```

**Config voor je PC (thuis):**
Zelfde als hierboven maar verander `"locatie"` naar `"thuis"`.

### Stap 3: Autostart instellen

1. Druk `Win + R`, typ `shell:startup`, druk Enter
2. Maak een snelkoppeling naar `desktop-agent.exe` in die map
3. Nu start de tracker automatisch bij het opstarten van Windows

### Stap 4: Testen

1. Start `desktop-agent.exe`
2. Je ziet een icoontje in de system tray (naast de klok)
3. Rechtermuisklik → je ziet opties (pauzeren, excluden, etc.)
4. Na ~2 minuten warmup begint hij te tracken
5. Check op dashboard.autronis.nl/tijd of je data binnenkomt

## Hoe de uren werken

- Beide apparaten (laptop + PC) syncen naar jouw account (Syb, id=2)
- Uren worden automatisch opgestapeld — laptop kantoor + PC thuis = totaal
- Op het dashboard zie je per sessie waar je werkte (kantoor/thuis)
- De tracker stopt automatisch als je 10 min niets doet

## Problemen?

- **Geen data?** Check of `api_token` klopt in config.json
- **Verkeerde uren?** De warmup is 2 min — eerste 2 min na opstarten telt niet mee
- **App excluden?** Rechtermuisklik op tray icon → "Huidige app excluden"
