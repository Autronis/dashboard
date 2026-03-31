# BTW Aangifte Voorbereiding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatische BTW-aangifte voorbereiding met Belastingdienst-rubrieken, concept/ingediend workflow, en cross-device sync.

**Architecture:** Extend existing `btw_aangiftes` table with rubriek columns + `is_buitenland` field on `uitgaven`. New POST endpoint calculates rubrieken from facturen/uitgaven. Extend existing PUT endpoint to save/update aangifte with rubrieken. Modal UI on belasting Acties tab triggered per kwartaalkaart.

**Tech Stack:** Next.js API routes, Drizzle ORM, SQLite, React, Tailwind CSS, Framer Motion, React Query

---

### Task 1: Extend database schema — btw_aangiftes rubrieken

**Files:**
- Modify: `src/lib/db/schema.ts:369-380`
- Modify: `src/lib/db/index.ts` (both Turso and SQLite auto-migrate blocks)

- [ ] **Step 1: Add rubriek columns to btw_aangiftes schema**

In `src/lib/db/schema.ts`, replace the existing `btwAangiftes` definition:

```typescript
export const btwAangiftes = sqliteTable("btw_aangiftes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kwartaal: integer("kwartaal").notNull(),
  jaar: integer("jaar").notNull(),
  btwOntvangen: real("btw_ontvangen").default(0),
  btwBetaald: real("btw_betaald").default(0),
  btwAfdragen: real("btw_afdragen").default(0),
  rubriek1aOmzet: real("rubriek_1a_omzet").default(0),
  rubriek1aBtw: real("rubriek_1a_btw").default(0),
  rubriek1bOmzet: real("rubriek_1b_omzet").default(0),
  rubriek1bBtw: real("rubriek_1b_btw").default(0),
  rubriek4aOmzet: real("rubriek_4a_omzet").default(0),
  rubriek4aBtw: real("rubriek_4a_btw").default(0),
  rubriek4bOmzet: real("rubriek_4b_omzet").default(0),
  rubriek4bBtw: real("rubriek_4b_btw").default(0),
  rubriek5aBtw: real("rubriek_5a_btw").default(0),
  rubriek5bBtw: real("rubriek_5b_btw").default(0),
  saldo: real("saldo").default(0),
  betalingskenmerk: text("betalingskenmerk"),
  status: text("status", { enum: ["open", "ingediend", "betaald"] }).default("open"),
  ingediendOp: text("ingediend_op"),
  notities: text("notities"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Add auto-migrate for new btw_aangiftes columns in db/index.ts**

Add ALTER TABLE statements for the new columns in both the Turso and SQLite branches of `src/lib/db/index.ts`. Place these near other ALTER TABLE migrations.

**Turso branch** (after the mealplan_plans CREATE TABLE):
```typescript
// BTW aangifte rubriek columns
const btwNewCols = [
  "rubriek_1a_omzet REAL DEFAULT 0", "rubriek_1a_btw REAL DEFAULT 0",
  "rubriek_1b_omzet REAL DEFAULT 0", "rubriek_1b_btw REAL DEFAULT 0",
  "rubriek_4a_omzet REAL DEFAULT 0", "rubriek_4a_btw REAL DEFAULT 0",
  "rubriek_4b_omzet REAL DEFAULT 0", "rubriek_4b_btw REAL DEFAULT 0",
  "rubriek_5a_btw REAL DEFAULT 0", "rubriek_5b_btw REAL DEFAULT 0",
  "saldo REAL DEFAULT 0", "betalingskenmerk TEXT",
];
for (const col of btwNewCols) {
  client.execute(`ALTER TABLE btw_aangiftes ADD COLUMN ${col}`).catch(() => {});
}
```

**SQLite branch** (after the mealplan_plans CREATE TABLE):
```typescript
// BTW aangifte rubriek columns
const btwCols = sqliteDb.prepare("PRAGMA table_info(btw_aangiftes)").all() as { name: string }[];
const btwNewCols = [
  { name: "rubriek_1a_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_1a_btw", def: "REAL DEFAULT 0" },
  { name: "rubriek_1b_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_1b_btw", def: "REAL DEFAULT 0" },
  { name: "rubriek_4a_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_4a_btw", def: "REAL DEFAULT 0" },
  { name: "rubriek_4b_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_4b_btw", def: "REAL DEFAULT 0" },
  { name: "rubriek_5a_btw", def: "REAL DEFAULT 0" }, { name: "rubriek_5b_btw", def: "REAL DEFAULT 0" },
  { name: "saldo", def: "REAL DEFAULT 0" }, { name: "betalingskenmerk", def: "TEXT" },
];
for (const col of btwNewCols) {
  if (!btwCols.some((c: { name: string }) => c.name === col.name)) {
    sqliteDb.exec(`ALTER TABLE btw_aangiftes ADD COLUMN ${col.name} ${col.def}`);
  }
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/index.ts
git commit -m "feat: add BTW rubriek columns to btw_aangiftes schema"
```

---

### Task 2: Extend database schema — uitgaven is_buitenland field

**Files:**
- Modify: `src/lib/db/schema.ts:129-143`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: Add is_buitenland column to uitgaven schema**

In `src/lib/db/schema.ts`, add after the `bonnetjeUrl` field in the `uitgaven` table:

```typescript
  isBuitenland: text("is_buitenland", { enum: ["buiten_eu", "binnen_eu"] }),
```

(Null means binnenland — no default needed.)

- [ ] **Step 2: Add auto-migrate for is_buitenland**

**Turso branch** in `src/lib/db/index.ts`:
```typescript
client.execute("ALTER TABLE uitgaven ADD COLUMN is_buitenland TEXT").catch(() => {});
```

**SQLite branch** in `src/lib/db/index.ts`:
```typescript
const uitgavenCols = sqliteDb.prepare("PRAGMA table_info(uitgaven)").all() as { name: string }[];
if (!uitgavenCols.some((c: { name: string }) => c.name === "is_buitenland")) {
  sqliteDb.exec("ALTER TABLE uitgaven ADD COLUMN is_buitenland TEXT");
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/index.ts
git commit -m "feat: add is_buitenland field to uitgaven schema"
```

---

### Task 3: Create BTW voorbereiding API endpoint

**Files:**
- Create: `src/app/api/belasting/btw-voorbereiding/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/belasting/btw-voorbereiding/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { btwAangiftes, facturen, uitgaven } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const BUITEN_EU_LEVERANCIERS = [
  "anthropic", "aws", "amazon web services", "openai",
  "vercel", "google cloud", "microsoft azure", "stripe",
  "digitalocean", "cloudflare", "github", "notion",
  "figma", "slack", "zoom",
];

function isBuitenEu(leverancier: string | null, isBuitenland: string | null): "buiten_eu" | "binnen_eu" | null {
  if (isBuitenland === "buiten_eu" || isBuitenland === "binnen_eu") return isBuitenland;
  if (!leverancier) return null;
  const lower = leverancier.toLowerCase();
  if (BUITEN_EU_LEVERANCIERS.some(naam => lower.includes(naam))) return "buiten_eu";
  return null;
}

function getQuarterDateRange(kwartaal: number, jaar: number): { start: string; end: string } {
  switch (kwartaal) {
    case 1: return { start: `${jaar}-01-01`, end: `${jaar}-03-31` };
    case 2: return { start: `${jaar}-04-01`, end: `${jaar}-06-30` };
    case 3: return { start: `${jaar}-07-01`, end: `${jaar}-09-30` };
    case 4: return { start: `${jaar}-10-01`, end: `${jaar}-12-31` };
    default: return { start: `${jaar}-01-01`, end: `${jaar}-12-31` };
  }
}

// POST /api/belasting/btw-voorbereiding
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const kwartaal = Number(body.kwartaal);
    const jaar = Number(body.jaar);

    if (!kwartaal || kwartaal < 1 || kwartaal > 4 || !jaar) {
      return NextResponse.json({ fout: "Ongeldig kwartaal of jaar" }, { status: 400 });
    }

    const { start, end } = getQuarterDateRange(kwartaal, jaar);

    // Rubriek 1a: Omzet binnenland 21%
    const r1a = await db.select({
      omzet: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      btw: sql<number>`COALESCE(SUM(${facturen.btwBedrag}), 0)`,
    }).from(facturen).where(and(
      eq(facturen.status, "betaald"),
      eq(facturen.isActief, 1),
      eq(facturen.btwPercentage, 21),
      gte(facturen.factuurdatum, start),
      lte(facturen.factuurdatum, end),
    )).get();

    // Rubriek 1b: Omzet binnenland 9%
    const r1b = await db.select({
      omzet: sql<number>`COALESCE(SUM(${facturen.bedragExclBtw}), 0)`,
      btw: sql<number>`COALESCE(SUM(${facturen.btwBedrag}), 0)`,
    }).from(facturen).where(and(
      eq(facturen.status, "betaald"),
      eq(facturen.isActief, 1),
      eq(facturen.btwPercentage, 9),
      gte(facturen.factuurdatum, start),
      lte(facturen.factuurdatum, end),
    )).get();

    // Get all uitgaven in quarter for rubriek 4 + 5b
    const alleUitgaven = await db.select().from(uitgaven).where(and(
      gte(uitgaven.datum, start),
      lte(uitgaven.datum, end),
    ));

    let r4aOmzet = 0;
    let r4bOmzet = 0;
    let voorbelasting = 0;

    for (const u of alleUitgaven) {
      const buitenland = isBuitenEu(u.leverancier, u.isBuitenland ?? null);
      if (buitenland === "buiten_eu") {
        r4aOmzet += u.bedrag;
      } else if (buitenland === "binnen_eu") {
        r4bOmzet += u.bedrag;
      } else {
        // Binnenland — btw_bedrag is voorbelasting
        voorbelasting += u.btwBedrag ?? 0;
      }
    }

    const r4aBtw = Math.round(r4aOmzet * 0.21 * 100) / 100;
    const r4bBtw = Math.round(r4bOmzet * 0.21 * 100) / 100;

    const rubriek1aOmzet = Math.round((r1a?.omzet ?? 0) * 100) / 100;
    const rubriek1aBtw = Math.round((r1a?.btw ?? 0) * 100) / 100;
    const rubriek1bOmzet = Math.round((r1b?.omzet ?? 0) * 100) / 100;
    const rubriek1bBtw = Math.round((r1b?.btw ?? 0) * 100) / 100;
    const rubriek4aOmzet = Math.round(r4aOmzet * 100) / 100;
    const rubriek4aBtw = r4aBtw;
    const rubriek4bOmzet = Math.round(r4bOmzet * 100) / 100;
    const rubriek4bBtw = r4bBtw;

    // 5a: totaal verschuldigde BTW
    const rubriek5aBtw = Math.round((rubriek1aBtw + rubriek1bBtw + rubriek4aBtw + rubriek4bBtw) * 100) / 100;

    // 5b: voorbelasting (binnenlandse BTW + verlegde BTW die je terugkrijgt)
    const rubriek5bBtw = Math.round((voorbelasting + rubriek4aBtw + rubriek4bBtw) * 100) / 100;

    // Saldo: positief = betalen, negatief = terugkrijgen
    const saldo = Math.round((rubriek5aBtw - rubriek5bBtw) * 100) / 100;

    // Check for existing aangifte
    const bestaand = await db.select().from(btwAangiftes).where(and(
      eq(btwAangiftes.kwartaal, kwartaal),
      eq(btwAangiftes.jaar, jaar),
    )).get();

    return NextResponse.json({
      rubrieken: {
        rubriek_1a: { omzet: rubriek1aOmzet, btw: rubriek1aBtw },
        rubriek_1b: { omzet: rubriek1bOmzet, btw: rubriek1bBtw },
        rubriek_4a: { omzet: rubriek4aOmzet, btw: rubriek4aBtw },
        rubriek_4b: { omzet: rubriek4bOmzet, btw: rubriek4bBtw },
        rubriek_5a: { btw: rubriek5aBtw },
        rubriek_5b: { btw: rubriek5bBtw },
      },
      saldo,
      kwartaal,
      jaar,
      bestaandeAangifte: bestaand ? {
        id: bestaand.id,
        status: bestaand.status,
        betalingskenmerk: bestaand.betalingskenmerk,
        ingediendOp: bestaand.ingediendOp,
      } : null,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/belasting/btw-voorbereiding/route.ts
git commit -m "feat: add BTW voorbereiding API endpoint with rubriek calculations"
```

---

### Task 4: Extend PUT endpoint to save rubrieken

**Files:**
- Modify: `src/app/api/belasting/btw/[id]/route.ts`

- [ ] **Step 1: Update the PUT handler to accept rubriek fields**

Replace the full contents of `src/app/api/belasting/btw/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { btwAangiftes, belastingDeadlines } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// PUT /api/belasting/btw/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const aangifteId = parseInt(id, 10);
    const body = await req.json();

    // Verify aangifte exists
    const bestaand = await db
      .select()
      .from(btwAangiftes)
      .where(eq(btwAangiftes.id, aangifteId))
      .get();

    if (!bestaand) {
      return NextResponse.json({ fout: "BTW aangifte niet gevonden." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status && ["open", "ingediend", "betaald"].includes(body.status)) {
      updateData.status = body.status;

      if (body.status === "ingediend") {
        updateData.ingediendOp = new Date().toISOString();

        // Mark corresponding BTW deadline as afgerond
        try {
          const deadline = await db.select().from(belastingDeadlines).where(and(
            eq(belastingDeadlines.type, "btw"),
            eq(belastingDeadlines.kwartaal, bestaand.kwartaal),
            eq(belastingDeadlines.jaar, bestaand.jaar),
          )).get();
          if (deadline) {
            await db.update(belastingDeadlines).set({ afgerond: 1 }).where(eq(belastingDeadlines.id, deadline.id));
          }
        } catch { /* deadline marking is best-effort */ }
      }
    }

    if (typeof body.notities === "string") {
      updateData.notities = body.notities.trim() || null;
    }

    if (typeof body.betalingskenmerk === "string") {
      updateData.betalingskenmerk = body.betalingskenmerk.trim() || null;
    }

    // Rubriek fields
    const rubriekFields = [
      "rubriek1aOmzet", "rubriek1aBtw", "rubriek1bOmzet", "rubriek1bBtw",
      "rubriek4aOmzet", "rubriek4aBtw", "rubriek4bOmzet", "rubriek4bBtw",
      "rubriek5aBtw", "rubriek5bBtw", "saldo",
    ] as const;

    for (const field of rubriekFields) {
      if (typeof body[field] === "number") {
        updateData[field] = body[field];
      }
    }

    // Also update legacy fields for backward compatibility
    if (typeof body.rubriek5aBtw === "number") {
      updateData.btwOntvangen = body.rubriek1aBtw + (body.rubriek1bBtw ?? 0);
    }
    if (typeof body.rubriek5bBtw === "number") {
      updateData.btwBetaald = body.rubriek5bBtw;
    }
    if (typeof body.saldo === "number") {
      updateData.btwAfdragen = body.saldo;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ fout: "Geen velden om bij te werken." }, { status: 400 });
    }

    const [bijgewerkt] = await db
      .update(btwAangiftes)
      .set(updateData)
      .where(eq(btwAangiftes.id, aangifteId))
      .returning();

    return NextResponse.json({ aangifte: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/belasting/btw/[id]/route.ts
git commit -m "feat: extend BTW PUT endpoint with rubriek fields and deadline marking"
```

---

### Task 5: Update BtwAangifte interface in hooks

**Files:**
- Modify: `src/hooks/queries/use-belasting.ts:16-26`

- [ ] **Step 1: Add rubriek fields to BtwAangifte interface**

Replace the `BtwAangifte` interface:

```typescript
export interface BtwAangifte {
  id: number;
  kwartaal: number;
  jaar: number;
  btwOntvangen: number;
  btwBetaald: number;
  btwAfdragen: number;
  rubriek1aOmzet: number;
  rubriek1aBtw: number;
  rubriek1bOmzet: number;
  rubriek1bBtw: number;
  rubriek4aOmzet: number;
  rubriek4aBtw: number;
  rubriek4bOmzet: number;
  rubriek4bBtw: number;
  rubriek5aBtw: number;
  rubriek5bBtw: number;
  saldo: number;
  betalingskenmerk: string | null;
  status: "open" | "ingediend" | "betaald";
  ingediendOp: string | null;
  notities: string | null;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/queries/use-belasting.ts
git commit -m "feat: add rubriek fields to BtwAangifte interface"
```

---

### Task 6: Build BTW Aangifte Modal UI

**Files:**
- Modify: `src/app/(dashboard)/belasting/page.tsx`

This is the main UI task. Add modal state, the modal component, and the trigger button.

- [ ] **Step 1: Add modal state and BTW voorbereiding types**

In `src/app/(dashboard)/belasting/page.tsx`, add after the existing modal state variables (around line 236-271, after the `aanslagModal` state):

```typescript
// BTW Aangifte Voorbereiding modal
const [btwVoorbereidingModal, setBtwVoorbereidingModal] = useState(false);
const [btwVoorbereidingKwartaal, setBtwVoorbereidingKwartaal] = useState(currentQuarter);
const [btwVoorbereidingJaar, setBtwVoorbereidingJaar] = useState(jaar);
const [btwVoorbereidingData, setBtwVoorbereidingData] = useState<{
  rubrieken: {
    rubriek_1a: { omzet: number; btw: number };
    rubriek_1b: { omzet: number; btw: number };
    rubriek_4a: { omzet: number; btw: number };
    rubriek_4b: { omzet: number; btw: number };
    rubriek_5a: { btw: number };
    rubriek_5b: { btw: number };
  };
  saldo: number;
  bestaandeAangifte: { id: number; status: string; betalingskenmerk: string | null; ingediendOp: string | null } | null;
} | null>(null);
const [btwVoorbereidingLoading, setBtwVoorbereidingLoading] = useState(false);
const [btwBetalingskenmerk, setBtwBetalingskenmerk] = useState("");
```

- [ ] **Step 2: Add fetch function for BTW voorbereiding**

Add after the state variables:

```typescript
const fetchBtwVoorbereiding = useCallback(async (kwartaal: number, btwJaar: number) => {
  setBtwVoorbereidingLoading(true);
  setBtwVoorbereidingData(null);
  try {
    const res = await fetch("/api/belasting/btw-voorbereiding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kwartaal, jaar: btwJaar }),
    });
    if (!res.ok) throw new Error("Fout bij ophalen");
    const data = await res.json();
    setBtwVoorbereidingData(data);
    setBtwBetalingskenmerk(data.bestaandeAangifte?.betalingskenmerk ?? "");
  } catch {
    addToast("Fout bij BTW voorbereiding berekening", "fout");
  }
  setBtwVoorbereidingLoading(false);
}, [addToast]);

const openBtwVoorbereiding = useCallback((kwartaal: number) => {
  setBtwVoorbereidingKwartaal(kwartaal);
  setBtwVoorbereidingJaar(jaar);
  setBtwVoorbereidingModal(true);
  fetchBtwVoorbereiding(kwartaal, jaar);
}, [jaar, fetchBtwVoorbereiding]);
```

- [ ] **Step 3: Add save/submit mutations**

Add after the fetch function:

```typescript
const saveBtwAangifte = useCallback(async (status: "open" | "ingediend") => {
  if (!btwVoorbereidingData) return;
  const r = btwVoorbereidingData.rubrieken;
  const aangifteId = btwVoorbereidingData.bestaandeAangifte?.id;

  if (!aangifteId) {
    addToast("Geen BTW aangifte gevonden voor dit kwartaal. Maak eerst aangiftes aan.", "fout");
    return;
  }

  try {
    const res = await fetch(`/api/belasting/btw/${aangifteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        betalingskenmerk: btwBetalingskenmerk,
        rubriek1aOmzet: r.rubriek_1a.omzet,
        rubriek1aBtw: r.rubriek_1a.btw,
        rubriek1bOmzet: r.rubriek_1b.omzet,
        rubriek1bBtw: r.rubriek_1b.btw,
        rubriek4aOmzet: r.rubriek_4a.omzet,
        rubriek4aBtw: r.rubriek_4a.btw,
        rubriek4bOmzet: r.rubriek_4b.omzet,
        rubriek4bBtw: r.rubriek_4b.btw,
        rubriek5aBtw: r.rubriek_5a.btw,
        rubriek5bBtw: r.rubriek_5b.btw,
        saldo: btwVoorbereidingData.saldo,
      }),
    });
    if (!res.ok) throw new Error("Opslaan mislukt");
    addToast(status === "ingediend" ? `Q${btwVoorbereidingKwartaal} gemarkeerd als ingediend` : `Q${btwVoorbereidingKwartaal} concept opgeslagen`, "succes");
    queryClient.invalidateQueries({ queryKey: ["belasting"] });
    setBtwVoorbereidingModal(false);
  } catch {
    addToast("Fout bij opslaan BTW aangifte", "fout");
  }
}, [btwVoorbereidingData, btwBetalingskenmerk, btwVoorbereidingKwartaal, addToast, queryClient]);
```

- [ ] **Step 4: Add "Aangifte voorbereiden" button to each Q-card**

In the BTW Aangiftes section (around line 1182), replace the existing action buttons block:

```tsx
{/* Action buttons */}
<div className="flex gap-2">
  <button
    onClick={() => openBtwVoorbereiding(aangifte.kwartaal)}
    className="flex-1 px-3 py-2 bg-autronis-accent/15 text-autronis-accent rounded-lg text-xs font-semibold hover:bg-autronis-accent/25 transition-colors"
  >
    Aangifte voorbereiden
  </button>
  {aangifte.status === "open" && (
    <button
      onClick={() => handleBtwStatus(aangifte, "ingediend")}
      className="px-3 py-2 bg-blue-500/15 text-blue-400 rounded-lg text-xs font-semibold hover:bg-blue-500/25 transition-colors"
    >
      Indienen
    </button>
  )}
  {(aangifte.status === "open" || aangifte.status === "ingediend") && (
    <button
      onClick={() => handleBtwStatus(aangifte, "betaald")}
      className="px-3 py-2 bg-green-500/15 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-500/25 transition-colors"
    >
      Betaald
    </button>
  )}
  {aangifte.status === "betaald" && (
    <div className="flex items-center gap-1.5 px-3 py-2 text-green-400 text-xs font-semibold">
      <CheckCircle2 className="w-3.5 h-3.5" /> Afgerond
    </div>
  )}
</div>
```

- [ ] **Step 5: Add the Modal component**

Add the modal JSX before the closing `</PageTransition>` tag (near the end of the file, where other modals are):

```tsx
{/* BTW Aangifte Voorbereiding Modal */}
<Modal
  open={btwVoorbereidingModal}
  onClose={() => setBtwVoorbereidingModal(false)}
  titel={`BTW Aangifte Q${btwVoorbereidingKwartaal} ${btwVoorbereidingJaar}`}
  breedte="lg"
  footer={
    btwVoorbereidingData ? (
      <>
        <button
          onClick={() => setBtwVoorbereidingModal(false)}
          className="px-4 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
        >
          Sluiten
        </button>
        <button
          onClick={() => saveBtwAangifte("open")}
          className="px-4 py-2 bg-amber-500/15 text-amber-400 rounded-lg text-sm font-semibold hover:bg-amber-500/25 transition-colors"
        >
          Opslaan als concept
        </button>
        {btwVoorbereidingData.bestaandeAangifte?.status !== "ingediend" && btwVoorbereidingData.bestaandeAangifte?.status !== "betaald" && (
          <button
            onClick={() => saveBtwAangifte("ingediend")}
            className="px-4 py-2 bg-blue-500/15 text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-500/25 transition-colors"
          >
            Markeer als ingediend
          </button>
        )}
      </>
    ) : undefined
  }
>
  {btwVoorbereidingLoading ? (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-6 h-6 text-autronis-accent animate-spin" />
    </div>
  ) : btwVoorbereidingData ? (
    <div className="space-y-5">
      {/* Kwartaal selector */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map(q => (
          <button
            key={q}
            onClick={() => { setBtwVoorbereidingKwartaal(q); fetchBtwVoorbereiding(q, btwVoorbereidingJaar); }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors",
              q === btwVoorbereidingKwartaal ? "bg-autronis-accent text-white" : "bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
            )}
          >
            Q{q}
          </button>
        ))}
        <div className="flex-1" />
        {/* Status badge */}
        {btwVoorbereidingData.bestaandeAangifte ? (
          <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold",
            btwVoorbereidingData.bestaandeAangifte.status === "ingediend" ? "bg-blue-500/15 text-blue-400" :
            btwVoorbereidingData.bestaandeAangifte.status === "betaald" ? "bg-green-500/15 text-green-400" :
            "bg-amber-500/15 text-amber-400"
          )}>
            {btwVoorbereidingData.bestaandeAangifte.status === "ingediend" ? "Ingediend" :
             btwVoorbereidingData.bestaandeAangifte.status === "betaald" ? "Betaald" : "Concept"}
          </span>
        ) : (
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-autronis-border/50 text-autronis-text-secondary">Nieuw</span>
        )}
      </div>

      {/* Rubriek 1: Omzet binnenland */}
      <div className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-autronis-text-secondary uppercase tracking-wider">Rubriek 1 — Omzet binnenland</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-autronis-accent w-5">1a</span>
              <span className="text-sm text-autronis-text-primary">Omzet hoog tarief (21%)</span>
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <span className="text-autronis-text-secondary">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_1a.omzet)}</span>
              <span className="font-semibold text-autronis-text-primary w-24 text-right">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_1a.btw)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-autronis-accent w-5">1b</span>
              <span className="text-sm text-autronis-text-primary">Omzet laag tarief (9%)</span>
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <span className="text-autronis-text-secondary">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_1b.omzet)}</span>
              <span className="font-semibold text-autronis-text-primary w-24 text-right">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_1b.btw)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rubriek 4: Buitenland */}
      <div className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-autronis-text-secondary uppercase tracking-wider">Rubriek 4 — Buitenland</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-autronis-accent w-5">4a</span>
              <span className="text-sm text-autronis-text-primary">Diensten buiten EU</span>
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <span className="text-autronis-text-secondary">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_4a.omzet)}</span>
              <span className="font-semibold text-autronis-text-primary w-24 text-right">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_4a.btw)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-autronis-accent w-5">4b</span>
              <span className="text-sm text-autronis-text-primary">Leveringen/diensten binnen EU</span>
            </div>
            <div className="flex items-center gap-4 text-sm tabular-nums">
              <span className="text-autronis-text-secondary">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_4b.omzet)}</span>
              <span className="font-semibold text-autronis-text-primary w-24 text-right">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_4b.btw)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rubriek 5: Berekening */}
      <div className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-autronis-text-secondary uppercase tracking-wider">Rubriek 5 — Berekening</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-autronis-accent w-5">5a</span>
              <span className="text-sm text-autronis-text-primary">Verschuldigde BTW</span>
            </div>
            <span className="text-sm font-semibold text-autronis-text-primary tabular-nums">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_5a.btw)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-autronis-accent w-5">5b</span>
              <span className="text-sm text-autronis-text-primary">Voorbelasting</span>
            </div>
            <span className="text-sm font-semibold text-autronis-text-primary tabular-nums">{formatBedrag(btwVoorbereidingData.rubrieken.rubriek_5b.btw)}</span>
          </div>
        </div>
      </div>

      {/* Saldo */}
      <div className={cn(
        "rounded-xl p-5 text-center",
        btwVoorbereidingData.saldo > 0 ? "bg-red-500/10 border border-red-500/30" : "bg-green-500/10 border border-green-500/30"
      )}>
        <p className="text-xs text-autronis-text-secondary mb-1">
          {btwVoorbereidingData.saldo > 0 ? "Te betalen aan de Belastingdienst" : "Terug te ontvangen van de Belastingdienst"}
        </p>
        <p className={cn("text-2xl font-bold tabular-nums", btwVoorbereidingData.saldo > 0 ? "text-red-400" : "text-green-400")}>
          {formatBedrag(Math.abs(btwVoorbereidingData.saldo))}
        </p>
      </div>

      {/* Betalingskenmerk */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-autronis-text-secondary">Betalingskenmerk</label>
        <input
          type="text"
          value={btwBetalingskenmerk}
          onChange={e => setBtwBetalingskenmerk(e.target.value)}
          placeholder="Vul hier het betalingskenmerk in..."
          disabled={btwVoorbereidingData.bestaandeAangifte?.status === "ingediend" || btwVoorbereidingData.bestaandeAangifte?.status === "betaald"}
          className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/30 focus:outline-none focus:border-autronis-accent/50 disabled:opacity-50"
        />
      </div>

      {/* Ingediend info */}
      {btwVoorbereidingData.bestaandeAangifte?.ingediendOp && (
        <p className="text-xs text-autronis-text-secondary/60 text-center">
          Ingediend op {formatDatum(btwVoorbereidingData.bestaandeAangifte.ingediendOp)}
        </p>
      )}
    </div>
  ) : (
    <p className="text-sm text-autronis-text-secondary text-center py-8">Geen data beschikbaar</p>
  )}
</Modal>
```

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Start dev server and verify visually**

Run: `npm run dev`

Verify:
1. Go to Belasting → Acties tab
2. Each Q-card has "Aangifte voorbereiden" button
3. Clicking opens modal with rubrieken
4. Q-selector works to switch quarters
5. Saldo shows green (terug) or red (betalen)
6. "Opslaan als concept" saves and closes modal
7. "Markeer als ingediend" sets status and closes modal

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/belasting/page.tsx
git commit -m "feat: add BTW aangifte voorbereiding modal with rubrieken UI"
```

---

### Task 7: Final integration test and cleanup

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete BTW aangifte voorbereiding feature"
```
