# Ideeën Pagina Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ideas page into a Focus Dashboard with Decide/Capture tabs, AI confidence scoring based on real dashboard data, auto-capture from meetings/leads/radar, and a streamlined idea-to-project flow.

**Architecture:** Two-tab layout (Decide/Capture) with split-view detail panel. New confidence scoring engine runs as API route + nightly cron. Auto-capture hooks into existing meeting/lead/radar pipelines. Frontend split into focused components.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Framer Motion, Drizzle ORM (SQLite), Claude API (Anthropic SDK), React Query

**Spec:** `docs/superpowers/specs/2026-04-11-ideeen-pagina-redesign.md`

---

## File Structure

### New files
- `src/app/(dashboard)/ideeen/decide-tab.tsx` — Hero top 3 + parkeerplaats grid
- `src/app/(dashboard)/ideeen/capture-tab.tsx` — Quick input + auto-capture feed + genereer
- `src/app/(dashboard)/ideeen/idee-detail-panel.tsx` — Right panel with detail, edit, project preview
- `src/app/(dashboard)/ideeen/confidence-badge.tsx` — Confidence score display component
- `src/app/(dashboard)/ideeen/pipeline-bar.tsx` — Mini pipeline indicator
- `src/app/api/ideeen/confidence/route.ts` — Calculate/recalculate confidence scores
- `src/lib/ideeen/confidence.ts` — Core confidence calculation logic
- `src/lib/ideeen/auto-capture.ts` — Shared auto-capture logic for meetings/leads/radar

### Modified files
- `src/lib/db/schema.ts` (lines 1141-1172) — Add new fields to ideeen table
- `src/hooks/queries/use-ideeen.ts` — Add Idee type fields + new hooks
- `src/app/(dashboard)/ideeen/page.tsx` — Complete rewrite (Decide/Capture tabs)
- `src/lib/meetings/analyse-meeting.ts` (line 173) — Add auto-capture after processing
- `src/app/api/leads/[id]/activiteiten/route.ts` (line 76) — Add auto-capture hook
- `src/app/api/ideeen/route.ts` — Update GET to include confidence data, default sort
- `src/app/api/ideeen/[id]/route.ts` — Support new fields in PUT
- `src/app/api/ideeen/[id]/start-project/route.ts` — Add preview mode

---

## Task 1: Database Schema Changes

**Files:**
- Modify: `src/lib/db/schema.ts:1141-1172`

- [ ] **Step 1: Add new fields to ideeen table in schema**

In `src/lib/db/schema.ts`, add these fields to the `ideeen` sqliteTable definition, after line 1170 (`bijgewerktOp`):

```typescript
  bron: text("bron"),
  bronTekst: text("bron_tekst"),
  confidenceBreakdown: text("confidence_breakdown"),
  confidenceBijgewerktOp: text("confidence_bijgewerkt_op"),
  geparkeerd: integer("geparkeerd").default(0),
```

- [ ] **Step 2: Add runtime ALTER TABLE for new columns**

In `src/app/api/ideeen/route.ts`, add at the top of the GET handler (after `requireAuth()`):

```typescript
// Ensure new columns exist
try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN bron TEXT`); } catch { /* exists */ }
try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN bron_tekst TEXT`); } catch { /* exists */ }
try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN confidence_breakdown TEXT`); } catch { /* exists */ }
try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN confidence_bijgewerkt_op TEXT`); } catch { /* exists */ }
try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN geparkeerd INTEGER DEFAULT 0`); } catch { /* exists */ }
```

- [ ] **Step 3: Migrate existing aiScore values**

Add after the ALTER TABLE statements:

```typescript
// One-time migration: scale existing aiScore from 1-10 to 0-100
try {
  await db.run(sql`UPDATE ideeen SET ai_score = ai_score * 10 WHERE ai_score IS NOT NULL AND ai_score <= 10`);
} catch { /* already migrated */ }
```

- [ ] **Step 4: Update Idee type in hooks**

In `src/hooks/queries/use-ideeen.ts`, add new fields to the `Idee` interface (after line 28):

```typescript
  bron: string | null;
  bronTekst: string | null;
  confidenceBreakdown: string | null;
  confidenceBijgewerktOp: string | null;
  geparkeerd: number;
```

- [ ] **Step 5: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/hooks/queries/use-ideeen.ts src/app/api/ideeen/route.ts
git commit -m "feat(ideeen): add schema fields for confidence scoring, auto-capture, and parking"
```

---

## Task 2: Confidence Score Engine

**Files:**
- Create: `src/lib/ideeen/confidence.ts`
- Create: `src/app/api/ideeen/confidence/route.ts`

- [ ] **Step 1: Create confidence calculation module**

Create `src/lib/ideeen/confidence.ts`:

