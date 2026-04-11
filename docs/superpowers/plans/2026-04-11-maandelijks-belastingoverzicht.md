# Maandelijks Belastingoverzicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monthly tax report page at `/belasting/maandrapport` that shows expenses, VAT calculations, Sem/Syb BTW split, settlements, and deposit overview — with PDF export.

**Architecture:** New DB tables (verdeelRegels, openstaandeVerrekeningen) + eigenaar/splitRatio columns on uitgaven and bankTransacties. Single API endpoint aggregates all data for a given month. React page with KPI cards, trend bar, expense table, BTW split cards, and optional settlement list. PDF export via @react-pdf/renderer.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (SQLite), React 19, TanStack Query, @react-pdf/renderer, Framer Motion, Tailwind CSS v4, lucide-react

**Design spec:** `docs/superpowers/specs/2026-04-11-maandelijks-belastingoverzicht-design.md`

---

### Task 1: Database Schema — New Tables & Columns

**Files:**
- Modify: `src/lib/db/schema.ts:1657` (append new tables + modify existing)
- Create: `drizzle/0007_maandrapport.sql` (migration)
- Modify: `src/lib/db/index.ts` (add Turso auto-migrate for new tables)

- [ ] **Step 1: Add eigenaar and splitRatio columns to uitgaven table in schema.ts**

In `src/lib/db/schema.ts`, find the `uitgaven` table (line 141) and add two columns before the closing `});`:

