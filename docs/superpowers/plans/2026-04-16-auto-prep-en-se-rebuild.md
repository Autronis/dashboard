# Auto-Prep Alle Leads + SE Rebuild Voorstel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Prep alle zichtbare" batch button to the rebuild-prep page and a "Website Rebuild Voorstel" card to every completed Sales Engine scan detail page.

**Architecture:** Feature A adds client-side chunk processing to the existing rebuild-prep page — no API changes. Feature B adds a new card component to the SE detail page that generates prompts client-side using existing `buildUpgradePrompt`/`buildFreshPrompt` functions with converted SE scrape data.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, lucide-react

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/(dashboard)/leads/rebuild-prep/page.tsx` | Modify | Add batch button, progress bar, stop/cancel, chunk processing |
| `src/app/(dashboard)/sales-engine/[id]/page.tsx` | Modify | Add WebsiteRebuildCard component + seScrapeToMarkdown helper |

No new files. No API changes. No DB changes.

---

## Task 1: "Prep alle zichtbare" batch processing state + logic

**Files:**
- Modify: `src/app/(dashboard)/leads/rebuild-prep/page.tsx:60-75` (state declarations)

- [ ] **Step 1: Add batch state variables and abort ref**

In `LeadsRebuildPrepPage`, after the existing state declarations (line 74), add:

```typescript
const [batchPrepping, setBatchPrepping] = useState(false);
const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, chunk: 0, totalChunks: 0 });
const [batchSkipped, setBatchSkipped] = useState(0);
const batchAbortRef = useRef(false);
```

Add `useRef` to the React import on line 3:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Add the batch processing function**

After the existing `runPrep` function (after line 243), add:

```typescript
async function runBatchPrep() {
  const allIds = gefilterd.map((l) => l.id);
  if (allIds.length === 0) return;

  batchAbortRef.current = false;
  setBatchPrepping(true);
  setBatchSkipped(0);
  setResults([]);

  const chunks: string[][] = [];
  for (let i = 0; i < allIds.length; i += BATCH_LIMIT) {
    chunks.push(allIds.slice(i, i + BATCH_LIMIT));
  }

  setBatchProgress({ done: 0, total: allIds.length, chunk: 0, totalChunks: chunks.length });
  const accumulated: PrepLeadResult[] = [];
  let skipped = 0;

  for (let c = 0; c < chunks.length; c++) {
    if (batchAbortRef.current) break;

    setBatchProgress((prev) => ({ ...prev, chunk: c + 1 }));

    try {
      const res = await fetch("/api/leads/prep-rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: chunks[c] }),
      });
      const data = await res.json();
      if (!res.ok) {
        skipped += chunks[c].length;
        setBatchSkipped(skipped);
        continue;
      }
      const newResults: PrepLeadResult[] = data.resultaten ?? [];
      accumulated.push(...newResults);
      setResults([...accumulated]);
      setBatchProgress((prev) => ({ ...prev, done: accumulated.length + skipped }));
    } catch {
      skipped += chunks[c].length;
      setBatchSkipped(skipped);
    }
  }

  setBatchPrepping(false);
  const verb = batchAbortRef.current ? "Gestopt" : "Klaar";
  addToast(`${verb}: ${accumulated.length} geprepareerd${skipped > 0 ? `, ${skipped} overgeslagen` : ""}`, "succes");
}