```typescript
import { db } from "@/lib/db";
import { ideeen, meetings, radarItems, leads, leadActiviteiten, projecten, concurrenten } from "@/lib/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { aiComplete } from "@/lib/ai";

interface ConfidenceBreakdown {
  klantbehoefte: { score: number; bronnen: Array<{ type: "meeting" | "lead"; id: number; titel: string }> };
  marktvalidatie: { score: number; bronnen: Array<{ type: "radar" | "concurrent"; id: number; titel: string }> };
  autronisFit: { score: number; uitleg: string };
  effortRoi: { score: number; geschatteUren: number | null; potentieleOmzet: number | null };
  totaal: number;
  samenvatting: string;
}

export async function berekenConfidence(ideeId: number): Promise<ConfidenceBreakdown> {
  const idee = await db.select().from(ideeen).where(eq(ideeen.id, ideeId)).get();
  if (!idee) throw new Error("Idee niet gevonden");

  const zoektermen = [idee.naam, idee.omschrijving].filter(Boolean).join(" ").toLowerCase();

  // 1. Klantbehoefte (40%) — scan meeting transcripts + lead notes
  const alleMeetings = await db
    .select({ id: meetings.id, titel: meetings.titel, transcript: meetings.transcript })
    .from(meetings)
    .where(eq(meetings.status, "klaar"))
    .all();

  const matchedMeetings: ConfidenceBreakdown["klantbehoefte"]["bronnen"] = [];
  for (const m of alleMeetings) {
    if (!m.transcript) continue;
    const transcript = m.transcript.toLowerCase();
    const woorden = zoektermen.split(/\s+/).filter(w => w.length > 3);
    const hits = woorden.filter(w => transcript.includes(w)).length;
    if (hits >= 2) {
      matchedMeetings.push({ type: "meeting", id: m.id, titel: m.titel });
    }
  }

  const alleLeadActiviteiten = await db
    .select({
      id: leadActiviteiten.id,
      leadId: leadActiviteiten.leadId,
      notitie: leadActiviteiten.notitie,
    })
    .from(leadActiviteiten)
    .where(eq(leadActiviteiten.type, "notitie_toegevoegd"))
    .all();

  const matchedLeads: ConfidenceBreakdown["klantbehoefte"]["bronnen"] = [];
  const geteldeLeads = new Set<number>();
  for (const a of alleLeadActiviteiten) {
    if (!a.notitie || geteldeLeads.has(a.leadId)) continue;
    const notitie = a.notitie.toLowerCase();
    const woorden = zoektermen.split(/\s+/).filter(w => w.length > 3);
    const hits = woorden.filter(w => notitie.includes(w)).length;
    if (hits >= 2) {
      geteldeLeads.add(a.leadId);
      matchedLeads.push({ type: "lead", id: a.leadId, titel: `Lead #${a.leadId}` });
    }
  }

  const uniekeMentions = matchedMeetings.length + matchedLeads.length;
  const klantbehoefteScore = uniekeMentions === 0 ? 0 : uniekeMentions === 1 ? 25 : uniekeMentions === 2 ? 50 : 100;

  // 2. Marktvalidatie (25%) — scan radar + concurrenten
  const alleRadar = await db
    .select({ id: radarItems.id, titel: radarItems.titel, aiSamenvatting: radarItems.aiSamenvatting })
    .from(radarItems)
    .where(sql`${radarItems.score} >= 7`)
    .all();

  const matchedRadar: ConfidenceBreakdown["marktvalidatie"]["bronnen"] = [];
  for (const r of alleRadar) {
    const tekst = [r.titel, r.aiSamenvatting].filter(Boolean).join(" ").toLowerCase();
    const woorden = zoektermen.split(/\s+/).filter(w => w.length > 3);
    const hits = woorden.filter(w => tekst.includes(w)).length;
    if (hits >= 2) {
      matchedRadar.push({ type: "radar", id: r.id, titel: r.titel });
    }
  }

  let concurrentMatch = false;
  try {
    const alleConcurrenten = await db.select().from(concurrenten).all();
    for (const c of alleConcurrenten) {
      const tekst = JSON.stringify(c).toLowerCase();
      const woorden = zoektermen.split(/\s+/).filter(w => w.length > 3);
      if (woorden.some(w => tekst.includes(w))) {
        concurrentMatch = true;
        break;
      }
    }
  } catch { /* concurrenten table may not exist */ }

  const marktScore = matchedRadar.length > 0 && concurrentMatch ? 100
    : concurrentMatch ? 100
    : matchedRadar.length > 0 ? 50
    : 0;

  // 3. Autronis Fit (20%) — AI assessment
  const actieveProjecten = await db
    .select({ naam: projecten.naam, omschrijving: projecten.omschrijving })
    .from(projecten)
    .where(eq(projecten.status, "actief"))
    .all();

  let fitScore = 50;
  let fitUitleg = "Geen beoordeling beschikbaar";
  try {
    const fitResult = await aiComplete({
      model: "claude-sonnet-4-5-20250514",
      maxTokens: 200,
      system: "Je bent een business analyst. Beoordeel of dit idee past bij het bedrijf. Antwoord ALLEEN met JSON: {\"score\": 0-100, \"uitleg\": \"korte zin\"}",
      prompt: `Bedrijf: Autronis — 2-persoons tech bureau (web development, automation, AI). Actieve projecten: ${actieveProjecten.map(p => p.naam).join(", ")}. Idee: "${idee.naam}" — ${idee.omschrijving || "geen omschrijving"}`,
    });
    const parsed = JSON.parse(fitResult);
    fitScore = parsed.score;
    fitUitleg = parsed.uitleg;
  } catch { /* use default */ }

  // 4. Effort/ROI (15%)
  const afgerondeProjecten = await db
    .select({ duurMinuten: sql<number>`SUM(duur_minuten)` })
    .from(projecten)
    .where(eq(projecten.status, "afgerond"))
    .all();

  let roiScore = 50; // neutral default
  let geschatteUren: number | null = null;
  let potentieleOmzet: number | null = null;

  try {
    const roiResult = await aiComplete({
      model: "claude-sonnet-4-5-20250514",
      maxTokens: 150,
      system: "Schat het aantal uren en potentiële omzet voor dit project. Antwoord ALLEEN met JSON: {\"uren\": number, \"omzet\": number}",
      prompt: `2-persoons tech bureau, uurtarief ~€100. Idee: "${idee.naam}" — ${idee.omschrijving || "geen omschrijving"}`,
    });
    const parsed = JSON.parse(roiResult);
    geschatteUren = parsed.uren;
    potentieleOmzet = parsed.omzet;
    if (geschatteUren && potentieleOmzet) {
      const ratio = potentieleOmzet / geschatteUren;
      roiScore = ratio > 150 ? 100 : ratio > 100 ? 75 : ratio > 50 ? 50 : 25;
    }
  } catch { /* use default */ }

  // Calculate weighted total
  const totaal = Math.round(
    klantbehoefteScore * 0.4 +
    marktScore * 0.25 +
    fitScore * 0.2 +
    roiScore * 0.15
  );

  // Generate summary sentence
  const signalen: string[] = [];
  if (uniekeMentions > 0) signalen.push(`${uniekeMentions} klant${uniekeMentions > 1 ? "en" : ""} noem${uniekeMentions === 1 ? "t" : "den"} dit`);
  if (matchedRadar.length > 0) signalen.push(`${matchedRadar.length} radar artikel${matchedRadar.length > 1 ? "en" : ""}`);
  if (concurrentMatch) signalen.push("concurrent biedt dit aan");
  if (fitScore >= 70) signalen.push("past goed bij Autronis");
  const samenvatting = signalen.length > 0 ? signalen.join(", ") : "Nog geen signalen gevonden";

  return {
    klantbehoefte: { score: klantbehoefteScore, bronnen: [...matchedMeetings, ...matchedLeads] },
    marktvalidatie: { score: marktScore, bronnen: matchedRadar },
    autronisFit: { score: fitScore, uitleg: fitUitleg },
    effortRoi: { score: roiScore, geschatteUren, potentieleOmzet },
    totaal,
    samenvatting,
  };
}

export async function updateConfidence(ideeId: number): Promise<void> {
  const breakdown = await berekenConfidence(ideeId);
  await db.update(ideeen).set({
    aiScore: breakdown.totaal,
    confidenceBreakdown: JSON.stringify(breakdown),
    confidenceBijgewerktOp: new Date().toISOString(),
  }).where(eq(ideeen.id, ideeId)).run();
}

export async function updateAllConfidence(): Promise<number> {
  const teBerekenen = await db
    .select({ id: ideeen.id })
    .from(ideeen)
    .where(sql`${ideeen.status} IN ('idee', 'uitgewerkt') AND ${ideeen.categorie} != 'inzicht'`)
    .all();

  let count = 0;
  for (const idee of teBerekenen) {
    try {
      await updateConfidence(idee.id);
      count++;
    } catch { /* skip failed */ }
  }
  return count;
}
```

- [ ] **Step 2: Check if aiComplete helper exists and find its import path**

Run: `grep -rn "export.*function aiComplete\|export.*aiComplete" src/lib/`

If it doesn't exist, check for the Anthropic SDK pattern used in existing routes:
Run: `grep -rn "anthropic\|claude" src/app/api/ideeen/analyse/route.ts | head -10`

Adjust the import in `confidence.ts` accordingly. If `aiComplete` doesn't exist, replace with direct Anthropic SDK calls matching the pattern in `src/app/api/ideeen/analyse/route.ts`.

- [ ] **Step 3: Check concurrenten table exists in schema**

Run: `grep -n "concurrenten" src/lib/db/schema.ts | head -5`

If it doesn't exist, remove the concurrenten scanning from `confidence.ts` and set `concurrentMatch = false`.

- [ ] **Step 4: Create confidence API route**

Create `src/app/api/ideeen/confidence/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { updateConfidence, updateAllConfidence } from "@/lib/ideeen/confidence";