```typescript
export const uitgaven = sqliteTable("uitgaven", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  datum: text("datum").notNull(),
  categorie: text("categorie", { enum: ["kantoor", "hardware", "software", "reiskosten", "marketing", "onderwijs", "telefoon", "verzekeringen", "accountant", "overig"] }).default("overig"),
  leverancier: text("leverancier"),
  btwBedrag: real("btw_bedrag"),
  btwPercentage: real("btw_percentage").default(21),
  fiscaalAftrekbaar: integer("fiscaal_aftrekbaar").default(1),
  bonnetjeUrl: text("bonnetje_url"),
  isBuitenland: text("is_buitenland", { enum: ["buiten_eu", "binnen_eu"] }),
  eigenaar: text("eigenaar", { enum: ["sem", "syb", "gedeeld"] }),
  splitRatio: text("split_ratio"),
  aangemaaktDoor: integer("aangemaakt_door").references(() => gebruikers.id),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Add eigenaar and splitRatio columns to bankTransacties table in schema.ts**

In `src/lib/db/schema.ts`, find the `bankTransacties` table (line 544) and add two columns before the closing `});`:

```typescript
export const bankTransacties = sqliteTable("bank_transacties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  datum: text("datum").notNull(),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  type: text("type", { enum: ["bij", "af"] }).notNull(),
  categorie: text("categorie"),
  gekoppeldFactuurId: integer("gekoppeld_factuur_id").references(() => facturen.id),
  status: text("status", { enum: ["onbekend", "gecategoriseerd", "gematcht"] }).default("onbekend"),
  bank: text("bank"),
  tegenrekening: text("tegenrekening"),
  revolutTransactieId: text("revolut_transactie_id"),
  merchantNaam: text("merchant_naam"),
  merchantCategorie: text("merchant_categorie"),
  aiBeschrijving: text("ai_beschrijving"),
  isAbonnement: integer("is_abonnement").default(0),
  overdodigheidScore: text("overbodigheid_score", { enum: ["noodzakelijk", "nuttig", "overbodig"] }),
  fiscaalType: text("fiscaal_type", { enum: ["investering", "kosten", "prive"] }),
  subsidieMogelijkheden: text("subsidie_mogelijkheden"),
  btwBedrag: real("btw_bedrag"),
  kiaAftrek: real("kia_aftrek"),
  isVerlegging: integer("is_verlegging").default(0),
  bonPad: text("bon_pad"),
  storageUrl: text("storage_url"),
  eigenaar: text("eigenaar", { enum: ["sem", "syb", "gedeeld"] }),
  splitRatio: text("split_ratio"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 3: Add new tables at end of schema.ts**

Append after the `clientHealthScores` table (line 1657):

```typescript
// ============ VERDEEL REGELS ============
export const verdeelRegels = sqliteTable("verdeel_regels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["leverancier", "categorie"] }).notNull(),
  waarde: text("waarde").notNull(),
  eigenaar: text("eigenaar", { enum: ["sem", "syb", "gedeeld"] }).notNull(),
  splitRatio: text("split_ratio").notNull(),
}, (table) => ({
  uniekTypeWaarde: uniqueIndex("uniek_verdeel_type_waarde").on(table.type, table.waarde),
}));

// ============ OPENSTAANDE VERREKENINGEN ============
export const openstaandeVerrekeningen = sqliteTable("openstaande_verrekeningen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  omschrijving: text("omschrijving").notNull(),
  bedrag: real("bedrag").notNull(),
  vanGebruikerId: integer("van_gebruiker_id").notNull().references(() => gebruikers.id),
  naarGebruikerId: integer("naar_gebruiker_id").notNull().references(() => gebruikers.id),
  betaald: integer("betaald").default(0),
  betaaldOp: text("betaald_op"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 4: Create SQL migration file**

Create `drizzle/0007_maandrapport.sql`:

```sql
-- Eigenaar kolommen op uitgaven
ALTER TABLE `uitgaven` ADD COLUMN `eigenaar` text;
--> statement-breakpoint
ALTER TABLE `uitgaven` ADD COLUMN `split_ratio` text;
--> statement-breakpoint

-- Eigenaar kolommen op bank_transacties
ALTER TABLE `bank_transacties` ADD COLUMN `eigenaar` text;
--> statement-breakpoint
ALTER TABLE `bank_transacties` ADD COLUMN `split_ratio` text;
--> statement-breakpoint

-- Verdeel regels tabel
CREATE TABLE `verdeel_regels` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `type` text NOT NULL,
  `waarde` text NOT NULL,
  `eigenaar` text NOT NULL,
  `split_ratio` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_verdeel_type_waarde` ON `verdeel_regels` (`type`, `waarde`);
--> statement-breakpoint

-- Openstaande verrekeningen tabel
CREATE TABLE `openstaande_verrekeningen` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `omschrijving` text NOT NULL,
  `bedrag` real NOT NULL,
  `van_gebruiker_id` integer NOT NULL REFERENCES `gebruikers`(`id`),
  `naar_gebruiker_id` integer NOT NULL REFERENCES `gebruikers`(`id`),
  `betaald` integer DEFAULT 0,
  `betaald_op` text,
  `aangemaakt_op` text DEFAULT (datetime('now'))
);
```

- [ ] **Step 5: Add Turso auto-migrate for new tables in db/index.ts**

In `src/lib/db/index.ts`, add after the last `client.execute(...)` block:

```typescript
  client.execute(`CREATE TABLE IF NOT EXISTS verdeel_regels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    waarde TEXT NOT NULL,
    eigenaar TEXT NOT NULL,
    split_ratio TEXT NOT NULL
  )`).catch(() => {});

  client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uniek_verdeel_type_waarde ON verdeel_regels (type, waarde)`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS openstaande_verrekeningen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    omschrijving TEXT NOT NULL,
    bedrag REAL NOT NULL,
    van_gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    naar_gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    betaald INTEGER DEFAULT 0,
    betaald_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  // Add columns to existing tables (ALTER TABLE is idempotent with catch)
  client.execute(`ALTER TABLE uitgaven ADD COLUMN eigenaar TEXT`).catch(() => {});
  client.execute(`ALTER TABLE uitgaven ADD COLUMN split_ratio TEXT`).catch(() => {});
  client.execute(`ALTER TABLE bank_transacties ADD COLUMN eigenaar TEXT`).catch(() => {});
  client.execute(`ALTER TABLE bank_transacties ADD COLUMN split_ratio TEXT`).catch(() => {});
```

- [ ] **Step 6: Run the local migration**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
sqlite3 data/autronis.db < drizzle/0007_maandrapport.sql
```

- [ ] **Step 7: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/index.ts drizzle/0007_maandrapport.sql
git commit -m "feat: add eigenaar/splitRatio columns and verdeelRegels/verrekeningen tables"
```

---

### Task 2: Verdeelregels API — CRUD

**Files:**
- Create: `src/app/api/belasting/verdeelregels/route.ts`
- Create: `src/app/api/belasting/verdeelregels/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

Create `src/app/api/belasting/verdeelregels/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verdeelRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();
    const regels = await db.select().from(verdeelRegels).orderBy(verdeelRegels.type);
    return NextResponse.json({ regels });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { type, waarde, eigenaar, splitRatio } = body;

    if (!type || !waarde || !eigenaar || !splitRatio) {
      return NextResponse.json({ fout: "Alle velden zijn verplicht" }, { status: 400 });
    }

    if (!["leverancier", "categorie"].includes(type)) {
      return NextResponse.json({ fout: "Type moet 'leverancier' of 'categorie' zijn" }, { status: 400 });
    }

    if (!["sem", "syb", "gedeeld"].includes(eigenaar)) {
      return NextResponse.json({ fout: "Eigenaar moet 'sem', 'syb' of 'gedeeld' zijn" }, { status: 400 });
    }

    // Upsert: update if exists, insert if not
    const existing = await db
      .select()
      .from(verdeelRegels)
      .where(and(eq(verdeelRegels.type, type), eq(verdeelRegels.waarde, waarde)))
      .get();

    if (existing) {
      await db
        .update(verdeelRegels)
        .set({ eigenaar, splitRatio })
        .where(eq(verdeelRegels.id, existing.id));
      return NextResponse.json({ regel: { ...existing, eigenaar, splitRatio } });
    }

    const result = await db.insert(verdeelRegels).values({ type, waarde, eigenaar, splitRatio });
    return NextResponse.json({ regel: { id: Number(result.lastInsertRowid), type, waarde, eigenaar, splitRatio } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Create DELETE route**

Create `src/app/api/belasting/verdeelregels/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verdeelRegels } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const regelId = parseInt(id, 10);

    if (isNaN(regelId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    await db.delete(verdeelRegels).where(eq(verdeelRegels.id, regelId));
    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/belasting/verdeelregels/
git commit -m "feat: add verdeelregels CRUD API routes"
```

---

### Task 3: Verrekeningen API — CRUD

**Files:**
- Create: `src/app/api/belasting/verrekeningen/route.ts`
- Create: `src/app/api/belasting/verrekeningen/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

Create `src/app/api/belasting/verrekeningen/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openstaandeVerrekeningen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();
    const verrekeningen = await db
      .select()
      .from(openstaandeVerrekeningen)
      .orderBy(openstaandeVerrekeningen.aangemaaktOp);
    return NextResponse.json({ verrekeningen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const { omschrijving, bedrag, vanGebruikerId, naarGebruikerId } = body;

    if (!omschrijving || bedrag == null || !vanGebruikerId || !naarGebruikerId) {
      return NextResponse.json({ fout: "Alle velden zijn verplicht" }, { status: 400 });
    }

    const result = await db.insert(openstaandeVerrekeningen).values({
      omschrijving,
      bedrag: Number(bedrag),
      vanGebruikerId: Number(vanGebruikerId),
      naarGebruikerId: Number(naarGebruikerId),
    });

    return NextResponse.json({
      verrekening: {
        id: Number(result.lastInsertRowid),
        omschrijving,
        bedrag: Number(bedrag),
        vanGebruikerId: Number(vanGebruikerId),
        naarGebruikerId: Number(naarGebruikerId),
        betaald: 0,
        betaaldOp: null,
      }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Create PUT route (markeer als betaald)**

Create `src/app/api/belasting/verrekeningen/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { openstaandeVerrekeningen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const verrekeningId = parseInt(id, 10);

    if (isNaN(verrekeningId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json();
    const betaald = body.betaald ? 1 : 0;
    const betaaldOp = betaald ? new Date().toISOString().split("T")[0] : null;

    await db
      .update(openstaandeVerrekeningen)
      .set({ betaald, betaaldOp })
      .where(eq(openstaandeVerrekeningen.id, verrekeningId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/belasting/verrekeningen/
git commit -m "feat: add verrekeningen CRUD API routes"
```

---

### Task 4: Eigenaar Tagging API

**Files:**
- Create: `src/app/api/uitgaven/[id]/eigenaar/route.ts`
- Create: `src/app/api/bank-transacties/[id]/eigenaar/route.ts`

- [ ] **Step 1: Create PUT route for uitgaven eigenaar**

Create `src/app/api/uitgaven/[id]/eigenaar/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uitgaven } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const uitgaveId = parseInt(id, 10);

    if (isNaN(uitgaveId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json();
    const { eigenaar, splitRatio } = body;

    if (!eigenaar || !["sem", "syb", "gedeeld"].includes(eigenaar)) {
      return NextResponse.json({ fout: "Eigenaar moet 'sem', 'syb' of 'gedeeld' zijn" }, { status: 400 });
    }

    await db
      .update(uitgaven)
      .set({ eigenaar, splitRatio: splitRatio ?? null })
      .where(eq(uitgaven.id, uitgaveId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Create PUT route for bankTransacties eigenaar**

Create `src/app/api/bank-transacties/[id]/eigenaar/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const transactieId = parseInt(id, 10);

    if (isNaN(transactieId)) {
      return NextResponse.json({ fout: "Ongeldig ID" }, { status: 400 });
    }

    const body = await req.json();
    const { eigenaar, splitRatio } = body;

    if (!eigenaar || !["sem", "syb", "gedeeld"].includes(eigenaar)) {
      return NextResponse.json({ fout: "Eigenaar moet 'sem', 'syb' of 'gedeeld' zijn" }, { status: 400 });
    }

    await db
      .update(bankTransacties)
      .set({ eigenaar, splitRatio: splitRatio ?? null })
      .where(eq(bankTransacties.id, transactieId));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/uitgaven/ src/app/api/bank-transacties/
git commit -m "feat: add eigenaar tagging API for uitgaven and bank-transacties"
```

---

### Task 5: Maandrapport API — Main Aggregation Endpoint

**Files:**
- Create: `src/app/api/belasting/maandrapport/route.ts`
- Create: `src/lib/borg-config.ts`

- [ ] **Step 1: Create borg config**

Create `src/lib/borg-config.ts`:

```typescript
export const BORG_CONFIG = {
  adres: "Edisonstraat 60",
  totaalBorg: 585.00,
  huurders: [
    { naam: "Sem (voorgeschoten)", borg: 585.00, huurPerMaand: 101.34, status: "eigen deel" },
    { naam: "Syb (M. Sprenkeler)", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "LP Brands", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
    { naam: "Nukeware Entertainment", borg: 146.25, huurPerMaand: 101.34, status: "betaald via Revolut" },
  ],
} as const;
```

- [ ] **Step 2: Create maandrapport API route**

Create `src/app/api/belasting/maandrapport/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bankTransacties, uitgaven, verdeelRegels, openstaandeVerrekeningen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { BORG_CONFIG } from "@/lib/borg-config";

interface RapportItem {
  id: number;
  bron: "bankTransacties" | "uitgaven";
  datum: string;
  omschrijving: string;
  categorie: string | null;
  bankNaam: string | null;
  bedragInclBtw: number;
  btwBedrag: number | null;
  eigenaar: string | null;
  splitRatio: string | null;
}

function parseSplitRatio(ratio: string): [number, number] {
  const parts = ratio.split("/").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0] / 100, parts[1] / 100];
  }
  return [0.5, 0.5];
}

function applyVerdeelRegels(
  item: RapportItem,
  regels: { type: string; waarde: string; eigenaar: string; splitRatio: string }[]
): RapportItem {
  if (item.eigenaar) return item;

  // Match leverancier first
  const leverancierMatch = regels.find(
    (r) => r.type === "leverancier" && item.omschrijving.toLowerCase().includes(r.waarde.toLowerCase())
  );
  if (leverancierMatch) {
    return { ...item, eigenaar: leverancierMatch.eigenaar, splitRatio: leverancierMatch.splitRatio };
  }

  // Then match categorie
  const categorieMatch = regels.find(
    (r) => r.type === "categorie" && item.categorie?.toLowerCase() === r.waarde.toLowerCase()
  );
  if (categorieMatch) {
    return { ...item, eigenaar: categorieMatch.eigenaar, splitRatio: categorieMatch.splitRatio };
  }

  return item;
}

function berekenBtwSplit(items: RapportItem[]): {
  sem: { items: { omschrijving: string; bedrag: number }[]; totaal: number };
  syb: { items: { omschrijving: string; bedrag: number }[]; totaal: number };
} {
  const sem: { omschrijving: string; bedrag: number }[] = [];
  const syb: { omschrijving: string; bedrag: number }[] = [];

  for (const item of items) {
    const btw = item.btwBedrag ?? 0;
    if (btw === 0) continue;

    if (item.eigenaar === "sem") {
      sem.push({ omschrijving: item.omschrijving, bedrag: btw });
    } else if (item.eigenaar === "syb") {
      syb.push({ omschrijving: item.omschrijving, bedrag: btw });
    } else if (item.eigenaar === "gedeeld" && item.splitRatio) {
      const [semPct, sybPct] = parseSplitRatio(item.splitRatio);
      const semBtw = Math.round(btw * semPct * 100) / 100;
      const sybBtw = Math.round(btw * sybPct * 100) / 100;
      if (semBtw > 0) sem.push({ omschrijving: `${item.omschrijving} (${Math.round(semPct * 100)}%)`, bedrag: semBtw });
      if (sybBtw > 0) syb.push({ omschrijving: `${item.omschrijving} (${Math.round(sybPct * 100)}%)`, bedrag: sybBtw });
    } else {
      // Untagged: default to sem
      sem.push({ omschrijving: item.omschrijving, bedrag: btw });
    }
  }

  return {
    sem: { items: sem, totaal: Math.round(sem.reduce((s, i) => s + i.bedrag, 0) * 100) / 100 },
    syb: { items: syb, totaal: Math.round(syb.reduce((s, i) => s + i.bedrag, 0) * 100) / 100 },
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const maandParam = searchParams.get("maand");

    if (!maandParam || !/^\d{4}-\d{2}$/.test(maandParam)) {
      return NextResponse.json({ fout: "Maand parameter vereist in YYYY-MM formaat" }, { status: 400 });
    }

    const [jaar, maandNr] = maandParam.split("-").map(Number);
    const maandStart = `${maandParam}-01`;
    const lastDay = new Date(jaar, maandNr, 0).getDate();
    const maandEind = `${maandParam}-${String(lastDay).padStart(2, "0")}`;

    // Fetch bank transactions for the month (type = "af" = expenses)
    const transacties = await db
      .select()
      .from(bankTransacties)
      .where(and(
        eq(bankTransacties.type, "af"),
        gte(bankTransacties.datum, maandStart),
        lte(bankTransacties.datum, maandEind),
      ))
      .orderBy(bankTransacties.datum);

    // Fetch uitgaven for the month
    const uitgavenData = await db
      .select()
      .from(uitgaven)
      .where(and(
        gte(uitgaven.datum, maandStart),
        lte(uitgaven.datum, maandEind),
      ))
      .orderBy(uitgaven.datum);

    // Fetch verdeelregels
    const regels = await db.select().from(verdeelRegels);

    // Combine into unified list
    let items: RapportItem[] = [
      ...transacties.map((t) => ({
        id: t.id,
        bron: "bankTransacties" as const,
        datum: t.datum,
        omschrijving: t.merchantNaam || t.omschrijving,
        categorie: t.categorie,
        bankNaam: t.bank,
        bedragInclBtw: Math.abs(t.bedrag),
        btwBedrag: t.btwBedrag,
        eigenaar: t.eigenaar,
        splitRatio: t.splitRatio,
      })),
      ...uitgavenData.map((u) => ({
        id: u.id,
        bron: "uitgaven" as const,
        datum: u.datum,
        omschrijving: u.leverancier || u.omschrijving,
        categorie: u.categorie,
        bankNaam: null,
        bedragInclBtw: u.bedrag,
        btwBedrag: u.btwBedrag,
        eigenaar: u.eigenaar,
        splitRatio: u.splitRatio,
      })),
    ];

    // Apply verdeelregels to untagged items
    items = items.map((item) => applyVerdeelRegels(item, regels));

    // Sort by date
    items.sort((a, b) => a.datum.localeCompare(b.datum));

    // Calculate totals
    const totaalUitgaven = Math.round(items.reduce((s, i) => s + i.bedragInclBtw, 0) * 100) / 100;
    const totaalBtw = Math.round(items.reduce((s, i) => s + (i.btwBedrag ?? 0), 0) * 100) / 100;

    // BTW split
    const btwSplit = berekenBtwSplit(items);

    // Fetch verrekeningen (onbetaald)
    const verrekeningen = await db
      .select()
      .from(openstaandeVerrekeningen)
      .where(eq(openstaandeVerrekeningen.betaald, 0));

    const totaalVerrekening = Math.round(
      verrekeningen.reduce((s, v) => s + v.bedrag, 0) * 100
    ) / 100;

    // Trend: last 6 months
    const trend: { maand: string; uitgaven: number; btw: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(jaar, maandNr - 1 - i, 1);
      const trendMaand = `${trendDate.getFullYear()}-${String(trendDate.getMonth() + 1).padStart(2, "0")}`;
      const trendStart = `${trendMaand}-01`;
      const trendLastDay = new Date(trendDate.getFullYear(), trendDate.getMonth() + 1, 0).getDate();
      const trendEind = `${trendMaand}-${String(trendLastDay).padStart(2, "0")}`;

      const trendResult = await db
        .select({
          totaalUitgaven: sql<number>`COALESCE(SUM(ABS(${bankTransacties.bedrag})), 0)`,
          totaalBtw: sql<number>`COALESCE(SUM(${bankTransacties.btwBedrag}), 0)`,
        })
        .from(bankTransacties)
        .where(and(
          eq(bankTransacties.type, "af"),
          gte(bankTransacties.datum, trendStart),
          lte(bankTransacties.datum, trendEind),
        ))
        .get();

      trend.push({
        maand: trendMaand,
        uitgaven: Math.round((trendResult?.totaalUitgaven ?? 0) * 100) / 100,
        btw: Math.round((trendResult?.totaalBtw ?? 0) * 100) / 100,
      });
    }

    return NextResponse.json({
      maandrapport: {
        maand: maandParam,
        uitgaven: items,
        totaalUitgaven,
        totaalBtw,
        btwSplit,
        verrekeningen: verrekeningen.map((v) => ({
          id: v.id,
          omschrijving: v.omschrijving,
          bedrag: v.bedrag,
          betaald: v.betaald === 1,
          vanGebruikerId: v.vanGebruikerId,
          naarGebruikerId: v.naarGebruikerId,
        })),
        totaalVerrekening,
        totaalTerug: Math.round((totaalBtw + totaalVerrekening) * 100) / 100,
        trend,
        borg: BORG_CONFIG,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/borg-config.ts src/app/api/belasting/maandrapport/route.ts
git commit -m "feat: add maandrapport aggregation API endpoint"
```

---

### Task 6: React Query Hooks

**Files:**
- Create: `src/hooks/queries/use-maandrapport.ts`

- [ ] **Step 1: Create hooks file with types and query hooks**

Create `src/hooks/queries/use-maandrapport.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ============ TYPES ============

export interface RapportItem {
  id: number;
  bron: "bankTransacties" | "uitgaven";
  datum: string;
  omschrijving: string;
  categorie: string | null;
  bankNaam: string | null;
  bedragInclBtw: number;
  btwBedrag: number | null;
  eigenaar: string | null;
  splitRatio: string | null;
}

export interface BtwSplitPersoon {
  items: { omschrijving: string; bedrag: number }[];
  totaal: number;
}

export interface Verrekening {
  id: number;
  omschrijving: string;
  bedrag: number;
  betaald: boolean;
  vanGebruikerId: number;
  naarGebruikerId: number;
}

export interface BorgHuurder {
  naam: string;
  borg: number;
  huurPerMaand: number;
  status: string;
}

export interface BorgConfig {
  adres: string;
  totaalBorg: number;
  huurders: BorgHuurder[];
}

export interface TrendPunt {
  maand: string;
  uitgaven: number;
  btw: number;
}

export interface MaandrapportData {
  maand: string;
  uitgaven: RapportItem[];
  totaalUitgaven: number;
  totaalBtw: number;
  btwSplit: {
    sem: BtwSplitPersoon;
    syb: BtwSplitPersoon;
  };
  verrekeningen: Verrekening[];
  totaalVerrekening: number;
  totaalTerug: number;
  trend: TrendPunt[];
  borg: BorgConfig;
}

export interface VerdeelRegel {
  id: number;
  type: "leverancier" | "categorie";
  waarde: string;
  eigenaar: "sem" | "syb" | "gedeeld";
  splitRatio: string;
}

// ============ QUERIES ============

export function useMaandrapport(maand: string) {
  return useQuery<MaandrapportData>({
    queryKey: ["maandrapport", maand],
    queryFn: async () => {
      const res = await fetch(`/api/belasting/maandrapport?maand=${maand}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon maandrapport niet ophalen");
      }
      const data = await res.json();
      return data.maandrapport;
    },
    staleTime: 30_000,
  });
}

export function useVerdeelRegels() {
  return useQuery<VerdeelRegel[]>({
    queryKey: ["verdeelregels"],
    queryFn: async () => {
      const res = await fetch("/api/belasting/verdeelregels");
      if (!res.ok) throw new Error("Kon verdeelregels niet ophalen");
      const data = await res.json();
      return data.regels;
    },
    staleTime: 60_000,
  });
}

// ============ MUTATIONS ============

export function useUpdateEigenaar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: number;
      bron: "bankTransacties" | "uitgaven";
      eigenaar: "sem" | "syb" | "gedeeld";
      splitRatio?: string;
    }) => {
      const endpoint = payload.bron === "bankTransacties"
        ? `/api/bank-transacties/${payload.id}/eigenaar`
        : `/api/uitgaven/${payload.id}/eigenaar`;

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eigenaar: payload.eigenaar, splitRatio: payload.splitRatio }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon eigenaar niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}

export function useToggleVerrekening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { id: number; betaald: boolean }) => {
      const res = await fetch(`/api/belasting/verrekeningen/${payload.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betaald: payload.betaald }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon verrekening niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}

export function useCreateVerrekening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { omschrijving: string; bedrag: number; vanGebruikerId: number; naarGebruikerId: number }) => {
      const res = await fetch("/api/belasting/verrekeningen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon verrekening niet aanmaken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}

export function useSaveVerdeelRegel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { type: string; waarde: string; eigenaar: string; splitRatio: string }) => {
      const res = await fetch("/api/belasting/verdeelregels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Kon verdeelregel niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verdeelregels"] });
      queryClient.invalidateQueries({ queryKey: ["maandrapport"] });
    },
  });
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/queries/use-maandrapport.ts
git commit -m "feat: add React Query hooks for maandrapport"
```

---

### Task 7: Maandrapport Page — UI

**Files:**
- Create: `src/app/(dashboard)/belasting/maandrapport/page.tsx`

- [ ] **Step 1: Create the maandrapport page**

Create `src/app/(dashboard)/belasting/maandrapport/page.tsx`:

```typescript
"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Receipt, ChevronLeft, ChevronRight, FileText, Download,
  Check, TrendingUp, Users, ArrowLeft,
} from "lucide-react";
import { cn, formatBedrag } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useMaandrapport,
  useUpdateEigenaar,
  useToggleVerrekening,
  type RapportItem,
  type MaandrapportData,
} from "@/hooks/queries/use-maandrapport";
import Link from "next/link";

const CATEGORIE_KLEUREN: Record<string, { bg: string; text: string }> = {
  hardware: { bg: "bg-blue-500/15", text: "text-blue-400" },
  kantoor: { bg: "bg-orange-500/15", text: "text-orange-400" },
  software: { bg: "bg-green-500/15", text: "text-green-400" },
  kvk: { bg: "bg-purple-500/15", text: "text-purple-400" },
  telefoon: { bg: "bg-pink-500/15", text: "text-pink-400" },
  afbetaling: { bg: "bg-yellow-500/15", text: "text-yellow-400" },
  hosting: { bg: "bg-teal-500/15", text: "text-teal-400" },
  reiskosten: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  marketing: { bg: "bg-rose-500/15", text: "text-rose-400" },
  onderwijs: { bg: "bg-indigo-500/15", text: "text-indigo-400" },
  verzekeringen: { bg: "bg-amber-500/15", text: "text-amber-400" },
  accountant: { bg: "bg-lime-500/15", text: "text-lime-400" },
  overig: { bg: "bg-zinc-500/15", text: "text-zinc-400" },
};

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function formatDatumKort(datum: string): string {
  const d = new Date(datum);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MaandrapportPage() {
  const now = new Date();
  const [jaar, setJaar] = useState(now.getFullYear());
  const [maandNr, setMaandNr] = useState(now.getMonth() + 1);

  const maandStr = `${jaar}-${String(maandNr).padStart(2, "0")}`;
  const { data, isLoading, error } = useMaandrapport(maandStr);
  const updateEigenaar = useUpdateEigenaar();
  const toggleVerrekening = useToggleVerrekening();
  const { addToast } = useToast();

  const vorigeMaand = useCallback(() => {
    if (maandNr === 1) {
      setJaar((j) => j - 1);
      setMaandNr(12);
    } else {
      setMaandNr((m) => m - 1);
    }
  }, [maandNr]);

  const volgendeMaand = useCallback(() => {
    if (maandNr === 12) {
      setJaar((j) => j + 1);
      setMaandNr(1);
    } else {
      setMaandNr((m) => m + 1);
    }
  }, [maandNr]);

  const handleEigenaarTag = useCallback(async (item: RapportItem, eigenaar: "sem" | "syb" | "gedeeld", splitRatio?: string) => {
    try {
      await updateEigenaar.mutateAsync({ id: item.id, bron: item.bron, eigenaar, splitRatio });
      addToast("Eigenaar bijgewerkt", "succes");
    } catch {
      addToast("Kon eigenaar niet bijwerken", "fout");
    }
  }, [updateEigenaar, addToast]);

  const handleToggleVerrekening = useCallback(async (id: number, betaald: boolean) => {
    try {
      await toggleVerrekening.mutateAsync({ id, betaald });
      addToast(betaald ? "Gemarkeerd als betaald" : "Gemarkeerd als onbetaald", "succes");
    } catch {
      addToast("Kon verrekening niet bijwerken", "fout");
    }
  }, [toggleVerrekening, addToast]);

  const handlePdfExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/belasting/maandrapport/pdf?maand=${maandStr}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `belastingoverzicht-${maandStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("PDF gedownload", "succes");
    } catch {
      addToast("Kon PDF niet genereren", "fout");
    }
  }, [maandStr, addToast]);

  return (
    <PageTransition>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/belasting" className="text-autronis-text-tertiary hover:text-autronis-text-primary transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-autronis-text-primary">Autronis VOF — Maandrapport</h1>
              <p className="text-sm text-autronis-text-tertiary">Gegenereerd op basis van bankdata</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-autronis-card border border-autronis-border rounded-xl px-3 py-2">
              <button onClick={vorigeMaand} className="text-autronis-text-tertiary hover:text-autronis-text-primary transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-autronis-text-secondary min-w-[120px] text-center">
                {MAAND_NAMEN[maandNr - 1]} {jaar}
              </span>
              <button onClick={volgendeMaand} className="text-autronis-text-tertiary hover:text-autronis-text-primary transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={handlePdfExport}
              className="flex items-center gap-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF Export
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-20 text-autronis-text-tertiary">Rapport laden...</div>
        )}

        {error && (
          <div className="text-center py-20 text-red-400">Fout bij het laden van het rapport</div>
        )}

        {data && (
          <>
            {/* Trendlijn */}
            <TrendBar trend={data.trend} huidigeMaand={maandStr} />

            {/* KPI Cards */}
            <KpiCards data={data} />

            {/* Uitgaven tabel */}
            <UitgavenTabel items={data.uitgaven} totaalUitgaven={data.totaalUitgaven} totaalBtw={data.totaalBtw} onTagEigenaar={handleEigenaarTag} />

            {/* BTW Split */}
            <BtwSplitSection btwSplit={data.btwSplit} />

            {/* Verrekeningen */}
            {data.verrekeningen.length > 0 && (
              <VerrekeningenSection verrekeningen={data.verrekeningen} totaal={data.totaalVerrekening} onToggle={handleToggleVerrekening} />
            )}

            {/* Borg */}
            <BorgSection borg={data.borg} />

            {/* Samenvatting */}
            <SamenvattingSection totaalBtw={data.totaalBtw} totaalVerrekening={data.totaalVerrekening} totaalTerug={data.totaalTerug} />
          </>
        )}
      </div>
    </PageTransition>
  );
}

