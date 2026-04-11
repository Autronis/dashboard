# Session Locking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent multiple Claude Code sessions from working on the same tasks or files simultaneously, using the Autronis Dashboard as central lock authority.

**Architecture:** Add lock fields to `taken` table, create `file_locks` table, build lock management API endpoints, and create Claude Code hooks (SessionStart, PreToolUse, Stop) that enforce locking automatically.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, SQLite, Bash hooks, Python hooks

**Spec:** `docs/superpowers/specs/2026-04-11-session-locking-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db/schema.ts` | Add lock fields to taken, create file_locks table |
| Create | `drizzle/0008_*.sql` | Migration for lock fields |
| Create | `src/app/api/team/locks/route.ts` | GET (list locks) + DELETE (release locks) |
| Create | `src/app/api/team/locks/claim/route.ts` | POST: claim a task |
| Create | `src/app/api/team/locks/file/route.ts` | POST: register file lock |
| Create | `src/app/api/team/locks/heartbeat/route.ts` | POST: extend lock expiry |
| Create | `src/app/api/team/locks/cleanup/route.ts` | GET: cron cleanup expired locks |
| Modify | `vercel.json` | Add cleanup cron schedule |
| Create | `~/.claude/hooks/session-lock-init.sh` | SessionStart: generate sessieId, show locks |
| Create | `~/.claude/hooks/file-lock-guard.sh` | PreToolUse: check file locks before Edit/Write |
| Create | `~/.claude/hooks/session-lock-release.sh` | Stop: release all locks |
| Modify | `~/.claude/settings.json` | Register new hooks |

---

### Task 1: Database schema — lock fields and file_locks table

**Files:**
- Modify: `src/lib/db/schema.ts:291-318` (taken table)
- Modify: `src/lib/db/schema.ts` (add file_locks table after teamActiviteit)

- [ ] **Step 1: Add lock fields to taken table**

In `src/lib/db/schema.ts`, find the `taken` table definition (line 291). Before the closing `}, (table) => ({`, add after `bijgewerktOp`:

```typescript
lockSessieId: text("lock_sessie_id"),
lockSinds: text("lock_sinds"),
lockVerlooptOp: text("lock_verloopt_op"),
```

- [ ] **Step 2: Add file_locks table**

After the `teamActiviteit` table definition (around line 370), add:

```typescript
export const fileLocks = sqliteTable("file_locks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessieId: text("sessie_id").notNull(),
  filePath: text("file_path").notNull(),
  projectId: integer("project_id").references(() => projecten.id),
  taakId: integer("taak_id").references(() => taken.id),
  lockSinds: text("lock_sinds").notNull().default(sql`(datetime('now'))`),
  lockVerlooptOp: text("lock_verloopt_op").notNull(),
}, (table) => ({
  idxSessieId: index("idx_file_locks_sessie").on(table.sessieId),
  uniqFilePath: unique("uniq_file_lock").on(table.filePath, table.projectId),
}));
```

- [ ] **Step 3: Generate and apply migration**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
npx drizzle-kit generate
npx drizzle-kit push
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add session lock fields to taken and file_locks table"
```

---

### Task 2: API — list and release locks

**Files:**
- Create: `src/app/api/team/locks/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/team/locks/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, fileLocks, gebruikers, projecten } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

function requireApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return key === process.env.SESSION_SECRET;
}

// GET /api/team/locks?projectId=9 — list active locks
export async function GET(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const nu = new Date().toISOString();

  const taakLocks = await db
    .select({
      taakId: taken.id,
      titel: taken.titel,
      sessieId: taken.lockSessieId,
      lockSinds: taken.lockSinds,
      lockVerlooptOp: taken.lockVerlooptOp,
      fase: taken.fase,
    })
    .from(taken)
    .where(
      and(
        ...[
          gt(taken.lockVerlooptOp, nu),
          ...(projectId ? [eq(taken.projectId, Number(projectId))] : []),
        ]
      )
    )
    .all();

  const actieveFileLocks = await db
    .select()
    .from(fileLocks)
    .where(
      and(
        gt(fileLocks.lockVerlooptOp, nu),
        ...(projectId ? [eq(fileLocks.projectId, Number(projectId))] : [])
      )
    )
    .all();

  return NextResponse.json({ taakLocks, fileLocks: actieveFileLocks });
}

