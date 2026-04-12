# Action Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile bottom nav and desktop FAB with a context-aware Action Dock that shows 5 shortcuts + overflow based on the current route, visible on both mobile and desktop.

**Architecture:** Single `ActionDock` component rendered responsively (bottom bar on mobile, floating pill on desktop). A central action registry maps routes to shortcut IDs. Handlers are navigation-based (router.push with query params) for v1 — no modal store refactor needed. The old `BottomNav` and `QuickActionButton` components are deleted.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Framer Motion, lucide-react, Zustand, vitest

**Spec:** `docs/superpowers/specs/2026-04-12-action-dock-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/layout/action-registry.ts` | Types, ACTIONS record, SHORTCUTS_BY_ROUTE, getShortcutsForRoute helper |
| Create | `src/components/layout/action-registry.test.ts` | Unit tests for getShortcutsForRoute |
| Create | `src/hooks/use-action-shortcuts.ts` | Hook that wires registry with router + pathname |
| Create | `src/components/layout/action-dock.tsx` | The dock component (mobile + desktop) |
| Create | `src/components/layout/action-dock-overflow.tsx` | Overflow sheet with all actions |
| Modify | `src/components/layout/app-shell.tsx` | Replace BottomNav/FAB with ActionDock, add command palette event listener, update padding |
| Delete | `src/components/layout/bottom-nav.tsx` | Removed |
| Delete | `src/components/ui/quick-action-button.tsx` | Removed |

---

### Task 1: Action registry with pure helper + tests

**Files:**
- Create: `src/components/layout/action-registry.ts`
- Create: `src/components/layout/action-registry.test.ts`

- [ ] **Step 1: Write the failing test for getShortcutsForRoute**

Create `src/components/layout/action-registry.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getShortcutsForRoute, FALLBACK_SHORTCUTS } from "./action-registry";

describe("getShortcutsForRoute", () => {
  it("returns exact match for known route", () => {
    const result = getShortcutsForRoute("/ideeen");
    expect(result).toContain("idee-nieuw");
    expect(result).toContain("idee-voer-uit");
  });

  it("returns prefix match for sub-routes", () => {
    const result = getShortcutsForRoute("/financien/nieuw");
    expect(result).toContain("factuur-nieuw");
  });

  it("returns longest prefix match when multiple prefixes apply", () => {
    // /klanten is a route, /klanten/123 should still match /klanten
    const result = getShortcutsForRoute("/klanten/123");
    expect(result).toContain("klant-nieuw");
  });

  it("returns exactly 5 shortcuts for main routes", () => {
    expect(getShortcutsForRoute("/")).toHaveLength(5);
    expect(getShortcutsForRoute("/taken")).toHaveLength(5);
    expect(getShortcutsForRoute("/ideeen")).toHaveLength(5);
  });

  it("returns fallback for unknown routes", () => {
    const result = getShortcutsForRoute("/unknown-route-xyz");
    expect(result).toEqual(FALLBACK_SHORTCUTS);
  });

  it("returns fallback for empty string", () => {
    const result = getShortcutsForRoute("");
    expect(result).toEqual(FALLBACK_SHORTCUTS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx vitest run src/components/layout/action-registry.test.ts 2>&1 | tail -20
```
Expected: FAIL — module `./action-registry` not found.

- [ ] **Step 3: Create the action registry with types and route mapping**

Create `src/components/layout/action-registry.ts`:

