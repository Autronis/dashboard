# Session Locking — Design Spec

## Doel

Voorkomen dat meerdere Claude Code sessies (op dezelfde of verschillende machines) tegelijkertijd aan dezelfde taken of files werken. Het Autronis Dashboard wordt de centrale authority voor locks.

## Aanpak

Dashboard-enforced locking op twee niveaus: task-level (claim een taak) en file-level (dynamisch bij eerste Edit/Write). Hooks in Claude Code dwingen dit af.

---

## 1. Database wijzigingen

### Nieuwe velden op `taken` tabel

| Veld | Type | Default | Beschrijving |
|------|------|---------|--------------|
| `lockSessieId` | text | null | Unieke sessie-ID van de Claude chat die de taak claimt |
| `lockSinds` | text | null | ISO timestamp wanneer de lock is geplaatst |
| `lockVerlooptOp` | text | null | ISO timestamp wanneer de lock automatisch verloopt (lockSinds + 2 uur) |

De bestaande `toegewezenAan` + `status: "bezig"` blijft intact voor menselijke toewijzing. De lock-velden zijn specifiek voor actieve Claude sessies.

### Nieuwe tabel `file_locks`

| Veld | Type | Default | Beschrijving |
|------|------|---------|--------------|
| `id` | integer PK | auto | |
| `sessieId` | text | not null | Claude sessie ID |
| `filePath` | text | not null | Relatief pad (bijv. `src/app/api/facturen/route.ts`) |
| `projectId` | integer | not null | Dashboard project ID |
| `taakId` | integer | nullable | Gekoppelde taak (als bekend) |
| `lockSinds` | text | not null | ISO timestamp |
| `lockVerlooptOp` | text | not null | Verloopt met de sessie lock (2 uur) |

Unique constraint op `(filePath, projectId)` — één sessie per file per project.

---

## 2. API endpoints

### POST `/api/team/locks/claim` — Taak claimen

Request:
```json
{
  "sessieId": "uuid-v4",
  "taakId": 123,
  "projectId": 9
}
```

Logica:
1. Check of de taak al gelockt is door een andere sessie (en lock niet verlopen)
2. Nee → zet `lockSessieId`, `lockSinds`, `lockVerlooptOp` (nu + 2 uur), return 200
3. Ja → return 409 met `{ fout: "Taak is al geclaimd door een andere sessie", sessieId: "...", lockSinds: "..." }`

### POST `/api/team/locks/file` — File lock registreren

Request:
```json
{
  "sessieId": "uuid-v4",
  "filePath": "src/app/api/facturen/route.ts",
  "projectId": 9,
  "taakId": 123
}
```

Logica:
1. Check of de file al gelockt is door een andere sessie (en lock niet verlopen)
2. Nee → insert file lock, return 200
3. Ja → return 409 met `{ fout: "Bestand wordt bewerkt door een andere sessie", sessieId: "...", taakId: ... }`

### GET `/api/team/locks?projectId=9` — Actieve locks ophalen

Response:
```json
{
  "taakLocks": [
    { "taakId": 123, "titel": "...", "sessieId": "...", "lockSinds": "...", "lockVerlooptOp": "..." }
  ],
  "fileLocks": [
    { "filePath": "src/...", "sessieId": "...", "taakId": 123, "lockSinds": "..." }
  ]
}
```

### DELETE `/api/team/locks?sessieId=X` — Alle locks van een sessie vrijgeven

Verwijdert alle file_locks met die sessieId en reset `lockSessieId`/`lockSinds`/`lockVerlooptOp` op taken.

### POST `/api/team/locks/heartbeat` — Lock verlengen

Request:
```json
{
  "sessieId": "uuid-v4"
}
```

Verlengt `lockVerlooptOp` met 2 uur voor alle locks van die sessie. Wordt periodiek gecalled door de Claude sessie.

---

## 3. Claude Code hooks

### SessionStart hook (`session-lock-init.sh`)

Bij het starten van elke Claude sessie:
1. Genereer een unieke `sessieId` (UUID) en sla op in `/tmp/claude-session-$PPID.id`
2. Call `GET /api/team/locks?projectId=X` om actieve locks te zien
3. Output als `systemMessage`: welke taken en files bezet zijn

### PreToolUse hook op Edit/Write (`file-lock-guard.sh`)

Bij elke Edit of Write actie:
1. Lees `sessieId` uit `/tmp/claude-session-$PPID.id`
2. Extract het file pad uit de tool input
3. Bepaal het relatieve pad (relatief aan project root)
4. Call `POST /api/team/locks/file` met sessieId + filePath
5. Als 200 → doorlaten (lock geregistreerd of al van deze sessie)
6. Als 409 → blokkeren met melding: "Bestand X wordt bewerkt door een andere sessie (taak: Y). Kies een andere taak."

### Stop hook (`session-lock-release.sh`)

Bij het eindigen van de sessie:
1. Lees `sessieId` uit `/tmp/claude-session-$PPID.id`
2. Call `DELETE /api/team/locks?sessieId=X`
3. Verwijder het tmp bestand

---

## 4. Lock expiry

In de bestaande cron job (`/api/facturen/cron` of een nieuwe `/api/team/locks/cleanup`):
- Elke run: verwijder file_locks waar `lockVerlooptOp < nu`
- Elke run: reset `lockSessieId`/`lockSinds`/`lockVerlooptOp` op taken waar lock verlopen is
- Voorkomt dead locks bij crashes of als de Stop hook niet runt

---

## 5. CLAUDE.md instructie update

Toevoegen aan de Autronis CLAUDE.md:

```
## Session Locking — VERPLICHT

Elke Claude sessie heeft een unieke sessieId. Voordat je aan een taak begint:
1. Check welke taken/files al gelockt zijn via de team sync
2. Claim de taak via POST /api/team/locks/claim
3. Als je een 409 krijgt: pak een ANDERE taak, probeer NIET dezelfde opnieuw
4. De PreToolUse hook blokkeert automatisch edits op files die door een andere sessie geclaimd zijn
```

---

## Technische details

### Stack
- Database: SQLite via Drizzle ORM (bestaande dashboard DB)
- API: Next.js API routes
- Hooks: Bash scripts in `~/.claude/hooks/`
- Auth: `x-api-key` header (SESSION_SECRET)

### Lock lifetime
- Default: 2 uur
- Verlengbaar via heartbeat
- Automatisch opgeruimd door cron

### Cross-machine support
- Dashboard API is de single source of truth
- Werkt op laptop, PC, of elke machine met internet
- Geen lokale state nodig behalve het sessieId tmp bestand
