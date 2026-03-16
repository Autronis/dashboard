# Focus Mode — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Focus Mode module with countdown timer overlay, automatic time registration, reflection prompts, dashboard widget, and statistics page.

**Architecture:** Separate `useFocus` Zustand store that calls existing tijdregistraties API. New `focus_sessies` table linked via FK. Full-screen overlay for active sessions. Dashboard widget + `/focus` stats page. Web Audio API for completion sound.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + SQLite, Zustand, TanStack React Query, Tailwind CSS with Autronis design tokens, Framer Motion, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-03-16-focus-mode-design.md`

---

## File Structure

### New Files
- `src/app/api/focus/route.ts` — GET + POST focus sessies
- `src/app/api/focus/[id]/route.ts` — PUT + DELETE focus sessie
- `src/app/api/focus/statistieken/route.ts` — GET aggregaties
- `src/hooks/use-focus.ts` — Zustand store voor focus state
- `src/hooks/queries/use-focus.ts` — React Query hooks
- `src/lib/focus-sound.ts` — Web Audio API ding sound
- `src/components/focus/focus-setup-modal.tsx` — Project/taak/duur selectie
- `src/components/focus/focus-overlay.tsx` — Full-screen countdown overlay
- `src/components/focus/focus-reflectie-modal.tsx` — Reflectie na sessie
- `src/components/focus/focus-widget.tsx` — Dashboard widget
- `src/app/(dashboard)/focus/page.tsx` — Statistieken pagina

### Modified Files
- `src/lib/db/schema.ts` — add `focusSessies` table, extend categorie enum
- `src/types/index.ts` — add `"focus"` to TijdCategorie, add FocusSessie types
- `src/components/layout/header.tsx` — add Focus button
- `src/components/layout/sidebar.tsx` — add Focus nav item
- `src/app/(dashboard)/page.tsx` — add FocusWidget

---

## Chunk 1: Database, Types & API Routes

### Task 1: Database schema + types

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Extend categorie enum in tijdregistraties table**

In `src/lib/db/schema.ts`, find line 60:
```typescript
  categorie: text("categorie", { enum: ["development", "meeting", "administratie", "overig"] }).default("development"),
```

Replace with:
```typescript
  categorie: text("categorie", { enum: ["development", "meeting", "administratie", "overig", "focus"] }).default("development"),