// ============ SUB-COMPONENTS ============

function TrendBar({ trend, huidigeMaand }: { trend: MaandrapportData["trend"]; huidigeMaand: string }) {
  const maxUitgaven = Math.max(...trend.map((t) => t.uitgaven), 1);

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
      <div className="text-xs uppercase tracking-wider text-autronis-text-tertiary mb-4">Trend — afgelopen 6 maanden</div>
      <div className="flex items-end gap-4 h-14">
        {trend.map((t) => {
          const hoogte = Math.max((t.uitgaven / maxUitgaven) * 100, 4);
          const isHuidig = t.maand === huidigeMaand;
          return (
            <div key={t.maand} className="flex flex-col items-center gap-1.5 flex-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${hoogte}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "w-full rounded-md",
                  isHuidig ? "bg-autronis-accent border-2 border-autronis-accent-hover" : "bg-autronis-accent/30"
                )}
              />
              <span className={cn("text-[10px]", isHuidig ? "text-autronis-text-primary font-semibold" : "text-autronis-text-tertiary")}>
                {MAAND_NAMEN[parseInt(t.maand.split("-")[1], 10) - 1]?.slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCards({ data }: { data: MaandrapportData }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Totaal uitgaven" value={formatBedrag(data.totaalUitgaven)} sub="ING + Revolut" />
      <KpiCard label="BTW terug" value={formatBedrag(data.totaalBtw)} sub={`Sem €${data.btwSplit.sem.totaal} + Syb €${data.btwSplit.syb.totaal}`} kleur="text-green-400" />
      {data.totaalVerrekening > 0 ? (
        <KpiCard label="Van Syb te ontvangen" value={formatBedrag(data.totaalVerrekening)} sub="Openstaande verrekeningen" kleur="text-orange-400" />
      ) : (
        <KpiCard label="Kosten per persoon" value={formatBedrag(data.totaalUitgaven / 2)} sub="Gelijkmatig verdeeld" kleur="text-blue-400" />
      )}
      <KpiCard label="Totaal terug" value={formatBedrag(data.totaalTerug)} sub="BTW + verrekeningen" kleur="text-purple-400" />
    </div>
  );
}

function KpiCard({ label, value, sub, kleur }: { label: string; value: string; sub: string; kleur?: string }) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="text-[10px] uppercase tracking-wider text-autronis-text-tertiary mb-1">{label}</div>
      <div className={cn("text-xl font-bold", kleur ?? "text-autronis-text-primary")}>{value}</div>
      <div className="text-[11px] text-autronis-text-tertiary mt-0.5">{sub}</div>
    </div>
  );
}

function UitgavenTabel({
  items, totaalUitgaven, totaalBtw, onTagEigenaar,
}: {
  items: RapportItem[];
  totaalUitgaven: number;
  totaalBtw: number;
  onTagEigenaar: (item: RapportItem, eigenaar: "sem" | "syb" | "gedeeld", splitRatio?: string) => void;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        Zakelijke uitgaven — {MAAND_NAMEN[parseInt(items[0]?.datum?.split("-")[1] ?? "1", 10) - 1] ?? ""}
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[70px_1fr_100px_80px_100px_80px_100px] px-4 py-2.5 text-[10px] uppercase tracking-wider text-autronis-text-tertiary bg-autronis-card/80 border-b border-autronis-border">
          <span>Datum</span>
          <span>Omschrijving</span>
          <span>Categorie</span>
          <span>Bron</span>
          <span className="text-right">Incl. BTW</span>
          <span className="text-right">BTW</span>
          <span className="text-center">Eigenaar</span>
        </div>

        {/* Rows */}
        {items.map((item) => (
          <div
            key={`${item.bron}-${item.id}`}
            className={cn(
              "grid grid-cols-[70px_1fr_100px_80px_100px_80px_100px] px-4 py-2.5 text-[13px] border-b border-autronis-border/50 items-center hover:bg-white/[0.02] transition-colors",
              !item.eigenaar && "bg-orange-500/[0.03]"
            )}
          >
            <span className="text-autronis-text-tertiary">{formatDatumKort(item.datum)}</span>
            <span className="text-autronis-text-primary truncate">{item.omschrijving}</span>
            <span>
              {item.categorie && (
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium",
                  CATEGORIE_KLEUREN[item.categorie]?.bg ?? "bg-zinc-500/15",
                  CATEGORIE_KLEUREN[item.categorie]?.text ?? "text-zinc-400",
                )}>
                  {item.categorie.charAt(0).toUpperCase() + item.categorie.slice(1)}
                </span>
              )}
            </span>
            <span className="text-autronis-text-tertiary text-xs">{item.bankNaam ?? "—"}</span>
            <span className="text-autronis-text-primary text-right">{formatBedrag(item.bedragInclBtw)}</span>
            <span className="text-autronis-text-tertiary text-right">{item.btwBedrag ? formatBedrag(item.btwBedrag) : "—"}</span>
            <span className="flex justify-center">
              <EigenaarBadge item={item} onTag={onTagEigenaar} />
            </span>
          </div>
        ))}

        {/* Total row */}
        <div className="grid grid-cols-[70px_1fr_100px_80px_100px_80px_100px] px-4 py-3 text-[13px] font-bold text-autronis-text-primary bg-autronis-card/80 border-t border-autronis-border">
          <span />
          <span>Totaal</span>
          <span />
          <span />
          <span className="text-right">{formatBedrag(totaalUitgaven)}</span>
          <span className="text-right">{formatBedrag(totaalBtw)}</span>
          <span />
        </div>
      </div>
    </section>
  );
}

