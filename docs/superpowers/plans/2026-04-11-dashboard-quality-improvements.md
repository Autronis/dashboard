# Dashboard Quality Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix security vulnerabilities, improve error handling, add database indexes, fix N+1 queries, and improve accessibility across the Autronis dashboard.

**Architecture:** Targeted fixes across auth, API routes, database schema, and frontend components. No structural refactoring — focused on hardening existing code.

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite, React 19, TypeScript

---

## Task 1: Security — Remove hardcoded SESSION_SECRET fallback

**Files:**
- Modify: `src/lib/auth.ts:11-12`

- [ ] **Step 1: Remove the fallback secret**

Replace the fallback with a hard crash if SESSION_SECRET is not set:

```typescript
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET environment variable is required (min 32 chars)");
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "security: remove hardcoded SESSION_SECRET fallback"
```

---

## Task 2: Security — Separate API key from SESSION_SECRET

**Files:**
- Modify: `src/lib/auth.ts:60-65`

- [ ] **Step 1: Replace SESSION_SECRET fallback with dedicated INTERNAL_API_KEY**

```typescript
// Fallback: accept INTERNAL_API_KEY for desktop agent / Claude sync
const internalKey = process.env.INTERNAL_API_KEY;
if (internalKey && token === internalKey) {
  return 1; // Sem's user ID
}
```

- [ ] **Step 2: Update .env.example to document new var**

Add `INTERNAL_API_KEY=...` to `.env.example`.

- [ ] **Step 3: Commit**

---

## Task 3: Security — Add security headers

**Files:**
- Modify: `next.config.ts:9-36`

- [ ] **Step 1: Add global security headers**

Add a catch-all `source: "/(.*)"` block with:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-DNS-Prefetch-Control: on`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

- [ ] **Step 2: Restrict /videos/* CORS to dashboard domain**

Change `Access-Control-Allow-Origin: *` to `https://dashboard.autronis.nl`.

- [ ] **Step 3: Commit**

---

## Task 4: Security — Make CRON_SECRET mandatory

**Files:**
- Modify: `src/app/api/followup/cron/route.ts:13-16`

- [ ] **Step 1: Make auth check unconditional**

```typescript
const cronSecret = process.env.CRON_SECRET;
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
}
```

- [ ] **Step 2: Commit**

---

## Task 5: Fix SQL injection in followup/log

**Files:**
- Modify: `src/app/api/followup/log/route.ts:46-58`

- [ ] **Step 1: Replace sql.raw with inArray from drizzle-orm**

```typescript
import { inArray } from "drizzle-orm";

const klantNamen = klantIds.length > 0
  ? await db
      .select({ id: klanten.id, naam: klanten.bedrijfsnaam })
      .from(klanten)
      .where(inArray(klanten.id, klantIds))
  : [];

const leadNamen = leadIds.length > 0
  ? await db
      .select({ id: leads.id, naam: leads.bedrijfsnaam })
      .from(leads)
      .where(inArray(leads.id, leadIds))
  : [];
```

- [ ] **Step 2: Commit**

---

## Task 6: Add database indexes on foreign keys

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add indexes to projecten table**

```typescript
export const projecten = sqliteTable("projecten", {
  // ... existing columns
}, (table) => ({
  idxKlantId: index("idx_projecten_klant_id").on(table.klantId),
  idxStatus: index("idx_projecten_status").on(table.status, table.isActief),
}));
```

- [ ] **Step 2: Add indexes to facturen table**

```typescript
}, (table) => ({
  idxKlantId: index("idx_facturen_klant_id").on(table.klantId),
  idxProjectId: index("idx_facturen_project_id").on(table.projectId),
  idxStatus: index("idx_facturen_status").on(table.status),
}));
```

- [ ] **Step 3: Add indexes to taken table**

```typescript
}, (table) => ({
  idxProjectId: index("idx_taken_project_id").on(table.projectId),
  idxStatus: index("idx_taken_status").on(table.status),
  idxToegewezenAan: index("idx_taken_toegewezen").on(table.toegewezenAan),
}));
```

- [ ] **Step 4: Generate and apply migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

- [ ] **Step 5: Commit**

---

## Task 7: Fix N+1 query in /api/klanten/[id]

**Files:**
- Modify: `src/app/api/klanten/[id]/route.ts:42-51`

- [ ] **Step 1: Replace Promise.all loop with single JOIN query**

```typescript
const projectenMetUren = await db
  .select({
    id: projecten.id,
    naam: projecten.naam,
    omschrijving: projecten.omschrijving,
    status: projecten.status,
    voortgangPercentage: projecten.voortgangPercentage,
    deadline: projecten.deadline,
    geschatteUren: projecten.geschatteUren,
    werkelijkeUren: projecten.werkelijkeUren,
    isActief: projecten.isActief,
    werkelijkeMinuten: sql<number>`coalesce(sum(${tijdregistraties.duurMinuten}), 0)`,
  })
  .from(projecten)
  .leftJoin(tijdregistraties, eq(tijdregistraties.projectId, projecten.id))
  .where(and(eq(projecten.klantId, Number(id)), eq(projecten.isActief, 1)))
  .groupBy(projecten.id)
  .orderBy(projecten.naam);
```

- [ ] **Step 2: Commit**

---

## Task 8: Dashboard page — fix silent errors and raw fetches

**Files:**
- Modify: `src/app/(dashboard)/page.tsx:702-721`

- [ ] **Step 1: Replace raw fetch with proper error handling**

Replace the two `.catch(() => {})` calls with fetches that show toast on error:

```typescript
useEffect(() => {
  if (window.innerWidth < 768) return;

  fetch(`/api/belasting/deadlines?jaar=${new Date().getFullYear()}`)
    .then(r => r.json())
    .then(data => {
      const nu = new Date();
      const urgent = (data.deadlines || [])
        .filter((d: { afgerond: number; datum: string }) => !d.afgerond)
        .map((d: { omschrijving: string; datum: string }) => {
          const dagen = Math.ceil((new Date(d.datum).getTime() - nu.getTime()) / 86400000);
          return { ...d, dagenOver: dagen };
        })
        .filter((d: { dagenOver: number }) => d.dagenOver <= 7 && d.dagenOver >= -30);
      setUrgentDeadlines(urgent);
    })
    .catch(() => addToast("Kon deadlines niet laden", "fout"));

  fetch("/api/dashboard/concurrenten")
    .then((r) => r.json())
    .then(setConcurrentData)
    .catch(() => {}); // Non-critical, silent OK
}, []);
```

- [ ] **Step 2: Fix empty Error() throws in mutations**

Replace `throw new Error()` with descriptive messages:

```typescript
// Line 756
if (!res.ok) throw new Error("Timer starten mislukt");
// Line 777
if (!res.ok) throw new Error("Timer stoppen mislukt");
// Line 794
if (!res.ok) throw new Error("Taak bijwerken mislukt");
```

- [ ] **Step 3: Commit**

---

## Task 9: Add accessibility improvements

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (collapse button)
- Modify: `src/components/layout/bottom-nav.tsx` (close button)

- [ ] **Step 1: Add aria-label to sidebar collapse button**

Find the collapse button and add `aria-label="Sidebar inklappen"` or `"Sidebar uitklappen"`.

- [ ] **Step 2: Add aria-label to bottom-nav close button**

Find the X close button and add `aria-label="Menu sluiten"`.

- [ ] **Step 3: Commit**

---

## Task 10: Final verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit
```

- [ ] **Step 2: Run dev server and verify no crashes**

```bash
npm run dev
```

- [ ] **Step 3: Run build**

```bash
npm run build
```