```

- [ ] **Step 2: Add focusSessies table to schema**

Add after the last table in `schema.ts`:

```typescript
// ============ FOCUS SESSIES ============
export const focusSessies = sqliteTable("focus_sessies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id),
  projectId: integer("project_id").references(() => projecten.id),
  taakId: integer("taak_id").references(() => taken.id),
  geplandeDuurMinuten: integer("geplande_duur_minuten").notNull(),
  werkelijkeDuurMinuten: integer("werkelijke_duur_minuten"),
  reflectie: text("reflectie"),
  tijdregistratieId: integer("tijdregistratie_id").notNull().references(() => tijdregistraties.id),
  status: text("status", { enum: ["actief", "voltooid", "afgebroken"] }).notNull().default("actief"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 3: Update TijdCategorie type**

In `src/types/index.ts`, find line 17:
```typescript
export type TijdCategorie = "development" | "meeting" | "administratie" | "overig";
```

Replace with:
```typescript
export type TijdCategorie = "development" | "meeting" | "administratie" | "overig" | "focus";
```

- [ ] **Step 4: Add Focus types**

Add to `src/types/index.ts` after the existing types:

```typescript
// Focus Mode
export type FocusSessieStatus = "actief" | "voltooid" | "afgebroken";

export interface FocusSessie {
  id: number;
  gebruikerId: number;
  projectId: number;
  taakId: number | null;
  geplandeDuurMinuten: number;
  werkelijkeDuurMinuten: number | null;
  reflectie: string | null;
  tijdregistratieId: number;
  status: FocusSessieStatus;
  aangemaaktOp: string;
  projectNaam?: string;
  taakTitel?: string;
}

export interface FocusStatistieken {
  vandaag: { sessies: number; totaleDuurMinuten: number };
  week: Array<{ dag: string; duurMinuten: number }>;
  vorigeWeek: { totaleDuurMinuten: number };
  streak: number;
  perProject: Array<{ projectId: number; projectNaam: string; duurMinuten: number; sessies: number }>;
}
```

- [ ] **Step 5: Push schema changes**

Run: `npx drizzle-kit generate` then `npx drizzle-kit push`

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/types/index.ts
git commit -m "feat(focus): add focus_sessies table + types"
```

---

### Task 2: Focus API — CRUD routes

**Files:**
- Create: `src/app/api/focus/route.ts`
- Create: `src/app/api/focus/[id]/route.ts`

- [ ] **Step 1: Create GET + POST /api/focus**

Create `src/app/api/focus/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { focusSessies, projecten, taken } from "@/lib/db/schema";
import { eq, and, between, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const tot = searchParams.get("tot");

    const conditions: SQL[] = [eq(focusSessies.gebruikerId, gebruiker.id)];
    if (van && tot) {
      conditions.push(between(focusSessies.aangemaaktOp, van, tot));
    }

    const sessies = await db
      .select({
        id: focusSessies.id,
        gebruikerId: focusSessies.gebruikerId,
        projectId: focusSessies.projectId,
        taakId: focusSessies.taakId,
        geplandeDuurMinuten: focusSessies.geplandeDuurMinuten,
        werkelijkeDuurMinuten: focusSessies.werkelijkeDuurMinuten,
        reflectie: focusSessies.reflectie,
        tijdregistratieId: focusSessies.tijdregistratieId,
        status: focusSessies.status,
        aangemaaktOp: focusSessies.aangemaaktOp,
        projectNaam: projecten.naam,
        taakTitel: taken.titel,
      })
      .from(focusSessies)
      .leftJoin(projecten, eq(focusSessies.projectId, projecten.id))
      .leftJoin(taken, eq(focusSessies.taakId, taken.id))
      .where(and(...conditions))
      .orderBy(desc(focusSessies.aangemaaktOp));
    return NextResponse.json({ sessies });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();
    const { projectId, taakId, geplandeDuurMinuten, tijdregistratieId } = body;

    if (!projectId || !geplandeDuurMinuten || !tijdregistratieId) {
      return NextResponse.json(
        { fout: "Project, duur en tijdregistratie zijn verplicht." },
        { status: 400 }
      );
    }

    // Check for existing active session
    const [actief] = await db
      .select({ id: focusSessies.id })
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.gebruikerId, gebruiker.id),
          eq(focusSessies.status, "actief")
        )
      );

    if (actief) {
      return NextResponse.json(
        { fout: "Er is al een actieve focus sessie." },
        { status: 409 }
      );
    }

    const [sessie] = await db
      .insert(focusSessies)
      .values({
        gebruikerId: gebruiker.id,
        projectId,
        taakId: taakId || null,
        geplandeDuurMinuten,
        tijdregistratieId,
        status: "actief",
      })
      .returning();

    return NextResponse.json({ sessie }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Create PUT + DELETE /api/focus/[id]**

Create `src/app/api/focus/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { focusSessies, tijdregistraties } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { werkelijkeDuurMinuten, reflectie, status } = body;

    const [bestaand] = await db
      .select()
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.id, Number(id)),
          eq(focusSessies.gebruikerId, gebruiker.id)
        )
      );

    if (!bestaand) {
      return NextResponse.json({ fout: "Sessie niet gevonden." }, { status: 404 });
    }

    const updateData: Partial<typeof focusSessies.$inferInsert> = {};
    if (werkelijkeDuurMinuten !== undefined) updateData.werkelijkeDuurMinuten = werkelijkeDuurMinuten;
    if (reflectie !== undefined) updateData.reflectie = reflectie;
    if (status !== undefined) updateData.status = status;

    const [bijgewerkt] = await db
      .update(focusSessies)
      .set(updateData)
      .where(eq(focusSessies.id, Number(id)))
      .returning();

    return NextResponse.json({ sessie: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [bestaand] = await db
      .select()
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.id, Number(id)),
          eq(focusSessies.gebruikerId, gebruiker.id)
        )
      );

    if (!bestaand) {
      return NextResponse.json({ fout: "Sessie niet gevonden." }, { status: 404 });
    }

    // Delete focus session
    await db.delete(focusSessies).where(eq(focusSessies.id, Number(id)));

    // Also delete linked tijdregistratie
    if (bestaand.tijdregistratieId) {
      await db.delete(tijdregistraties).where(eq(tijdregistraties.id, bestaand.tijdregistratieId));
    }

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/focus/
git commit -m "feat(focus): add CRUD API routes"
```

---

### Task 3: Focus statistieken API

**Files:**
- Create: `src/app/api/focus/statistieken/route.ts`

- [ ] **Step 1: Create GET /api/focus/statistieken**

Create `src/app/api/focus/statistieken/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { focusSessies, projecten } from "@/lib/db/schema";
import { eq, and, between, sql, inArray } from "drizzle-orm";

function getWeekRange(offset = 0): { van: string; tot: string } {
  const now = new Date();
  const dag = now.getDay();
  const maandag = new Date(now);
  maandag.setDate(now.getDate() - (dag === 0 ? 6 : dag - 1) + offset * 7);
  maandag.setHours(0, 0, 0, 0);
  const zondag = new Date(maandag);
  zondag.setDate(maandag.getDate() + 6);
  zondag.setHours(23, 59, 59, 999);
  return { van: maandag.toISOString(), tot: zondag.toISOString() };
}

function getVandaagRange(): { van: string; tot: string } {
  const now = new Date();
  const van = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
  return { van, tot };
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    // Vandaag
    const vandaagRange = getVandaagRange();
    const vandaagSessies = await db
      .select({
        werkelijkeDuurMinuten: focusSessies.werkelijkeDuurMinuten,
      })
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.gebruikerId, gebruiker.id),
          inArray(focusSessies.status, ["voltooid", "afgebroken"]),
          between(focusSessies.aangemaaktOp, vandaagRange.van, vandaagRange.tot)
        )
      );

    const vandaag = {
      sessies: vandaagSessies.length,
      totaleDuurMinuten: vandaagSessies.reduce((sum, s) => sum + (s.werkelijkeDuurMinuten || 0), 0),
    };

    // Deze week per dag
    const weekRange = getWeekRange(0);
    const weekSessies = await db
      .select({
        werkelijkeDuurMinuten: focusSessies.werkelijkeDuurMinuten,
        aangemaaktOp: focusSessies.aangemaaktOp,
      })
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.gebruikerId, gebruiker.id),
          inArray(focusSessies.status, ["voltooid", "afgebroken"]),
          between(focusSessies.aangemaaktOp, weekRange.van, weekRange.tot)
        )
      );

    const weekMap = new Map<string, number>();
    for (const s of weekSessies) {
      if (!s.aangemaaktOp) continue;
      const dag = s.aangemaaktOp.substring(0, 10);
      weekMap.set(dag, (weekMap.get(dag) || 0) + (s.werkelijkeDuurMinuten || 0));
    }

    // Generate all 7 days
    const week: Array<{ dag: string; duurMinuten: number }> = [];
    const maandag = new Date(weekRange.van);
    for (let i = 0; i < 7; i++) {
      const d = new Date(maandag);
      d.setDate(maandag.getDate() + i);
      const dagStr = d.toISOString().substring(0, 10);
      week.push({ dag: dagStr, duurMinuten: weekMap.get(dagStr) || 0 });
    }

    // Vorige week totaal
    const vorigeWeekRange = getWeekRange(-1);
    const vorigeWeekSessies = await db
      .select({
        werkelijkeDuurMinuten: focusSessies.werkelijkeDuurMinuten,
      })
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.gebruikerId, gebruiker.id),
          inArray(focusSessies.status, ["voltooid", "afgebroken"]),
          between(focusSessies.aangemaaktOp, vorigeWeekRange.van, vorigeWeekRange.tot)
        )
      );

    const vorigeWeek = {
      totaleDuurMinuten: vorigeWeekSessies.reduce((sum, s) => sum + (s.werkelijkeDuurMinuten || 0), 0),
    };

    // Streak — count consecutive days with at least 1 session going back from today
    // Limit lookback to 365 days for performance
    const streakLookback = new Date();
    streakLookback.setDate(streakLookback.getDate() - 365);
    const alleSessies = await db
      .select({ aangemaaktOp: focusSessies.aangemaaktOp })
      .from(focusSessies)
      .where(
        and(
          eq(focusSessies.gebruikerId, gebruiker.id),
          inArray(focusSessies.status, ["voltooid", "afgebroken"]),
          between(focusSessies.aangemaaktOp, streakLookback.toISOString(), new Date().toISOString())
        )
      );

    const dagenMetSessie = new Set(
      alleSessies.map((s) => s.aangemaaktOp?.substring(0, 10)).filter(Boolean)
    );

    let streak = 0;
    const vandaagStr = new Date().toISOString().substring(0, 10);
    let checkDag = new Date(vandaagStr);
    while (dagenMetSessie.has(checkDag.toISOString().substring(0, 10))) {
      streak++;
      checkDag.setDate(checkDag.getDate() - 1);
    }

    // Per project
    const perProjectSessies = await db
      .select({
        projectId: focusSessies.projectId,
        projectNaam: projecten.naam,
        werkelijkeDuurMinuten: focusSessies.werkelijkeDuurMinuten,
      })
      .from(focusSessies)
      .leftJoin(projecten, eq(focusSessies.projectId, projecten.id))
      .where(
        and(
          eq(focusSessies.gebruikerId, gebruiker.id),
          inArray(focusSessies.status, ["voltooid", "afgebroken"]),
          between(focusSessies.aangemaaktOp, weekRange.van, weekRange.tot)
        )
      );

    const projectMap = new Map<number, { projectNaam: string; duurMinuten: number; sessies: number }>();
    for (const s of perProjectSessies) {
      if (!s.projectId) continue;
      const bestaand = projectMap.get(s.projectId);
      if (bestaand) {
        bestaand.duurMinuten += s.werkelijkeDuurMinuten || 0;
        bestaand.sessies++;
      } else {
        projectMap.set(s.projectId, {
          projectNaam: s.projectNaam || "Onbekend",
          duurMinuten: s.werkelijkeDuurMinuten || 0,
          sessies: 1,
        });
      }
    }

    const perProject = Array.from(projectMap.entries()).map(([projectId, data]) => ({
      projectId,
      ...data,
    }));

    return NextResponse.json({ vandaag, week, vorigeWeek, streak, perProject });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/focus/statistieken/
git commit -m "feat(focus): add statistieken API endpoint"
```

---

## Chunk 2: Zustand Store, Sound & React Query Hooks

### Task 4: Focus sound utility

**Files:**
- Create: `src/lib/focus-sound.ts`

- [ ] **Step 1: Create Web Audio API ding sound**

Create `src/lib/focus-sound.ts`:

```typescript
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playFocusDing(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.5);

    // Second tone (harmony)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.15); // E6
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 1.5);
  } catch {
    // Audio not supported, silently fail
  }
}

export function requestNotificationPermission(): void {
  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

export function showFocusNotification(projectNaam: string): void {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Focus sessie voltooid!", {
      body: `Je hebt gefocust op ${projectNaam}`,
      icon: "/icons/icon-192x192.png",
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/focus-sound.ts
git commit -m "feat(focus): add Web Audio ding + notification helpers"
```

---

### Task 5: useFocus Zustand store

**Files:**
- Create: `src/hooks/use-focus.ts`

- [ ] **Step 1: Create the useFocus store**

Create `src/hooks/use-focus.ts`:

```typescript
import { create } from "zustand";
import { useTimer } from "./use-timer";
import { playFocusDing, requestNotificationPermission, showFocusNotification } from "@/lib/focus-sound";

const STORAGE_KEY = "autronis-focus";

interface FocusStorage {
  isActive: boolean;
  isPaused: boolean;
  projectId: number;
  projectNaam: string;
  taakId: number | null;
  taakTitel: string | null;
  geplandeDuur: number;
  startTimestamp: number;
  totalePauzeDuur: number;
  pauseStartTimestamp: number | null;
  focusSessieId: number;
  tijdregistratieId: number;
}

interface FocusState {
  isActive: boolean;
  isPaused: boolean;
  projectId: number | null;
  projectNaam: string;
  taakId: number | null;
  taakTitel: string | null;
  geplandeDuur: number;
  resterend: number;
  startTimestamp: number | null;
  totalePauzeDuur: number;
  pauseStartTimestamp: number | null;
  focusSessieId: number | null;
  tijdregistratieId: number | null;
  showSetup: boolean;
  showReflectie: boolean;
  showOverlay: boolean;
}

interface FocusActions {
  openSetup: () => void;
  closeSetup: () => void;
  start: (params: {
    projectId: number;
    projectNaam: string;
    taakId: number | null;
    taakTitel: string | null;
    duurMinuten: number;
  }) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (reflectie?: string) => Promise<void>;
  tick: () => void;
  openOverlay: () => void;
  closeReflectie: () => void;
  restore: () => void;
}

function saveToStorage(state: FocusStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // SSR or storage unavailable
  }
}

function loadFromStorage(): FocusStorage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FocusStorage;
  } catch {
    return null;
  }
}

function calculateResterend(
  geplandeDuur: number,
  startTimestamp: number,
  totalePauzeDuur: number,
  isPaused: boolean,
  pauseStartTimestamp: number | null
): number {
  const now = Date.now() / 1000;
  const elapsed = now - startTimestamp / 1000;
  let pauzeDuur = totalePauzeDuur;
  if (isPaused && pauseStartTimestamp) {
    pauzeDuur += now - pauseStartTimestamp / 1000;
  }
  return Math.max(0, Math.round(geplandeDuur - elapsed + pauzeDuur));
}

export const useFocus = create<FocusState & FocusActions>((set, get) => ({
  // State
  isActive: false,
  isPaused: false,
  projectId: null,
  projectNaam: "",
  taakId: null,
  taakTitel: null,
  geplandeDuur: 0,
  resterend: 0,
  startTimestamp: null,
  totalePauzeDuur: 0,
  pauseStartTimestamp: null,
  focusSessieId: null,
  tijdregistratieId: null,
  showSetup: false,
  showReflectie: false,
  showOverlay: false,

  // Actions
  openSetup: () => set({ showSetup: true }),
  closeSetup: () => set({ showSetup: false }),

  start: async ({ projectId, projectNaam, taakId, taakTitel, duurMinuten }) => {
    // Stop active regular timer if running
    const timerState = useTimer.getState();
    if (timerState.isRunning && timerState.registratieId) {
      const elapsed = timerState.elapsed;
      const duur = Math.round(elapsed / 60);
      await fetch(`/api/tijdregistraties/${timerState.registratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eindTijd: new Date().toISOString(),
          duurMinuten: duur,
        }),
      });
      timerState.stop();
    }

    // Request notification permission
    requestNotificationPermission();

    // Create tijdregistratie
    const regRes = await fetch("/api/tijdregistraties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        omschrijving: `Focus sessie${taakTitel ? `: ${taakTitel}` : ""}`,
        categorie: "focus",
        startTijd: new Date().toISOString(),
      }),
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(regData.fout || "Tijdregistratie aanmaken mislukt");

    // Create focus session
    const focusRes = await fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        taakId,
        geplandeDuurMinuten: duurMinuten,
        tijdregistratieId: regData.registratie.id,
      }),
    });
    const focusData = await focusRes.json();
    if (!focusRes.ok) throw new Error(focusData.fout || "Focus sessie aanmaken mislukt");

    const geplandeDuur = duurMinuten * 60;
    const startTimestamp = Date.now();

    const newState = {
      isActive: true,
      isPaused: false,
      projectId,
      projectNaam,
      taakId,
      taakTitel,
      geplandeDuur,
      resterend: geplandeDuur,
      startTimestamp,
      totalePauzeDuur: 0,
      pauseStartTimestamp: null,
      focusSessieId: focusData.sessie.id,
      tijdregistratieId: regData.registratie.id,
      showSetup: false,
      showReflectie: false,
      showOverlay: true,
    };

    set(newState);
    saveToStorage({
      isActive: true,
      isPaused: false,
      projectId,
      projectNaam,
      taakId,
      taakTitel,
      geplandeDuur,
      startTimestamp,
      totalePauzeDuur: 0,
      pauseStartTimestamp: null,
      focusSessieId: focusData.sessie.id,
      tijdregistratieId: regData.registratie.id,
    });
  },

  pause: () => {
    const state = get();
    if (!state.isActive || state.isPaused) return;
    const pauseStartTimestamp = Date.now();
    set({ isPaused: true, pauseStartTimestamp });
    saveToStorage({
      isActive: true,
      isPaused: true,
      projectId: state.projectId!,
      projectNaam: state.projectNaam,
      taakId: state.taakId,
      taakTitel: state.taakTitel,
      geplandeDuur: state.geplandeDuur,
      startTimestamp: state.startTimestamp!,
      totalePauzeDuur: state.totalePauzeDuur,
      pauseStartTimestamp,
      focusSessieId: state.focusSessieId!,
      tijdregistratieId: state.tijdregistratieId!,
    });
  },

  resume: () => {
    const state = get();
    if (!state.isActive || !state.isPaused || !state.pauseStartTimestamp) return;
    const pauzeDuur = (Date.now() - state.pauseStartTimestamp) / 1000;
    const totalePauzeDuur = state.totalePauzeDuur + pauzeDuur;
    set({ isPaused: false, pauseStartTimestamp: null, totalePauzeDuur });
    saveToStorage({
      isActive: true,
      isPaused: false,
      projectId: state.projectId!,
      projectNaam: state.projectNaam,
      taakId: state.taakId,
      taakTitel: state.taakTitel,
      geplandeDuur: state.geplandeDuur,
      startTimestamp: state.startTimestamp!,
      totalePauzeDuur,
      pauseStartTimestamp: null,
      focusSessieId: state.focusSessieId!,
      tijdregistratieId: state.tijdregistratieId!,
    });
  },

  stop: async (reflectie?: string) => {
    const state = get();
    if (!state.isActive) return;

    const werkelijkeDuur = state.geplandeDuur - state.resterend;
    const werkelijkeDuurMinuten = Math.round(werkelijkeDuur / 60);
    const isVoltooid = state.resterend <= 0;

    // Update tijdregistratie
    if (state.tijdregistratieId) {
      await fetch(`/api/tijdregistraties/${state.tijdregistratieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eindTijd: new Date().toISOString(),
          duurMinuten: werkelijkeDuurMinuten,
        }),
      });
    }

    // Update focus session
    if (state.focusSessieId) {
      await fetch(`/api/focus/${state.focusSessieId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          werkelijkeDuurMinuten,
          reflectie: reflectie || null,
          status: isVoltooid ? "voltooid" : "afgebroken",
        }),
      });
    }

    set({
      isActive: false,
      isPaused: false,
      projectId: null,
      projectNaam: "",
      taakId: null,
      taakTitel: null,
      geplandeDuur: 0,
      resterend: 0,
      startTimestamp: null,
      totalePauzeDuur: 0,
      pauseStartTimestamp: null,
      focusSessieId: null,
      tijdregistratieId: null,
      showSetup: false,
      showReflectie: false,
      showOverlay: false,
    });
    clearStorage();
  },

  tick: () => {
    const state = get();
    if (!state.isActive || state.isPaused || !state.startTimestamp) return;

    const resterend = calculateResterend(
      state.geplandeDuur,
      state.startTimestamp,
      state.totalePauzeDuur,
      state.isPaused,
      state.pauseStartTimestamp
    );

    set({ resterend });

    if (resterend <= 0) {
      // Timer complete
      playFocusDing();
      showFocusNotification(state.projectNaam);
      set({ showReflectie: true, showOverlay: false });
    }
  },

  openOverlay: () => set({ showOverlay: true }),

  closeReflectie: () => set({ showReflectie: false }),

  restore: () => {
    const stored = loadFromStorage();
    if (!stored || !stored.isActive) return;

    const resterend = calculateResterend(
      stored.geplandeDuur,
      stored.startTimestamp,
      stored.totalePauzeDuur,
      stored.isPaused,
      stored.pauseStartTimestamp
    );

    // If timer expired while away, trigger completion
    if (resterend <= 0 && !stored.isPaused) {
      set({
        isActive: true,
        isPaused: false,
        projectId: stored.projectId,
        projectNaam: stored.projectNaam,
        taakId: stored.taakId,
        taakTitel: stored.taakTitel,
        geplandeDuur: stored.geplandeDuur,
        resterend: 0,
        startTimestamp: stored.startTimestamp,
        totalePauzeDuur: stored.totalePauzeDuur,
        pauseStartTimestamp: null,
        focusSessieId: stored.focusSessieId,
        tijdregistratieId: stored.tijdregistratieId,
        showSetup: false,
        showReflectie: true,
        showOverlay: false,
      });
      playFocusDing();
      return;
    }

    set({
      isActive: true,
      isPaused: stored.isPaused,
      projectId: stored.projectId,
      projectNaam: stored.projectNaam,
      taakId: stored.taakId,
      taakTitel: stored.taakTitel,
      geplandeDuur: stored.geplandeDuur,
      resterend,
      startTimestamp: stored.startTimestamp,
      totalePauzeDuur: stored.totalePauzeDuur,
      pauseStartTimestamp: stored.pauseStartTimestamp,
      focusSessieId: stored.focusSessieId,
      tijdregistratieId: stored.tijdregistratieId,
      showSetup: false,
      showReflectie: false,
      showOverlay: true,
    });
  },
}));

