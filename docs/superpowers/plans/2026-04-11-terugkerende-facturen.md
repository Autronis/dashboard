# Terugkerende Facturen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add frontend UI for managing recurring invoices — form fields, overview tab, pause/resume — and upgrade the cron job to use the new schema fields.

**Architecture:** Extend the existing `facturen` table with 5 new columns (terugkeerAantal, terugkeerEenheid, terugkeerStatus, volgendeFactuurdatum, bronFactuurId). Add a "Herhaling" section to the invoice form, a new "Terugkerend" tab to the financien page, a new API endpoint for status management, and update the cron job logic.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, SQLite, Tailwind CSS v4, Framer Motion, lucide-react

**Spec:** `docs/superpowers/specs/2026-04-11-terugkerende-facturen-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/db/schema.ts` | Add 5 new columns to facturen table |
| Create | `drizzle/0007_*.sql` | Migration for new columns |
| Modify | `src/app/api/facturen/route.ts` | Accept terugkerend fields in POST, filter in GET |
| Modify | `src/app/api/facturen/[id]/route.ts` | Accept terugkerend fields in PUT |
| Create | `src/app/api/facturen/[id]/terugkerend/route.ts` | Pause/resume/stop endpoint |
| Modify | `src/app/api/facturen/cron/route.ts` | Use new fields (volgendeFactuurdatum, terugkeerStatus) |
| Modify | `src/app/(dashboard)/financien/nieuw/page.tsx` | Add "Herhaling" form section |
| Modify | `src/app/(dashboard)/financien/[id]/bewerken/page.tsx` | Add "Herhaling" form section |
| Modify | `src/app/(dashboard)/financien/page.tsx` | Add "Terugkerend" tab |
| Create | `src/app/(dashboard)/financien/terugkerend-tab.tsx` | Recurring invoices overview tab |

---

### Task 1: Database schema — add new columns

**Files:**
- Modify: `src/lib/db/schema.ts:88-113`

- [ ] **Step 1: Add new columns to facturen table in schema.ts**

In `src/lib/db/schema.ts`, find the existing `facturen` table definition. After the `terugkeerInterval` field (around line 102), add the new columns:

```typescript
terugkeerAantal: integer("terugkeer_aantal").default(1),
terugkeerEenheid: text("terugkeer_eenheid", { enum: ["dagen", "weken", "maanden"] }),
terugkeerStatus: text("terugkeer_status", { enum: ["actief", "gepauzeerd", "gestopt"] }).default("actief"),
volgendeFactuurdatum: text("volgende_factuurdatum"),
bronFactuurId: integer("bron_factuur_id").references(() => facturen.id),
```

- [ ] **Step 2: Generate the migration**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx drizzle-kit generate
```
Expected: A new migration file `drizzle/0007_*.sql` with ALTER TABLE statements adding the 5 columns.

- [ ] **Step 3: Apply the migration**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx drizzle-kit push
```
Expected: Migration applied successfully, no errors.

- [ ] **Step 4: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add recurring invoice columns to facturen schema"
```

---

### Task 2: API — accept terugkerend fields in POST and GET

**Files:**
- Modify: `src/app/api/facturen/route.ts:100-191` (POST handler)
- Modify: `src/app/api/facturen/route.ts:8-97` (GET handler)

- [ ] **Step 1: Update POST handler to accept recurring fields**

In the POST handler of `src/app/api/facturen/route.ts`, extract the new fields from the request body. Find where the body is parsed (around line 108):

```typescript
const { klantId, projectId, factuurdatum, vervaldatum, notities, regels,
  isTerugkerend, terugkeerAantal, terugkeerEenheid, volgendeFactuurdatum } = await req.json();