// POST /api/ideeen/confidence — Recalculate confidence score(s)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json().catch(() => ({}));
    const { ideeId } = body as { ideeId?: number };

    if (ideeId) {
      await updateConfidence(ideeId);
      return NextResponse.json({ succes: true, ideeId });
    }

    // Recalculate all
    const count = await updateAllConfidence();
    return NextResponse.json({ succes: true, bijgewerkt: count });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    if (message === "Niet geauthenticeerd") {
      return NextResponse.json({ fout: message }, { status: 401 });
    }
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Add useConfidenceRecalc hook**

In `src/hooks/queries/use-ideeen.ts`, add after `useSyncBacklog`:

```typescript
export function useConfidenceRecalc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ideeId?: number) => {
      const res = await fetch("/api/ideeen/confidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ideeId ? { ideeId } : {}),
      });
      if (!res.ok) throw new Error("Herberekening mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}
```

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (fix any import issues)

- [ ] **Step 7: Commit**

```bash
git add src/lib/ideeen/confidence.ts src/app/api/ideeen/confidence/route.ts src/hooks/queries/use-ideeen.ts
git commit -m "feat(ideeen): add confidence score engine with real dashboard data"
```

---

## Task 3: Auto-Capture Module

**Files:**
- Create: `src/lib/ideeen/auto-capture.ts`
- Modify: `src/lib/meetings/analyse-meeting.ts:131-173`
- Modify: `src/app/api/leads/[id]/activiteiten/route.ts:41-76`

- [ ] **Step 1: Create auto-capture shared module**

Create `src/lib/ideeen/auto-capture.ts`:

```typescript
import { db } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

interface CaptureInput {
  naam: string;
  omschrijving: string;
  bron: string;
  bronTekst: string;
}

export async function createAutoCapture(input: CaptureInput): Promise<number> {
  // Ensure columns exist
  try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN bron TEXT`); } catch { /* exists */ }
  try { await db.run(sql`ALTER TABLE ideeen ADD COLUMN bron_tekst TEXT`); } catch { /* exists */ }

  // Get next nummer
  const maxResult = await db.all(sql`SELECT MAX(nummer) as max FROM ideeen`);
  const nextNummer = ((maxResult[0] as { max: number | null })?.max ?? 0) + 1;

  const result = await db.insert(ideeen).values({
    nummer: nextNummer,
    naam: input.naam,
    omschrijving: input.omschrijving,
    categorie: "inzicht",
    status: "idee",
    prioriteit: "normaal",
    bron: input.bron,
    bronTekst: input.bronTekst,
    aangemaaktDoor: 1,
  }).run();

  return Number(result.lastInsertRowid);
}
```

- [ ] **Step 2: Add auto-capture to meeting processing**

In `src/lib/meetings/analyse-meeting.ts`, add import at the top:

```typescript
import { createAutoCapture } from "@/lib/ideeen/auto-capture";
```

Then add after the `db.update(meetings).set(...)` call at the end of `processMeeting()` (after the status is set to "klaar"), before the closing `}`:

```typescript
  // Auto-capture: extract idea signals from transcript
  try {
    const ideeSignalen = await aiComplete({
      model: "claude-sonnet-4-5-20250514",
      maxTokens: 500,
      system: `Scan dit meeting transcript op idee-signalen — momenten waar iemand een behoefte, wens, of kans noemt. Zoek naar patronen als "we zouden kunnen", "klant vraagt om", "het zou handig zijn als", "idee:", of vergelijkbare triggers. Antwoord ALLEEN met JSON array: [{"naam": "korte titel", "quote": "relevante zin uit transcript"}]. Geen ideeën gevonden? Return lege array [].`,
      prompt: transcript,
    });
    const signalen = JSON.parse(ideeSignalen) as Array<{ naam: string; quote: string }>;
    for (const signaal of signalen) {
      await createAutoCapture({
        naam: signaal.naam,
        omschrijving: `Uit meeting: ${signaal.quote}`,
        bron: `meeting:${meetingId}`,
        bronTekst: signaal.quote,
      });
    }
  } catch { /* non-blocking: don't fail meeting processing for capture errors */ }
```

- [ ] **Step 3: Add auto-capture to lead activities**

In `src/app/api/leads/[id]/activiteiten/route.ts`, add import at the top:

```typescript
import { createAutoCapture } from "@/lib/ideeen/auto-capture";
```

Then add after the successful insert in the POST handler (after the `return NextResponse.json(...)` is prepared but before it's returned — wrap the capture in a non-blocking try/catch):

```typescript
    // Auto-capture: scan note for idea signals (non-blocking)
    if (type === "notitie_toegevoegd" && notitie) {
      try {
        const { aiComplete } = await import("@/lib/ai");
        const signalen = await aiComplete({
          model: "claude-sonnet-4-5-20250514",
          maxTokens: 300,
          system: `Scan deze lead-notitie op kans-signalen voor een tech bureau. Zoek naar onvervulde behoeften, feature requests, of marktopportuniteiten. Antwoord ALLEEN met JSON array: [{"naam": "korte titel", "quote": "relevante passage"}]. Geen signalen? Return [].`,
          prompt: notitie,
        });
        const parsed = JSON.parse(signalen) as Array<{ naam: string; quote: string }>;
        for (const s of parsed) {
          await createAutoCapture({
            naam: s.naam,
            omschrijving: `Uit lead-notitie: ${s.quote}`,
            bron: `lead:${id}`,
            bronTekst: s.quote,
          });
        }
      } catch { /* non-blocking */ }
    }
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/ideeen/auto-capture.ts src/lib/meetings/analyse-meeting.ts src/app/api/leads/[id]/activiteiten/route.ts
git commit -m "feat(ideeen): add auto-capture from meetings and lead notes"
```

---

## Task 4: Update GET /api/ideeen for Confidence Data

**Files:**
- Modify: `src/app/api/ideeen/route.ts`
- Modify: `src/app/api/ideeen/[id]/route.ts`

- [ ] **Step 1: Update GET response to include new fields and default sort**

In `src/app/api/ideeen/route.ts`, update the GET handler's select query to include the new fields. Replace the existing query with one that selects all fields and sorts by `aiScore` descending by default:

```typescript
    const result = await db
      .select()
      .from(ideeen)
      .orderBy(desc(ideeen.aiScore))
      .$dynamic();
```

Add `desc` to the imports from drizzle-orm if not already imported.

- [ ] **Step 2: Update PUT handler for new fields**

In `src/app/api/ideeen/[id]/route.ts`, add the new fields to the update set in the PUT handler. Where the existing code builds the update object, add:

```typescript
    if (body.bron !== undefined) updateData.bron = body.bron;
    if (body.bronTekst !== undefined) updateData.bronTekst = body.bronTekst;
    if (body.geparkeerd !== undefined) updateData.geparkeerd = body.geparkeerd;
