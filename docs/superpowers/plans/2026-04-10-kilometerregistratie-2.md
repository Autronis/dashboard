# Kilometerregistratie 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the kilometerregistratie from manual logbook to smart, automated system with 15 features across 4 pillars.

**Architecture:** Features are ordered by dependency. Database schema first, then Google Maps integration (foundation for autocomplete, calendar suggestions, mobile entry), then intelligence features, analytics, and mobile UX. Each task produces a working, committable increment.

**Tech Stack:** Next.js App Router, Drizzle ORM (SQLite), Google Directions/Places API, Vercel Crons, web-push, Resend, React-PDF, Framer Motion, TanStack React Query.

**Spec:** `docs/superpowers/specs/2026-04-10-kilometerregistratie-2-design.md`

**Verification after each task:** `npx tsc --noEmit` must pass before committing.

---

## Task 1: Database Schema — New Tables

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add `locatieAliassen` table to schema**

Add after the `brandstofKosten` table definition (after line ~1481):

```typescript
export const locatieAliassen = sqliteTable("locatie_aliassen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id).notNull(),
  alias: text("alias").notNull(),
  genormaliseerdeNaam: text("genormaliseerde_naam").notNull(),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("locatie_aliassen_gebruiker_alias").on(table.gebruikerId, table.alias),
]);
```

- [ ] **Step 2: Add `kmStandFotos` table to schema**

Add directly after `locatieAliassen`:

```typescript
export const kmStandFotos = sqliteTable("km_stand_fotos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kmStandId: integer("km_stand_id").references(() => kmStanden.id).notNull(),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id).notNull(),
  bestandsnaam: text("bestandsnaam").notNull(),
  bestandspad: text("bestandspad").notNull(),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 3: Run the migration to create tables**

Create a migration script and run it:

```bash
cat > /tmp/km2-migration.sql << 'EOF'
CREATE TABLE IF NOT EXISTS locatie_aliassen (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
  alias TEXT NOT NULL,
  genormaliseerde_naam TEXT NOT NULL,
  aangemaakt_op TEXT DEFAULT (datetime('now')),
  UNIQUE(gebruiker_id, alias)
);

CREATE TABLE IF NOT EXISTS km_stand_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  km_stand_id INTEGER NOT NULL REFERENCES km_standen(id),
  gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
  bestandsnaam TEXT NOT NULL,
  bestandspad TEXT NOT NULL,
  aangemaakt_op TEXT DEFAULT (datetime('now'))
);
EOF

npx tsx -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('./data/autronis.db');
const sql = fs.readFileSync('/tmp/km2-migration.sql', 'utf8');
db.exec(sql);
console.log('Migration complete');
db.close();
"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(km): add locatieAliassen and kmStandFotos tables"
```

---

## Task 2: Google Maps Distance API

**Files:**
- Create: `src/app/api/kilometers/distance/route.ts`
- Create: `src/lib/google-maps.ts`

- [ ] **Step 1: Create Google Maps utility**

```typescript
// src/lib/google-maps.ts
import { google } from "googleapis";

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface DistanceResult {
  afstandMeters: number;
  afstandKm: number;
  duurSeconden: number;
  duurTekst: string;
}

export async function berekenAfstand(
  van: string,
  naar: string
): Promise<DistanceResult | null> {
  if (!MAPS_KEY) {
    console.error("GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", van);
  url.searchParams.set("destination", naar);
  url.searchParams.set("key", MAPS_KEY);
  url.searchParams.set("language", "nl");
  url.searchParams.set("region", "nl");

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !data.routes?.length) {
    return null;
  }

  const leg = data.routes[0].legs[0];
  return {
    afstandMeters: leg.distance.value,
    afstandKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    duurSeconden: leg.duration.value,
    duurTekst: leg.duration.text,
  };
}

interface PlacePrediction {
  description: string;
  place_id: string;
}