```

Then in the `db.insert(facturen).values({...})` call, add after the existing fields:

```typescript
isTerugkerend: isTerugkerend ? 1 : 0,
terugkeerAantal: isTerugkerend ? (terugkeerAantal || 1) : null,
terugkeerEenheid: isTerugkerend ? terugkeerEenheid : null,
terugkeerStatus: isTerugkerend ? "actief" : null,
volgendeFactuurdatum: isTerugkerend ? volgendeFactuurdatum : null,
```

- [ ] **Step 2: Update GET handler to support terugkerend filter**

In the GET handler, after the existing query params parsing, add support for `?terugkerend=true`:

```typescript
const terugkerend = url.searchParams.get("terugkerend");
```

Add to the WHERE conditions:

```typescript
...(terugkerend === "true" ? [eq(facturen.isTerugkerend, 1)] : []),
```

Also ensure the response includes the new fields by adding them to the select or verifying the `select *` returns them.

- [ ] **Step 3: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/facturen/route.ts
git commit -m "feat: accept recurring fields in facturen POST, add terugkerend filter to GET"
```

---

### Task 3: API — accept terugkerend fields in PUT

**Files:**
- Modify: `src/app/api/facturen/[id]/route.ts:61-130`

- [ ] **Step 1: Update PUT handler**

In the PUT handler, extract the recurring fields from the request body alongside existing fields:

```typescript
const { klantId, projectId, factuurdatum, vervaldatum, notities, regels,
  isTerugkerend, terugkeerAantal, terugkeerEenheid, volgendeFactuurdatum } = body;
```

In the `db.update(facturen).set({...})` call, add:

```typescript
...(isTerugkerend !== undefined && {
  isTerugkerend: isTerugkerend ? 1 : 0,
  terugkeerAantal: isTerugkerend ? (terugkeerAantal || 1) : null,
  terugkeerEenheid: isTerugkerend ? terugkeerEenheid : null,
  terugkeerStatus: isTerugkerend ? "actief" : null,
  volgendeFactuurdatum: isTerugkerend ? volgendeFactuurdatum : null,
}),
```