function EigenaarBadge({
  item,
  onTag,
}: {
  item: RapportItem;
  onTag: (item: RapportItem, eigenaar: "sem" | "syb" | "gedeeld", splitRatio?: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  if (item.eigenaar === "sem") {
    return <span className="bg-autronis-accent text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium">Sem</span>;
  }
  if (item.eigenaar === "syb") {
    return <span className="bg-blue-500 text-white px-2.5 py-0.5 rounded-full text-[11px] font-medium">Syb</span>;
  }
  if (item.eigenaar === "gedeeld" && item.splitRatio) {
    return <span className="bg-yellow-500/15 text-yellow-400 px-2.5 py-0.5 rounded-full text-[11px] font-medium">{item.splitRatio}</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="border border-dashed border-autronis-border text-autronis-text-tertiary px-2.5 py-0.5 rounded-full text-[11px] font-medium hover:border-autronis-text-tertiary transition-colors"
      >
        + Tag
      </button>
      {showMenu && (
        <div className="absolute z-10 top-full mt-1 right-0 bg-autronis-card border border-autronis-border rounded-xl shadow-lg p-1.5 min-w-[120px]">
          <button onClick={() => { onTag(item, "sem"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">Sem</button>
          <button onClick={() => { onTag(item, "syb"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">Syb</button>
          <button onClick={() => { onTag(item, "gedeeld", "50/50"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">50/50</button>
          <button onClick={() => { onTag(item, "gedeeld", "25/75"); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/5 text-autronis-text-secondary">25/75</button>
        </div>
      )}
    </div>
  );
}

function BtwSplitSection({ btwSplit }: { btwSplit: MaandrapportData["btwSplit"] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        BTW split — Sem vs Syb
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BtwSplitCard naam="Sem" data={btwSplit.sem} />
        <BtwSplitCard naam="Syb" data={btwSplit.syb} />
      </div>
    </section>
  );
}

function BtwSplitCard({ naam, data }: { naam: string; data: MaandrapportData["btwSplit"]["sem"] }) {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">{naam} — BTW terug</h3>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <div key={i} className="flex justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
            <span className="text-autronis-text-tertiary">{item.omschrijving}</span>
            <span className="text-autronis-text-primary">{formatBedrag(item.bedrag)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold pt-2 border-t border-autronis-border">
          <span className="text-autronis-text-primary">Totaal {naam}</span>
          <span className="text-green-400">{formatBedrag(data.totaal)}</span>
        </div>
      </div>
    </div>
  );
}

function VerrekeningenSection({
  verrekeningen, totaal, onToggle,
}: {
  verrekeningen: MaandrapportData["verrekeningen"];
  totaal: number;
  onToggle: (id: number, betaald: boolean) => void;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-400" />
        Openstaand — Syb → Sem
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 max-w-lg">
        <div className="space-y-2">
          {verrekeningen.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
              <span className="text-autronis-text-tertiary">{v.omschrijving}</span>
              <div className="flex items-center gap-3">
                <span className="text-autronis-text-primary">{formatBedrag(v.bedrag)}</span>
                <button
                  onClick={() => onToggle(v.id, !v.betaald)}
                  className={cn(
                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                    v.betaald ? "bg-green-500 border-green-500" : "border-autronis-border hover:border-autronis-text-tertiary"
                  )}
                >
                  {v.betaald && <Check className="w-3 h-3 text-white" />}
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-autronis-border">
            <span className="text-autronis-text-primary">Syb moet Sem betalen</span>
            <span className="text-orange-400">{formatBedrag(totaal)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function BorgSection({ borg }: { borg: MaandrapportData["borg"] }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400" />
        Borg kantoor — {borg.adres}
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-4 px-4 py-2.5 text-[10px] uppercase tracking-wider text-autronis-text-tertiary bg-autronis-card/80 border-b border-autronis-border">
          <span>Huurder</span>
          <span className="text-right">Borg</span>
          <span className="text-right">Huur/maand</span>
          <span className="text-right">Status</span>
        </div>
        {borg.huurders.map((h, i) => (
          <div key={i} className="grid grid-cols-4 px-4 py-2.5 text-[13px] border-b border-autronis-border/50">
            <span className="text-autronis-text-primary">{h.naam}</span>
            <span className="text-autronis-text-secondary text-right">{formatBedrag(h.borg)}</span>
            <span className="text-autronis-text-secondary text-right">{formatBedrag(h.huurPerMaand)}</span>
            <span className="text-green-400 text-right">{h.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 text-[13px] text-indigo-300">
        <strong className="text-indigo-200">Borg is geen kostenpost</strong> — staat als vordering op de balans. Niet aftrekbaar voor BTW of winstbelasting.
      </div>
    </section>
  );
}

function SamenvattingSection({ totaalBtw, totaalVerrekening, totaalTerug }: { totaalBtw: number; totaalVerrekening: number; totaalTerug: number }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        Samenvatting — wat krijgt Sem terug?
      </h2>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 max-w-lg">
        <div className="space-y-2">
          <div className="flex justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
            <span className="text-autronis-text-tertiary">BTW terug (Belastingdienst)</span>
            <span className="text-green-400">{formatBedrag(totaalBtw)}</span>
          </div>
          {totaalVerrekening > 0 && (
            <div className="flex justify-between text-[13px] pb-1.5 border-b border-autronis-border/50">
              <span className="text-autronis-text-tertiary">Van Syb (openstaand)</span>
              <span className="text-orange-400">{formatBedrag(totaalVerrekening)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-autronis-border">
            <span className="text-autronis-text-primary">Totaal terug te krijgen</span>
            <span className="text-autronis-text-primary text-base">{formatBedrag(totaalTerug)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Start dev server and verify the page renders**

```bash
npm run dev
```

Open `http://localhost:3000/belasting/maandrapport` in browser. Verify:
- Header with month selector works (navigate between months)
- Trend bar renders
- KPI cards show data
- Expense table shows rows with category badges and eigenaar badges
- BTW split cards render
- Borg section renders

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/belasting/maandrapport/page.tsx
git commit -m "feat: add maandrapport page with full UI"
```

---

### Task 8: PDF Export

**Files:**
- Create: `src/lib/maandrapport-pdf.tsx`
- Create: `src/app/api/belasting/maandrapport/pdf/route.ts`

- [ ] **Step 1: Create PDF template**

Create `src/lib/maandrapport-pdf.tsx`:

```typescript
import React from "react";
import path from "path";
import fs from "fs";
import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer";
import type { MaandrapportData } from "@/hooks/queries/use-maandrapport";

let _logoSrc: string | null = null;
function getLogoSrc(): string {
  if (!_logoSrc) {
    try {
      const buf = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
      _logoSrc = `data:image/png;base64,${buf.toString("base64")}`;
    } catch { _logoSrc = ""; }
  }
  return _logoSrc;
}

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "Inter-400.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-600.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Inter-700.ttf"), fontWeight: 700 },
  ],
});

const TEAL = "#17B8A5";

const MAAND_NAMEN = [
  "Januari", "Februari", "Maart", "April", "Mei", "Juni",
  "Juli", "Augustus", "September", "Oktober", "November", "December",
];

function fmt(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(bedrag);
}

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 8, color: "#1F2937", backgroundColor: "#FFFFFF", padding: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #E5E7EB", paddingBottom: 12 },
  title: { fontSize: 14, fontWeight: 700, color: "#111827" },
  subtitle: { fontSize: 9, color: "#6B7280", marginTop: 2 },
  badge: { fontSize: 8, color: "#6B7280", backgroundColor: "#F3F4F6", padding: "3 8", borderRadius: 4 },
  logo: { width: 40, height: 40 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: "#111827", marginBottom: 8, marginTop: 16 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 6, padding: 10, border: "1px solid #E5E7EB" },
  kpiLabel: { fontSize: 7, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  kpiSub: { fontSize: 7, color: "#9CA3AF", marginTop: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: "#F9FAFB", borderBottom: "1px solid #E5E7EB", paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderCell: { fontSize: 7, fontWeight: 600, color: "#6B7280", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", borderBottom: "1px solid #F3F4F6", paddingVertical: 3, paddingHorizontal: 6 },
  tableCell: { fontSize: 8, color: "#374151" },
  totalRow: { flexDirection: "row", borderTop: "1px solid #D1D5DB", paddingVertical: 4, paddingHorizontal: 6, backgroundColor: "#F9FAFB" },
  totalCell: { fontSize: 8, fontWeight: 700, color: "#111827" },
  splitRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  splitCard: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 6, padding: 10, border: "1px solid #E5E7EB" },
  splitTitle: { fontSize: 9, fontWeight: 700, color: "#111827", marginBottom: 6 },
  splitItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottom: "1px solid #F3F4F6" },
  splitItemText: { fontSize: 8, color: "#6B7280" },
  splitItemValue: { fontSize: 8, color: "#374151" },
  splitTotal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid #D1D5DB", marginTop: 4 },
  splitTotalText: { fontSize: 8, fontWeight: 700, color: "#111827" },
  splitTotalValue: { fontSize: 8, fontWeight: 700, color: "#059669" },
  note: { backgroundColor: "#EFF6FF", borderRadius: 4, padding: 8, marginTop: 8, border: "1px solid #DBEAFE" },
  noteText: { fontSize: 7, color: "#1E40AF" },
  footer: { marginTop: 20, paddingTop: 10, borderTop: "1px solid #E5E7EB", textAlign: "center" },
  footerText: { fontSize: 7, color: "#9CA3AF" },
});

export function MaandrapportPDF({ data }: { data: MaandrapportData }) {
  const [jaarStr, maandStr] = data.maand.split("-");
  const maandNaam = MAAND_NAMEN[parseInt(maandStr, 10) - 1];
  const logoSrc = getLogoSrc();

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Autronis VOF — Maandrapport</Text>
            <Text style={s.subtitle}>Belastingoverzicht {maandNaam} {jaarStr}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.badge}>{maandNaam} {jaarStr}</Text>
            {logoSrc ? <Image src={logoSrc} style={s.logo} /> : null}
          </View>
        </View>

        {/* KPI Cards */}
        <View style={s.kpiRow}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Totaal uitgaven</Text>
            <Text style={s.kpiValue}>{fmt(data.totaalUitgaven)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>BTW terug</Text>
            <Text style={[s.kpiValue, { color: "#059669" }]}>{fmt(data.totaalBtw)}</Text>
          </View>
          {data.totaalVerrekening > 0 && (
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>Van Syb</Text>
              <Text style={[s.kpiValue, { color: "#EA580C" }]}>{fmt(data.totaalVerrekening)}</Text>
            </View>
          )}
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>Totaal terug</Text>
            <Text style={[s.kpiValue, { color: "#7C3AED" }]}>{fmt(data.totaalTerug)}</Text>
          </View>
        </View>

        {/* Uitgaven tabel */}
        <Text style={s.sectionTitle}>Zakelijke uitgaven — {maandNaam} {jaarStr}</Text>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { width: 50 }]}>Datum</Text>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>Omschrijving</Text>
          <Text style={[s.tableHeaderCell, { width: 70 }]}>Categorie</Text>
          <Text style={[s.tableHeaderCell, { width: 50 }]}>Bron</Text>
          <Text style={[s.tableHeaderCell, { width: 65, textAlign: "right" }]}>Incl. BTW</Text>
          <Text style={[s.tableHeaderCell, { width: 55, textAlign: "right" }]}>BTW</Text>
          <Text style={[s.tableHeaderCell, { width: 55, textAlign: "right" }]}>Eigenaar</Text>
        </View>
        {data.uitgaven.map((item, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tableCell, { width: 50 }]}>{item.datum.slice(5).replace("-", "/")}</Text>
            <Text style={[s.tableCell, { flex: 1 }]}>{item.omschrijving}</Text>
            <Text style={[s.tableCell, { width: 70 }]}>{item.categorie ?? ""}</Text>
            <Text style={[s.tableCell, { width: 50 }]}>{item.bankNaam ?? "—"}</Text>
            <Text style={[s.tableCell, { width: 65, textAlign: "right" }]}>{fmt(item.bedragInclBtw)}</Text>
            <Text style={[s.tableCell, { width: 55, textAlign: "right" }]}>{item.btwBedrag ? fmt(item.btwBedrag) : "—"}</Text>
            <Text style={[s.tableCell, { width: 55, textAlign: "right" }]}>{item.eigenaar === "gedeeld" ? item.splitRatio : item.eigenaar ?? "—"}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={[s.totalCell, { width: 50 }]} />
          <Text style={[s.totalCell, { flex: 1 }]}>Totaal</Text>
          <Text style={[s.totalCell, { width: 70 }]} />
          <Text style={[s.totalCell, { width: 50 }]} />
          <Text style={[s.totalCell, { width: 65, textAlign: "right" }]}>{fmt(data.totaalUitgaven)}</Text>
          <Text style={[s.totalCell, { width: 55, textAlign: "right" }]}>{fmt(data.totaalBtw)}</Text>
          <Text style={[s.totalCell, { width: 55 }]} />
        </View>

        {/* BTW Split */}
        <Text style={s.sectionTitle}>BTW split — Sem vs Syb</Text>
        <View style={s.splitRow}>
          <View style={s.splitCard}>
            <Text style={s.splitTitle}>Sem — BTW terug</Text>
            {data.btwSplit.sem.items.map((item, i) => (
              <View key={i} style={s.splitItem}>
                <Text style={s.splitItemText}>{item.omschrijving}</Text>
                <Text style={s.splitItemValue}>{fmt(item.bedrag)}</Text>
              </View>
            ))}
            <View style={s.splitTotal}>
              <Text style={s.splitTotalText}>Totaal Sem</Text>
              <Text style={s.splitTotalValue}>{fmt(data.btwSplit.sem.totaal)}</Text>
            </View>
          </View>
          <View style={s.splitCard}>
            <Text style={s.splitTitle}>Syb — BTW terug</Text>
            {data.btwSplit.syb.items.map((item, i) => (
              <View key={i} style={s.splitItem}>
                <Text style={s.splitItemText}>{item.omschrijving}</Text>
                <Text style={s.splitItemValue}>{fmt(item.bedrag)}</Text>
              </View>
            ))}
            <View style={s.splitTotal}>
              <Text style={s.splitTotalText}>Totaal Syb</Text>
              <Text style={s.splitTotalValue}>{fmt(data.btwSplit.syb.totaal)}</Text>
            </View>
          </View>
        </View>

        {/* Samenvatting */}
        <Text style={s.sectionTitle}>Samenvatting</Text>
        <View style={s.splitCard}>
          <View style={s.splitItem}>
            <Text style={s.splitItemText}>BTW terug (Belastingdienst)</Text>
            <Text style={[s.splitItemValue, { color: "#059669" }]}>{fmt(data.totaalBtw)}</Text>
          </View>
          {data.totaalVerrekening > 0 && (
            <View style={s.splitItem}>
              <Text style={s.splitItemText}>Van Syb (openstaand)</Text>
              <Text style={[s.splitItemValue, { color: "#EA580C" }]}>{fmt(data.totaalVerrekening)}</Text>
            </View>
          )}
          <View style={s.splitTotal}>
            <Text style={s.splitTotalText}>Totaal terug te krijgen</Text>
            <Text style={[s.splitTotalValue, { fontSize: 10 }]}>{fmt(data.totaalTerug)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Autronis VOF — Gegenereerd op {new Date().toLocaleDateString("nl-NL")} — Dit overzicht is indicatief</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Create PDF API route**

Create `src/app/api/belasting/maandrapport/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { renderToBuffer } from "@react-pdf/renderer";
import { MaandrapportPDF } from "@/lib/maandrapport-pdf";
import React from "react";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const maand = searchParams.get("maand");

    if (!maand || !/^\d{4}-\d{2}$/.test(maand)) {
      return NextResponse.json({ fout: "Maand parameter vereist in YYYY-MM formaat" }, { status: 400 });
    }

    // Fetch maandrapport data from own API
    const baseUrl = process.env.NEXT_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
    const dataRes = await fetch(`${baseUrl}/api/belasting/maandrapport?maand=${maand}`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });

    if (!dataRes.ok) {
      const err = await dataRes.json();
      return NextResponse.json({ fout: err.fout ?? "Kon data niet ophalen" }, { status: 500 });
    }

    const { maandrapport } = await dataRes.json();
    const buffer = await renderToBuffer(React.createElement(MaandrapportPDF, { data: maandrapport }));

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="belastingoverzicht-${maand}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Test PDF download in browser**

Navigate to `http://localhost:3000/belasting/maandrapport`, click "PDF Export" button, verify PDF downloads and contains all sections.

- [ ] **Step 5: Commit**

```bash
git add src/lib/maandrapport-pdf.tsx src/app/api/belasting/maandrapport/pdf/
git commit -m "feat: add PDF export for maandrapport"
```

---

### Task 9: Link from Belasting Page + Seed Verdeelregels

**Files:**
- Modify: `src/app/(dashboard)/belasting/page.tsx` (add link to maandrapport)
- Modify: `drizzle/0007_maandrapport.sql` (add seed data for verdeelregels)

- [ ] **Step 1: Add link to maandrapport on belasting page**

In `src/app/(dashboard)/belasting/page.tsx`, find the header/title section and add a link button. Look for the page title or tab bar area and add:

```typescript
import Link from "next/link";
import { FileBarChart } from "lucide-react";
```

Then near the top of the page (after the title/year selector), add:

```tsx
<Link
  href="/belasting/maandrapport"
  className="flex items-center gap-2 bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
>
  <FileBarChart className="w-4 h-4" />
  Maandrapport
</Link>
```

- [ ] **Step 2: Seed default verdeelregels**

Run these SQL inserts to create the initial rules based on the HTML reference:

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
sqlite3 data/autronis.db "INSERT OR IGNORE INTO verdeel_regels (type, waarde, eigenaar, split_ratio) VALUES
  ('leverancier', 'Coolblue', 'sem', '100/0'),
  ('leverancier', 'Amac', 'sem', '100/0'),
  ('leverancier', 'Hoesjesdirect', 'sem', '100/0'),
  ('leverancier', 'KVK', 'gedeeld', '50/50'),
  ('leverancier', 'eHerkenning', 'gedeeld', '50/50'),
  ('leverancier', 'Rinkel', 'gedeeld', '50/50'),
  ('leverancier', 'Microsoft', 'sem', '100/0'),
  ('leverancier', 'Lovable', 'sem', '100/0'),
  ('categorie', 'hardware', 'sem', '100/0'),
  ('leverancier', 'Kantoorhuur', 'gedeeld', '25/75'),
  ('leverancier', 'Bibliotheek', 'gedeeld', '50/50');"
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Full browser test**

Open `http://localhost:3000/belasting` — verify the "Maandrapport" link is visible and navigates to `/belasting/maandrapport`. On the maandrapport page, verify:
- Month navigation works
- Trend bar renders with data
- Expense table shows rows with automatically applied eigenaar badges (via verdeelregels)
- BTW split cards calculate correctly
- Borg section shows hardcoded data
- PDF export downloads

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/belasting/page.tsx
git commit -m "feat: add maandrapport link to belasting page and seed verdeelregels"
```