function stopBatchPrep() {
  batchAbortRef.current = true;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/leads/rebuild-prep/page.tsx
git commit -m "feat(rebuild-prep): add batch processing state and logic"
```

---

## Task 2: "Prep alle zichtbare" UI — button + progress bar

**Files:**
- Modify: `src/app/(dashboard)/leads/rebuild-prep/page.tsx:279-305` (button area)

- [ ] **Step 1: Add the "Prep alle zichtbare" button next to existing buttons**

Replace the button group div (lines 279-304) with:

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={selectFirstVisible}
    disabled={gefilterd.length === 0}
    className="px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-sm text-autronis-text hover:border-autronis-accent transition disabled:opacity-50"
  >
    Selecteer eerste {Math.min(BATCH_LIMIT, gefilterd.length)}
  </button>
  <button
    onClick={runPrep}
    disabled={selectedIds.size === 0 || preppingLoader || batchPrepping}
    className="px-4 py-2 rounded-lg bg-autronis-accent text-black text-sm font-semibold hover:bg-autronis-accent-hover transition disabled:opacity-50 inline-flex items-center gap-2"
  >
    {preppingLoader ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Bezig...
      </>
    ) : (
      <>
        <Sparkles className="w-4 h-4" />
        Prep {selectedIds.size || ""} leads
      </>
    )}
  </button>
  <button
    onClick={runBatchPrep}
    disabled={gefilterd.length === 0 || batchPrepping || preppingLoader}
    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition disabled:opacity-50 inline-flex items-center gap-2"
  >
    {batchPrepping ? (
      <>
        <Loader2 className="w-4 h-4 animate-spin" />
        Bezig...
      </>
    ) : (
      <>
        <Sparkles className="w-4 h-4" />
        Prep alle {gefilterd.length}
      </>
    )}
  </button>
</div>
```

- [ ] **Step 2: Add progress bar below the filter row**

After the error block (after line 359), before the loading check, add:

```tsx
{batchPrepping && (
  <div className="mb-4 p-4 rounded-xl bg-autronis-card border border-autronis-accent/30">
    <div className="flex items-center justify-between mb-2">
      <div className="text-sm text-autronis-text">
        Chunk {batchProgress.chunk}/{batchProgress.totalChunks} — {batchProgress.done} van {batchProgress.total} leads verwerkt
        {batchSkipped > 0 && <span className="text-amber-400 ml-2">({batchSkipped} overgeslagen)</span>}
      </div>
      <button
        onClick={stopBatchPrep}
        className="px-3 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30 transition"
      >
        Stop
      </button>
    </div>
    <div className="w-full h-2 rounded-full bg-autronis-border">
      <div
        className="h-full rounded-full bg-autronis-accent transition-all duration-300"
        style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Update description text to remove "Max 20 per batch" since batch mode exists now**

On line 276, change the `<p>` description to:

```tsx
<p className="text-autronis-text-muted mt-1 max-w-2xl">
  Batch-tool voor alle leads. Leads <b>zonder</b> website krijgen
  een SERP-check + &quot;from scratch&quot; prompt. Leads <b>mét</b>{" "}
  website worden gescraped voor een upgrade-pitch. &quot;Prep alle&quot;
  verwerkt alles in chunks van {BATCH_LIMIT}.
</p>
```

- [ ] **Step 4: Verify in browser**

Run: `npm run dev` (if not already running)

Open: `http://localhost:3000/leads/rebuild-prep`

Verify:
- "Prep alle [N]" button appears next to existing buttons
- Clicking it shows progress bar with chunk counter
- Results stream in as chunks complete
- Stop button halts processing
- Existing "Prep N leads" (selection-based) still works

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/leads/rebuild-prep/page.tsx
git commit -m "feat(rebuild-prep): prep-alle-zichtbare button with progress bar"
```

---

## Task 3: Website Rebuild Voorstel card on SE detail page

**Files:**
- Modify: `src/app/(dashboard)/sales-engine/[id]/page.tsx`

- [ ] **Step 1: Add imports for rebuild functions and Copy/Check icons**

At the top of the file, add these imports (after existing imports, around line 35):

```typescript
import { buildUpgradePrompt, buildFreshPrompt, type SiteScrape, type SerpCheck } from "@/lib/lead-rebuild-prep";
import { classifyFit } from "@/lib/lead-rebuild-fit";
import { Copy, Check, Sparkles as SparklesIcon } from "lucide-react";
```

Note: `Copy` and `Check` need to be added to the existing lucide-react import. `Sparkles` may conflict with existing imports — use `SparklesIcon` alias if needed, or just add `Copy` and `Check` to the existing import block. Check the existing imports first — `Sparkles` is not imported yet in this file.

The existing lucide-react import (lines 11-34) already imports many icons. Add `Copy`, `Check`, `Sparkles` to that import:

```typescript
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  User,
  AlertTriangle,
  Wrench,
  MessageSquare,
  Globe,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Calculator,
  Gauge,
  FileText,
  UserPlus,
  Mail,
  Loader2,
  RefreshCw,
  Rocket,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
```

Add the lib imports after lucide-react:

```typescript
import { buildUpgradePrompt, buildFreshPrompt, type SiteScrape, type SerpCheck } from "@/lib/lead-rebuild-prep";
import { classifyFit } from "@/lib/lead-rebuild-fit";
```

- [ ] **Step 2: Add the seScrapeToMarkdown helper and WebsiteRebuildCard component**

After the `ScanProgressIndicator` component (after line 350), add:

```typescript
function seScrapeToMarkdown(scrapeData: ScrapeResultaat): string {
  const parts: string[] = [];
  if (scrapeData.homepage.title) parts.push(`# ${scrapeData.homepage.title}`);
  for (const h of scrapeData.homepage.headings) parts.push(`## ${h}`);
  if (scrapeData.homepage.bodyText) parts.push(scrapeData.homepage.bodyText);
  for (const sub of scrapeData.subpaginas ?? []) {
    if (sub.title) parts.push(`\n## ${sub.title}`);
    if (sub.bodyText) parts.push(sub.bodyText);
  }
  return parts.join("\n\n");
}

function WebsiteRebuildCard({
  scan,
  scrapeResultaat,
  bedrijfsnaam,
}: {
  scan: ScanDetail["scan"];
  scrapeResultaat: ScrapeResultaat;
  bedrijfsnaam: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasWebsite = !!scan.websiteUrl;
  const category = scrapeResultaat.googlePlaces?.categorieen?.[0] ?? null;
  const fit = classifyFit(category, bedrijfsnaam);

  let prompt: string;
  if (hasWebsite) {
    const markdown = seScrapeToMarkdown(scrapeResultaat);
    const scrape: SiteScrape = {
      ran: true,
      url: scan.websiteUrl,
      title: scrapeResultaat.homepage.title || null,
      markdown: markdown || null,
      error: null,
      source: "custom",
    };
    prompt = buildUpgradePrompt({
      name: bedrijfsnaam,
      location: scrapeResultaat.googlePlaces?.adres ?? null,
      category,
      fit,
      scrape,
    });
  } else {
    const serp: SerpCheck = {
      ran: false,
      verdict: "skipped",
      foundUrl: null,
      candidates: [],
      note: "Sales Engine scan — geen website",
    };
    prompt = buildFreshPrompt({
      name: bedrijfsnaam,
      location: scrapeResultaat.googlePlaces?.adres ?? null,
      category,
      fit,
      serp,
    });
  }

  const previewLines = prompt.split("\n").slice(0, 5).join("\n");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API failed
    }
  }

  const fitStyles =
    fit.verdict === "scroll_stop_good"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : fit.verdict === "static_upgrade"
        ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
        : "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent)]" />
          Website Rebuild Voorstel
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              copied
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-[var(--card)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]/40"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Gekopieerd" : "Kopieer prompt"}
          </button>
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black text-xs font-semibold hover:opacity-90 transition"
          >
            claude.ai
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-0.5 rounded-md text-xs border ${
          hasWebsite
            ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
            : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        }`}>
          {hasWebsite ? "Upgrade" : "Fresh"}
        </span>
        <span className={`px-2 py-0.5 rounded-md text-xs border ${fitStyles}`}>
          {fit.label}
        </span>
      </div>

      <div className="relative">
        <pre
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-3 cursor-pointer overflow-hidden whitespace-pre-wrap"
          style={{ maxHeight: expanded ? "none" : "7rem" }}
        >
          {expanded ? prompt : previewLines + "\n..."}
        </pre>
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--bg)] to-transparent rounded-b-lg pointer-events-none" />
        )}
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-[var(--accent)] hover:underline mt-1"
      >
        {expanded ? "Inklappen" : "Volledig tonen"}
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 3: Render the WebsiteRebuildCard in the page**

In the `ScanDetailPage` component, between the "Automatiseringskansen" section (ends around line 802) and the "Samenvatting" section (starts at line 804), add:

```tsx
{/* Website Rebuild Voorstel */}
{scan.status === "completed" && scrapeResultaat && (
  <WebsiteRebuildCard
    scan={scan}
    scrapeResultaat={scrapeResultaat}
    bedrijfsnaam={lead?.bedrijfsnaam ?? "Onbekend bedrijf"}
  />
)}
```

- [ ] **Step 4: Verify in browser**

Open: `http://localhost:3000/sales-engine/[pick-a-completed-scan-id]`