// DELETE /api/team/locks?sessieId=X — release all locks for a session
export async function DELETE(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessieId = url.searchParams.get("sessieId");

  if (!sessieId) {
    return NextResponse.json({ fout: "sessieId is verplicht" }, { status: 400 });
  }

  // Release file locks
  const verwijderd = await db
    .delete(fileLocks)
    .where(eq(fileLocks.sessieId, sessieId))
    .returning({ id: fileLocks.id });

  // Release task locks
  const nu = new Date().toISOString();
  const taken_vrijgegeven = await db
    .update(taken)
    .set({ lockSessieId: null, lockSinds: null, lockVerlooptOp: null, bijgewerktOp: nu })
    .where(eq(taken.lockSessieId, sessieId))
    .returning({ id: taken.id });

  return NextResponse.json({
    succes: true,
    fileLocks: verwijderd.length,
    taakLocks: taken_vrijgegeven.length,
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/team/locks/
git commit -m "feat: add lock list and release API endpoints"
```

---

### Task 3: API — claim a task

**Files:**
- Create: `src/app/api/team/locks/claim/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/team/locks/claim/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

function requireApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return key === process.env.SESSION_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { sessieId, taakId, projectId } = await req.json();

  if (!sessieId || !taakId) {
    return NextResponse.json({ fout: "sessieId en taakId zijn verplicht" }, { status: 400 });
  }

  const [taak] = await db
    .select()
    .from(taken)
    .where(eq(taken.id, taakId))
    .limit(1);

  if (!taak) {
    return NextResponse.json({ fout: "Taak niet gevonden" }, { status: 404 });
  }

  // Check if already locked by another session (and lock not expired)
  const nu = new Date().toISOString();
  if (taak.lockSessieId && taak.lockSessieId !== sessieId && taak.lockVerlooptOp && taak.lockVerlooptOp > nu) {
    return NextResponse.json({
      fout: `Taak "${taak.titel}" is al geclaimd door een andere sessie`,
      sessieId: taak.lockSessieId,
      lockSinds: taak.lockSinds,
      lockVerlooptOp: taak.lockVerlooptOp,
    }, { status: 409 });
  }

  // Set lock (2 hours from now)
  const verloopt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  await db.update(taken)
    .set({
      lockSessieId: sessieId,
      lockSinds: nu,
      lockVerlooptOp: verloopt,
      status: "bezig",
      bijgewerktOp: nu,
    })
    .where(eq(taken.id, taakId));

  return NextResponse.json({
    succes: true,
    taakId,
    lockVerlooptOp: verloopt,
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/team/locks/claim/
git commit -m "feat: add task claim endpoint with lock expiry"
```

---

### Task 4: API — file lock endpoint

**Files:**
- Create: `src/app/api/team/locks/file/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/team/locks/file/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fileLocks } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

function requireApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return key === process.env.SESSION_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { sessieId, filePath, projectId, taakId } = await req.json();

  if (!sessieId || !filePath) {
    return NextResponse.json({ fout: "sessieId en filePath zijn verplicht" }, { status: 400 });
  }

  const nu = new Date().toISOString();

  // Check if file already locked by another session
  const [bestaand] = await db
    .select()
    .from(fileLocks)
    .where(
      and(
        eq(fileLocks.filePath, filePath),
        ...(projectId ? [eq(fileLocks.projectId, projectId)] : []),
        gt(fileLocks.lockVerlooptOp, nu)
      )
    )
    .limit(1);

  if (bestaand && bestaand.sessieId !== sessieId) {
    return NextResponse.json({
      fout: `Bestand "${filePath}" wordt bewerkt door een andere sessie`,
      sessieId: bestaand.sessieId,
      taakId: bestaand.taakId,
      lockSinds: bestaand.lockSinds,
    }, { status: 409 });
  }

  // Already locked by this session — just return OK
  if (bestaand && bestaand.sessieId === sessieId) {
    return NextResponse.json({ succes: true, bestaand: true });
  }

  // Create new file lock (same 2h expiry)
  const verloopt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  await db.insert(fileLocks).values({
    sessieId,
    filePath,
    projectId: projectId || null,
    taakId: taakId || null,
    lockSinds: nu,
    lockVerlooptOp: verloopt,
  });

  return NextResponse.json({ succes: true, lockVerlooptOp: verloopt });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/team/locks/file/
git commit -m "feat: add file lock endpoint"
```

---

### Task 5: API — heartbeat and cleanup

**Files:**
- Create: `src/app/api/team/locks/heartbeat/route.ts`
- Create: `src/app/api/team/locks/cleanup/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create heartbeat endpoint**

Create `src/app/api/team/locks/heartbeat/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, fileLocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function requireApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return key === process.env.SESSION_SECRET;
}

export async function POST(req: NextRequest) {
  if (!requireApiKey(req)) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { sessieId } = await req.json();
  if (!sessieId) {
    return NextResponse.json({ fout: "sessieId is verplicht" }, { status: 400 });
  }

  const nu = new Date().toISOString();
  const verloopt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  // Extend task locks
  const taakResult = await db.update(taken)
    .set({ lockVerlooptOp: verloopt, bijgewerktOp: nu })
    .where(eq(taken.lockSessieId, sessieId))
    .returning({ id: taken.id });

  // Extend file locks
  const fileResult = await db.update(fileLocks)
    .set({ lockVerlooptOp: verloopt })
    .where(eq(fileLocks.sessieId, sessieId))
    .returning({ id: fileLocks.id });

  return NextResponse.json({
    succes: true,
    verlengd: { taken: taakResult.length, files: fileResult.length },
    lockVerlooptOp: verloopt,
  });
}
```

- [ ] **Step 2: Create cleanup cron endpoint**

Create `src/app/api/team/locks/cleanup/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, fileLocks } from "@/lib/db/schema";
import { lte, isNotNull } from "drizzle-orm";

export async function GET() {
  const nu = new Date().toISOString();

  // Remove expired file locks
  const verwijderd = await db
    .delete(fileLocks)
    .where(lte(fileLocks.lockVerlooptOp, nu))
    .returning({ id: fileLocks.id });

  // Reset expired task locks
  const gereset = await db
    .update(taken)
    .set({ lockSessieId: null, lockSinds: null, lockVerlooptOp: null, bijgewerktOp: nu })
    .where(lte(taken.lockVerlooptOp, nu))
    .returning({ id: taken.id });

  return NextResponse.json({
    succes: true,
    verwijderdeFileLocks: verwijderd.length,
    geresetTaakLocks: gereset.length,
  });
}
```

- [ ] **Step 3: Add cleanup cron to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{ "path": "/api/team/locks/cleanup", "schedule": "*/30 * * * *" }
```

This runs every 30 minutes to clean up expired locks.

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/team/locks/heartbeat/ src/app/api/team/locks/cleanup/ vercel.json
git commit -m "feat: add lock heartbeat, cleanup cron, and vercel schedule"
```

---

### Task 6: Hook — SessionStart lock init

**Files:**
- Create: `~/.claude/hooks/session-lock-init.sh`

- [ ] **Step 1: Create the session init hook**

Create `/Users/semmiegijs/.claude/hooks/session-lock-init.sh`:

```bash
#!/bin/bash
# SessionStart Hook — genereer sessieId en toon actieve locks

# Genereer unieke sessie ID
SESSIE_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
echo "$SESSIE_ID" > "/tmp/claude-session-$PPID.id"

# Lees config
CONFIG="$HOME/.config/autronis/claude-sync.json"
[ ! -f "$CONFIG" ] && exit 0

URL=$(python3 -c "import json; print(json.load(open('$CONFIG'))['dashboard_url'])" 2>/dev/null)
SECRET=$(grep -o '"SESSION_SECRET"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/Autronis/Projects/autronis-dashboard/.env.local" 2>/dev/null | head -1 | sed 's/.*"SESSION_SECRET"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# Fallback: probeer env var
[ -z "$SECRET" ] && SECRET="$SESSION_SECRET"
[ -z "$URL" ] || [ -z "$SECRET" ] && exit 0

# Detecteer project ID uit pad
PROJECT_ID=""
CURRENT="$PWD"
if echo "$CURRENT" | grep -q "/autronis-dashboard"; then
  PROJECT_ID="9"
fi

[ -z "$PROJECT_ID" ] && exit 0

# Haal actieve locks op
RESPONSE=$(curl -s --max-time 5 "$URL/api/team/locks?projectId=$PROJECT_ID" \
  -H "x-api-key: $SECRET" 2>/dev/null)

[ -z "$RESPONSE" ] && exit 0

python3 -c "
import json, sys

try:
    data = json.loads('$RESPONSE'.replace(\"'\", ''))
except:
    try:
        data = json.loads(sys.stdin.read())
    except:
        sys.exit(0)

taak_locks = data.get('taakLocks', [])
file_locks = data.get('fileLocks', [])

if not taak_locks and not file_locks:
    msg = 'Geen actieve locks — alle taken en files zijn vrij.'
    print(json.dumps({'systemMessage': f'Session ID: $SESSIE_ID\\n{msg}'}))
    sys.exit(0)

lines = ['Session ID: $SESSIE_ID', '']
if taak_locks:
    lines.append(f'BEZETTE TAKEN ({len(taak_locks)}):')
    for t in taak_locks:
        lines.append(f'  - {t[\"titel\"]} (sessie: {t[\"sessieId\"][:8]}...)')
if file_locks:
    lines.append(f'GELOCKTE FILES ({len(file_locks)}):')
    for f in file_locks:
        lines.append(f'  - {f[\"filePath\"]} (sessie: {f[\"sessieId\"][:8]}...)')
lines.append('')
lines.append('NIET aan deze taken/files werken — kies iets anders.')

print(json.dumps({'systemMessage': chr(10).join(lines)}))
" <<< "$RESPONSE" 2>/dev/null

exit 0
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/semmiegijs/.claude/hooks/session-lock-init.sh
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/.claude/hooks
git add session-lock-init.sh 2>/dev/null || true
```

---

### Task 7: Hook — PreToolUse file lock guard

**Files:**
- Create: `~/.claude/hooks/file-lock-guard.sh`

- [ ] **Step 1: Create the file lock guard hook**

Create `/Users/semmiegijs/.claude/hooks/file-lock-guard.sh`:

```bash
#!/bin/bash
# PreToolUse Hook — check en registreer file locks bij Edit/Write
# Blokkeert als een andere sessie het bestand bewerkt

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

# Alleen voor Edit en Write
[ "$TOOL" != "Edit" ] && [ "$TOOL" != "Write" ] && exit 0

# Haal file path uit tool input
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 0

# Lees sessie ID
SESSIE_FILE="/tmp/claude-session-$PPID.id"
[ ! -f "$SESSIE_FILE" ] && exit 0
SESSIE_ID=$(cat "$SESSIE_FILE")
[ -z "$SESSIE_ID" ] && exit 0

# Maak relatief pad (ten opzichte van project root)
REL_PATH="$FILE_PATH"
if echo "$FILE_PATH" | grep -q "/Autronis/Projects/"; then
  REL_PATH=$(echo "$FILE_PATH" | sed 's|.*/Autronis/Projects/[^/]*/||')
fi

# Skip non-project files (hooks, tmp, etc.)
if ! echo "$FILE_PATH" | grep -q "/Autronis/Projects/"; then
  exit 0
fi

# Detecteer project ID
PROJECT_ID=""
if echo "$FILE_PATH" | grep -q "/autronis-dashboard/"; then
  PROJECT_ID="9"
fi

# Lees config
CONFIG="$HOME/.config/autronis/claude-sync.json"
[ ! -f "$CONFIG" ] && exit 0
URL=$(python3 -c "import json; print(json.load(open('$CONFIG'))['dashboard_url'])" 2>/dev/null)
SECRET=$(grep -o '"SESSION_SECRET"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/Autronis/Projects/autronis-dashboard/.env.local" 2>/dev/null | head -1 | sed 's/.*"SESSION_SECRET"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
[ -z "$SECRET" ] && SECRET="$SESSION_SECRET"
[ -z "$URL" ] || [ -z "$SECRET" ] && exit 0

# Registreer file lock (of check of het vrij is)
RESPONSE=$(curl -s --max-time 3 -X POST "$URL/api/team/locks/file" \
  -H "x-api-key: $SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"sessieId\":\"$SESSIE_ID\",\"filePath\":\"$REL_PATH\",\"projectId\":$PROJECT_ID}" 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'fout' in data:
        print('409')
    else:
        print('200')
except:
    print('200')
" 2>/dev/null)

if [ "$HTTP_CODE" = "409" ]; then
  FOUT=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('fout','Bestand is gelockt'))" 2>/dev/null)
  echo "{\"decision\":\"block\",\"reason\":\"🔒 GELOCKT: $FOUT. Werk aan een ander bestand.\"}"
  exit 0
fi

exit 0
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/semmiegijs/.claude/hooks/file-lock-guard.sh
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/.claude/hooks
git add file-lock-guard.sh 2>/dev/null || true
```

---

### Task 8: Hook — Stop session lock release

**Files:**
- Create: `~/.claude/hooks/session-lock-release.sh`

- [ ] **Step 1: Create the release hook**

Create `/Users/semmiegijs/.claude/hooks/session-lock-release.sh`:

```bash
#!/bin/bash
# Stop Hook — geef alle locks vrij bij sessie einde

SESSIE_FILE="/tmp/claude-session-$PPID.id"
[ ! -f "$SESSIE_FILE" ] && exit 0
SESSIE_ID=$(cat "$SESSIE_FILE")
[ -z "$SESSIE_ID" ] && exit 0

# Lees config
CONFIG="$HOME/.config/autronis/claude-sync.json"
[ ! -f "$CONFIG" ] && exit 0
URL=$(python3 -c "import json; print(json.load(open('$CONFIG'))['dashboard_url'])" 2>/dev/null)
SECRET=$(grep -o '"SESSION_SECRET"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/Autronis/Projects/autronis-dashboard/.env.local" 2>/dev/null | head -1 | sed 's/.*"SESSION_SECRET"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
[ -z "$SECRET" ] && SECRET="$SESSION_SECRET"
[ -z "$URL" ] || [ -z "$SECRET" ] && exit 0

# Release alle locks
curl -s --max-time 5 -X DELETE "$URL/api/team/locks?sessieId=$SESSIE_ID" \
  -H "x-api-key: $SECRET" >/dev/null 2>&1

# Cleanup tmp file
rm -f "$SESSIE_FILE"

exit 0
```

- [ ] **Step 2: Make executable**

```bash
chmod +x /Users/semmiegijs/.claude/hooks/session-lock-release.sh
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/.claude/hooks
git add session-lock-release.sh 2>/dev/null || true
```

---

### Task 9: Register hooks in settings.json

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Add SessionStart hook**

In the `SessionStart` array in `~/.claude/settings.json`, add the lock init hook after the existing hooks:

```json
{
  "type": "command",
  "command": "~/.claude/hooks/session-lock-init.sh",
  "timeout": 10
}
```

- [ ] **Step 2: Add PreToolUse hook for Edit/Write**

Add a new entry to the `PreToolUse` array (alongside the existing Bash safety guard):

```json
{
  "matcher": "Edit|Write",
  "hooks": [
    {
      "type": "command",
      "command": "~/.claude/hooks/file-lock-guard.sh",
      "timeout": 5
    }
  ]
}
```

- [ ] **Step 3: Add Stop hook**

Add the lock release hook to the `Stop` array:

```json
{
  "type": "command",
  "command": "~/.claude/hooks/session-lock-release.sh",
  "timeout": 10
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/semmiegijs/.claude
git add settings.json 2>/dev/null || true
```

---

### Task 10: Update CLAUDE.md with locking instructions

**Files:**
- Modify: `/Users/semmiegijs/Autronis/CLAUDE.md`

- [ ] **Step 1: Add Session Locking section**

Add after the "Dashboard Task Sync" section in CLAUDE.md:

```markdown
## Session Locking — VERPLICHT

Elke Claude sessie heeft een unieke sessieId (automatisch gegenereerd bij start). Het dashboard is de central authority voor locks.

### Automatisch (via hooks):
- **SessionStart**: genereert sessieId, toont bezette taken/files
- **PreToolUse (Edit/Write)**: registreert file lock of blokkeert als een andere sessie het bestand bewerkt
- **Stop**: geeft alle locks vrij

### Handmatig (wanneer nodig):
**Taak claimen voordat je begint:**
```bash
SECRET=$(grep SESSION_SECRET ~/Autronis/Projects/autronis-dashboard/.env.local | cut -d= -f2)
SESSIE_ID=$(cat /tmp/claude-session-$PPID.id)

curl -X POST "https://dashboard.autronis.nl/api/team/locks/claim" \
  -H "x-api-key: $SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"sessieId\":\"$SESSIE_ID\",\"taakId\":TAAK_ID,\"projectId\":9}"
```

### Regels:
- Als je een **409** krijgt: pak een ANDERE taak, probeer NIET dezelfde opnieuw
- De PreToolUse hook blokkeert automatisch edits op files die door een andere sessie geclaimd zijn
- Locks verlopen na 2 uur (automatisch opgeruimd)
- Bij crash: locks worden opgeruimd door de cleanup cron (elke 30 min)
```

- [ ] **Step 2: Commit**

```bash
cd /Users/semmiegijs/Autronis
git add CLAUDE.md
git commit -m "docs: add session locking instructions to CLAUDE.md"
```