```

- [ ] **Step 3: Add geparkeerd toggle hook**

In `src/hooks/queries/use-ideeen.ts`, add:

```typescript
export function useParkeerIdee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, geparkeerd }: { id: number; geparkeerd: boolean }) => {
      const res = await fetch(`/api/ideeen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geparkeerd: geparkeerd ? 1 : 0 }),
      });
      if (!res.ok) throw new Error("Parkeren mislukt");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideeen"] });
    },
  });
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ideeen/route.ts src/app/api/ideeen/[id]/route.ts src/hooks/queries/use-ideeen.ts
git commit -m "feat(ideeen): update API for confidence data, parking, and default sort"
```

---

## Task 5: Improved Start-Project Preview

**Files:**
- Modify: `src/app/api/ideeen/[id]/start-project/route.ts`

- [ ] **Step 1: Add GET handler for project preview**

In `src/app/api/ideeen/[id]/start-project/route.ts`, add a GET handler that returns a quick preview without creating the project:

```typescript
// GET /api/ideeen/[id]/start-project — Preview before starting
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const ideeId = Number(id);

    const idee = await db.select().from(ideeen).where(eq(ideeen.id, ideeId)).get();
    if (!idee) return NextResponse.json({ fout: "Idee niet gevonden" }, { status: 404 });

    // Find similar completed projects
    const vergelijkbaar = await db
      .select({ naam: projecten.naam, status: projecten.status })
      .from(projecten)
      .where(eq(projecten.status, "afgerond"))
      .limit(5)
      .all();

    // Count active projects + open tasks for workload context
    const actieveProjectenCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(projecten)
      .where(eq(projecten.status, "actief"))
      .get();

    // AI preview
    const preview = await aiComplete({
      model: "claude-sonnet-4-5-20250514",
      maxTokens: 300,
      system: `Geef een korte project preview. Antwoord ALLEEN met JSON: {"geschatteUren": number, "geschatteDoorlooptijd": "string", "fases": number, "eersteTaken": ["taak1", "taak2", "taak3"], "vergelijkbaarProject": "naam of null"}`,
      prompt: `Idee: "${idee.naam}" — ${idee.omschrijving || "geen omschrijving"}. Vergelijkbare projecten: ${vergelijkbaar.map(p => p.naam).join(", ") || "geen"}. Actieve projecten: ${actieveProjectenCount?.count ?? 0}.`,
    });

    const parsed = JSON.parse(preview);
    const suggestieModus = (parsed.geschatteUren || 20) > 10 ? "team" : "zelf";

    return NextResponse.json({
      preview: {
        ...parsed,
        suggestieModus,
        actieveProjecten: actieveProjectenCount?.count ?? 0,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add useProjectPreview hook**

In `src/hooks/queries/use-ideeen.ts`, add:

```typescript
export function useProjectPreview(ideeId: number | null) {
  return useQuery({
    queryKey: ["project-preview", ideeId],
    queryFn: async () => {
      const res = await fetch(`/api/ideeen/${ideeId}/start-project`);
      if (!res.ok) throw new Error("Preview laden mislukt");
      const data = await res.json();
      return data.preview as {
        geschatteUren: number;
        geschatteDoorlooptijd: string;
        fases: number;
        eersteTaken: string[];
        vergelijkbaarProject: string | null;
        suggestieModus: "team" | "zelf";
        actieveProjecten: number;
      };
    },
    enabled: ideeId !== null && ideeId > 0,
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ideeen/[id]/start-project/route.ts src/hooks/queries/use-ideeen.ts
git commit -m "feat(ideeen): add project preview endpoint for inline start-project flow"
```

---

## Task 6: Confidence Badge Component

**Files:**
- Create: `src/app/(dashboard)/ideeen/confidence-badge.tsx`

- [ ] **Step 1: Create component**

Create `src/app/(dashboard)/ideeen/confidence-badge.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ConfidenceBadge({ score, size = "md", showLabel = false }: ConfidenceBadgeProps) {
  if (score === null) return null;

  const kleur = score >= 60 ? "text-emerald-400 bg-emerald-400/15 border-emerald-400/30"
    : score >= 30 ? "text-amber-400 bg-amber-400/15 border-amber-400/30"
    : "text-red-400 bg-red-400/15 border-red-400/30";

  const sizes = {
    sm: "text-xs px-1.5 py-0.5 min-w-[28px]",
    md: "text-sm px-2 py-1 min-w-[36px]",
    lg: "text-lg px-3 py-1.5 min-w-[44px] font-bold",
  };

  return (
    <span className={cn("inline-flex items-center justify-center rounded-lg border font-semibold tabular-nums", kleur, sizes[size])}>
      {score}
      {showLabel && <span className="ml-1 font-normal opacity-70 text-[0.75em]">confidence</span>}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/ideeen/confidence-badge.tsx
git commit -m "feat(ideeen): add confidence badge component"
```

---

## Task 7: Pipeline Bar Component

**Files:**
- Create: `src/app/(dashboard)/ideeen/pipeline-bar.tsx`

- [ ] **Step 1: Create component**

Create `src/app/(dashboard)/ideeen/pipeline-bar.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { Idee } from "@/hooks/queries/use-ideeen";

interface PipelineBarProps {
  ideeen: Idee[];
}

export function PipelineBar({ ideeen }: PipelineBarProps) {
  const counts = {
    idee: ideeen.filter(i => i.status === "idee" && i.categorie !== "inzicht").length,
    uitgewerkt: ideeen.filter(i => i.status === "uitgewerkt").length,
    actief: ideeen.filter(i => i.status === "actief").length,
    gebouwd: ideeen.filter(i => i.status === "gebouwd").length,
  };

  const stages = [
    { label: "Idee", count: counts.idee, color: "bg-blue-400" },
    { label: "Uitgewerkt", count: counts.uitgewerkt, color: "bg-amber-400" },
    { label: "Actief", count: counts.actief, color: "bg-autronis-accent" },
    { label: "Gebouwd", count: counts.gebouwd, color: "bg-emerald-400" },
  ];

  return (
    <div className="flex items-center gap-1 text-xs text-autronis-text-secondary">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-center gap-1">
          <div className={cn("w-2 h-2 rounded-full", stage.color)} />
          <span className="tabular-nums">{stage.count}</span>
          <span className="opacity-60">{stage.label}</span>
          {i < stages.length - 1 && <span className="opacity-30 mx-0.5">→</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/ideeen/pipeline-bar.tsx
git commit -m "feat(ideeen): add pipeline bar component"
```

---

## Task 8: Detail Panel Component

**Files:**
- Create: `src/app/(dashboard)/ideeen/idee-detail-panel.tsx`

- [ ] **Step 1: Create detail panel**

Create `src/app/(dashboard)/ideeen/idee-detail-panel.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Play, ParkingCircle, Trash2, RefreshCw, Loader2,
  Calendar, Tag, ExternalLink, ChevronDown, ChevronUp, MessageSquare,
} from "lucide-react";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";
import { useToast } from "@/hooks/use-toast";
import {
  useUpdateIdee,
  useDeleteIdee,
  useStartProject,
  useConfidenceRecalc,
  useParkeerIdee,
  useProjectPreview,
} from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";

interface ConfidenceBreakdown {
  klantbehoefte: { score: number; bronnen: Array<{ type: string; id: number; titel: string }> };
  marktvalidatie: { score: number; bronnen: Array<{ type: string; id: number; titel: string }> };
  autronisFit: { score: number; uitleg: string };
  effortRoi: { score: number; geschatteUren: number | null; potentieleOmzet: number | null };
  totaal: number;
  samenvatting: string;
}

const categorieLabels: Record<string, string> = {
  dashboard: "Dashboard",
  klant_verkoop: "Klant & Verkoop",
  intern: "Intern",
  dev_tools: "Dev Tools",
  content_media: "Content & Media",
  geld_groei: "Geld & Groei",
  experimenteel: "Experimenteel",
  website: "Website",
  inzicht: "Inzicht",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  idee: { label: "Idee", color: "bg-blue-500/15 text-blue-400" },
  uitgewerkt: { label: "Uitgewerkt", color: "bg-amber-500/15 text-amber-400" },
  actief: { label: "Actief", color: "bg-autronis-accent/15 text-autronis-accent" },
  gebouwd: { label: "Gebouwd", color: "bg-emerald-500/15 text-emerald-400" },
};

interface IdeeDetailPanelProps {
  idee: Idee;
  onClose: () => void;
  onDaanSpar?: () => void;
}

export function IdeeDetailPanel({ idee, onClose, onDaanSpar }: IdeeDetailPanelProps) {
  const { addToast } = useToast();
  const updateMutation = useUpdateIdee();
  const deleteMutation = useDeleteIdee();
  const startProjectMutation = useStartProject();
  const confidenceRecalc = useConfidenceRecalc();
  const parkeerMutation = useParkeerIdee();
  const [showPreview, setShowPreview] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNaam, setEditNaam] = useState(idee.naam);
  const [editOmschrijving, setEditOmschrijving] = useState(idee.omschrijving || "");
  const [editCategorie, setEditCategorie] = useState(idee.categorie || "experimenteel");
  const [previewModus, setPreviewModus] = useState<"zelf" | "team">("zelf");

  const { data: preview, isLoading: previewLoading } = useProjectPreview(
    showPreview ? idee.id : null
  );

  const breakdown: ConfidenceBreakdown | null = idee.confidenceBreakdown
    ? JSON.parse(idee.confidenceBreakdown)
    : null;

  const sc = statusLabels[idee.status] || statusLabels.idee;

  const handleSave = useCallback(() => {
    updateMutation.mutate(
      { id: idee.id, body: { naam: editNaam, omschrijving: editOmschrijving, categorie: editCategorie } },
      {
        onSuccess: () => { addToast("Idee bijgewerkt", "succes"); setEditing(false); },
        onError: () => addToast("Bijwerken mislukt", "fout"),
      }
    );
  }, [updateMutation, idee.id, editNaam, editOmschrijving, editCategorie, addToast]);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(idee.id, {
      onSuccess: () => { addToast("Idee verwijderd", "succes"); onClose(); },
      onError: () => addToast("Verwijderen mislukt", "fout"),
    });
  }, [deleteMutation, idee.id, addToast, onClose]);

  const handleStartProject = useCallback(() => {
    startProjectMutation.mutate(
      { id: idee.id, modus: previewModus },
      {
        onSuccess: (data) => {
          addToast(`Project "${data.project.naam}" gestart`, "succes");
          onClose();
        },
        onError: (err) => addToast(err.message, "fout"),
      }
    );
  }, [startProjectMutation, idee.id, previewModus, addToast, onClose]);

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-8rem)]"
    >
      {/* Header */}
      <div>
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Terug
        </button>
        <div className="flex items-start justify-between gap-3">
          {editing ? (
            <input value={editNaam} onChange={(e) => setEditNaam(e.target.value)} className="text-xl font-bold text-autronis-text-primary bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5 flex-1" />
          ) : (
            <h2 className="text-xl font-bold text-autronis-text-primary">{idee.naam}</h2>
          )}
          <ConfidenceBadge score={idee.aiScore} size="lg" />
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", sc.color)}>{sc.label}</span>
          {idee.categorie && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-autronis-bg border border-autronis-border text-autronis-text-secondary">
              {categorieLabels[idee.categorie] || idee.categorie}
            </span>
          )}
          {idee.bron && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400">
              {idee.bron.startsWith("meeting:") ? "Meeting" : idee.bron.startsWith("lead:") ? "Lead" : idee.bron.startsWith("radar:") ? "Radar" : "Auto"}
            </span>
          )}
        </div>
      </div>

      {/* Confidence breakdown */}
      {breakdown && (
        <div>
          <button onClick={() => setShowBreakdown(!showBreakdown)} className="flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            {showBreakdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {breakdown.samenvatting}
          </button>
          {showBreakdown && (
            <div className="mt-3 space-y-2">
              {[
                { label: "Klantbehoefte", score: breakdown.klantbehoefte.score, weight: "40%", detail: `${breakdown.klantbehoefte.bronnen.length} bronnen` },
                { label: "Marktvalidatie", score: breakdown.marktvalidatie.score, weight: "25%", detail: `${breakdown.marktvalidatie.bronnen.length} bronnen` },
                { label: "Autronis Fit", score: breakdown.autronisFit.score, weight: "20%", detail: breakdown.autronisFit.uitleg },
                { label: "Effort/ROI", score: breakdown.effortRoi.score, weight: "15%", detail: breakdown.effortRoi.geschatteUren ? `~${breakdown.effortRoi.geschatteUren}u` : "onbekend" },
              ].map((cat) => (
                <div key={cat.label} className="flex items-center gap-3 text-sm">
                  <span className="text-autronis-text-secondary w-28 shrink-0">{cat.label} ({cat.weight})</span>
                  <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", cat.score >= 60 ? "bg-emerald-400" : cat.score >= 30 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${cat.score}%` }} />
                  </div>
                  <span className="text-xs text-autronis-text-secondary tabular-nums w-8 text-right">{cat.score}</span>
                  <span className="text-xs text-autronis-text-secondary/60 truncate max-w-[120px]">{cat.detail}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => confidenceRecalc.mutate(idee.id)} disabled={confidenceRecalc.isPending} className="flex items-center gap-1.5 mt-2 text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors">
            <RefreshCw className={cn("w-3 h-3", confidenceRecalc.isPending && "animate-spin")} /> Herbereken
          </button>
        </div>
      )}

      {/* Bron tekst */}
      {idee.bronTekst && (
        <div className="bg-autronis-bg/50 border border-autronis-border/50 rounded-xl p-4">
          <p className="text-xs text-autronis-text-secondary mb-1 uppercase tracking-wider">Originele bron</p>
          <p className="text-sm text-autronis-text-primary italic">"{idee.bronTekst}"</p>
        </div>
      )}

      {/* Description */}
      <div>
        <p className="text-xs text-autronis-text-secondary mb-1 uppercase tracking-wider">Omschrijving</p>
        {editing ? (
          <textarea value={editOmschrijving} onChange={(e) => setEditOmschrijving(e.target.value)} rows={4} className="w-full text-sm text-autronis-text-primary bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2" />
        ) : (
          <div className="text-sm text-autronis-text-primary prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(idee.omschrijving || "*Geen omschrijving*") as string }} />
        )}
      </div>

      {/* Uitwerking */}
      {(idee.uitwerking || editing) && (
        <div>
          <p className="text-xs text-autronis-text-secondary mb-1 uppercase tracking-wider">Uitwerking</p>
          <div className="text-sm text-autronis-text-primary prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(idee.uitwerking || "*Nog niet uitgewerkt*") as string }} />
        </div>
      )}

      {/* Edit controls */}
      {editing ? (
        <div className="flex items-center gap-2">
          <select value={editCategorie} onChange={(e) => setEditCategorie(e.target.value)} className="text-sm bg-autronis-bg border border-autronis-border rounded-lg px-3 py-1.5 text-autronis-text-primary">
            {Object.entries(categorieLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={handleSave} disabled={updateMutation.isPending} className="px-4 py-1.5 bg-autronis-accent text-autronis-bg text-sm font-semibold rounded-lg hover:bg-autronis-accent-hover transition-colors">
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Opslaan"}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">Annuleer</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-sm text-autronis-accent hover:text-autronis-accent-hover transition-colors">Bewerken</button>
      )}

      {/* Start project preview */}
      {(idee.status === "idee" || idee.status === "uitgewerkt") && (
        <div className="border-t border-autronis-border pt-4 space-y-3">
          {!showPreview ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg text-sm font-semibold rounded-xl hover:bg-autronis-accent-hover transition-colors">
                <Play className="w-4 h-4" /> Start project
              </button>
              {onDaanSpar && (
                <button onClick={onDaanSpar} className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border text-autronis-text-primary text-sm rounded-xl hover:border-autronis-accent/30 transition-colors">
                  <MessageSquare className="w-4 h-4" /> Eerst uitwerken
                </button>
              )}
              <button onClick={() => parkeerMutation.mutate({ id: idee.id, geparkeerd: !idee.geparkeerd })} className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border text-autronis-text-secondary text-sm rounded-xl hover:border-amber-400/30 transition-colors">
                <ParkingCircle className="w-4 h-4" /> {idee.geparkeerd ? "Deparkeer" : "Parkeer"}
              </button>
            </div>
          ) : (
            <div className="bg-autronis-bg/50 border border-autronis-accent/20 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-autronis-text-primary">Project Preview</p>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-autronis-text-secondary"><Loader2 className="w-4 h-4 animate-spin" /> Preview laden...</div>
              ) : preview ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-autronis-text-secondary">Scope:</span> <span className="text-autronis-text-primary font-medium">~{preview.geschatteUren}u, {preview.fases} fases</span></div>
                    <div><span className="text-autronis-text-secondary">Doorlooptijd:</span> <span className="text-autronis-text-primary font-medium">{preview.geschatteDoorlooptijd}</span></div>
                    <div><span className="text-autronis-text-secondary">Werkdruk:</span> <span className="text-autronis-text-primary font-medium">{preview.actieveProjecten} actief</span></div>
                  </div>
                  <div>
                    <p className="text-xs text-autronis-text-secondary mb-1">Eerste taken:</p>
                    <ul className="text-sm text-autronis-text-primary space-y-1">
                      {preview.eersteTaken.map((t, i) => <li key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-autronis-accent shrink-0" />{t}</li>)}
                    </ul>
                  </div>
                  {preview.vergelijkbaarProject && (
                    <p className="text-xs text-autronis-text-secondary">Vergelijkbaar met: <span className="text-autronis-accent">{preview.vergelijkbaarProject}</span></p>
                  )}
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex items-center gap-1 bg-autronis-bg border border-autronis-border rounded-lg p-0.5">
                      <button onClick={() => setPreviewModus("zelf")} className={cn("px-3 py-1 text-xs rounded-md transition-colors", previewModus === "zelf" ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary")}>Zelf doen</button>
                      <button onClick={() => setPreviewModus("team")} className={cn("px-3 py-1 text-xs rounded-md transition-colors", previewModus === "team" ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary")}>Team</button>
                    </div>
                    <button onClick={handleStartProject} disabled={startProjectMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-autronis-accent text-autronis-bg text-sm font-semibold rounded-lg hover:bg-autronis-accent-hover transition-colors">
                      {startProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start
                    </button>
                    <button onClick={() => setShowPreview(false)} className="text-sm text-autronis-text-secondary hover:text-autronis-text-primary">Annuleer</button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Delete */}
      <div className="border-t border-autronis-border pt-4">
        <button onClick={handleDelete} disabled={deleteMutation.isPending} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
          <Trash2 className="w-4 h-4" /> Verwijder idee
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (fix any missing imports)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ideeen/idee-detail-panel.tsx
git commit -m "feat(ideeen): add detail panel component with confidence breakdown and project preview"
```

---

## Task 9: Decide Tab Component

**Files:**
- Create: `src/app/(dashboard)/ideeen/decide-tab.tsx`

- [ ] **Step 1: Create decide tab**

Create `src/app/(dashboard)/ideeen/decide-tab.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, Play, ParkingCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "./confidence-badge";
import { PipelineBar } from "./pipeline-bar";
import { IdeeDetailPanel } from "./idee-detail-panel";
import { useParkeerIdee, useConfidenceRecalc } from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";

const categorieLabels: Record<string, string> = {
  dashboard: "Dashboard", klant_verkoop: "Klant & Verkoop", intern: "Intern",
  dev_tools: "Dev Tools", content_media: "Content & Media", geld_groei: "Geld & Groei",
  experimenteel: "Experimenteel", website: "Website",
};

interface DecideTabProps {
  ideeen: Idee[];
  onDaanSpar: (idee: Idee) => void;
}

export function DecideTab({ ideeen, onDaanSpar }: DecideTabProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoek, setZoek] = useState("");
  const [filterCategorie, setFilterCategorie] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"confidence" | "nieuwste" | "categorie">("confidence");

  // Filter out inzichten (those live in Capture tab)
  const backlogIdeeen = useMemo(() =>
    ideeen.filter(i => i.categorie !== "inzicht"),
    [ideeen]
  );

  // Top 3 (not geparkeerd, status idee/uitgewerkt, sorted by confidence)
  const top3 = useMemo(() =>
    backlogIdeeen
      .filter(i => !i.geparkeerd && (i.status === "idee" || i.status === "uitgewerkt"))
      .sort((a, b) => (b.aiScore ?? 0) - (a.aiScore ?? 0))
      .slice(0, 3),
    [backlogIdeeen]
  );

  const top3Ids = new Set(top3.map(i => i.id));

  // Parkeerplaats (everything not in top 3)
  const parkeerplaats = useMemo(() => {
    let items = backlogIdeeen.filter(i => !top3Ids.has(i.id));
    if (zoek) {
      const q = zoek.toLowerCase();
      items = items.filter(i => i.naam.toLowerCase().includes(q) || i.omschrijving?.toLowerCase().includes(q));
    }
    if (filterCategorie) items = items.filter(i => i.categorie === filterCategorie);
    if (filterStatus) items = items.filter(i => i.status === filterStatus);

    items.sort((a, b) => {
      if (sortBy === "confidence") return (b.aiScore ?? 0) - (a.aiScore ?? 0);
      if (sortBy === "nieuwste") return new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime();
      return (a.categorie || "").localeCompare(b.categorie || "");
    });
    return items;
  }, [backlogIdeeen, top3Ids, zoek, filterCategorie, filterStatus, sortBy]);

  const selectedIdee = ideeen.find(i => i.id === selectedId) || null;

  return (
    <div className="flex gap-6">
      {/* Left: main content */}
      <div className={cn("flex-1 space-y-6 min-w-0", selectedIdee && "max-w-[60%]")}>
        {/* Hero: Top 3 */}
        {top3.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-autronis-accent" />
              <h2 className="text-sm font-semibold text-autronis-text-primary">Bouw dit als eerste</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((idee) => {
                const breakdown = idee.confidenceBreakdown ? JSON.parse(idee.confidenceBreakdown) : null;
                return (
                  <motion.div
                    key={idee.id}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedId(idee.id)}
                    className="bg-gradient-to-br from-autronis-card to-autronis-card/80 border border-autronis-accent/20 rounded-2xl p-5 cursor-pointer hover:border-autronis-accent/40 transition-all card-glow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <ConfidenceBadge score={idee.aiScore} size="lg" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedId(idee.id); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent text-autronis-bg text-xs font-semibold rounded-lg hover:bg-autronis-accent-hover transition-colors"
                      >
                        <Play className="w-3 h-3" /> Start
                      </button>
                    </div>
                    <h3 className="text-base font-semibold text-autronis-text-primary mb-1 line-clamp-2">{idee.naam}</h3>
                    {idee.omschrijving && (
                      <p className="text-sm text-autronis-text-secondary line-clamp-2 mb-3">{idee.omschrijving}</p>
                    )}
                    {breakdown?.samenvatting && (
                      <p className="text-xs text-autronis-accent/80">{breakdown.samenvatting}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pipeline bar */}
        <PipelineBar ideeen={backlogIdeeen} />

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
            <input
              value={zoek}
              onChange={(e) => setZoek(e.target.value)}
              placeholder="Zoek ideeën..."
              className="w-full pl-9 pr-3 py-2 bg-autronis-bg border border-autronis-border rounded-xl text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:border-autronis-accent/50 outline-none transition-colors"
            />
          </div>
          <select value={filterCategorie || ""} onChange={(e) => setFilterCategorie(e.target.value || null)} className="bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary">
            <option value="">Alle categorieën</option>
            {Object.entries(categorieLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <div className="flex items-center gap-1 bg-autronis-bg border border-autronis-border rounded-xl p-0.5">
            {(["idee", "uitgewerkt", "actief", "gebouwd"] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? null : s)} className={cn("px-2.5 py-1 text-xs rounded-lg transition-colors capitalize", filterStatus === s ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary hover:text-autronis-text-primary")}>
                {s}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2 text-sm text-autronis-text-primary">
            <option value="confidence">Confidence</option>
            <option value="nieuwste">Nieuwste</option>
            <option value="categorie">Categorie</option>
          </select>
        </div>

        {/* Parkeerplaats grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {parkeerplaats.map((idee) => (
            <motion.button
              key={idee.id}
              whileHover={{ x: 2 }}
              onClick={() => setSelectedId(idee.id)}
              className={cn(
                "w-full text-left bg-autronis-bg/30 rounded-xl border pl-4 pr-5 py-3.5 hover:border-autronis-accent/30 transition-colors group",
                selectedId === idee.id ? "border-autronis-accent/50" : "border-autronis-border/50",
                idee.geparkeerd && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                <ConfidenceBadge score={idee.aiScore} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-autronis-text-primary truncate">{idee.naam}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {idee.categorie && (
                      <span className="text-xs text-autronis-text-secondary/70">{categorieLabels[idee.categorie] || idee.categorie}</span>
                    )}
                    {idee.geparkeerd ? <span className="text-xs text-amber-400/70">Geparkeerd</span> : null}
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
        {parkeerplaats.length === 0 && (
          <p className="text-sm text-autronis-text-secondary text-center py-8">Geen ideeën gevonden</p>
        )}
      </div>

      {/* Right: detail panel */}
      <AnimatePresence>
        {selectedIdee && (
          <div className="w-[40%] shrink-0">
            <IdeeDetailPanel
              key={selectedIdee.id}
              idee={selectedIdee}
              onClose={() => setSelectedId(null)}
              onDaanSpar={() => onDaanSpar(selectedIdee)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ideeen/decide-tab.tsx
git commit -m "feat(ideeen): add Decide tab with top 3 hero and parkeerplaats grid"
```

---

## Task 10: Capture Tab Component

**Files:**
- Create: `src/app/(dashboard)/ideeen/capture-tab.tsx`

- [ ] **Step 1: Create capture tab**

Create `src/app/(dashboard)/ideeen/capture-tab.tsx`:

```typescript
"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Mic, TrendingUp, Sparkles, Trash2, ArrowRight, Loader2,
  MessageSquare, Search as SearchIcon, Radio,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateIdee,
  useDeleteIdee,
  useUpdateIdee,
  useGenereerIdeeen,
} from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";

const bronIcons: Record<string, { icon: typeof Mic; label: string; color: string }> = {
  meeting: { icon: Mic, label: "Meeting", color: "text-blue-400 bg-blue-400/10" },
  lead: { icon: TrendingUp, label: "Lead", color: "text-emerald-400 bg-emerald-400/10" },
  radar: { icon: Radio, label: "Radar", color: "text-purple-400 bg-purple-400/10" },
};

interface CaptureTabProps {
  ideeen: Idee[];
}

export function CaptureTab({ ideeen }: CaptureTabProps) {
  const { addToast } = useToast();
  const [input, setInput] = useState("");
  const createMutation = useCreateIdee();
  const deleteMutation = useDeleteIdee();
  const updateMutation = useUpdateIdee();
  const genereerMutation = useGenereerIdeeen();

  // Auto-captures: inzichten with a bron field
  const autoCaptures = useMemo(() =>
    ideeen
      .filter(i => i.categorie === "inzicht" && i.bron)
      .sort((a, b) => new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime()),
    [ideeen]
  );

  // Manual captures: inzichten without bron
  const handmatig = useMemo(() =>
    ideeen
      .filter(i => i.categorie === "inzicht" && !i.bron)
      .sort((a, b) => new Date(b.aangemaaktOp).getTime() - new Date(a.aangemaaktOp).getTime()),
    [ideeen]
  );

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    createMutation.mutate(
      { naam: input.trim(), categorie: "inzicht", status: "idee" },
      {
        onSuccess: () => { setInput(""); addToast("Idee vastgelegd", "succes"); },
        onError: () => addToast("Kon idee niet opslaan", "fout"),
      }
    );
  }, [input, createMutation, addToast]);

  const handlePromoveer = useCallback((id: number) => {
    updateMutation.mutate(
      { id, body: { categorie: "experimenteel", isAiSuggestie: 0, gepromoveerd: 1 } },
      {
        onSuccess: () => addToast("Toegevoegd aan backlog", "succes"),
        onError: () => addToast("Promoveren mislukt", "fout"),
      }
    );
  }, [updateMutation, addToast]);

  const handleNegeer = useCallback((id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => addToast("Verwijderd", "succes"),
      onError: () => addToast("Verwijderen mislukt", "fout"),
    });
  }, [deleteMutation, addToast]);

  const bronType = (bron: string) => bron.split(":")[0];

  return (
    <div className="space-y-6">
      {/* Quick input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Noteer een idee, inzicht, of kans..."
            className="w-full pl-9 pr-3 py-3 bg-autronis-card border border-autronis-border rounded-xl text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:border-autronis-accent/50 outline-none transition-colors"
          />
        </div>
        <button onClick={handleSubmit} disabled={!input.trim() || createMutation.isPending} className="px-4 py-3 bg-autronis-accent text-autronis-bg text-sm font-semibold rounded-xl hover:bg-autronis-accent-hover transition-colors disabled:opacity-50">
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vastleggen"}
        </button>
      </div>

      {/* Generate button */}
      <button
        onClick={() => genereerMutation.mutate(undefined, {
          onSuccess: (data) => addToast(`${data.resultaat?.aangemaakt || 0} ideeën gegenereerd`, "succes"),
          onError: () => addToast("Genereren mislukt", "fout"),
        })}
        disabled={genereerMutation.isPending}
        className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border border-autronis-border rounded-xl text-sm text-autronis-text-primary hover:border-autronis-accent/30 transition-colors"
      >
        {genereerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-autronis-accent" />}
        AI: Genereer ideeën
      </button>

      {/* Auto-capture feed */}
      {autoCaptures.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-autronis-accent" />
            Automatisch gevangen
            <span className="text-autronis-text-secondary/50 font-normal">({autoCaptures.length})</span>
          </h3>
          <div className="space-y-2">
            {autoCaptures.map((item) => {
              const bt = bronType(item.bron!);
              const bronInfo = bronIcons[bt] || bronIcons.meeting;
              const Icon = bronInfo.icon;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl px-4 py-3 flex items-start gap-3"
                >
                  <div className={cn("p-2 rounded-lg shrink-0", bronInfo.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-autronis-text-primary">{item.naam}</p>
                    {item.bronTekst && (
                      <p className="text-xs text-autronis-text-secondary mt-0.5 line-clamp-2 italic">"{item.bronTekst}"</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-autronis-text-secondary/60">{bronInfo.label}</span>
                      <span className="text-xs text-autronis-text-secondary/40">{formatDatum(item.aangemaaktOp)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handlePromoveer(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-autronis-accent/10 text-autronis-accent text-xs font-medium rounded-lg hover:bg-autronis-accent/20 transition-colors">
                      <ArrowRight className="w-3 h-3" /> Backlog
                    </button>
                    <button onClick={() => handleNegeer(item.id)} className="p-1.5 text-autronis-text-secondary hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual notes */}
      {handmatig.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">
            Handmatig vastgelegd
            <span className="text-autronis-text-secondary/50 font-normal ml-2">({handmatig.length})</span>
          </h3>
          <div className="space-y-2">
            {handmatig.map((item) => (
              <div key={item.id} className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-autronis-text-primary">{item.naam}</p>
                  <span className="text-xs text-autronis-text-secondary/60">{formatDatum(item.aangemaaktOp)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => handlePromoveer(item.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-autronis-accent/10 text-autronis-accent text-xs font-medium rounded-lg hover:bg-autronis-accent/20 transition-colors">
                    <ArrowRight className="w-3 h-3" /> Backlog
                  </button>
                  <button onClick={() => handleNegeer(item.id)} className="p-1.5 text-autronis-text-secondary hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {autoCaptures.length === 0 && handmatig.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex p-4 bg-autronis-accent/10 rounded-2xl mb-4">
            <Sparkles className="w-8 h-8 text-autronis-accent" />
          </div>
          <p className="text-autronis-text-primary font-medium mb-1">Nog geen captures</p>
          <p className="text-sm text-autronis-text-secondary">Typ een idee hierboven, of wacht op auto-captures uit meetings en leads</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/ideeen/capture-tab.tsx
git commit -m "feat(ideeen): add Capture tab with quick input and auto-capture feed"
```

---

## Task 11: Rewrite Main Page

**Files:**
- Modify: `src/app/(dashboard)/ideeen/page.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite the main page**

Replace the entire content of `src/app/(dashboard)/ideeen/page.tsx` with:

```typescript
"use client";

import { useState, useCallback } from "react";
import { Lightbulb, Crosshair, Inbox, Settings2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { useIdeeen, useConfidenceRecalc } from "@/hooks/queries/use-ideeen";
import type { Idee } from "@/hooks/queries/use-ideeen";
import { DecideTab } from "./decide-tab";
import { CaptureTab } from "./capture-tab";

export default function IdeeenPage() {
  const { addToast } = useToast();
  const { data: ideeen = [], isLoading } = useIdeeen();
  const confidenceRecalc = useConfidenceRecalc();
  const [activeTab, setActiveTab] = useState<"decide" | "capture">("decide");

  // DAAN spar state (reuse existing pattern)
  const [daanOpen, setDaanOpen] = useState(false);
  const [daanIdee, setDaanIdee] = useState<Idee | null>(null);

  const handleDaanSpar = useCallback((idee: Idee) => {
    setDaanIdee(idee);
    setDaanOpen(true);
  }, []);

  const handleRecalcAll = useCallback(() => {
    confidenceRecalc.mutate(undefined, {
      onSuccess: (data) => addToast(`${data.bijgewerkt} ideeën herberekend`, "succes"),
      onError: () => addToast("Herberekening mislukt", "fout"),
    });
  }, [confidenceRecalc, addToast]);

  const captureCount = ideeen.filter(i => i.categorie === "inzicht").length;

  if (isLoading) {
    return (
      <PageTransition>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-3">
              <Lightbulb className="w-6 h-6 text-autronis-accent" />
              Ideeën
            </h1>
            <p className="text-sm text-autronis-text-secondary mt-1">Focus op wat je moet bouwen</p>
          </div>
          <button
            onClick={handleRecalcAll}
            disabled={confidenceRecalc.isPending}
            className="flex items-center gap-2 px-3 py-2 text-sm text-autronis-text-secondary hover:text-autronis-text-primary bg-autronis-bg border border-autronis-border rounded-xl hover:border-autronis-accent/30 transition-colors"
          >
            <Settings2 className={cn("w-4 h-4", confidenceRecalc.isPending && "animate-spin")} />
            {confidenceRecalc.isPending ? "Berekenen..." : "Herbereken scores"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-autronis-bg border border-autronis-border rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("decide")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors",
              activeTab === "decide" ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            <Crosshair className="w-4 h-4" /> Decide
          </button>
          <button
            onClick={() => setActiveTab("capture")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors",
              activeTab === "capture" ? "bg-autronis-accent text-autronis-bg font-semibold" : "text-autronis-text-secondary hover:text-autronis-text-primary"
            )}
          >
            <Inbox className="w-4 h-4" /> Capture
            {captureCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs rounded-full bg-autronis-accent/20 text-autronis-accent tabular-nums">{captureCount}</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "decide" ? (
          <DecideTab ideeen={ideeen} onDaanSpar={handleDaanSpar} />
        ) : (
          <CaptureTab ideeen={ideeen} />
        )}
      </div>
    </PageTransition>
  );
}
```

Note: The DAAN spar modal will need to be re-integrated from the old code. For now the state is set up (`daanOpen`, `daanIdee`) but the modal JSX needs to be copied from the previous version. This is a follow-up step.

- [ ] **Step 2: Copy DAAN spar modal from old page**

From the old `page.tsx` (backed up via git), copy the DAAN spar modal JSX (approximately lines 1447-1536 of the old file) and add it to the new page, before the closing `</PageTransition>`. Wrap it in `{daanOpen && daanIdee && ( ... )}`.

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors (fix any missing type imports)

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/ideeen/page.tsx
git commit -m "feat(ideeen): rewrite main page with Decide/Capture tabs"
```

---

## Task 12: Final Integration & Verification

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Start dev server and test**

Run: `npm run dev`

Test the following flows:
1. Navigate to /ideeen — should show Decide tab with top 3 hero (if ideas have confidence scores)
2. Click "Herbereken scores" — should recalculate confidence for all ideas
3. Click an idea in the parkeerplaats — detail panel opens on the right
4. In detail panel: click "Start project" — preview should load inline
5. Switch to Capture tab — should show quick input and any auto-captures
6. Type an idea and press Enter — should create a new inzicht
7. Click "AI: Genereer ideeën" — should generate new ideas

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(ideeen): integration fixes from testing"
```