export function loadFocusFromStorage(): FocusStorage | null {
  return loadFromStorage();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-focus.ts
git commit -m "feat(focus): add useFocus Zustand store with localStorage persistence"
```

---

### Task 6: React Query hooks

**Files:**
- Create: `src/hooks/queries/use-focus.ts`

- [ ] **Step 1: Create React Query hooks for focus data**

Create `src/hooks/queries/use-focus.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import type { FocusSessie, FocusStatistieken } from "@/types";

export function useFocusSessies(van?: string, tot?: string) {
  return useQuery<{ sessies: FocusSessie[] }>({
    queryKey: ["focus-sessies", van, tot],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (van) params.set("van", van);
      if (tot) params.set("tot", tot);
      const res = await fetch(`/api/focus?${params}`);
      if (!res.ok) throw new Error("Focus sessies ophalen mislukt");
      return res.json();
    },
  });
}

export function useFocusStatistieken() {
  return useQuery<FocusStatistieken>({
    queryKey: ["focus-statistieken"],
    queryFn: async () => {
      const res = await fetch("/api/focus/statistieken");
      if (!res.ok) throw new Error("Focus statistieken ophalen mislukt");
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/queries/use-focus.ts
git commit -m "feat(focus): add React Query hooks"
```

---

## Chunk 3: UI Components

### Task 7: Focus Setup Modal

**Files:**
- Create: `src/components/focus/focus-setup-modal.tsx`

- [ ] **Step 1: Create the setup modal component**

Create `src/components/focus/focus-setup-modal.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/form-field";
import { Target, Play } from "lucide-react";
import { useFocus } from "@/hooks/use-focus";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: number;
  naam: string;
}

interface Taak {
  id: number;
  titel: string;
}

const DUUR_OPTIES = [
  { waarde: 25, label: "25 min" },
  { waarde: 50, label: "50 min" },
  { waarde: 0, label: "Custom" },
];

export function FocusSetupModal() {
  const focus = useFocus();
  const { addToast } = useToast();
  const [projecten, setProjecten] = useState<Project[]>([]);
  const [taken, setTaken] = useState<Taak[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [taakId, setTaakId] = useState<number | null>(null);
  const [duurType, setDuurType] = useState(25);
  const [customDuur, setCustomDuur] = useState(30);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!focus.showSetup) return;
    fetch("/api/projecten")
      .then((r) => r.json())
      .then((data) => setProjecten(data.projecten || []))
      .catch(() => {});
  }, [focus.showSetup]);

  useEffect(() => {
    if (!projectId) {
      setTaken([]);
      setTaakId(null);
      return;
    }
    fetch(`/api/taken?projectId=${projectId}&status=open,bezig`)
      .then((r) => r.json())
      .then((data) => setTaken(data.taken || []))
      .catch(() => {});
  }, [projectId]);

  const handleStart = async () => {
    if (!projectId) {
      addToast("Selecteer een project", "fout");
      return;
    }

    const duurMinuten = duurType === 0 ? customDuur : duurType;
    if (duurMinuten < 5 || duurMinuten > 120) {
      addToast("Duur moet tussen 5 en 120 minuten zijn", "fout");
      return;
    }

    const project = projecten.find((p) => p.id === projectId);
    const taak = taken.find((t) => t.id === taakId);

    setIsStarting(true);
    try {
      await focus.start({
        projectId,
        projectNaam: project?.naam || "",
        taakId: taakId,
        taakTitel: taak?.titel || null,
        duurMinuten,
      });
      addToast("Focus sessie gestart!", "succes");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Focus starten mislukt",
        "fout"
      );
    } finally {
      setIsStarting(false);
    }
  };

  const handleClose = () => {
    focus.closeSetup();
    setProjectId(null);
    setTaakId(null);
    setDuurType(25);
    setCustomDuur(30);
  };

  return (
    <Modal open={focus.showSetup} onClose={handleClose} titel="Focus starten" breedte="md">
      <div className="space-y-6">
        {/* Project selectie */}
        <SelectField
          label="Project"
          verplicht
          value={projectId || ""}
          onChange={(e) => setProjectId(Number(e.target.value) || null)}
          opties={[
            { waarde: "", label: "Selecteer project..." },
            ...projecten.map((p) => ({ waarde: String(p.id), label: p.naam })),
          ]}
        />

        {/* Taak selectie (optioneel) */}
        {projectId && taken.length > 0 && (
          <SelectField
            label="Taak (optioneel)"
            value={taakId || ""}
            onChange={(e) => setTaakId(Number(e.target.value) || null)}
            opties={[
              { waarde: "", label: "Geen specifieke taak" },
              ...taken.map((t) => ({ waarde: String(t.id), label: t.titel })),
            ]}
          />
        )}

        {/* Duur selectie */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Duur <span className="text-red-400 ml-1">*</span>
          </label>
          <div className="flex gap-2">
            {DUUR_OPTIES.map((optie) => (
              <button
                key={optie.waarde}
                type="button"
                onClick={() => setDuurType(optie.waarde)}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  duurType === optie.waarde
                    ? "bg-autronis-accent text-white"
                    : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/50"
                }`}
              >
                {optie.label}
              </button>
            ))}
          </div>
          {duurType === 0 && (
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                min={5}
                max={120}
                value={customDuur}
                onChange={(e) => setCustomDuur(Number(e.target.value))}
                className="w-24 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 tabular-nums"
              />
              <span className="text-sm text-autronis-text-secondary">minuten</span>
            </div>
          )}
        </div>

        {/* Start knop */}
        <button
          onClick={handleStart}
          disabled={!projectId || isStarting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-autronis-accent text-white font-semibold text-base hover:bg-autronis-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStarting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Target className="w-5 h-5" />
              Start Focus
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/focus/focus-setup-modal.tsx
git commit -m "feat(focus): add setup modal component"
```

---

### Task 8: Focus Overlay

**Files:**
- Create: `src/components/focus/focus-overlay.tsx`

- [ ] **Step 1: Create the full-screen focus overlay**

Create `src/components/focus/focus-overlay.tsx`:

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Square, Target } from "lucide-react";
import { useFocus } from "@/hooks/use-focus";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function formatCountdown(seconden: number): string {
  const min = Math.floor(seconden / 60);
  const sec = seconden % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FocusOverlay() {
  const focus = useFocus();
  const [showStopDialog, setShowStopDialog] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick interval
  useEffect(() => {
    if (!focus.isActive || focus.isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Immediate tick
    focus.tick();

    intervalRef.current = setInterval(() => {
      focus.tick();
    }, 1000);

    // Backup timeout for exact completion
    if (focus.resterend > 0) {
      timeoutRef.current = setTimeout(() => {
        focus.tick();
      }, focus.resterend * 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [focus.isActive, focus.isPaused]);

  // Visibility change — force tick when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && focus.isActive) {
        focus.tick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [focus.isActive]);

  // Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focus.showOverlay) {
        setShowStopDialog(true);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [focus.showOverlay]);

  const progress = focus.geplandeDuur > 0
    ? ((focus.geplandeDuur - focus.resterend) / focus.geplandeDuur) * 100
    : 0;

  const circumference = 2 * Math.PI * 140; // radius 140
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const handleStop = () => {
    setShowStopDialog(false);
    // Show reflectie modal instead of stopping directly (per spec)
    useFocus.setState({ showReflectie: true, showOverlay: false });
  };

  return (
    <>
      <AnimatePresence>
        {focus.showOverlay && focus.isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
            style={{
              background: "radial-gradient(ellipse at center, #1a2a2e 0%, #0E1719 70%)",
            }}
          >
            {/* Progress ring + timer */}
            <div className="relative flex items-center justify-center">
              <svg width="320" height="320" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  fill="none"
                  stroke="#2A3538"
                  strokeWidth="6"
                />
                {/* Progress circle */}
                <circle
                  cx="160"
                  cy="160"
                  r="140"
                  fill="none"
                  stroke="#17B8A5"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>

              {/* Timer text centered in ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-7xl font-mono font-bold text-autronis-text-primary tabular-nums tracking-tight">
                  {formatCountdown(focus.resterend)}
                </span>
                {focus.isPaused && (
                  <span className="text-sm text-autronis-accent mt-2 animate-pulse">
                    Gepauzeerd
                  </span>
                )}
              </div>
            </div>

            {/* Project + taak info */}
            <div className="mt-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Target className="w-4 h-4 text-autronis-accent" />
                <span className="text-lg font-medium text-autronis-text-primary">
                  {focus.projectNaam}
                </span>
              </div>
              {focus.taakTitel && (
                <p className="text-sm text-autronis-text-secondary">{focus.taakTitel}</p>
              )}
            </div>

            {/* Controls */}
            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={() => (focus.isPaused ? focus.resume() : focus.pause())}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
              >
                {focus.isPaused ? (
                  <>
                    <Play className="w-5 h-5" />
                    Hervatten
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5" />
                    Pauze
                  </>
                )}
              </button>

              <button
                onClick={() => setShowStopDialog(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <Square className="w-5 h-5" />
                Stop
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={showStopDialog}
        onClose={() => setShowStopDialog(false)}
        onBevestig={handleStop}
        titel="Focus sessie stoppen?"
        bericht="De timer stopt en de tijd tot nu toe wordt geregistreerd."
        bevestigTekst="Stoppen"
        variant="warning"
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/focus/focus-overlay.tsx
git commit -m "feat(focus): add full-screen countdown overlay"
```

---

### Task 9: Focus Reflectie Modal

**Files:**
- Create: `src/components/focus/focus-reflectie-modal.tsx`

- [ ] **Step 1: Create the reflectie modal**

Create `src/components/focus/focus-reflectie-modal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useFocus } from "@/hooks/use-focus";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Target, CheckCircle } from "lucide-react";

export function FocusReflectieModal() {
  const focus = useFocus();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [reflectie, setReflectie] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleOpslaan = async () => {
    setIsSaving(true);
    try {
      await focus.stop(reflectie || undefined);
      queryClient.invalidateQueries({ queryKey: ["focus-sessies"] });
      queryClient.invalidateQueries({ queryKey: ["focus-statistieken"] });
      addToast("Focus sessie opgeslagen!", "succes");
    } catch {
      addToast("Opslaan mislukt", "fout");
    } finally {
      setIsSaving(false);
      setReflectie("");
    }
  };

  const handleOverslaan = async () => {
    setIsSaving(true);
    try {
      await focus.stop();
      queryClient.invalidateQueries({ queryKey: ["focus-sessies"] });
      queryClient.invalidateQueries({ queryKey: ["focus-statistieken"] });
    } catch {
      addToast("Opslaan mislukt", "fout");
    } finally {
      setIsSaving(false);
      setReflectie("");
    }
  };

  return (
    <Modal
      open={focus.showReflectie}
      onClose={handleOverslaan}
      titel="Focus sessie voltooid!"
      breedte="md"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-autronis-accent/10 border border-autronis-accent/20">
          <CheckCircle className="w-6 h-6 text-autronis-accent flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-autronis-text-primary">
              {focus.projectNaam}
            </p>
            {focus.taakTitel && (
              <p className="text-xs text-autronis-text-secondary">{focus.taakTitel}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-autronis-text-secondary">
            Wat heb je gedaan? (optioneel)
          </label>
          <textarea
            value={reflectie}
            onChange={(e) => setReflectie(e.target.value)}
            placeholder="Kort samenvatten wat je hebt bereikt..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-primary placeholder-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleOverslaan}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary transition-colors disabled:opacity-50"
          >
            Overslaan
          </button>
          <button
            onClick={handleOpslaan}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Opslaan"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/focus/focus-reflectie-modal.tsx
git commit -m "feat(focus): add reflectie modal"
```

---

## Chunk 4: Integration & Pages

### Task 10: Header integration — Focus button

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Add Focus button to header**

In `src/components/layout/header.tsx`:

1. Add imports at top (after existing lucide imports):
```typescript
import { Target } from "lucide-react";
import { useFocus } from "@/hooks/use-focus";
```

2. Inside the component, add after `const timer = useTimer();`:
```typescript
const focus = useFocus();
```

3. Add Focus button JSX right before the timer indicator block (`{timer.isRunning && ...}`):

```typescript
{/* Focus button */}
{focus.isActive ? (
  <button
    onClick={() => focus.openOverlay()}
    className="flex items-center gap-2 bg-autronis-accent/10 border border-autronis-accent/30 rounded-lg px-3 py-1.5 hover:bg-autronis-accent/20 transition-colors animate-pulse"
  >
    <Target className="w-4 h-4 text-autronis-accent" />
    <span className="text-sm font-mono font-semibold text-autronis-accent tabular-nums">
      {String(Math.floor(focus.resterend / 60)).padStart(2, "0")}:
      {String(focus.resterend % 60).padStart(2, "0")}
    </span>
  </button>
) : (
  <button
    onClick={() => focus.openSetup()}
    className="flex items-center gap-1.5 text-autronis-text-secondary hover:text-autronis-accent transition-colors px-2 py-1.5 rounded-lg hover:bg-autronis-accent/10"
    title="Focus starten"
  >
    <Target className="w-4 h-4" />
    <span className="text-sm font-medium hidden sm:inline">Focus</span>
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat(focus): add Focus button to header"
```

---

### Task 11: Sidebar integration

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Focus to sidebar nav items**

In `src/components/layout/sidebar.tsx`:

1. Add `Target` to lucide-react imports:
```typescript
import { ..., Target, ... } from "lucide-react";
```

2. In the `navItems` array, add after the Tijdregistratie entry:
```typescript
{ label: "Focus", icon: Target, href: "/focus" },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(focus): add Focus to sidebar navigation"
```

---

### Task 12: App Shell integration — mount Focus components

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

- [ ] **Step 1: Add Focus components to app shell**

In `src/components/layout/app-shell.tsx`:

1. Add imports:
```typescript
import { FocusSetupModal } from "@/components/focus/focus-setup-modal";
import { FocusOverlay } from "@/components/focus/focus-overlay";
import { FocusReflectieModal } from "@/components/focus/focus-reflectie-modal";
import { useFocus, loadFocusFromStorage } from "@/hooks/use-focus";
```

2. Inside the component, add restore logic:
```typescript
const focus = useFocus();

useEffect(() => {
  const stored = loadFocusFromStorage();
  if (stored) {
    focus.restore();
  }
}, []);
```

3. Add components before closing JSX (after ToastContainer or other modals):
```typescript
<FocusSetupModal />
<FocusOverlay />
<FocusReflectieModal />
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat(focus): mount focus components in app shell"
```

---

### Task 13: Dashboard Widget

**Files:**
- Create: `src/components/focus/focus-widget.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Create the Focus widget component**

Create `src/components/focus/focus-widget.tsx`:

```typescript
"use client";

import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { useFocusStatistieken } from "@/hooks/queries/use-focus";

const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export function FocusWidget() {
  const { data, isLoading } = useFocusStatistieken();

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-autronis-accent" />
          <h3 className="text-lg font-semibold text-autronis-text-primary">Focus vandaag</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const uren = (data.vandaag.totaleDuurMinuten / 60).toFixed(1).replace(".", ",");
  const maxDuur = Math.max(...data.week.map((d) => d.duurMinuten), 1);
  const weekTotaal = data.week.reduce((sum, d) => sum + d.duurMinuten, 0);
  const vorigeWeekTotaal = data.vorigeWeek.totaleDuurMinuten;
  const delta = vorigeWeekTotaal > 0
    ? Math.round(((weekTotaal - vorigeWeekTotaal) / vorigeWeekTotaal) * 100)
    : 0;

  return (
    <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-autronis-accent" />
          <h3 className="text-lg font-semibold text-autronis-text-primary">Focus vandaag</h3>
        </div>
        {data.streak > 0 && (
          <span className="text-xs font-medium text-autronis-accent bg-autronis-accent/10 px-2 py-1 rounded-full">
            {data.streak} dagen streak
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold text-autronis-text-primary tabular-nums">{uren}</span>
        <span className="text-sm text-autronis-text-secondary">uur</span>
      </div>
      <p className="text-sm text-autronis-text-secondary mb-5">
        {data.vandaag.sessies} {data.vandaag.sessies === 1 ? "sessie" : "sessies"}
      </p>

      {/* Week bar chart */}
      <div className="flex items-end gap-1.5 h-16 mb-2">
        {data.week.map((dag, i) => {
          const hoogte = maxDuur > 0 ? (dag.duurMinuten / maxDuur) * 100 : 0;
          const isVandaag = dag.dag === new Date().toISOString().substring(0, 10);
          return (
            <div key={dag.dag} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t transition-all ${
                  isVandaag ? "bg-autronis-accent" : "bg-autronis-accent/30"
                }`}
                style={{ height: `${Math.max(hoogte, 4)}%` }}
                title={`${dag.duurMinuten} min`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mb-4">
        {DAGEN_KORT.map((dag) => (
          <div key={dag} className="flex-1 text-center text-[10px] text-autronis-text-secondary">
            {dag}
          </div>
        ))}
      </div>

      {/* Week vergelijking */}
      {vorigeWeekTotaal > 0 && (
        <div className="flex items-center gap-1.5 mb-4 text-sm">
          {delta > 0 ? (
            <TrendingUp className="w-4 h-4 text-green-400" />
          ) : delta < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-400" />
          ) : (
            <Minus className="w-4 h-4 text-autronis-text-secondary" />
          )}
          <span className={delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-autronis-text-secondary"}>
            {delta > 0 ? "+" : ""}{delta}% vs vorige week
          </span>
        </div>
      )}

      <Link
        href="/focus"
        className="text-sm text-autronis-accent hover:text-autronis-accent-hover transition-colors"
      >
        Bekijk details →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Add FocusWidget to dashboard homepage**

In `src/app/(dashboard)/page.tsx`, add import:
```typescript
import { FocusWidget } from "@/components/focus/focus-widget";
```

Then add `<FocusWidget />` in the widget grid area alongside other widgets.

- [ ] **Step 3: Commit**

```bash
git add src/components/focus/focus-widget.tsx src/app/(dashboard)/page.tsx
git commit -m "feat(focus): add dashboard widget with weekly bar chart"
```

---

### Task 14: /focus Statistieken Pagina

**Files:**
- Create: `src/app/(dashboard)/focus/page.tsx`

- [ ] **Step 1: Create the focus statistics page**

Create `src/app/(dashboard)/focus/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Target, Clock, Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useFocusSessies, useFocusStatistieken } from "@/hooks/queries/use-focus";
import { useFocus } from "@/hooks/use-focus";

const DAGEN_KORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function formatDuur(minuten: number): string {
  if (minuten < 60) return `${minuten} min`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest > 0 ? `${uren}u ${rest}m` : `${uren}u`;
}

export default function FocusPage() {
  const focus = useFocus();
  const { data: stats, isLoading: statsLoading } = useFocusStatistieken();

  // Get today's sessions
  const vandaag = new Date();
  const van = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate()).toISOString();
  const tot = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate(), 23, 59, 59).toISOString();
  const { data: sessiesData, isLoading: sessiesLoading } = useFocusSessies(van, tot);

  const isLoading = statsLoading || sessiesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
      </div>
    );
  }

  const sessies = sessiesData?.sessies || [];
  const maxDuurWeek = stats ? Math.max(...stats.week.map((d) => d.duurMinuten), 1) : 1;
  const weekTotaal = stats ? stats.week.reduce((sum, d) => sum + d.duurMinuten, 0) : 0;
  const vorigeWeekTotaal = stats?.vorigeWeek.totaleDuurMinuten || 0;
  const delta = vorigeWeekTotaal > 0
    ? Math.round(((weekTotaal - vorigeWeekTotaal) / vorigeWeekTotaal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary">Focus</h1>
          <p className="text-autronis-text-secondary">Deep work sessies & statistieken</p>
        </div>
        <button
          onClick={() => focus.openSetup()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-white font-medium hover:bg-autronis-accent-hover transition-colors"
        >
          <Target className="w-4 h-4" />
          Nieuwe sessie
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm text-autronis-text-secondary">Vandaag</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatDuur(stats?.vandaag.totaleDuurMinuten || 0)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">
            {stats?.vandaag.sessies || 0} sessies
          </p>
        </div>

        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm text-autronis-text-secondary">Deze week</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatDuur(weekTotaal)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {delta > 0 ? (
              <TrendingUp className="w-3 h-3 text-green-400" />
            ) : delta < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-autronis-text-secondary" />
            )}
            <span className={`text-xs ${delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-autronis-text-secondary"}`}>
              {delta > 0 ? "+" : ""}{delta}% vs vorige week
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-autronis-text-secondary">Streak</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {stats?.streak || 0} dagen
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">Opeenvolgend</p>
        </div>

        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-5 card-glow">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-autronis-accent" />
            <span className="text-sm text-autronis-text-secondary">Vorige week</span>
          </div>
          <p className="text-2xl font-bold text-autronis-text-primary tabular-nums">
            {formatDuur(vorigeWeekTotaal)}
          </p>
          <p className="text-xs text-autronis-text-secondary mt-1">Totaal</p>
        </div>
      </div>

      {/* Week overzicht bar chart */}
      <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
        <h2 className="text-lg font-semibold text-autronis-text-primary mb-5">Weekoverzicht</h2>
        <div className="flex items-end gap-3 h-40">
          {stats?.week.map((dag, i) => {
            const hoogte = maxDuurWeek > 0 ? (dag.duurMinuten / maxDuurWeek) * 100 : 0;
            const isVandaag = dag.dag === new Date().toISOString().substring(0, 10);
            return (
              <div key={dag.dag} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-autronis-text-secondary tabular-nums">
                  {dag.duurMinuten > 0 ? formatDuur(dag.duurMinuten) : ""}
                </span>
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isVandaag ? "bg-autronis-accent" : "bg-autronis-accent/30"
                  }`}
                  style={{ height: `${Math.max(hoogte, 2)}%` }}
                />
                <span className={`text-xs ${isVandaag ? "text-autronis-accent font-medium" : "text-autronis-text-secondary"}`}>
                  {DAGEN_KORT[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vandaag sessies */}
        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">Sessies vandaag</h2>
          {sessies.length === 0 ? (
            <p className="text-sm text-autronis-text-secondary">Nog geen sessies vandaag.</p>
          ) : (
            <div className="space-y-3">
              {sessies.map((sessie) => (
                <div
                  key={sessie.id}
                  className="flex items-start justify-between p-3 rounded-xl bg-autronis-bg/50 border border-autronis-border/50"
                >
                  <div>
                    <p className="text-sm font-medium text-autronis-text-primary">
                      {sessie.projectNaam}
                    </p>
                    {sessie.taakTitel && (
                      <p className="text-xs text-autronis-text-secondary">{sessie.taakTitel}</p>
                    )}
                    {sessie.reflectie && (
                      <p className="text-xs text-autronis-text-secondary mt-1 italic">
                        &ldquo;{sessie.reflectie}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sessie.status === "voltooid"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-orange-500/10 text-orange-400"
                    }`}>
                      {sessie.status === "voltooid" ? "Voltooid" : "Afgebroken"}
                    </span>
                    <p className="text-sm font-medium text-autronis-text-primary mt-1 tabular-nums">
                      {formatDuur(sessie.werkelijkeDuurMinuten || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per project breakdown */}
        <div className="rounded-2xl bg-autronis-card border border-autronis-border p-6 card-glow">
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">Per project (deze week)</h2>
          {!stats?.perProject.length ? (
            <p className="text-sm text-autronis-text-secondary">Nog geen focus data deze week.</p>
          ) : (
            <div className="space-y-3">
              {stats.perProject.map((project) => {
                const maxProjectDuur = Math.max(...stats.perProject.map((p) => p.duurMinuten), 1);
                const breedte = (project.duurMinuten / maxProjectDuur) * 100;
                return (
                  <div key={project.projectId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-autronis-text-primary">{project.projectNaam}</span>
                      <span className="text-xs text-autronis-text-secondary tabular-nums">
                        {formatDuur(project.duurMinuten)} · {project.sessies} sessies
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-autronis-border">
                      <div
                        className="h-full rounded-full bg-autronis-accent transition-all"
                        style={{ width: `${breedte}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/focus/
git commit -m "feat(focus): add /focus statistics page"
```

---

## Chunk 5: Verification & Polish

### Task 15: TypeScript check + build verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Fix any type errors found**

Fix all errors, then re-run tsc.

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Manually verify:
1. Focus button visible in header
2. Focus item in sidebar
3. Setup modal opens with project/taak/duur selection
4. Timer starts and overlay appears
5. Countdown counts down correctly
6. Pause/resume works
7. Stop triggers reflectie modal
8. Dashboard widget shows data
9. /focus page shows statistics

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(focus): complete Focus Mode module"
```