- [ ] **Step 2: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/facturen/[id]/route.ts
git commit -m "feat: accept recurring fields in facturen PUT"
```

---

### Task 4: API — create terugkerend status endpoint

**Files:**
- Create: `src/app/api/facturen/[id]/terugkerend/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/facturen/[id]/terugkerend/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facturen } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;
  const { actie } = await req.json();

  const factuurId = Number(id);
  if (!factuurId) {
    return NextResponse.json({ fout: "Ongeldig factuur ID" }, { status: 400 });
  }

  const [bestaand] = await db
    .select()
    .from(facturen)
    .where(eq(facturen.id, factuurId))
    .limit(1);

  if (!bestaand || !bestaand.isTerugkerend) {
    return NextResponse.json({ fout: "Factuur niet gevonden of niet terugkerend" }, { status: 404 });
  }

  if (actie === "pauzeren") {
    if (bestaand.terugkeerStatus === "gestopt") {
      return NextResponse.json({ fout: "Gestopte factuur kan niet gepauzeerd worden" }, { status: 400 });
    }
    await db.update(facturen)
      .set({ terugkeerStatus: "gepauzeerd", bijgewerktOp: new Date().toISOString() })
      .where(eq(facturen.id, factuurId));

  } else if (actie === "hervatten") {
    if (bestaand.terugkeerStatus !== "gepauzeerd") {
      return NextResponse.json({ fout: "Alleen gepauzeerde facturen kunnen hervat worden" }, { status: 400 });
    }
    // Recalculate volgendeFactuurdatum from today
    const nu = new Date();
    const aantal = bestaand.terugkeerAantal || 1;
    const eenheid = bestaand.terugkeerEenheid || "maanden";
    if (eenheid === "dagen") nu.setDate(nu.getDate() + aantal);
    else if (eenheid === "weken") nu.setDate(nu.getDate() + aantal * 7);
    else if (eenheid === "maanden") nu.setMonth(nu.getMonth() + aantal);

    await db.update(facturen)
      .set({
        terugkeerStatus: "actief",
        volgendeFactuurdatum: nu.toISOString().slice(0, 10),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(facturen.id, factuurId));

  } else if (actie === "stoppen") {
    if (bestaand.terugkeerStatus === "gestopt") {
      return NextResponse.json({ fout: "Factuur is al gestopt" }, { status: 400 });
    }
    await db.update(facturen)
      .set({
        terugkeerStatus: "gestopt",
        volgendeFactuurdatum: null,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(facturen.id, factuurId));

  } else {
    return NextResponse.json({ fout: "Ongeldige actie. Gebruik: pauzeren, hervatten, stoppen" }, { status: 400 });
  }

  return NextResponse.json({ succes: true, actie });
}
```

- [ ] **Step 2: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/facturen/[id]/terugkerend/
git commit -m "feat: add recurring invoice status management endpoint"
```

---

### Task 5: Update cron job to use new fields

**Files:**
- Modify: `src/app/api/facturen/cron/route.ts:33-199`

- [ ] **Step 1: Rewrite the recurring invoice query**

Replace the existing terugkerend query (around line 33-46) with:

```typescript
const terugkerend = await db
  .select()
  .from(facturen)
  .where(
    and(
      eq(facturen.isTerugkerend, 1),
      eq(facturen.terugkeerStatus, "actief"),
      eq(facturen.isActief, 1),
      lte(facturen.volgendeFactuurdatum, nu)
    )
  )
  .all();
```

Import `lte` from drizzle-orm if not already imported.

- [ ] **Step 2: Update the generation loop**

Replace the old interval calculation logic. Instead of checking `betaaldOp` + `terugkeerInterval`, the query already filtered on `volgendeFactuurdatum <= today`. Inside the loop, after generating the new invoice:

1. Set `bronFactuurId` on the new invoice to the source invoice's ID
2. Calculate the next date and update the source invoice:

```typescript
// After inserting the new invoice, update volgendeFactuurdatum on the source
const aantal = f.terugkeerAantal || 1;
const eenheid = f.terugkeerEenheid || (f.terugkeerInterval === "wekelijks" ? "weken" : "maanden");
const volgende = new Date(f.volgendeFactuurdatum!);

if (eenheid === "dagen") volgende.setDate(volgende.getDate() + aantal);
else if (eenheid === "weken") volgende.setDate(volgende.getDate() + aantal * 7);
else if (eenheid === "maanden") volgende.setMonth(volgende.getMonth() + aantal);

await db.update(facturen)
  .set({ volgendeFactuurdatum: volgende.toISOString().slice(0, 10), bijgewerktOp: new Date().toISOString() })
  .where(eq(facturen.id, f.id));
```

- [ ] **Step 3: Add bronFactuurId to the insert**

In the `db.insert(facturen).values({...})` for new invoices, add:

```typescript
bronFactuurId: f.id,
```

- [ ] **Step 4: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/facturen/cron/route.ts
git commit -m "feat: update cron job to use new recurring fields"
```

---

### Task 6: Frontend — add "Herhaling" section to create form

**Files:**
- Modify: `src/app/(dashboard)/financien/nieuw/page.tsx`

- [ ] **Step 1: Add state variables**

After the existing state variables (around line 90), add:

```typescript
const [isTerugkerend, setIsTerugkerend] = useState(false);
const [terugkeerAantal, setTerugkeerAantal] = useState(1);
const [terugkeerEenheid, setTerugkeerEenheid] = useState<"dagen" | "weken" | "maanden">("maanden");
```

- [ ] **Step 2: Add computed volgendeFactuurdatum**

Below the new state variables, add a computed value:

```typescript
const volgendeFactuurdatum = useMemo(() => {
  if (!isTerugkerend || !factuurdatum) return "";
  const d = new Date(factuurdatum);
  if (terugkeerEenheid === "dagen") d.setDate(d.getDate() + terugkeerAantal);
  else if (terugkeerEenheid === "weken") d.setDate(d.getDate() + terugkeerAantal * 7);
  else if (terugkeerEenheid === "maanden") d.setMonth(d.getMonth() + terugkeerAantal);
  return d.toISOString().slice(0, 10);
}, [isTerugkerend, factuurdatum, terugkeerAantal, terugkeerEenheid]);
```

Add `useMemo` to the React import.

- [ ] **Step 3: Add "Herhaling" card section to the form**

After the Notities section (around line 356), before the action buttons, add:

```tsx
{/* Herhaling */}
<div className="bg-autronis-card rounded-2xl border border-autronis-border p-6 space-y-4">
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-autronis-text-primary">Herhaling</h3>
    <button
      type="button"
      onClick={() => setIsTerugkerend(!isTerugkerend)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors",
        isTerugkerend ? "bg-autronis-accent" : "bg-autronis-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform",
          isTerugkerend && "translate-x-5"
        )}
      />
    </button>
  </div>

  {isTerugkerend && (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Elke"
          type="number"
          min={1}
          value={terugkeerAantal}
          onChange={(e) => setTerugkeerAantal(Math.max(1, Number(e.target.value)))}
        />
        <SelectField
          label="Eenheid"
          value={terugkeerEenheid}
          onChange={(e) => setTerugkeerEenheid(e.target.value as "dagen" | "weken" | "maanden")}
          opties={[
            { value: "dagen", label: "Dagen" },
            { value: "weken", label: "Weken" },
            { value: "maanden", label: "Maanden" },
          ]}
        />
      </div>

      {volgendeFactuurdatum && (
        <p className="text-sm text-autronis-text-secondary">
          Volgende factuur op: <span className="text-autronis-accent font-medium">{new Date(volgendeFactuurdatum).toLocaleDateString("nl-NL")}</span>
        </p>
      )}
    </div>
  )}