Verify:
- "Website Rebuild Voorstel" card appears after automatiseringskansen
- Mode badge shows "Upgrade" (since SE scans always have a website)
- Sector-fit badge is present
- "Kopieer prompt" copies to clipboard
- "claude.ai" link opens new tab
- Prompt preview shows 5 lines, click expands to full
- Card has teal accent border matching the samenvatting style

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/sales-engine/\[id\]/page.tsx
git commit -m "feat(sales-engine): website rebuild voorstel card on scan detail"
```

---

## Task 4: TypeScript check + final verification

**Files:** None new — just verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: 0 errors. If there are errors, fix them:
- Common issue: `SiteScrape.source` expects `ScrapeSource` type which includes `"jina" | "custom"`. We pass `"custom"` — check the type definition in `src/lib/scraper.ts`.
- Common issue: `ScanDetail` type might not be exported. It IS exported via `use-sales-engine.ts` line 204.

- [ ] **Step 2: Verify both features end-to-end in browser**

1. `/leads/rebuild-prep` — click "Prep alle" on a small filtered set (e.g. filter "met site", search for a specific name to get ~5 leads). Confirm progress bar, results streaming, stop button.
2. `/sales-engine/[id]` — open a completed scan. Confirm rebuild card, copy prompt, expand/collapse.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: typescript and verification fixes for auto-prep + SE rebuild"
```