```typescript
import type { LucideIcon } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  Zap, CheckSquare, Lightbulb, FileText, Search, Rocket, Inbox, Sparkles,
  Play, Calendar, CheckCircle, Target, Receipt, Landmark, BarChart3, RefreshCw,
  User, Phone, StickyNote, Mail, Home, Clock, Briefcase, TrendingUp, Users,
  ArrowRight, BookOpen, Download, Bookmark, ShieldOff, Pause, LayoutDashboard,
} from "lucide-react";

export type ActionId =
  | "timer-start"
  | "taak-nieuw"
  | "idee-nieuw"
  | "idee-voer-uit"
  | "idee-backlog"
  | "ai-brainstorm"
  | "dagritme"
  | "search"
  | "timer-op-taak"
  | "plan-agenda"
  | "taak-klaar"
  | "focus"
  | "factuur-nieuw"
  | "uitgave-nieuw"
  | "bank-import"
  | "btw-aangifte"
  | "revolut-sync"
  | "klant-nieuw"
  | "lead-nieuw"
  | "offerte-nieuw"
  | "notitie-nieuw"
  | "mail-nieuw"
  | "timer-toggle"
  | "tijd-handmatig"
  | "locatie-toggle"
  | "tijd-week"
  | "focus-sessie"
  | "project-nieuw"
  | "project-voortgang"
  | "teamlid-toevoegen"
  | "agenda-nieuw"
  | "agenda-vandaag"
  | "google-sync"
  | "meeting-plannen"
  | "wiki-nieuw"
  | "wiki-zoek"
  | "wiki-import"
  | "second-brain-save"
  | "focus-start"
  | "focus-block"
  | "focus-pauze"
  | "focus-stats"
  | "lead-converteren"
  | "pipeline-view"
  | "followup-sturen"
  | "dashboard";

export interface ActionContext {
  router: AppRouterInstance;
  pathname: string;
  openCommandPalette: () => void;
  addToast: (bericht: string, type?: "succes" | "fout" | "info") => void;
}

export interface ActionDef {
  id: ActionId;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  handler: (ctx: ActionContext) => void;
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  "timer-start": {
    id: "timer-start",
    label: "Timer starten",
    icon: Zap,
    shortcut: "S",
    handler: (ctx) => ctx.router.push("/tijd?start=true"),
  },
  "taak-nieuw": {
    id: "taak-nieuw",
    label: "Nieuwe taak",
    icon: CheckSquare,
    shortcut: "N",
    handler: (ctx) => ctx.router.push("/taken?nieuw=true"),
  },
  "idee-nieuw": {
    id: "idee-nieuw",
    label: "Nieuw idee",
    icon: Lightbulb,
    handler: (ctx) => ctx.router.push("/ideeen?nieuw=true"),
  },
  "idee-voer-uit": {
    id: "idee-voer-uit",
    label: "Voer idee uit",
    icon: Rocket,
    handler: (ctx) => ctx.router.push("/ideeen?voerUit=true"),
  },
  "idee-backlog": {
    id: "idee-backlog",
    label: "Naar backlog",
    icon: Inbox,
    handler: (ctx) => ctx.router.push("/ideeen?tab=backlog"),
  },
  "ai-brainstorm": {
    id: "ai-brainstorm",
    label: "AI brainstorm",
    icon: Sparkles,
    handler: (ctx) => ctx.router.push("/ideeen?ai=true"),
  },
  "dagritme": {
    id: "dagritme",
    label: "Dagritme",
    icon: Clock,
    handler: (ctx) => ctx.router.push("/dagritme"),
  },
  "search": {
    id: "search",
    label: "Zoeken",
    icon: Search,
    shortcut: "⌘K",
    handler: (ctx) => ctx.openCommandPalette(),
  },
  "timer-op-taak": {
    id: "timer-op-taak",
    label: "Timer op taak",
    icon: Play,
    handler: (ctx) => ctx.router.push("/tijd?start=true"),
  },
  "plan-agenda": {
    id: "plan-agenda",
    label: "Plan in agenda",
    icon: Calendar,
    handler: (ctx) => ctx.router.push("/agenda?plan=true"),
  },
  "taak-klaar": {
    id: "taak-klaar",
    label: "Markeer klaar",
    icon: CheckCircle,
    handler: (ctx) => ctx.addToast("Selecteer een taak om klaar te markeren", "info"),
  },
  "focus": {
    id: "focus",
    label: "Focus mode",
    icon: Target,
    handler: (ctx) => ctx.router.push("/focus"),
  },
  "factuur-nieuw": {
    id: "factuur-nieuw",
    label: "Nieuwe factuur",
    icon: FileText,
    handler: (ctx) => ctx.router.push("/financien/nieuw"),
  },
  "uitgave-nieuw": {
    id: "uitgave-nieuw",
    label: "Uitgave",
    icon: Receipt,
    handler: (ctx) => ctx.router.push("/financien?tab=uitgaven&nieuw=true"),
  },
  "bank-import": {
    id: "bank-import",
    label: "Bank import",
    icon: Landmark,
    handler: (ctx) => ctx.router.push("/financien?tab=bank"),
  },
  "btw-aangifte": {
    id: "btw-aangifte",
    label: "BTW aangifte",
    icon: BarChart3,
    handler: (ctx) => ctx.router.push("/belasting"),
  },
  "revolut-sync": {
    id: "revolut-sync",
    label: "Revolut sync",
    icon: RefreshCw,
    handler: (ctx) => ctx.router.push("/financien?sync=revolut"),
  },
  "klant-nieuw": {
    id: "klant-nieuw",
    label: "Nieuwe klant",
    icon: User,
    handler: (ctx) => ctx.router.push("/klanten?nieuw=true"),
  },
  "lead-nieuw": {
    id: "lead-nieuw",
    label: "Nieuwe lead",
    icon: Phone,
    handler: (ctx) => ctx.router.push("/leads?nieuw=true"),
  },
  "offerte-nieuw": {
    id: "offerte-nieuw",
    label: "Nieuwe offerte",
    icon: FileText,
    handler: (ctx) => ctx.router.push("/offertes/nieuw"),
  },
  "notitie-nieuw": {
    id: "notitie-nieuw",
    label: "Notitie",
    icon: StickyNote,
    handler: (ctx) => ctx.addToast("Selecteer een klant voor een notitie", "info"),
  },
  "mail-nieuw": {
    id: "mail-nieuw",
    label: "Mail",
    icon: Mail,
    handler: (ctx) => ctx.router.push("/mail"),
  },
  "timer-toggle": {
    id: "timer-toggle",
    label: "Timer start/stop",
    icon: Play,
    handler: (ctx) => ctx.router.push("/tijd?toggle=true"),
  },
  "tijd-handmatig": {
    id: "tijd-handmatig",
    label: "Handmatige registratie",
    icon: FileText,
    handler: (ctx) => ctx.router.push("/tijd?handmatig=true"),
  },
  "locatie-toggle": {
    id: "locatie-toggle",
    label: "Thuis/kantoor",
    icon: Home,
    handler: (ctx) => ctx.addToast("Selecteer een sessie om locatie te wijzigen", "info"),
  },
  "tijd-week": {
    id: "tijd-week",
    label: "Week overzicht",
    icon: BarChart3,
    handler: (ctx) => ctx.router.push("/tijd?view=week"),
  },
  "focus-sessie": {
    id: "focus-sessie",
    label: "Focus sessie",
    icon: Target,
    handler: (ctx) => ctx.router.push("/focus"),
  },
  "project-nieuw": {
    id: "project-nieuw",
    label: "Nieuw project",
    icon: Briefcase,
    handler: (ctx) => ctx.router.push("/projecten?nieuw=true"),
  },
  "project-voortgang": {
    id: "project-voortgang",
    label: "Voortgang",
    icon: TrendingUp,
    handler: (ctx) => ctx.addToast("Selecteer een project om voortgang bij te werken", "info"),
  },
  "teamlid-toevoegen": {
    id: "teamlid-toevoegen",
    label: "Teamlid",
    icon: Users,
    handler: (ctx) => ctx.router.push("/team?nieuw=true"),
  },
  "agenda-nieuw": {
    id: "agenda-nieuw",
    label: "Nieuwe afspraak",
    icon: Calendar,
    handler: (ctx) => ctx.router.push("/agenda?nieuw=true"),
  },
  "agenda-vandaag": {
    id: "agenda-vandaag",
    label: "Vandaag",
    icon: Calendar,
    handler: (ctx) => ctx.router.push("/agenda?datum=vandaag"),
  },
  "google-sync": {
    id: "google-sync",
    label: "Google sync",
    icon: RefreshCw,
    handler: (ctx) => ctx.router.push("/agenda?sync=google"),
  },
  "meeting-plannen": {
    id: "meeting-plannen",
    label: "Meeting",
    icon: Users,
    handler: (ctx) => ctx.router.push("/meetings?nieuw=true"),
  },
  "wiki-nieuw": {
    id: "wiki-nieuw",
    label: "Nieuwe pagina",
    icon: BookOpen,
    handler: (ctx) => ctx.router.push("/wiki/nieuw"),
  },
  "wiki-zoek": {
    id: "wiki-zoek",
    label: "Zoek in wiki",
    icon: Search,
    handler: (ctx) => ctx.openCommandPalette(),
  },
  "wiki-import": {
    id: "wiki-import",
    label: "Import URL",
    icon: Download,
    handler: (ctx) => ctx.router.push("/wiki?import=true"),
  },
  "second-brain-save": {
    id: "second-brain-save",
    label: "Second Brain",
    icon: Bookmark,
    handler: (ctx) => ctx.router.push("/second-brain?nieuw=true"),
  },
  "focus-start": {
    id: "focus-start",
    label: "Start focus",
    icon: Target,
    handler: (ctx) => ctx.router.push("/focus?start=true"),
  },
  "focus-block": {
    id: "focus-block",
    label: "Block distractions",
    icon: ShieldOff,
    handler: (ctx) => ctx.router.push("/focus?block=true"),
  },
  "focus-pauze": {
    id: "focus-pauze",
    label: "Pauze",
    icon: Pause,
    handler: (ctx) => ctx.addToast("Pauze alleen beschikbaar tijdens actieve focus sessie", "info"),
  },
  "focus-stats": {
    id: "focus-stats",
    label: "Focus stats",
    icon: BarChart3,
    handler: (ctx) => ctx.router.push("/focus?tab=stats"),
  },
  "lead-converteren": {
    id: "lead-converteren",
    label: "Lead → klant",
    icon: ArrowRight,
    handler: (ctx) => ctx.addToast("Selecteer een lead om te converteren", "info"),
  },
  "pipeline-view": {
    id: "pipeline-view",
    label: "Pipeline",
    icon: BarChart3,
    handler: (ctx) => ctx.router.push("/sales-engine?view=pipeline"),
  },
  "followup-sturen": {
    id: "followup-sturen",
    label: "Follow-up",
    icon: Mail,
    handler: (ctx) => ctx.router.push("/followup"),
  },
  "dashboard": {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    handler: (ctx) => ctx.router.push("/"),
  },
};

export const SHORTCUTS_BY_ROUTE: Record<string, ActionId[]> = {
  "/": ["timer-start", "taak-nieuw", "idee-nieuw", "dagritme", "search"],
  "/ideeen": ["idee-nieuw", "idee-voer-uit", "idee-backlog", "ai-brainstorm", "search"],
  "/taken": ["taak-nieuw", "timer-op-taak", "plan-agenda", "taak-klaar", "focus"],
  "/financien": ["factuur-nieuw", "uitgave-nieuw", "bank-import", "btw-aangifte", "revolut-sync"],
  "/klanten": ["klant-nieuw", "lead-nieuw", "offerte-nieuw", "notitie-nieuw", "mail-nieuw"],
  "/tijd": ["timer-toggle", "tijd-handmatig", "locatie-toggle", "tijd-week", "focus-sessie"],
  "/projecten": ["project-nieuw", "taak-nieuw", "timer-op-taak", "project-voortgang", "teamlid-toevoegen"],
  "/agenda": ["agenda-nieuw", "plan-agenda", "agenda-vandaag", "google-sync", "meeting-plannen"],
  "/wiki": ["wiki-nieuw", "wiki-zoek", "wiki-import", "second-brain-save", "dashboard"],
  "/focus": ["focus-start", "focus-block", "focus-pauze", "focus-stats", "idee-nieuw"],
  "/sales-engine": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
  "/leads": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
  "/offertes": ["lead-nieuw", "offerte-nieuw", "followup-sturen", "pipeline-view", "lead-converteren"],
};

export const FALLBACK_SHORTCUTS: ActionId[] = [
  "timer-start",
  "taak-nieuw",
  "idee-nieuw",
  "dashboard",
  "search",
];

/**
 * Resolve shortcut IDs for a given pathname.
 * Rules:
 * 1. Exact match wins
 * 2. Otherwise longest matching prefix (pathname starts with "<key>/") wins
 * 3. Fallback shortcuts if nothing matches
 */
export function getShortcutsForRoute(pathname: string): ActionId[] {
  if (!pathname) return FALLBACK_SHORTCUTS;

  // Exact match
  if (SHORTCUTS_BY_ROUTE[pathname]) {
    return SHORTCUTS_BY_ROUTE[pathname];
  }

  // Longest prefix match
  const keys = Object.keys(SHORTCUTS_BY_ROUTE).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (pathname.startsWith(key + "/")) {
      return SHORTCUTS_BY_ROUTE[key];
    }
  }

  return FALLBACK_SHORTCUTS;
}
```

