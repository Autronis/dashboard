# Kilometers Uitbreiding Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Extend the kilometers page with km-stand tracking, privé/zakelijk ratio, belastingrapport PDF, terugkerende ritten, and Revolut fuel cost integration.

**Architecture:** Modular components added to existing page. New DB tables via Drizzle schema. API routes follow existing patterns. PDF uses @react-pdf/renderer.

**Tech Stack:** Next.js 16, Drizzle ORM, SQLite, React Query, Framer Motion, @react-pdf/renderer

---

### Task 1: Database Schema — New tables + field
**Files:** Modify: `src/lib/db/schema.ts` (after line 1369)

### Task 2: API Routes — km-stand, instellingen, terugkerend, genereer, brandstof
**Files:** Create: `src/app/api/kilometers/km-stand/route.ts`, `src/app/api/kilometers/instellingen/route.ts`, `src/app/api/kilometers/terugkerend/route.ts`, `src/app/api/kilometers/terugkerend/genereer/route.ts`, `src/app/api/kilometers/brandstof/route.ts`

### Task 3: Belastingrapport PDF template + API route
**Files:** Create: `src/lib/belastingrapport-pdf.tsx`, `src/app/api/kilometers/belastingrapport/route.ts`

### Task 4: React Query hooks
**Files:** Modify: `src/hooks/queries/use-kilometers.ts`

### Task 5: UI Components — KmStandPanel, DonutChart, TerugkerendeRittenModal, BelastingrapportKnop
**Files:** Create: `src/app/(dashboard)/kilometers/components/KmStandPanel.tsx`, `src/app/(dashboard)/kilometers/components/DonutChart.tsx`, `src/app/(dashboard)/kilometers/components/TerugkerendeRittenModal.tsx`, `src/app/(dashboard)/kilometers/components/BelastingrapportKnop.tsx`

### Task 6: Main page integration
**Files:** Modify: `src/app/(dashboard)/kilometers/page.tsx`

### Task 7: Revolut webhook extension
**Files:** Modify: `src/app/api/revolut/webhook/route.ts`

### Task 8: TypeScript check + commit