export async function zoekPlaatsen(
  query: string,
  sessionToken?: string
): Promise<PlacePrediction[]> {
  if (!MAPS_KEY || query.length < 2) return [];

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", query);
  url.searchParams.set("key", MAPS_KEY);
  url.searchParams.set("language", "nl");
  url.searchParams.set("components", "country:nl");
  if (sessionToken) url.searchParams.set("sessiontoken", sessionToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") return [];

  return data.predictions.slice(0, 3).map((p: { description: string; place_id: string }) => ({
    description: p.description,
    place_id: p.place_id,
  }));
}
```

- [ ] **Step 2: Create distance API route**

```typescript
// src/app/api/kilometers/distance/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { berekenAfstand } from "@/lib/google-maps";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const van = searchParams.get("van");
    const naar = searchParams.get("naar");

    if (!van || !naar) {
      return NextResponse.json({ fout: "van en naar zijn verplicht" }, { status: 400 });
    }

    const result = await berekenAfstand(van, naar);

    if (!result) {
      return NextResponse.json({ fout: "Kon afstand niet berekenen" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Add hook for distance calculation**

Add to `src/hooks/queries/use-kilometers.ts`:

```typescript
export function useAfstandBerekening() {
  return useMutation({
    mutationFn: async ({ van, naar }: { van: string; naar: string }) => {
      const res = await fetch(`/api/kilometers/distance?van=${encodeURIComponent(van)}&naar=${encodeURIComponent(naar)}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ afstandMeters: number; afstandKm: number; duurSeconden: number; duurTekst: string }>;
    },
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-maps.ts src/app/api/kilometers/distance/route.ts src/hooks/queries/use-kilometers.ts
git commit -m "feat(km): add Google Maps distance calculation API"
```

---

## Task 3: Locatie Autocomplete API + Component

**Files:**
- Create: `src/app/api/kilometers/locaties/route.ts`
- Create: `src/app/(dashboard)/kilometers/components/LocatieAutocomplete.tsx`
- Modify: `src/hooks/queries/use-kilometers.ts`

- [ ] **Step 1: Create locaties API endpoint**

```typescript
// src/app/api/kilometers/locaties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, locatieAliassen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, sql, or, like } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const zoekterm = searchParams.get("q")?.trim();

    if (!zoekterm || zoekterm.length < 2) {
      return NextResponse.json({ locaties: [] });
    }

    const pattern = `%${zoekterm}%`;

    // Search in existing trip locations + aliases
    const vanLocaties = await db
      .select({
        locatie: kilometerRegistraties.vanLocatie,
        aantal: sql<number>`COUNT(*)`.as("aantal"),
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          like(kilometerRegistraties.vanLocatie, pattern)
        )
      )
      .groupBy(kilometerRegistraties.vanLocatie)
      .all();

    const naarLocaties = await db
      .select({
        locatie: kilometerRegistraties.naarLocatie,
        aantal: sql<number>`COUNT(*)`.as("aantal"),
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          like(kilometerRegistraties.naarLocatie, pattern)
        )
      )
      .groupBy(kilometerRegistraties.naarLocatie)
      .all();

    // Merge and deduplicate
    const locatieMap = new Map<string, number>();
    for (const l of [...vanLocaties, ...naarLocaties]) {
      const bestaand = locatieMap.get(l.locatie) ?? 0;
      locatieMap.set(l.locatie, bestaand + l.aantal);
    }

    // Check aliases
    const aliassen = await db
      .select()
      .from(locatieAliassen)
      .where(
        and(
          eq(locatieAliassen.gebruikerId, gebruiker.id),
          like(locatieAliassen.alias, pattern)
        )
      )
      .all();

    for (const a of aliassen) {
      if (!locatieMap.has(a.genormaliseerdeNaam)) {
        locatieMap.set(a.genormaliseerdeNaam, 1);
      }
    }

    // Sort by frequency descending, limit to 4
    const locaties = Array.from(locatieMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([locatie, aantalGebruikt]) => ({ locatie, aantalGebruikt }));

    return NextResponse.json({ locaties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Add hooks for locatie search and Google Places**

Add to `src/hooks/queries/use-kilometers.ts`:

```typescript
interface LocatieSuggestie {
  locatie: string;
  aantalGebruikt: number;
  bron: "eigen" | "google";
}

export function useLocatieSuggesties(zoekterm: string) {
  return useQuery({
    queryKey: ["kilometers", "locaties", zoekterm],
    queryFn: async (): Promise<LocatieSuggestie[]> => {
      if (!zoekterm || zoekterm.length < 2) return [];

      // Fetch own locations
      const eigenRes = await fetch(`/api/kilometers/locaties?q=${encodeURIComponent(zoekterm)}`);
      const eigenData = await eigenRes.json();
      const eigen: LocatieSuggestie[] = (eigenData.locaties ?? []).map(
        (l: { locatie: string; aantalGebruikt: number }) => ({ ...l, bron: "eigen" as const })
      );

      // If we have enough own results, skip Google
      if (eigen.length >= 3) return eigen;

      // Fetch Google Places
      const googleRes = await fetch(`/api/kilometers/locaties/google?q=${encodeURIComponent(zoekterm)}`);
      const googleData = await googleRes.json();
      const google: LocatieSuggestie[] = (googleData.suggesties ?? []).map(
        (s: { description: string }) => ({ locatie: s.description, aantalGebruikt: 0, bron: "google" as const })
      );

      return [...eigen, ...google];
    },
    enabled: zoekterm.length >= 2,
    staleTime: 10000,
  });
}
```

- [ ] **Step 3: Create Google Places proxy endpoint**

```typescript
// src/app/api/kilometers/locaties/google/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { zoekPlaatsen } from "@/lib/google-maps";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const q = new URL(req.url).searchParams.get("q");
    if (!q || q.length < 2) {
      return NextResponse.json({ suggesties: [] });
    }
    const suggesties = await zoekPlaatsen(q);
    return NextResponse.json({ suggesties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 4: Create LocatieAutocomplete component**

```typescript
// src/app/(dashboard)/kilometers/components/LocatieAutocomplete.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { MapPin, Search, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocatieSuggesties } from "@/hooks/queries/use-kilometers";

interface LocatieAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function LocatieAutocomplete({
  value,
  onChange,
  placeholder = "Typ locatie...",
  label,
  className,
}: LocatieAutocompleteProps) {
  const [zoekterm, setZoekterm] = useState(value);
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(zoekterm), 300);
    return () => clearTimeout(timer);
  }, [zoekterm]);

  // Sync external value
  useEffect(() => {
    setZoekterm(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: suggesties = [] } = useLocatieSuggesties(debounced);

  function handleSelect(locatie: string) {
    setZoekterm(locatie);
    onChange(locatie);
    setOpen(false);
  }

  function handleInputChange(val: string) {
    setZoekterm(val);
    onChange(val);
    if (val.length >= 2) setOpen(true);
    else setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      {label && (
        <label className="block text-xs text-[var(--autronis-text-muted)] mb-1.5 font-medium">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={zoekterm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => zoekterm.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-card)] px-4 py-2.5 text-sm text-[var(--autronis-text)] placeholder:text-[var(--autronis-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--autronis-accent)]/30 focus:border-[var(--autronis-accent)]"
        />
        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--autronis-text-muted)]" />
      </div>

      {open && suggesties.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-card)] shadow-lg overflow-hidden">
          {suggesties.map((s, i) => (
            <button
              key={`${s.locatie}-${i}`}
              type="button"
              onClick={() => handleSelect(s.locatie)}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--autronis-accent)]/10 flex items-center justify-between border-b border-[var(--autronis-border)] last:border-0"
            >
              <span className="text-[var(--autronis-text)] truncate">{s.locatie}</span>
              {s.bron === "eigen" ? (
                <span className="flex items-center gap-1 text-xs text-[var(--autronis-accent)] shrink-0">
                  <Star className="w-3 h-3" /> {s.aantalGebruikt}x
                </span>
              ) : (
                <span className="text-xs text-[var(--autronis-text-muted)] shrink-0">
                  <Search className="w-3 h-3 inline mr-1" />Google
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Integrate into the kilometers page**

Modify `src/app/(dashboard)/kilometers/page.tsx`:
- Add import: `import { LocatieAutocomplete } from "./components/LocatieAutocomplete";`
- Replace the van/naar `<input>` fields in both the SnelRitForm and the main modal form with `<LocatieAutocomplete>` components
- Keep the same `value` and `onChange` bindings as the current inputs

- [ ] **Step 6: Add auto-distance calculation to the form**

In `src/app/(dashboard)/kilometers/page.tsx`:
- Import `useAfstandBerekening` from the hooks
- Add a `useEffect` that triggers distance calculation when both van and naar are filled (debounced 500ms)
- Auto-fill the km field with the result, but mark it as "auto-berekend" (allow manual override)
- Show retour-km (2x) next to the retour toggle

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit`
Expected: No errors

```bash
git add src/app/api/kilometers/locaties/ src/app/api/kilometers/distance/ src/lib/google-maps.ts src/hooks/queries/use-kilometers.ts src/app/\(dashboard\)/kilometers/components/LocatieAutocomplete.tsx src/app/\(dashboard\)/kilometers/page.tsx
git commit -m "feat(km): add location autocomplete and auto-distance calculation"
```

---

## Task 4: Automatische Brandstof-Matching (Revolut)

**Files:**
- Modify: `src/app/api/revolut/webhook/route.ts`

The webhook already has MCC-based fuel detection (codes 5541/5542). We need to add keyword-based detection for merchants that don't always use fuel MCC codes.

- [ ] **Step 1: Add keyword detection to the webhook handler**

In `src/app/api/revolut/webhook/route.ts`, add a helper function near the top of the file:

```typescript
const BRANDSTOF_KEYWORDS = [
  "shell", "bp", "totalenergies", "tango", "tinq", "esso",
  "texaco", "gulf", "tamoil", "argos", "avia", "firezone",
];

function isBrandstofTransactie(merchantName: string | undefined, categoryCode: string | undefined): boolean {
  // Already detected by MCC
  if (categoryCode === "5541" || categoryCode === "5542") return true;
  // Keyword-based detection
  if (!merchantName) return false;
  const lower = merchantName.toLowerCase();
  return BRANDSTOF_KEYWORDS.some((kw) => lower.includes(kw));
}
```

- [ ] **Step 2: Replace existing MCC check with the new function**

In the POST handler, replace the existing MCC check (the block that checks `merchant?.category_code === "5541"`) with:

```typescript
// Auto-detect fuel transactions
if (isBrandstofTransactie(leg.merchant?.name, leg.merchant?.category_code)) {
  // Check for duplicate
  const bestaand = await db
    .select({ id: brandstofKosten.id })
    .from(brandstofKosten)
    .where(eq(brandstofKosten.bankTransactieId, nieuwTransactie.id))
    .get();

  if (!bestaand) {
    await db.insert(brandstofKosten).values({
      gebruikerId: verbinding.gebruikerId,
      datum,
      bedrag: Math.abs(parseFloat(leg.amount.toString())),
      bankTransactieId: nieuwTransactie.id,
      notitie: `Auto: ${leg.merchant?.name ?? "Tankstation"}`,
    });
  }
}
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/revolut/webhook/route.ts
git commit -m "feat(km): expand fuel auto-detection with keyword matching"
```

---

## Task 5: Dagelijkse Cron voor Terugkerende Ritten

**Files:**
- Modify: `vercel.json`
- Modify: `src/app/api/kilometers/terugkerend/genereer/route.ts`

- [ ] **Step 1: Add cron to vercel.json**

Add the kilometer generation cron to the existing crons array in `vercel.json`:

```json
{ "path": "/api/kilometers/terugkerend/genereer", "schedule": "0 7 * * *" }
```

- [ ] **Step 2: Add cron authentication to the genereer endpoint**

At the top of the POST handler in `src/app/api/kilometers/terugkerend/genereer/route.ts`, add authorization bypass for Vercel Cron:

```typescript
export async function POST(req: NextRequest) {
  try {
    // Allow Vercel Cron calls
    const authHeader = req.headers.get("authorization");
    const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    let gebruikerId: number | null = null;
    if (!isCron) {
      const gebruiker = await requireAuth();
      gebruikerId = gebruiker.id;
    }
    // When called by cron, generate for ALL users (gebruikerId = null)
```

Update the query to optionally filter by user:

```typescript
    const ritten = await db
      .select()
      .from(terugkerendeRitten)
      .where(
        gebruikerId
          ? and(eq(terugkerendeRitten.isActief, 1), eq(terugkerendeRitten.gebruikerId, gebruikerId))
          : eq(terugkerendeRitten.isActief, 1)
      )
      .all();
```

- [ ] **Step 3: Add push notification after generation**

At the end of the POST handler, after all trips are generated, add push notifications:

```typescript
    // Send push notifications per user
    if (isCron && aangemaakt > 0) {
      const { sendPushToUser } = await import("@/lib/push");
      const userCounts = new Map<number, number>();
      // Count trips per user from generated entries
      for (const rit of ritten) {
        // Only count if we actually generated something for this rit
        userCounts.set(rit.gebruikerId, (userCounts.get(rit.gebruikerId) ?? 0));
      }
      // We track aangemaakt globally; for per-user we need to adjust the loop
      // Simplified: send to all users with active recurring trips
      const uniqueUsers = [...new Set(ritten.map((r) => r.gebruikerId))];
      for (const uid of uniqueUsers) {
        await sendPushToUser(uid, {
          titel: "Ritten toegevoegd",
          bericht: `${aangemaakt} terugkerende rit(ten) automatisch gelogd`,
          url: "/kilometers",
          tag: "km-terugkerend",
        }).catch(() => {}); // Don't fail if push fails
      }
    }

    return NextResponse.json({ aangemaakt });
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add vercel.json src/app/api/kilometers/terugkerend/genereer/route.ts
git commit -m "feat(km): add daily cron for recurring trip generation with push notifications"
```

---

## Task 6: Google Calendar → Rit-Suggesties

**Files:**
- Create: `src/app/api/kilometers/suggesties/route.ts`
- Modify: `src/hooks/queries/use-kilometers.ts`
- Modify: `src/app/(dashboard)/kilometers/page.tsx`

- [ ] **Step 1: Create suggesties API endpoint**

```typescript
// src/app/api/kilometers/suggesties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, klanten, googleTokens } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedClient } from "@/lib/google-calendar";
import { berekenAfstand } from "@/lib/google-maps";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();

    // Check if Google Calendar is connected
    const tokens = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.gebruikerId, gebruiker.id))
      .get();

    if (!tokens) {
      return NextResponse.json({ suggesties: [] });
    }

    const auth = await getAuthenticatedClient(gebruiker.id);
    if (!auth) {
      return NextResponse.json({ suggesties: [] });
    }

    const calendar = google.calendar({ version: "v3", auth });
    const vandaag = new Date();
    const startVanDag = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    const eindVanDag = new Date(startVanDag.getTime() + 24 * 60 * 60 * 1000);

    const events = await calendar.events.list({
      calendarId: "primary",
      timeMin: startVanDag.toISOString(),
      timeMax: eindVanDag.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = events.data.items ?? [];
    const eventsMetLocatie = items.filter((e) => e.location?.trim());

    if (eventsMetLocatie.length === 0) {
      return NextResponse.json({ suggesties: [] });
    }

    // Get today's logged trips
    const vandaagStr = vandaag.toISOString().slice(0, 10);
    const bestaandeRitten = await db
      .select()
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          eq(kilometerRegistraties.datum, vandaagStr)
        )
      )
      .all();

    const gelogdeLocaties = new Set(
      bestaandeRitten.flatMap((r) => [r.vanLocatie.toLowerCase(), r.naarLocatie.toLowerCase()])
    );

    // Get all klanten for auto-matching
    const alleKlanten = await db.select().from(klanten).where(eq(klanten.isActief, 1)).all();

    const suggesties = [];

    for (const event of eventsMetLocatie) {
      const locatie = event.location!.trim();
      if (gelogdeLocaties.has(locatie.toLowerCase())) continue;

      // Try to match with a klant
      let klantId: number | null = null;
      let klantNaam: string | null = null;
      for (const k of alleKlanten) {
        if (locatie.toLowerCase().includes(k.naam.toLowerCase()) ||
            k.naam.toLowerCase().includes(locatie.toLowerCase().split(",")[0])) {
          klantId = k.id;
          klantNaam = k.naam;
          break;
        }
      }

      // Calculate distance
      let afstandKm: number | null = null;
      const afstand = await berekenAfstand("Autronis, Eindhoven", locatie);
      if (afstand) afstandKm = afstand.afstandKm;

      suggesties.push({
        eventId: event.id,
        titel: event.summary ?? "Geen titel",
        locatie,
        startTijd: event.start?.dateTime ?? event.start?.date ?? "",
        afstandKm,
        klantId,
        klantNaam,
      });
    }

    return NextResponse.json({ suggesties });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Add hook**

Add to `src/hooks/queries/use-kilometers.ts`:

```typescript
interface CalendarSuggestie {
  eventId: string;
  titel: string;
  locatie: string;
  startTijd: string;
  afstandKm: number | null;
  klantId: number | null;
  klantNaam: string | null;
}

export function useCalendarSuggesties() {
  return useQuery({
    queryKey: ["kilometers", "suggesties"],
    queryFn: async (): Promise<CalendarSuggestie[]> => {
      const res = await fetch("/api/kilometers/suggesties");
      if (!res.ok) return [];
      const data = await res.json();
      return data.suggesties ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
```

- [ ] **Step 3: Add suggestie-banner to the km page**

In `src/app/(dashboard)/kilometers/page.tsx`, add a suggestie banner at the top of the page content (below the header, above the trip list). Use `useCalendarSuggesties()` and render each suggestion as a dismissable card with "Toevoegen" button that pre-fills the modal form. Use `sessionStorage` to track dismissed suggestions.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/suggesties/ src/hooks/queries/use-kilometers.ts src/app/\(dashboard\)/kilometers/page.tsx
git commit -m "feat(km): add Google Calendar trip suggestions"
```

---

## Task 7: Locatie-Normalisatie

**Files:**
- Create: `src/app/api/kilometers/aliassen/route.ts`
- Modify: `src/app/api/kilometers/route.ts` (POST handler)
- Modify: `src/hooks/queries/use-kilometers.ts`

- [ ] **Step 1: Create aliassen CRUD endpoint**

```typescript
// src/app/api/kilometers/aliassen/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { locatieAliassen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const aliassen = await db
      .select()
      .from(locatieAliassen)
      .where(eq(locatieAliassen.gebruikerId, gebruiker.id))
      .all();
    return NextResponse.json({ aliassen });
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
    const { alias, genormaliseerdeNaam } = await req.json();

    if (!alias?.trim() || !genormaliseerdeNaam?.trim()) {
      return NextResponse.json({ fout: "Alias en genormaliseerde naam zijn verplicht" }, { status: 400 });
    }

    const [nieuw] = await db
      .insert(locatieAliassen)
      .values({
        gebruikerId: gebruiker.id,
        alias: alias.trim().toLowerCase(),
        genormaliseerdeNaam: genormaliseerdeNaam.trim(),
      })
      .returning();

    return NextResponse.json({ alias: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "");
    if (!id) return NextResponse.json({ fout: "ID is verplicht" }, { status: 400 });

    await db
      .delete(locatieAliassen)
      .where(and(eq(locatieAliassen.id, id), eq(locatieAliassen.gebruikerId, gebruiker.id)))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Add alias resolution to POST /api/kilometers**

In `src/app/api/kilometers/route.ts`, after getting `vanLocatie` and `naarLocatie` from the body, add alias resolution:

```typescript
    // Resolve aliases
    const resolveAlias = async (locatie: string) => {
      const alias = await db
        .select()
        .from(locatieAliassen)
        .where(
          and(
            eq(locatieAliassen.gebruikerId, gebruiker.id),
            eq(locatieAliassen.alias, locatie.trim().toLowerCase())
          )
        )
        .get();
      return alias ? alias.genormaliseerdeNaam : locatie.trim();
    };

    const resolvedVan = await resolveAlias(vanLocatie);
    const resolvedNaar = await resolveAlias(naarLocatie);
```

Then use `resolvedVan` and `resolvedNaar` in the insert instead of `vanLocatie.trim()` and `naarLocatie.trim()`.

- [ ] **Step 3: Create one-time migration script for existing data**

Create `scripts/normalize-locaties.ts` that:
- Groups all existing locations by `LOWER(TRIM(locatie))`
- For groups with >1 variant, picks the most-used as `genormaliseerdeNaam`
- Creates alias entries for all other variants
- Updates existing trips to use the normalized name

This script should be run once manually: `npx tsx scripts/normalize-locaties.ts`

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/aliassen/ src/app/api/kilometers/route.ts scripts/normalize-locaties.ts
git commit -m "feat(km): add location normalization with alias system"
```

---

## Task 8: Duplicate Detection

**Files:**
- Modify: `src/app/api/kilometers/route.ts`
- Modify: `src/app/(dashboard)/kilometers/page.tsx`

- [ ] **Step 1: Add duplicate check to POST handler**

In `src/app/api/kilometers/route.ts`, after validation and before insert, add:

```typescript
    // Duplicate detection (skip if forceer=true)
    if (!body.forceer) {
      const mogelijkeDuplicaat = await db
        .select()
        .from(kilometerRegistraties)
        .where(
          and(
            eq(kilometerRegistraties.gebruikerId, gebruiker.id),
            eq(kilometerRegistraties.datum, datum)
          )
        )
        .all();

      const duplicaat = mogelijkeDuplicaat.find((r) => {
        const zelfdeRoute =
          (r.vanLocatie.toLowerCase() === resolvedVan.toLowerCase() &&
           r.naarLocatie.toLowerCase() === resolvedNaar.toLowerCase()) ||
          (r.vanLocatie.toLowerCase() === resolvedNaar.toLowerCase() &&
           r.naarLocatie.toLowerCase() === resolvedVan.toLowerCase());
        const vergelijkbareKm = Math.abs(r.kilometers - kmWaarde) / kmWaarde < 0.1;
        return zelfdeRoute && vergelijkbareKm;
      });

      if (duplicaat) {
        return NextResponse.json({
          waarschuwing: "duplicate",
          bestaandeRit: duplicaat,
        });
      }
    }
```

- [ ] **Step 2: Handle duplicate warning in the frontend**

In `src/app/(dashboard)/kilometers/page.tsx`, in the mutation handler for adding a rit:
- Check if response contains `waarschuwing: "duplicate"`
- If so, show a confirm dialog with details of the existing trip
- On confirm, re-submit with `forceer: true`
- On cancel, close the modal

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/route.ts src/app/\(dashboard\)/kilometers/page.tsx
git commit -m "feat(km): add duplicate trip detection with warning"
```

---

## Task 9: Privé/Zakelijk Split op Werkelijke Data

**Files:**
- Modify: `src/app/api/kilometers/jaaroverzicht/route.ts`
- Modify: `src/hooks/queries/use-kilometers.ts` (JaaroverzichtData type)
- Modify: `src/app/(dashboard)/kilometers/page.tsx`

- [ ] **Step 1: Add werkelijk percentage to jaaroverzicht API**

In `src/app/api/kilometers/jaaroverzicht/route.ts`, after the existing queries, add:

```typescript
    // Calculate werkelijk zakelijk percentage from km-standen
    const kmStandenData = await db
      .select()
      .from(kmStanden)
      .where(
        and(
          eq(kmStanden.gebruikerId, gebruiker.id),
          eq(kmStanden.jaar, jaar)
        )
      )
      .all();

    let werkelijkPercentage: number | null = null;
    let totaalGereden: number | null = null;
    let ontbrekendeMaanden: number[] = [];

    if (kmStandenData.length > 0) {
      totaalGereden = kmStandenData.reduce((sum, ks) => sum + (ks.eindStand - ks.beginStand), 0);
      if (totaalGereden > 0) {
        werkelijkPercentage = Math.round((totaalKm / totaalGereden) * 1000) / 10;
      }
      // Find missing months (1-12 for current year, 1-current month)
      const huidigeMaand = jaar === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
      const ingevuldeMaanden = new Set(kmStandenData.map((ks) => ks.maand));
      for (let m = 1; m <= huidigeMaand; m++) {
        if (!ingevuldeMaanden.has(m)) ontbrekendeMaanden.push(m);
      }
    }
```

Add these fields to the response object:

```typescript
    werkelijkPercentage,
    totaalGereden,
    ontbrekendeMaanden,
```

- [ ] **Step 2: Update JaaroverzichtData type**

In `src/hooks/queries/use-kilometers.ts`, add to the `JaaroverzichtData` interface:

```typescript
  werkelijkPercentage: number | null;
  totaalGereden: number | null;
  ontbrekendeMaanden: number[];
```

- [ ] **Step 3: Display in the frontend**

In the jaaroverzicht section of the km page, add a card showing:
- Werkelijk zakelijk % (if available) next to the ingestelde %
- Visual indicator (green if close, amber if >5% difference)
- Warning if `ontbrekendeMaanden.length > 0`
- Suggestion text: "Je werkelijke zakelijk % is X% — overweeg je instelling aan te passen"

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/jaaroverzicht/route.ts src/hooks/queries/use-kilometers.ts src/app/\(dashboard\)/kilometers/page.tsx
git commit -m "feat(km): add real business percentage calculation from km-standen"
```

---

## Task 10: Dashboard Widget

**Files:**
- Create: `src/app/api/kilometers/widget/route.ts`
- Create: `src/app/(dashboard)/components/KilometerWidget.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Create widget API endpoint**

```typescript
// src/app/api/kilometers/widget/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth() + 1;

    const startDatum = `${jaar}-${String(maand).padStart(2, "0")}-01`;
    const eindDatum = `${jaar}-${String(maand).padStart(2, "0")}-31`;

    // Current month stats
    const stats = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        aantalRitten: sql<number>`COUNT(*)`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, startDatum),
          lte(kilometerRegistraties.datum, eindDatum)
        )
      )
      .get();

    const km = stats?.totaalKm ?? 0;
    const ritten = stats?.aantalRitten ?? 0;
    const aftrekbaar = Math.round(km * 0.23 * 100) / 100;

    // Per-week breakdown (weeks 1-5 of current month)
    const perWeek: number[] = [0, 0, 0, 0, 0];
    const dagData = await db
      .select({
        dag: sql<number>`CAST(SUBSTR(${kilometerRegistraties.datum}, 9, 2) AS INTEGER)`,
        km: sql<number>`SUM(${kilometerRegistraties.kilometers})`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, startDatum),
          lte(kilometerRegistraties.datum, eindDatum)
        )
      )
      .groupBy(sql`SUBSTR(${kilometerRegistraties.datum}, 9, 2)`)
      .all();

    for (const d of dagData) {
      const weekIdx = Math.min(Math.floor((d.dag - 1) / 7), 4);
      perWeek[weekIdx] += d.km;
    }

    // Previous month for trend
    const vorigeMaand = maand === 1 ? 12 : maand - 1;
    const vorigJaar = maand === 1 ? jaar - 1 : jaar;
    const vorigeStart = `${vorigJaar}-${String(vorigeMaand).padStart(2, "0")}-01`;
    const vorigeEind = `${vorigJaar}-${String(vorigeMaand).padStart(2, "0")}-31`;

    const vorigeStats = await db
      .select({
        totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
      })
      .from(kilometerRegistraties)
      .where(
        and(
          eq(kilometerRegistraties.gebruikerId, gebruiker.id),
          gte(kilometerRegistraties.datum, vorigeStart),
          lte(kilometerRegistraties.datum, vorigeEind)
        )
      )
      .get();

    const vorigeKm = vorigeStats?.totaalKm ?? 0;
    const trendVsVorigeMaand = vorigeKm > 0
      ? Math.round(((km - vorigeKm) / vorigeKm) * 100)
      : 0;

    return NextResponse.json({
      km: Math.round(km),
      aftrekbaar,
      ritten,
      perWeek: perWeek.map((w) => Math.round(w)),
      trendVsVorigeMaand,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Create KilometerWidget component**

Create `src/app/(dashboard)/components/KilometerWidget.tsx` with:
- `useQuery` for `/api/kilometers/widget`
- Card with Autronis styling (`bg-[var(--autronis-card)]`, `rounded-2xl`, `border`)
- 3 KPI values: km, aftrekbaar (€), ritten
- Mini bar chart from `perWeek` data (5 bars, SVG or styled divs)
- Trend indicator: green arrow up / red arrow down with percentage
- Link to `/kilometers`
- Skeleton loading state

Follow the exact same card pattern used by other dashboard widgets on the main page (see `DailyBriefing`, `RadarWidget` patterns from `page.tsx`).

- [ ] **Step 3: Add widget to dashboard page**

In `src/app/(dashboard)/page.tsx`:
- Import `KilometerWidget`
- Add it to the dashboard grid in an appropriate position (after the existing top section)

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/widget/ src/app/\(dashboard\)/components/KilometerWidget.tsx src/app/\(dashboard\)/page.tsx
git commit -m "feat(km): add kilometer widget to main dashboard"
```

---

## Task 11: Goal-Type Analytics + Brandstof Analytics

**Files:**
- Modify: `src/app/api/kilometers/jaaroverzicht/route.ts`
- Create: `src/app/(dashboard)/kilometers/components/AnalyticsPanel.tsx`
- Create: `src/app/(dashboard)/kilometers/components/BrandstofPanel.tsx`
- Modify: `src/hooks/queries/use-kilometers.ts`
- Modify: `src/app/(dashboard)/kilometers/page.tsx`

- [ ] **Step 1: Add perDoelType aggregation to jaaroverzicht API**

In `src/app/api/kilometers/jaaroverzicht/route.ts`, add after the perKlant query:

```typescript
    // Per goal type aggregation
    const perDoelType = await db
      .select({
        type: kilometerRegistraties.doelType,
        km: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
        ritten: sql<number>`COUNT(*)`,
        bedrag: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers} * COALESCE(${kilometerRegistraties.tariefPerKm}, 0.23)), 0)`,
      })
      .from(kilometerRegistraties)
      .where(and(...conditions))
      .groupBy(kilometerRegistraties.doelType)
      .all();
```

Add `perDoelType` to the response object. Update `JaaroverzichtData` type accordingly:

```typescript
  perDoelType: { type: string | null; km: number; ritten: number; bedrag: number }[];
```

- [ ] **Step 2: Create AnalyticsPanel component**

Create `src/app/(dashboard)/kilometers/components/AnalyticsPanel.tsx`:
- Collapsible panel (default collapsed) with "Analytics" header
- Donut chart: upgrade existing `DonutChart.tsx` pattern for goal-type distribution
- Horizontal bar chart: top 5 klanten (from `jaaroverzicht.perKlant`)
- Colors: use the existing `DOEL_CHIP` color mappings from page.tsx constants
- Use Framer Motion `AnimatePresence` for expand/collapse

- [ ] **Step 3: Create BrandstofPanel component**

Create `src/app/(dashboard)/kilometers/components/BrandstofPanel.tsx`:
- 4 KPI cards in a grid: totaalBrandstof (€), kostenPerKm (€), kmPerLiter, trend vs vorige maand
- Data from `jaaroverzicht.brandstof` (already available in the API)
- Calculate `kmPerLiter` from `totaalKm / totaalLiters` (show "—" if no liter data)
- Only render if `brandstof.totaalBedrag > 0`

- [ ] **Step 4: Add panels to km page**

In `src/app/(dashboard)/kilometers/page.tsx`:
- Import `AnalyticsPanel` and `BrandstofPanel`
- Add both below the existing jaaroverzicht section
- Pass `jaaroverzichtData` as prop

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/jaaroverzicht/route.ts src/app/\(dashboard\)/kilometers/components/AnalyticsPanel.tsx src/app/\(dashboard\)/kilometers/components/BrandstofPanel.tsx src/hooks/queries/use-kilometers.ts src/app/\(dashboard\)/kilometers/page.tsx
git commit -m "feat(km): add goal-type analytics and fuel analytics panels"
```

---

## Task 12: Maandelijkse Email-Samenvatting

**Files:**
- Create: `src/app/api/kilometers/maandrapport/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create maandrapport endpoint**

```typescript
// src/app/api/kilometers/maandrapport/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kilometerRegistraties, gebruikers, kmStanden, brandstofKosten, klanten } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ fout: "Niet geautoriseerd" }, { status: 401 });
    }

    const nu = new Date();
    const vorigeMaand = nu.getMonth() === 0 ? 12 : nu.getMonth(); // 1-12
    const jaar = nu.getMonth() === 0 ? nu.getFullYear() - 1 : nu.getFullYear();
    const maandNamen = ["", "januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
    const maandNaam = maandNamen[vorigeMaand];

    const startDatum = `${jaar}-${String(vorigeMaand).padStart(2, "0")}-01`;
    const eindDatum = `${jaar}-${String(vorigeMaand).padStart(2, "0")}-31`;

    // Get active users
    const users = await db.select().from(gebruikers).where(eq(gebruikers.isActief, 1)).all();

    let verzonden = 0;

    for (const user of users) {
      if (!user.email) continue;

      // Monthly stats
      const stats = await db
        .select({
          totaalKm: sql<number>`COALESCE(SUM(${kilometerRegistraties.kilometers}), 0)`,
          aantalRitten: sql<number>`COUNT(*)`,
        })
        .from(kilometerRegistraties)
        .where(
          and(
            eq(kilometerRegistraties.gebruikerId, user.id),
            gte(kilometerRegistraties.datum, startDatum),
            lte(kilometerRegistraties.datum, eindDatum)
          )
        )
        .get();

      const km = stats?.totaalKm ?? 0;
      const ritten = stats?.aantalRitten ?? 0;
      const aftrekbaar = Math.round(km * 0.23 * 100) / 100;

      // Unique klanten
      const klantenData = await db
        .select({ klantId: kilometerRegistraties.klantId })
        .from(kilometerRegistraties)
        .where(
          and(
            eq(kilometerRegistraties.gebruikerId, user.id),
            gte(kilometerRegistraties.datum, startDatum),
            lte(kilometerRegistraties.datum, eindDatum)
          )
        )
        .groupBy(kilometerRegistraties.klantId)
        .all();
      const aantalKlanten = klantenData.filter((k) => k.klantId !== null).length;

      // Fuel costs
      const brandstof = await db
        .select({
          totaal: sql<number>`COALESCE(SUM(${brandstofKosten.bedrag}), 0)`,
        })
        .from(brandstofKosten)
        .where(
          and(
            eq(brandstofKosten.gebruikerId, user.id),
            gte(brandstofKosten.datum, startDatum),
            lte(brandstofKosten.datum, eindDatum)
          )
        )
        .get();

      // Check km-stand
      const kmStand = await db
        .select()
        .from(kmStanden)
        .where(
          and(
            eq(kmStanden.gebruikerId, user.id),
            eq(kmStanden.jaar, jaar),
            eq(kmStanden.maand, vorigeMaand)
          )
        )
        .get();

      const waarschuwingen: string[] = [];
      if (!kmStand) waarschuwingen.push(`Km-stand ${maandNaam} nog niet ingevuld`);
      if (ritten === 0) waarschuwingen.push("Geen ritten gelogd deze maand");

      const dashboardUrl = process.env.NEXT_PUBLIC_URL ?? "https://dashboard.autronis.nl";

      await resend.emails.send({
        from: "Autronis <noreply@autronis.nl>",
        to: user.email,
        subject: `Kilometerrapport ${maandNaam} ${jaar}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto;">
            <div style="background: #0E1719; padding: 20px 24px; border-radius: 12px 12px 0 0;">
              <div style="color: #17B8A5; font-weight: 600;">Autronis Kilometerrapport</div>
              <div style="color: #888; font-size: 14px;">${maandNaam} ${jaar} — Samenvatting</div>
            </div>
            <div style="background: #fff; padding: 24px; border-radius: 0 0 12px 12px;">
              <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <div style="flex: 1; text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                  <div style="font-size: 24px; font-weight: 700;">${Math.round(km)} km</div>
                  <div style="font-size: 12px; color: #888;">totaal gereden</div>
                </div>
                <div style="flex: 1; text-align: center; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                  <div style="font-size: 24px; font-weight: 700; color: #17B8A5;">€${aftrekbaar.toFixed(2)}</div>
                  <div style="font-size: 12px; color: #888;">aftrekbaar</div>
                </div>
              </div>
              <div style="font-size: 14px; color: #666; margin-bottom: 16px;">
                ${ritten} ritten · ${aantalKlanten} klanten bezocht · €${(brandstof?.totaal ?? 0).toFixed(2)} brandstof
              </div>
              ${waarschuwingen.length > 0 ? `<div style="padding: 12px; background: #FFF8E1; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #F57C00;">⚠️ ${waarschuwingen.join(" · ")}</div>` : ""}
              <div style="text-align: center;">
                <a href="${dashboardUrl}/kilometers" style="display: inline-block; padding: 10px 24px; background: #17B8A5; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">Bekijk in dashboard →</a>
              </div>
            </div>
          </div>
        `,
      });

      verzonden++;
    }

    return NextResponse.json({ verzonden });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add cron to vercel.json**

Add to the crons array:

```json
{ "path": "/api/kilometers/maandrapport", "schedule": "0 8 1 * *" }
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/maandrapport/ vercel.json
git commit -m "feat(km): add monthly email summary with Resend"
```

---

## Task 13: Verbeterd Belastingrapport

**Files:**
- Modify: `src/lib/belastingrapport-pdf.tsx`
- Modify: `src/app/api/kilometers/belastingrapport/route.ts`

- [ ] **Step 1: Extend BelastingrapportProps interface**

In `src/lib/belastingrapport-pdf.tsx`, add to the interface:

```typescript
interface BelastingrapportProps {
  // ... existing fields
  werkelijkPercentage: number | null;
  totaalGereden: number | null;
  brandstofPerMaand: { maand: number; bedrag: number; liters: number | null }[];
  kmStandFotos: { maand: number; bestandspad: string }[];
}
```

- [ ] **Step 2: Add new sections to the PDF document**

After the existing summary page, add 4 new sections:

1. **Km-stand bewijs:** Table with columns: Maand, BeginStand, EindStand, TotaalGereden, GelogdZakelijk, PrivéKm
2. **Zakelijk % onderbouwing:** Text block showing calculation: totaalGereden, totaalZakelijk, werkelijkPercentage
3. **Brandstofkosten detail:** Per-maand table with bedrag, liters (if available), km/liter
4. **Foto-bijlagen:** For each foto in `kmStandFotos`, render an `<Image>` component with the photo

Follow the exact same styling patterns (COL widths, `styles.tableRow`, TEAL accent) as existing pages.

- [ ] **Step 3: Update the belastingrapport API to pass new data**

In `src/app/api/kilometers/belastingrapport/route.ts`, add queries for:
- `werkelijkPercentage` and `totaalGereden` (same calculation as Task 9)
- `brandstofPerMaand`: group brandstofKosten by month
- `kmStandFotos`: select from `kmStandFotos` table for the year

Pass all new data to the `BelastingrapportPDF` component.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/belastingrapport-pdf.tsx src/app/api/kilometers/belastingrapport/route.ts
git commit -m "feat(km): enhance tax report with km-stand proof, fuel detail, and photos"
```

---

## Task 14: Mobile Quick-Entry (FAB + Bottom Sheet)

**Files:**
- Create: `src/app/(dashboard)/kilometers/components/MobileQuickEntry.tsx`
- Modify: `src/app/(dashboard)/kilometers/page.tsx`

- [ ] **Step 1: Create MobileQuickEntry component**

```typescript
// src/app/(dashboard)/kilometers/components/MobileQuickEntry.tsx
"use client";

import { useState, useEffect } from "react";
import { Plus, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useOpgeslagenRoutes, useUseRoute, useAfstandBerekening } from "@/hooks/queries/use-kilometers";
import { LocatieAutocomplete } from "./LocatieAutocomplete";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const DOEL_TYPES = [
  { waarde: "klantbezoek", label: "Klantbezoek" },
  { waarde: "meeting", label: "Meeting" },
  { waarde: "inkoop", label: "Inkoop" },
  { waarde: "netwerk", label: "Netwerk" },
  { waarde: "training", label: "Training" },
  { waarde: "boekhouder", label: "Boekhouder" },
  { waarde: "overig", label: "Overig" },
];

export function MobileQuickEntry() {
  const [open, setOpen] = useState(false);
  const [vanLocatie, setVanLocatie] = useState("");
  const [naarLocatie, setNaarLocatie] = useState("");
  const [kilometers, setKilometers] = useState("");
  const [doelType, setDoelType] = useState("klantbezoek");
  const [autoKm, setAutoKm] = useState(false);
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { data: routesData } = useOpgeslagenRoutes();
  const useRoute = useUseRoute();
  const afstandMutation = useAfstandBerekening();

  const routes = routesData?.routes ?? [];

  // Auto-fill "Van" with most used departure
  useEffect(() => {
    if (!vanLocatie && routes.length > 0) {
      // Find most common vanLocatie from routes
      const topRoute = routes[0];
      if (topRoute) setVanLocatie(topRoute.vanLocatie);
    }
  }, [routes, vanLocatie]);

  // Auto-calculate distance
  useEffect(() => {
    if (vanLocatie.length >= 3 && naarLocatie.length >= 3) {
      const timer = setTimeout(async () => {
        const result = await afstandMutation.mutateAsync({ van: vanLocatie, naar: naarLocatie });
        if (result) {
          setKilometers(String(result.afstandKm));
          setAutoKm(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [vanLocatie, naarLocatie]);

  const addRitMutation = useMutation({
    mutationFn: async (data: { datum: string; vanLocatie: string; naarLocatie: string; kilometers: number; doelType: string; isRetour: boolean }) => {
      const res = await fetch("/api/kilometers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Kon rit niet opslaan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kilometers"] });
    },
  });

  async function handleQuickRoute(route: typeof routes[0]) {
    const datum = new Date().toISOString().slice(0, 10);
    await addRitMutation.mutateAsync({
      datum,
      vanLocatie: route.vanLocatie,
      naarLocatie: route.naarLocatie,
      kilometers: route.kilometers,
      doelType: route.doelType ?? "overig",
      isRetour: false,
    });
    useRoute.mutate({ id: route.id });
    addToast("Rit toegevoegd!", "succes");
    setOpen(false);
  }

  async function handleSubmit(isRetour: boolean) {
    const km = parseFloat(kilometers);
    if (!vanLocatie || !naarLocatie || !km || km <= 0) {
      addToast("Vul alle velden in", "fout");
      return;
    }
    const datum = new Date().toISOString().slice(0, 10);
    await addRitMutation.mutateAsync({
      datum,
      vanLocatie,
      naarLocatie,
      kilometers: km,
      doelType,
      isRetour,
    });
    addToast(isRetour ? "Retourrit toegevoegd!" : "Rit toegevoegd!", "succes");
    setNaarLocatie("");
    setKilometers("");
    setAutoKm(false);
    setOpen(false);
  }

  return (
    <>
      {/* FAB - only visible on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-2xl bg-[var(--autronis-accent)] text-white shadow-lg shadow-[var(--autronis-accent)]/30 flex items-center justify-center active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--autronis-card)] rounded-t-3xl p-5 pb-8"
            >
              <div className="w-10 h-1 bg-[var(--autronis-border)] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--autronis-text)]">Nieuwe rit</h3>
                <button onClick={() => setOpen(false)}>
                  <X className="w-5 h-5 text-[var(--autronis-text-muted)]" />
                </button>
              </div>

              {/* Quick route chips */}
              {routes.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-[var(--autronis-text-muted)] mb-2 font-medium">Snelkeuze</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {routes.slice(0, 4).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleQuickRoute(r)}
                        className="shrink-0 px-3 py-2 rounded-xl bg-[var(--autronis-accent)]/10 border border-[var(--autronis-accent)]/20 text-left"
                      >
                        <div className="text-sm text-[var(--autronis-accent)]">{r.vanLocatie} → {r.naarLocatie}</div>
                        <div className="text-xs text-[var(--autronis-text-muted)]">{r.kilometers} km</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Compact form */}
              <div className="grid grid-cols-2 gap-3">
                <LocatieAutocomplete value={vanLocatie} onChange={setVanLocatie} label="Van" placeholder="Vertrek..." />
                <LocatieAutocomplete value={naarLocatie} onChange={setNaarLocatie} label="Naar" placeholder="Bestemming..." />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs text-[var(--autronis-text-muted)] mb-1.5 font-medium">Km {autoKm && <span className="text-[var(--autronis-accent)]">(auto)</span>}</label>
                  <input
                    type="number"
                    value={kilometers}
                    onChange={(e) => { setKilometers(e.target.value); setAutoKm(false); }}
                    className="w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-bg)] px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--autronis-text-muted)] mb-1.5 font-medium">Type</label>
                  <select
                    value={doelType}
                    onChange={(e) => setDoelType(e.target.value)}
                    className="w-full rounded-xl border border-[var(--autronis-border)] bg-[var(--autronis-bg)] px-4 py-2.5 text-sm"
                  >
                    {DOEL_TYPES.map((d) => (
                      <option key={d.waarde} value={d.waarde}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={addRitMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-[var(--autronis-accent)] text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  Toevoegen
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={addRitMutation.isPending}
                  className="flex-1 py-3 rounded-xl border border-[var(--autronis-accent)]/20 text-[var(--autronis-accent)] font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <CornerDownLeft className="w-4 h-4 inline mr-1" />
                  Retour
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 2: Add to km page**

In `src/app/(dashboard)/kilometers/page.tsx`:
- Import `MobileQuickEntry`
- Add `<MobileQuickEntry />` at the end of the page component (before the closing fragment)

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/\(dashboard\)/kilometers/components/MobileQuickEntry.tsx src/app/\(dashboard\)/kilometers/page.tsx
git commit -m "feat(km): add mobile floating action button with bottom sheet quick entry"
```

---

## Task 15: Km-stand Foto Upload

**Files:**
- Create: `src/app/api/kilometers/km-stand/foto/route.ts`
- Modify: `src/app/(dashboard)/kilometers/components/KmStandPanel.tsx`
- Modify: `src/hooks/queries/use-kilometers.ts`

- [ ] **Step 1: Create upload directory**

```bash
mkdir -p public/uploads/km-standen
echo "public/uploads/km-standen/*" >> .gitignore
echo "!public/uploads/km-standen/.gitkeep" >> .gitignore
touch public/uploads/km-standen/.gitkeep
```

- [ ] **Step 2: Create foto API endpoint**

```typescript
// src/app/api/kilometers/km-stand/foto/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kmStandFotos } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { writeFile, unlink } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const formData = await req.formData();
    const file = formData.get("foto") as File;
    const kmStandId = parseInt(formData.get("kmStandId") as string);

    if (!file || !kmStandId) {
      return NextResponse.json({ fout: "Foto en kmStandId zijn verplicht" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ fout: "Bestand mag maximaal 5MB zijn" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png"].includes(ext)) {
      return NextResponse.json({ fout: "Alleen JPEG en PNG bestanden" }, { status: 400 });
    }

    const bestandsnaam = `km-stand-${kmStandId}-${Date.now()}.${ext}`;
    const bestandspad = `/uploads/km-standen/${bestandsnaam}`;
    const fullPath = path.join(process.cwd(), "public", bestandspad);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buffer);

    const [foto] = await db
      .insert(kmStandFotos)
      .values({
        kmStandId,
        gebruikerId: gebruiker.id,
        bestandsnaam,
        bestandspad,
      })
      .returning();

    return NextResponse.json({ foto }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const kmStandId = parseInt(new URL(req.url).searchParams.get("kmStandId") ?? "");

    if (!kmStandId) {
      return NextResponse.json({ fout: "kmStandId is verplicht" }, { status: 400 });
    }

    const foto = await db
      .select()
      .from(kmStandFotos)
      .where(
        and(
          eq(kmStandFotos.kmStandId, kmStandId),
          eq(kmStandFotos.gebruikerId, gebruiker.id)
        )
      )
      .get();

    return NextResponse.json({ foto: foto ?? null });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const id = parseInt(new URL(req.url).searchParams.get("id") ?? "");

    if (!id) return NextResponse.json({ fout: "ID is verplicht" }, { status: 400 });

    const foto = await db
      .select()
      .from(kmStandFotos)
      .where(and(eq(kmStandFotos.id, id), eq(kmStandFotos.gebruikerId, gebruiker.id)))
      .get();

    if (foto) {
      const fullPath = path.join(process.cwd(), "public", foto.bestandspad);
      await unlink(fullPath).catch(() => {});
      await db.delete(kmStandFotos).where(eq(kmStandFotos.id, id)).run();
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

- [ ] **Step 3: Add hooks for foto upload**

Add to `src/hooks/queries/use-kilometers.ts`:

```typescript
export function useKmStandFoto(kmStandId: number | null) {
  return useQuery({
    queryKey: ["kilometers", "km-stand-foto", kmStandId],
    queryFn: async () => {
      if (!kmStandId) return null;
      const res = await fetch(`/api/kilometers/km-stand/foto?kmStandId=${kmStandId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.foto as { id: number; bestandspad: string; bestandsnaam: string } | null;
    },
    enabled: !!kmStandId,
    staleTime: 60000,
  });
}

export function useUploadKmStandFoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kmStandId, foto }: { kmStandId: number; foto: File }) => {
      const formData = new FormData();
      formData.append("foto", foto);
      formData.append("kmStandId", String(kmStandId));
      const res = await fetch("/api/kilometers/km-stand/foto", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload mislukt");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kilometers", "km-stand-foto", variables.kmStandId] });
    },
  });
}
```

- [ ] **Step 4: Add foto upload UI to KmStandPanel**

In `src/app/(dashboard)/kilometers/components/KmStandPanel.tsx`:
- Import `useKmStandFoto` and `useUploadKmStandFoto`
- Add a camera/upload zone next to the existing inputs
- Use `<input type="file" accept="image/*" capture="environment">` for mobile camera access
- Show preview when foto is uploaded
- Show existing foto if already saved

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/api/kilometers/km-stand/foto/ src/app/\(dashboard\)/kilometers/components/KmStandPanel.tsx src/hooks/queries/use-kilometers.ts public/uploads/km-standen/.gitkeep .gitignore
git commit -m "feat(km): add km-stand photo upload for tax proof"
```

---

## Task 16: Environment Variables + Final Verification

**Files:**
- Modify: `.env.local` (or `.env`)

- [ ] **Step 1: Add required env variables**

Add to the environment:
```
GOOGLE_MAPS_API_KEY=<key from Google Cloud Console - enable Directions API + Places API>
CRON_SECRET=<generate with: openssl rand -hex 32>
```

Also add `CRON_SECRET` to Vercel project settings.

- [ ] **Step 2: Full build verification**

Run:
```bash
npx tsc --noEmit
npm run build
```

Expected: Both pass without errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(km): Kilometerregistratie 2.0 — 15 features across automation, intelligence, analytics, and mobile UX"
```