- [ ] **Step 4: Run the test again to verify it passes**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx vitest run src/components/layout/action-registry.test.ts 2>&1 | tail -20
```
Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Run type check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit 2>&1 | tail -20
```
Expected: No errors (or at most pre-existing errors unrelated to the new files).

- [ ] **Step 6: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/components/layout/action-registry.ts src/components/layout/action-registry.test.ts
git commit -m "feat(action-dock): add action registry with route matching"
```

---

### Task 2: useActionShortcuts hook

**Files:**
- Create: `src/hooks/use-action-shortcuts.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-action-shortcuts.ts`:

```typescript
"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ACTIONS,
  getShortcutsForRoute,
  type ActionContext,
  type ActionDef,
  type ActionId,
} from "@/components/layout/action-registry";
import { useToast } from "@/hooks/use-toast";

export interface BoundAction extends ActionDef {
  run: () => void;
}

/**
 * Resolve the current route's shortcuts and all actions, pre-bound to a
 * router + toast context. Consumers get a `run()` function per action.
 */
export function useActionShortcuts() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const addToast = useToast((s) => s.addToast);

  const bound = useMemo(() => {
    const ctx: ActionContext = {
      router,
      pathname,
      openCommandPalette: () => {
        window.dispatchEvent(new CustomEvent("autronis:open-command-palette"));
      },
      addToast,
    };

    const bindOne = (def: ActionDef): BoundAction => ({
      ...def,
      run: () => def.handler(ctx),
    });

    const visibleIds = getShortcutsForRoute(pathname);
    const visible = visibleIds.map((id) => bindOne(ACTIONS[id]));
    const allIds = Object.keys(ACTIONS) as ActionId[];
    const all = allIds.map((id) => bindOne(ACTIONS[id]));

    return { visible, all };
  }, [pathname, router, addToast]);

  return bound;
}
```

- [ ] **Step 2: Verify useToast selector pattern matches the existing store**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && grep -n "useToast" src/hooks/use-toast.ts
```
Expected: confirms `useToast` is a Zustand store (supports selector pattern `useToast((s) => s.addToast)`).