</div>
```

Import `SelectField` alongside `FormField` if not already imported.

- [ ] **Step 4: Update the API call to include recurring fields**

In the `fetch("/api/facturen", { ... })` call body (around line 142), add after the existing fields:

```typescript
isTerugkerend,
terugkeerAantal,
terugkeerEenheid,
volgendeFactuurdatum: isTerugkerend ? volgendeFactuurdatum : null,
```

- [ ] **Step 5: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/(dashboard)/financien/nieuw/page.tsx
git commit -m "feat: add recurring invoice fields to create form"
```

---

### Task 7: Frontend — add "Herhaling" section to edit form

**Files:**
- Modify: `src/app/(dashboard)/financien/[id]/bewerken/page.tsx`

- [ ] **Step 1: Add state variables**

Same as Task 6, add after existing state variables:

```typescript
const [isTerugkerend, setIsTerugkerend] = useState(false);
const [terugkeerAantal, setTerugkeerAantal] = useState(1);
const [terugkeerEenheid, setTerugkeerEenheid] = useState<"dagen" | "weken" | "maanden">("maanden");
```

- [ ] **Step 2: Add computed volgendeFactuurdatum**

Same `useMemo` as Task 6 Step 2. Add `useMemo` to React import.

- [ ] **Step 3: Load existing recurring data**

In the data loading callback (where the API response is mapped to state, around line 78-97), add:

```typescript
setIsTerugkerend(!!f.isTerugkerend);
setTerugkeerAantal(f.terugkeerAantal || 1);
setTerugkeerEenheid(f.terugkeerEenheid || "maanden");
```

- [ ] **Step 4: Add "Herhaling" card section**

Same JSX as Task 6 Step 3 — the identical card with toggle, number input, select, and preview text.

- [ ] **Step 5: Update the API call to include recurring fields**

In the `fetch(\`/api/facturen/${id}\`, { ... })` PUT call body, add:

```typescript
isTerugkerend,
terugkeerAantal,
terugkeerEenheid,
volgendeFactuurdatum: isTerugkerend ? volgendeFactuurdatum : null,
```