If the existing store doesn't support selectors (i.e. if it's a plain hook returning an object), change the hook call to:
```typescript
const { addToast } = useToast();
```

- [ ] **Step 3: Run type check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit 2>&1 | tail -20
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/hooks/use-action-shortcuts.ts
git commit -m "feat(action-dock): add useActionShortcuts hook"
```

---

### Task 3: ActionDock component (responsive)

**Files:**
- Create: `src/components/layout/action-dock.tsx`

- [ ] **Step 1: Create the ActionDock component**

Create `src/components/layout/action-dock.tsx`:

```typescript
"use client";

import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActionShortcuts, type BoundAction } from "@/hooks/use-action-shortcuts";
import { ActionDockOverflow } from "./action-dock-overflow";

export function ActionDock() {
  const { visible, all } = useActionShortcuts();
  const [overflowOpen, setOverflowOpen] = useState(false);

  const handleRun = (action: BoundAction) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
    action.run();
  };

  return (
    <>
      {/* Mobile bottom bar */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-autronis-border bg-autronis-card/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <LayoutGroup id="action-dock-mobile">
          <div className="flex items-stretch justify-around px-1 pt-2 pb-2">
            <AnimatePresence mode="popLayout">
              {visible.map((action) => (
                <motion.button
                  key={action.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleRun(action)}
                  className="flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl text-autronis-text-secondary active:bg-autronis-accent/10 active:text-autronis-accent transition-colors"
                  aria-label={action.label}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium truncate max-w-full px-1">
                    {action.label}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
            <button
              onClick={() => setOverflowOpen(true)}
              className="flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl text-autronis-text-secondary active:bg-autronis-accent/10 active:text-autronis-accent transition-colors"
              aria-label="Meer acties"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Meer</span>
            </button>
          </div>
        </LayoutGroup>
      </div>

      {/* Desktop floating pill */}
      <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <LayoutGroup id="action-dock-desktop">
          <div className="flex items-center gap-1 rounded-2xl border border-autronis-border bg-autronis-card/90 backdrop-blur-xl px-2 py-2 shadow-2xl shadow-autronis-accent/10">
            <AnimatePresence mode="popLayout">
              {visible.map((action) => (
                <motion.button
                  key={action.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRun(action)}
                  className={cn(
                    "group relative w-11 h-11 flex items-center justify-center rounded-xl",
                    "text-autronis-text-secondary hover:bg-autronis-accent/10 hover:text-autronis-accent",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-autronis-accent",
                    "transition-colors"
                  )}
                  aria-label={action.label}
                  title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-autronis-bg border border-autronis-border px-2 py-1 text-xs text-autronis-text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.label}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
            <div className="w-px self-stretch bg-autronis-border mx-1" />
            <button
              onClick={() => setOverflowOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-autronis-text-secondary hover:bg-autronis-accent/10 hover:text-autronis-accent transition-colors"
              aria-label="Meer acties"
              title="Meer acties"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </LayoutGroup>
      </div>

      <ActionDockOverflow
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        actions={all}
      />
    </>
  );
}
```

- [ ] **Step 2: Run type check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit 2>&1 | tail -20
```
Expected: Error — `./action-dock-overflow` not yet created (that's Task 4). Proceed to commit anyway; tests will pass after Task 4.

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/components/layout/action-dock.tsx
git commit -m "feat(action-dock): add responsive ActionDock component"
```

---

### Task 4: ActionDockOverflow — bottom sheet / popover with all actions

**Files:**
- Create: `src/components/layout/action-dock-overflow.tsx`

- [ ] **Step 1: Create the overflow component**

Create `src/components/layout/action-dock-overflow.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoundAction } from "@/hooks/use-action-shortcuts";

interface ActionDockOverflowProps {
  open: boolean;
  onClose: () => void;
  actions: BoundAction[];
}

export function ActionDockOverflow({ open, onClose, actions }: ActionDockOverflowProps) {
  const [query, setQuery] = useState("");

  // Reset query when closing, and close on Escape.
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleRun = (action: BoundAction) => {
    onClose();
    // Slight delay so the sheet's exit animation can start before navigation.
    setTimeout(() => action.run(), 50);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Mobile: bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-autronis-border bg-autronis-card shadow-2xl"
            style={{ maxHeight: "80vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-base font-semibold text-autronis-text-primary">Alle acties</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-autronis-text-secondary hover:bg-autronis-bg"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-autronis-border bg-autronis-bg px-3 py-2">
                <Search className="w-4 h-4 text-autronis-text-secondary" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Zoek actie..."
                  className="flex-1 bg-transparent text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto px-2 pb-4" style={{ maxHeight: "calc(80vh - 120px)" }}>
              <div className="grid grid-cols-1 gap-1">
                {filtered.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleRun(action)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                  >
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-autronis-bg text-autronis-accent">
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-autronis-text-secondary py-6">
                    Geen acties gevonden
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Desktop: centered popover */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="hidden md:block fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[420px] max-h-[70vh] rounded-2xl border border-autronis-border bg-autronis-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-autronis-border px-4 py-3">
              <Search className="w-4 h-4 text-autronis-text-secondary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek actie..."
                className="flex-1 bg-transparent text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary focus:outline-none"
                autoFocus
              />
              <button
                onClick={onClose}
                className="text-autronis-text-secondary hover:text-autronis-text-primary"
                aria-label="Sluiten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2" style={{ maxHeight: "calc(70vh - 56px)" }}>
              <div className="grid grid-cols-1 gap-1">
                {filtered.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleRun(action)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-autronis-text-primary",
                      "hover:bg-autronis-accent/10 hover:text-autronis-accent transition-colors"
                    )}
                  >
                    <action.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.shortcut && (
                      <span className="ml-auto text-xs text-autronis-text-secondary">
                        {action.shortcut}
                      </span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-autronis-text-secondary py-6">
                    Geen acties gevonden
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Run type check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit 2>&1 | tail -20
```
Expected: No errors related to `action-dock.tsx` or `action-dock-overflow.tsx`.

- [ ] **Step 3: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/components/layout/action-dock-overflow.tsx
git commit -m "feat(action-dock): add overflow sheet/popover"
```

---

### Task 5: Wire ActionDock into AppShell, delete BottomNav + FAB

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Delete: `src/components/layout/bottom-nav.tsx`
- Delete: `src/components/ui/quick-action-button.tsx`

- [ ] **Step 1: Read the current app-shell.tsx to locate the BottomNav and FAB imports/usages**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && grep -n "BottomNav\|QuickActionButton\|pb-20" src/components/layout/app-shell.tsx
```
Note the line numbers of each occurrence — you'll remove those imports and JSX usages.

- [ ] **Step 2: Update app-shell.tsx**

In `src/components/layout/app-shell.tsx`, make these changes:

1. **Remove** the `BottomNav` import and the `<BottomNav ... />` JSX usage (around line 100).
2. **Remove** the `QuickActionButton` import and its JSX usage if present.
3. **Add** this import near the other layout imports:
```typescript
import { ActionDock } from "./action-dock";
```
4. **Render** `<ActionDock />` in the exact spot where `<BottomNav />` was previously rendered.
5. **Update** the `main` element's bottom padding. The existing `pb-20 md:pb-6` (or similar) should become `pb-24 md:pb-24` so content does not hide behind the dock on either viewport.
6. **Add** a `useEffect` near the top of the component body that bridges the custom event from the action context to the existing command palette state. If the file uses `useKeyboardShortcuts()` which exposes `setCommandPaletteOpen`, wire it like this:

```typescript
useEffect(() => {
  const onOpen = () => setCommandPaletteOpen(true);
  window.addEventListener("autronis:open-command-palette", onOpen);
  return () => window.removeEventListener("autronis:open-command-palette", onOpen);
}, [setCommandPaletteOpen]);
```

If `useKeyboardShortcuts` does not return `setCommandPaletteOpen`, read the hook and find the equivalent setter — use that. Add `useEffect` to the React import if not already present.

- [ ] **Step 3: Delete the old bottom nav and FAB**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
rm src/components/layout/bottom-nav.tsx
rm src/components/ui/quick-action-button.tsx
```

- [ ] **Step 4: Search for any remaining references that would break the build**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && grep -rn "BottomNav\|quick-action-button\|QuickActionButton" src/ 2>&1
```
Expected: only matches inside `app-shell.tsx` are acceptable if they're gone. Any other hits must be removed.

If any remaining file still imports these, remove those imports and usages the same way.

- [ ] **Step 5: Run type check**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx tsc --noEmit 2>&1 | tail -20
```
Expected: No errors.

- [ ] **Step 6: Run the vitest suite to ensure nothing else broke**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npx vitest run 2>&1 | tail -30
```
Expected: All previously passing tests still pass. The new `action-registry.test.ts` also passes.

- [ ] **Step 7: Commit**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
git add src/components/layout/app-shell.tsx
git add -u src/components/layout/bottom-nav.tsx src/components/ui/quick-action-button.tsx
git commit -m "feat(action-dock): wire ActionDock into AppShell, remove BottomNav and FAB"
```

---

### Task 6: Manual verification in the dev server

**Files:** None — this is a verification step only.

- [ ] **Step 1: Start the dev server**

Run:
```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard && npm run dev
```
Wait for: `✓ Ready` or similar. Dev server is typically at `http://localhost:3000`.

- [ ] **Step 2: Verify desktop layout**

Open `http://localhost:3000/` in a browser (desktop width ≥ 768px). Confirm:
1. A floating pill dock is visible at the bottom center of the screen.
2. It shows 5 icon-only buttons plus a "…" button.
3. Hovering each button shows its label as a tooltip.
4. Clicking "Nieuwe taak" navigates to `/taken?nieuw=true`.
5. Clicking "…" opens a popover with a searchable list of all actions.
6. The old FAB (bottom-right) is gone.

- [ ] **Step 3: Verify context-aware behavior**

Navigate to `/ideeen`. Confirm:
1. The dock's shortcuts have visibly changed (with a smooth morph animation).
2. The first icon is now "Nieuw idee" (Lightbulb).
3. The second is "Voer idee uit" (Rocket).

Navigate to `/financien`. Confirm:
1. The shortcuts change again.
2. First icon is "Nieuwe factuur" (FileText).

- [ ] **Step 4: Verify mobile layout**

Resize the browser window below 768px (or use DevTools device mode). Confirm:
1. The floating pill disappears.
2. A bottom bar spans the full width with 5 shortcut buttons + "Meer".
3. Each button shows icon + short label.
4. Tapping "Meer" opens a full bottom sheet that slides up from below.
5. The bottom sheet has a search input and lists all actions.
6. The old BottomNav (Dashboard/Timer/Taken/Ideeën/Meer) is gone.

- [ ] **Step 5: Verify command palette wiring**

On any route, click the "Zoeken" action in the dock (the search icon). Confirm:
1. The existing command palette opens (Cmd+K style).
2. Closing it (Escape) returns to the page.

- [ ] **Step 6: Stop the dev server**

In the terminal where dev is running: `Ctrl+C`.

If any verification fails, do not proceed. Report the failure — no Task 7 commit is needed unless something is fixed.

---