- [ ] **Step 6: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/(dashboard)/financien/[id]/bewerken/page.tsx
git commit -m "feat: add recurring invoice fields to edit form"
```

---

### Task 8: Frontend — create "Terugkerend" tab component

**Files:**
- Create: `src/app/(dashboard)/financien/terugkerend-tab.tsx`

- [ ] **Step 1: Create the tab component**

Create `src/app/(dashboard)/financien/terugkerend-tab.tsx`:

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Play, Pause, Square, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/providers/toast-provider";

interface TerugkerendFactuur {
  id: number;
  factuurnummer: string;
  klantNaam: string;
  bedragInclBtw: number;
  terugkeerAantal: number;
  terugkeerEenheid: string;
  terugkeerStatus: string;
  volgendeFactuurdatum: string | null;
}

export function TerugkerendTab() {
  const router = useRouter();
  const { addToast } = useToast();
  const [facturen, setFacturen] = useState<TerugkerendFactuur[]>([]);
  const [laden, setLaden] = useState(true);

  const ophalen = useCallback(async () => {
    try {
      const res = await fetch("/api/facturen?terugkerend=true");
      const data = await res.json();
      setFacturen(data.facturen || []);
    } catch {
      addToast("Fout bij ophalen terugkerende facturen", "fout");
    } finally {
      setLaden(false);
    }
  }, [addToast]);

  useEffect(() => { ophalen(); }, [ophalen]);

  const actieUitvoeren = async (id: number, actie: "pauzeren" | "hervatten" | "stoppen") => {
    try {
      const res = await fetch(`/api/facturen/${id}/terugkerend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie }),
      });
      if (!res.ok) {
        const data = await res.json();
        addToast(data.fout || "Actie mislukt", "fout");
        return;
      }
      addToast(
        actie === "pauzeren" ? "Factuur gepauzeerd" :
        actie === "hervatten" ? "Factuur hervat" : "Factuur gestopt",
        "succes"
      );
      ophalen();
    } catch {
      addToast("Fout bij uitvoeren actie", "fout");
    }
  };

  const formatInterval = (aantal: number, eenheid: string) => {
    if (aantal === 1) {
      return eenheid === "dagen" ? "Dagelijks" : eenheid === "weken" ? "Wekelijks" : "Maandelijks";
    }
    return `Elke ${aantal} ${eenheid}`;
  };

  const statusKleur = (status: string) => {
    if (status === "actief") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (status === "gepauzeerd") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-red-500/10 text-red-400 border-red-500/20";
  };

  const actief = facturen.filter((f) => f.terugkeerStatus === "actief");
  const gepauzeerd = facturen.filter((f) => f.terugkeerStatus === "gepauzeerd");
  const maandelijksOmzet = actief.reduce((sum, f) => {
    const bedrag = f.bedragInclBtw || 0;
    if (f.terugkeerEenheid === "dagen") return sum + bedrag * (30 / (f.terugkeerAantal || 1));
    if (f.terugkeerEenheid === "weken") return sum + bedrag * (4.33 / (f.terugkeerAantal || 1));
    return sum + bedrag / (f.terugkeerAantal || 1);
  }, 0);

  if (laden) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-autronis-card rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-5">
          <p className="text-sm text-autronis-text-secondary">Actief</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{actief.length}</p>
        </div>
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-5">
          <p className="text-sm text-autronis-text-secondary">Gepauzeerd</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{gepauzeerd.length}</p>
        </div>
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-5">
          <p className="text-sm text-autronis-text-secondary">Maandelijkse omzet</p>
          <p className="text-2xl font-bold text-autronis-accent mt-1">
            {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(maandelijksOmzet)}
          </p>
        </div>
      </div>

      {/* Table */}
      {facturen.length === 0 ? (
        <div className="bg-autronis-card rounded-2xl border border-autronis-border p-12 text-center">
          <Repeat className="w-12 h-12 text-autronis-text-secondary/30 mx-auto mb-4" />
          <p className="text-autronis-text-secondary">Nog geen terugkerende facturen</p>
          <p className="text-sm text-autronis-text-secondary/60 mt-1">
            Maak een factuur aan en zet herhaling aan
          </p>
        </div>
      ) : (
        <div className="bg-autronis-card rounded-2xl border border-autronis-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-autronis-border">
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Klant</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Factuurnr.</th>
                <th className="text-right text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Bedrag</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Interval</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Volgende</th>
                <th className="text-left text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-right text-xs font-medium text-autronis-text-secondary uppercase tracking-wider px-6 py-3">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border">
              {facturen.map((f) => (
                <tr
                  key={f.id}
                  className="hover:bg-autronis-bg/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/financien/${f.id}`)}
                >
                  <td className="px-6 py-4 text-sm text-autronis-text-primary">{f.klantNaam}</td>
                  <td className="px-6 py-4 text-sm text-autronis-text-secondary font-mono">{f.factuurnummer}</td>
                  <td className="px-6 py-4 text-sm text-autronis-text-primary text-right font-medium">
                    {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(f.bedragInclBtw)}
                  </td>
                  <td className="px-6 py-4 text-sm text-autronis-text-secondary">
                    {formatInterval(f.terugkeerAantal, f.terugkeerEenheid)}
                  </td>
                  <td className="px-6 py-4 text-sm text-autronis-text-secondary">
                    {f.volgendeFactuurdatum
                      ? new Date(f.volgendeFactuurdatum).toLocaleDateString("nl-NL")
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", statusKleur(f.terugkeerStatus))}>
                      {f.terugkeerStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {f.terugkeerStatus === "actief" && (
                        <button
                          onClick={() => actieUitvoeren(f.id, "pauzeren")}
                          className="p-1.5 rounded-lg hover:bg-amber-500/10 text-autronis-text-secondary hover:text-amber-400 transition-colors"
                          title="Pauzeren"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {f.terugkeerStatus === "gepauzeerd" && (
                        <button
                          onClick={() => actieUitvoeren(f.id, "hervatten")}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-autronis-text-secondary hover:text-emerald-400 transition-colors"
                          title="Hervatten"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {f.terugkeerStatus !== "gestopt" && (
                        <button
                          onClick={() => actieUitvoeren(f.id, "stoppen")}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-autronis-text-secondary hover:text-red-400 transition-colors"
                          title="Stoppen"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/(dashboard)/financien/terugkerend-tab.tsx
git commit -m "feat: create recurring invoices overview tab component"
```

---

### Task 9: Frontend — add "Terugkerend" tab to financien page

**Files:**
- Modify: `src/app/(dashboard)/financien/page.tsx`

- [ ] **Step 1: Import the component and add the tab**

At the top of `page.tsx`, add the import:

```typescript
import { TerugkerendTab } from "./terugkerend-tab";
```

Add `Repeat` to the lucide-react import:

```typescript
import {
  Receipt, Landmark, TrendingUp, BarChart3, CreditCard, Euro, Link2, Repeat,
} from "lucide-react";
```

- [ ] **Step 2: Update the Tab type and TABS array**

Change the type:

```typescript
type Tab = "uitgaven" | "abonnementen" | "profit" | "bank" | "matching" | "liquiditeit" | "terugkerend";
```

Add to the TABS array (after "abonnementen"):

```typescript
{ key: "terugkerend", label: "Terugkerend", icon: Repeat },
```

- [ ] **Step 3: Add the tab content render**

After the existing tab content renders (around line 72), add:

```tsx
{activeTab === "terugkerend" && <TerugkerendTab />}
```

- [ ] **Step 4: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 5: Test in browser**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npm run dev
```

Open `http://localhost:3000/financien?tab=terugkerend` and verify:
- Tab appears in the tab bar
- KPI cards show (zeros if no data)
- Empty state shows when no recurring invoices exist
- Navigate to `/financien/nieuw` and verify the "Herhaling" toggle section appears

- [ ] **Step 6: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/(dashboard)/financien/page.tsx
git commit -m "feat: add Terugkerend tab to financien page"
```

---

### Task 10: Update GET API to return recurring fields with klantNaam

**Files:**
- Modify: `src/app/api/facturen/route.ts` (GET handler)

- [ ] **Step 1: Include klantNaam and recurring fields in response**

The GET handler needs to join with klanten to return `klantNaam`, and include the recurring fields. In the query (around line 15-40), ensure the response includes:

```typescript
terugkeerAantal: facturen.terugkeerAantal,
terugkeerEenheid: facturen.terugkeerEenheid,
terugkeerStatus: facturen.terugkeerStatus,
volgendeFactuurdatum: facturen.volgendeFactuurdatum,
```

If the existing query already uses `select()` (select all), these will be included automatically via the schema change. Verify and ensure `klantNaam` is part of the response for the terugkerend tab to work.

- [ ] **Step 2: Verify with TypeScript check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 3: Commit (if changes were needed)**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/app/api/facturen/route.ts
git commit -m "feat: ensure recurring fields and klantNaam in GET response"
```
