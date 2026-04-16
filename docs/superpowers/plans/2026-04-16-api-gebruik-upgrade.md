# API Gebruik Pagina Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade de API Gebruik pagina zodat alle 20+ services uit de codebase zichtbaar zijn met live status, configureerbare dashboard links vanuit een database tabel, en een drie-zone layout (status grid, AI kosten detail, service rijen).

**Architecture:** Nieuwe `api_services` tabel als service registry. De bestaande `/api/api-gebruik` route wordt gerefactord om services uit DB te lezen i.p.v. hardcoded. Nieuwe CRUD endpoints voor service beheer. Frontend herschreven met drie zones: compact status grid, prominent AI kosten blok, en klikbare service rijen per categorie.

**Tech Stack:** Next.js (App Router), Drizzle ORM, SQLite/Turso, TypeScript, Tailwind CSS, Lucide React

**Spec:** `docs/superpowers/specs/2026-04-16-api-gebruik-upgrade-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/db/schema.ts` | Modify | Add `apiServices` table definition |
| `drizzle/0008_api_services.sql` | Create | Migration: CREATE TABLE + seed data |
| `src/app/api/api-services/route.ts` | Create | GET all + POST new service |
| `src/app/api/api-services/[id]/route.ts` | Create | PUT + DELETE per service |
| `src/app/api/api-gebruik/route.ts` | Modify | Refactor to read from DB registry |
| `src/app/(dashboard)/api-gebruik/page.tsx` | Modify | Full rewrite: three-zone layout |

---

### Task 1: Database Schema & Migration

**Files:**
- Modify: `src/lib/db/schema.ts:1668` (after `apiTokenGebruik`)
- Create: `drizzle/0008_api_services.sql`

- [ ] **Step 1: Add Drizzle schema definition**

Add the `apiServices` table to `src/lib/db/schema.ts`, directly after the `apiTokenGebruik` block (after line 1668):

```typescript
// ============ API SERVICES REGISTRY ============

export const apiServices = sqliteTable("api_services", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  slug: text("slug").notNull().unique(),
  categorie: text("categorie", { enum: ["ai", "email", "media", "data", "betaal", "overig"] }).notNull().default("overig"),
  omschrijving: text("omschrijving"),
  envVar: text("env_var"),
  dashboardUrl: text("dashboard_url"),
  trackingType: text("tracking_type", { enum: ["db", "api", "geen"] }).notNull().default("geen"),
  kostenType: text("kosten_type", { enum: ["usage", "infra", "gratis"] }).notNull().default("infra"),
  providerSlug: text("provider_slug"),
  icon: text("icon"),
  volgorde: integer("volgorde").default(0),
  isActief: integer("is_actief").default(1),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Create migration file**

Create `drizzle/0008_api_services.sql`:

```sql
CREATE TABLE `api_services` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `naam` text NOT NULL,
  `slug` text NOT NULL,
  `categorie` text NOT NULL DEFAULT 'overig',
  `omschrijving` text,
  `env_var` text,
  `dashboard_url` text,
  `tracking_type` text NOT NULL DEFAULT 'geen',
  `kosten_type` text NOT NULL DEFAULT 'infra',
  `provider_slug` text,
  `icon` text,
  `volgorde` integer DEFAULT 0,
  `is_actief` integer DEFAULT 1,
  `aangemaakt_op` text DEFAULT (datetime('now')),
  `bijgewerkt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_services_slug_unique` ON `api_services` (`slug`);
--> statement-breakpoint

-- Seed data: alle services
INSERT INTO `api_services` (`naam`, `slug`, `categorie`, `omschrijving`, `env_var`, `dashboard_url`, `tracking_type`, `kosten_type`, `provider_slug`, `icon`, `volgorde`) VALUES
  ('Anthropic (Claude)', 'anthropic', 'ai', 'Core AI voor chat, analyse, content generatie', 'ANTHROPIC_API_KEY', 'https://console.anthropic.com/settings/billing', 'db', 'usage', 'anthropic', 'Brain', 1),
  ('OpenAI (GPT)', 'openai', 'ai', 'Meeting analyse, transcriptie verwerking', 'OPENAI_API_KEY', 'https://platform.openai.com/usage', 'db', 'usage', 'openai', 'Brain', 2),
  ('Groq (Llama)', 'groq', 'ai', 'Gratis snelle LLM fallback', 'GROQ_API_KEY', 'https://console.groq.com/settings/billing', 'db', 'usage', 'groq', 'Brain', 3),
  ('FAL.ai (Kling)', 'fal-ai', 'media', 'AI video generatie (image-to-video, upscaling)', 'FAL_API_KEY', 'https://fal.ai/dashboard/billing', 'api', 'usage', NULL, 'Video', 1),
  ('Firecrawl', 'firecrawl', 'overig', 'Web search & scraping voor leads en concurrenten', 'FIRECRAWL_API_KEY', 'https://www.firecrawl.dev/app', 'api', 'usage', NULL, 'Globe', 1),
  ('Resend', 'resend', 'email', 'Facturen, offertes, contracten versturen', 'RESEND_API_KEY', 'https://resend.com/overview', 'geen', 'usage', NULL, 'Mail', 1),
  ('AWS SES', 'aws-ses', 'email', 'Follow-ups en notificaties', 'AWS_ACCESS_KEY_ID', 'https://eu-west-1.console.aws.amazon.com/ses/home', 'geen', 'usage', NULL, 'Mail', 2),
  ('Recall.ai', 'recall-ai', 'media', 'Meeting opnames & transcriptie (Nova-3)', 'RECALL_API_KEY', 'https://www.recall.ai/dashboard', 'geen', 'usage', NULL, 'Video', 2),
  ('KIE AI', 'kie-ai', 'media', 'Banner & animatie generatie', 'KIE_API_KEY', 'https://kie.ai/dashboard', 'geen', 'usage', NULL, 'Video', 3),
  ('Notion', 'notion', 'data', 'Documenten, contracten, plannen, notities', 'NOTION_API_KEY', 'https://www.notion.so/my-integrations', 'geen', 'infra', NULL, 'Database', 1),
  ('Supabase (Main)', 'supabase', 'data', 'Auth, storage, database voor leads', 'SUPABASE_URL', 'https://supabase.com/dashboard/project/_/settings/billing/usage', 'geen', 'infra', NULL, 'Database', 2),
  ('Supabase (Leads)', 'supabase-leads', 'data', 'Syb''s lead-dashboard instance', 'SUPABASE_LEADS_URL', 'https://supabase.com/dashboard/project/hurzsuwaccglzoblqkxd', 'geen', 'infra', NULL, 'Database', 3),
  ('Turso', 'turso', 'data', 'SQLite database met replicatie', 'TURSO_DATABASE_URL', 'https://turso.tech/app', 'geen', 'infra', NULL, 'Database', 4),
  ('Vercel Blob', 'vercel-blob', 'data', 'File storage voor PDFs, scopes, media', 'BLOB_READ_WRITE_TOKEN', 'https://vercel.com/dashboard', 'geen', 'infra', NULL, 'Database', 5),
  ('Mollie', 'mollie', 'betaal', 'iDEAL betalingen voor facturen', 'MOLLIE_API_KEY', 'https://my.mollie.com/dashboard', 'geen', 'usage', NULL, 'CreditCard', 1),
  ('Revolut Business', 'revolut', 'betaal', 'Bankrekening sync & transacties', 'REVOLUT_CLIENT_ID', 'https://business.revolut.com', 'geen', 'infra', NULL, 'CreditCard', 2),
  ('Google Maps / Places', 'google-maps', 'overig', 'Afstanden, routes, bedrijfsinfo lookup', 'GOOGLE_MAPS_API_KEY', 'https://console.cloud.google.com/apis/dashboard', 'geen', 'usage', NULL, 'Globe', 2),
  ('GitHub', 'github', 'overig', 'Repo management, webhooks, issue tracking', 'GITHUB_TOKEN', 'https://github.com/orgs/autronis/settings/billing', 'geen', 'gratis', NULL, 'Globe', 3),
  ('Jina Reader', 'jina-reader', 'overig', 'Web scraping (gratis tier)', 'JINA_API_KEY', 'https://jina.ai/reader', 'geen', 'gratis', NULL, 'Globe', 4),
  ('Google OAuth', 'google-oauth', 'overig', 'Login, Gmail/Calendar toegang', 'GOOGLE_CLIENT_ID', 'https://console.cloud.google.com/apis/credentials', 'geen', 'gratis', NULL, 'Globe', 5);
```

- [ ] **Step 3: Run the migration**

```bash
cd /Users/semmiegijs/Autronis/Projects/autronis-dashboard
npx tsx src/lib/db/migrate.ts
```

If no migrate script exists, run directly:
```bash
sqlite3 data/autronis.db < drizzle/0008_api_services.sql
```

Verify:
```bash
sqlite3 data/autronis.db "SELECT COUNT(*) FROM api_services;"
```
Expected: `20`

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0008_api_services.sql
git commit -m "feat: add api_services registry table with seed data"
```

---

### Task 2: CRUD API Routes for Service Registry

**Files:**
- Create: `src/app/api/api-services/route.ts`
- Create: `src/app/api/api-services/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

Create `src/app/api/api-services/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiServices } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// GET /api/api-services — alle services ophalen
export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select()
      .from(apiServices)
      .where(eq(apiServices.isActief, 1))
      .orderBy(asc(apiServices.categorie), asc(apiServices.volgorde));

    return NextResponse.json({ services: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}

// POST /api/api-services — nieuwe service toevoegen
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    if (!body.naam?.trim()) {
      return NextResponse.json({ fout: "Naam is verplicht" }, { status: 400 });
    }

    const slug = body.slug?.trim() || body.naam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [nieuw] = await db
      .insert(apiServices)
      .values({
        naam: body.naam.trim(),
        slug,
        categorie: body.categorie || "overig",
        omschrijving: body.omschrijving?.trim() || null,
        envVar: body.envVar?.trim() || null,
        dashboardUrl: body.dashboardUrl?.trim() || null,
        trackingType: body.trackingType || "geen",
        kostenType: body.kostenType || "infra",
        providerSlug: body.providerSlug?.trim() || null,
        icon: body.icon?.trim() || null,
        volgorde: body.volgorde ?? 0,
      })
      .returning();

    return NextResponse.json({ service: nieuw }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    if (message.includes("UNIQUE constraint")) {
      return NextResponse.json({ fout: "Een service met deze slug bestaat al" }, { status: 409 });
    }
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}
```

- [ ] **Step 2: Create PUT + DELETE route**

Create `src/app/api/api-services/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiServices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// PUT /api/api-services/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {
      bijgewerktOp: new Date().toISOString(),
    };
    if (body.naam !== undefined) updateData.naam = body.naam.trim();
    if (body.slug !== undefined) updateData.slug = body.slug.trim();
    if (body.categorie !== undefined) updateData.categorie = body.categorie;
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.envVar !== undefined) updateData.envVar = body.envVar?.trim() || null;
    if (body.dashboardUrl !== undefined) updateData.dashboardUrl = body.dashboardUrl?.trim() || null;
    if (body.trackingType !== undefined) updateData.trackingType = body.trackingType;
    if (body.kostenType !== undefined) updateData.kostenType = body.kostenType;
    if (body.providerSlug !== undefined) updateData.providerSlug = body.providerSlug?.trim() || null;
    if (body.icon !== undefined) updateData.icon = body.icon?.trim() || null;
    if (body.volgorde !== undefined) updateData.volgorde = body.volgorde;

    const [bijgewerkt] = await db
      .update(apiServices)
      .set(updateData)
      .where(eq(apiServices.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Service niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ service: bijgewerkt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}

// DELETE /api/api-services/[id] (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await db
      .update(apiServices)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(apiServices.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/api-services/route.ts src/app/api/api-services/\[id\]/route.ts
git commit -m "feat: CRUD endpoints for api_services registry"
```

---

### Task 3: Refactor `/api/api-gebruik` Route

**Files:**
- Modify: `src/app/api/api-gebruik/route.ts` (full rewrite)

- [ ] **Step 1: Rewrite the route to read from DB registry**

Replace the entire contents of `src/app/api/api-gebruik/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiTokenGebruik, apiServices } from "@/lib/db/schema";
import { sql, gte, eq, asc, desc } from "drizzle-orm";

interface ServiceResponse {
  id: number;
  naam: string;
  slug: string;
  categorie: string;
  omschrijving: string | null;
  dashboardUrl: string | null;
  kostenType: string;
  status: "actief" | "niet_geconfigureerd";
  laatsteCall?: string | null;
  gebruik?: {
    verbruikt: string;
    limiet?: string;
    eenheid: string;
    percentage?: number;
    details?: string;
  };
  fout?: string;
}

interface TokenStats {
  provider: string;
  totalInput: number;
  totalOutput: number;
  totalKosten: number;
  aantalCalls: number;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

async function getMonthStart(): Promise<string> {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchTokenStats(monthStart: string): Promise<TokenStats[]> {
  try {
    return await db
      .select({
        provider: apiTokenGebruik.provider,
        totalInput: sql<number>`COALESCE(SUM(${apiTokenGebruik.inputTokens}), 0)`,
        totalOutput: sql<number>`COALESCE(SUM(${apiTokenGebruik.outputTokens}), 0)`,
        totalKosten: sql<number>`COALESCE(SUM(${apiTokenGebruik.kostenCent}), 0)`,
        aantalCalls: sql<number>`COUNT(*)`,
      })
      .from(apiTokenGebruik)
      .where(gte(apiTokenGebruik.aangemaaktOp, monthStart))
      .groupBy(apiTokenGebruik.provider)
      .all();
  } catch {
    return [];
  }
}

async function fetchLaatsteCallPerProvider(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({
        provider: apiTokenGebruik.provider,
        laatsteCall: sql<string>`MAX(${apiTokenGebruik.aangemaaktOp})`,
      })
      .from(apiTokenGebruik)
      .groupBy(apiTokenGebruik.provider)
      .all();

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.provider] = row.laatsteCall;
    }
    return result;
  } catch {
    return {};
  }
}

function checkEnvVar(envVar: string | null): boolean {
  if (!envVar) return true; // no env var to check = assume active
  return !!process.env[envVar];
}

async function fetchFalUsage(): Promise<{ gebruik?: ServiceResponse["gebruik"]; fout?: string }> {
  const key = process.env.FAL_API_KEY;
  if (!key) return {};

  try {
    const res = await fetch("https://rest.fal.run/billing/usage", {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return {
      gebruik: {
        verbruikt: data.total_usage_usd ? `$${Number(data.total_usage_usd).toFixed(2)}` : String(data.total_usage ?? "onbekend"),
        eenheid: "credits",
      },
    };
  } catch (e) {
    return { fout: String(e) };
  }
}

async function fetchFirecrawlUsage(): Promise<{ gebruik?: ServiceResponse["gebruik"]; fout?: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return {};

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/team/credits", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const remaining = data.data?.remaining_credits ?? data.remaining_credits;
    const used = data.data?.total_credits_used ?? data.total_credits_used;
    const total = remaining != null && used != null ? remaining + used : undefined;

    return {
      gebruik: {
        verbruikt: String(used ?? "onbekend"),
        limiet: total != null ? String(total) : undefined,
        eenheid: "credits",
        percentage: total ? Math.round((used / total) * 100) : undefined,
      },
    };
  } catch (e) {
    return { fout: String(e) };
  }
}

async function fetchRouteBreakdown(monthStart: string) {
  try {
    return await db
      .select({
        route: apiTokenGebruik.route,
        provider: apiTokenGebruik.provider,
        aantalCalls: sql<number>`COUNT(*)`,
        kostenCent: sql<number>`COALESCE(SUM(${apiTokenGebruik.kostenCent}), 0)`,
        tokens: sql<number>`COALESCE(SUM(${apiTokenGebruik.inputTokens}) + SUM(${apiTokenGebruik.outputTokens}), 0)`,
      })
      .from(apiTokenGebruik)
      .where(gte(apiTokenGebruik.aangemaaktOp, monthStart))
      .groupBy(apiTokenGebruik.route, apiTokenGebruik.provider)
      .orderBy(sql`SUM(${apiTokenGebruik.kostenCent}) DESC`)
      .all();
  } catch {
    return [];
  }
}

// Map of slug -> fetch function for API-tracked services
const apiFetchers: Record<string, () => Promise<{ gebruik?: ServiceResponse["gebruik"]; fout?: string }>> = {
  "fal-ai": fetchFalUsage,
  "firecrawl": fetchFirecrawlUsage,
};

export async function GET() {
  await requireAuth();

  // 1. Load service registry from DB
  const registeredServices = await db
    .select()
    .from(apiServices)
    .where(eq(apiServices.isActief, 1))
    .orderBy(asc(apiServices.categorie), asc(apiServices.volgorde));

  const monthStart = await getMonthStart();

  // 2. Fetch all tracking data in parallel
  const [allStats, laatsteCallMap, routeBreakdown] = await Promise.all([
    fetchTokenStats(monthStart),
    fetchLaatsteCallPerProvider(),
    fetchRouteBreakdown(monthStart),
  ]);

  // 3. Fetch API-tracked usage in parallel
  const apiSlugs = registeredServices
    .filter(s => s.trackingType === "api" && apiFetchers[s.slug])
    .map(s => s.slug);

  const apiResults: Record<string, { gebruik?: ServiceResponse["gebruik"]; fout?: string }> = {};
  const apiPromises = apiSlugs.map(async (slug) => {
    apiResults[slug] = await apiFetchers[slug]();
  });
  await Promise.all(apiPromises);

  // 4. Build response per service
  const services: ServiceResponse[] = registeredServices.map(svc => {
    const isConfigured = checkEnvVar(svc.envVar);
    const base: ServiceResponse = {
      id: svc.id,
      naam: svc.naam,
      slug: svc.slug,
      categorie: svc.categorie,
      omschrijving: svc.omschrijving,
      dashboardUrl: svc.dashboardUrl,
      kostenType: svc.kostenType,
      status: isConfigured ? "actief" : "niet_geconfigureerd",
    };

    // DB-tracked: add usage from token stats + laatste call
    if (svc.trackingType === "db" && svc.providerSlug) {
      const stats = allStats.find(s => s.provider === svc.providerSlug);
      base.laatsteCall = laatsteCallMap[svc.providerSlug] ?? null;

      if (stats && stats.aantalCalls > 0) {
        const totalTokens = stats.totalInput + stats.totalOutput;
        const kostenEuro = (stats.totalKosten / 100).toFixed(2);
        base.gebruik = {
          verbruikt: `€${kostenEuro}`,
          eenheid: "deze maand",
          details: `${formatTokens(totalTokens)} tokens (${formatTokens(stats.totalInput)} in / ${formatTokens(stats.totalOutput)} uit) · ${stats.aantalCalls} calls`,
        };
      } else if (isConfigured) {
        base.gebruik = {
          verbruikt: "Nog geen data",
          eenheid: "tokens",
          details: "Tracking actief — gebruik wordt automatisch bijgehouden",
        };
      }
    }

    // API-tracked: add fetched usage
    if (svc.trackingType === "api" && apiResults[svc.slug]) {
      const result = apiResults[svc.slug];
      if (result.gebruik) base.gebruik = result.gebruik;
      if (result.fout) base.fout = result.fout;
    }

    return base;
  });

  // 5. AI detail aggregate
  const aiProviders = registeredServices
    .filter(s => s.categorie === "ai" && s.trackingType === "db" && s.providerSlug)
    .map(svc => {
      const stats = allStats.find(s => s.provider === svc.providerSlug);
      return {
        naam: svc.naam,
        calls: stats?.aantalCalls ?? 0,
        tokens: {
          input: stats?.totalInput ?? 0,
          output: stats?.totalOutput ?? 0,
          totaal: (stats?.totalInput ?? 0) + (stats?.totalOutput ?? 0),
        },
        kostenEuro: stats ? (stats.totalKosten / 100).toFixed(2) : "0.00",
        laatsteCall: laatsteCallMap[svc.providerSlug!] ?? null,
      };
    });

  const totaalAiKostenCent = allStats.reduce((sum, s) => sum + s.totalKosten, 0);
  const totaalAiCalls = allStats.reduce((sum, s) => sum + s.aantalCalls, 0);

  return NextResponse.json({
    services,
    aiDetail: {
      totaalKostenEuro: (totaalAiKostenCent / 100).toFixed(2),
      totaalCalls: totaalAiCalls,
      providers: aiProviders,
    },
    routeBreakdown,
  });
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Test manually**

```bash
npm run dev
# In another terminal:
curl -s http://localhost:3000/api/api-gebruik -H "Cookie: <session cookie>" | python3 -m json.tool | head -40
```

Verify: response has `services` array with 20 entries, `aiDetail` object, `routeBreakdown` array.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/api-gebruik/route.ts
git commit -m "refactor: api-gebruik route reads from api_services registry"
```

---

### Task 4: Frontend — Three-Zone Page Rewrite

**Files:**
- Modify: `src/app/(dashboard)/api-gebruik/page.tsx` (full rewrite)

This is the largest task. The page gets a complete rewrite with three zones.

- [ ] **Step 1: Rewrite the page component**

Replace the entire contents of `src/app/(dashboard)/api-gebruik/page.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, ExternalLink, RefreshCw, Loader2, Plus,
  Brain, Mail, Video, Database, CreditCard, Globe,
  ChevronRight, X,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────

interface ServiceEntry {
  id: number;
  naam: string;
  slug: string;
  categorie: string;
  omschrijving: string | null;
  dashboardUrl: string | null;
  kostenType: string;
  status: "actief" | "niet_geconfigureerd";
  laatsteCall?: string | null;
  gebruik?: {
    verbruikt: string;
    limiet?: string;
    eenheid: string;
    percentage?: number;
    details?: string;
  };
  fout?: string;
}

interface AiProvider {
  naam: string;
  calls: number;
  tokens: { input: number; output: number; totaal: number };
  kostenEuro: string;
  laatsteCall: string | null;
}

interface AiDetail {
  totaalKostenEuro: string;
  totaalCalls: number;
  providers: AiProvider[];
}

interface RouteBreakdown {
  route: string;
  provider: string;
  aantalCalls: number;
  kostenCent: number;
  tokens: number;
}

// ── Constants ──────────────────────────────────────────

const categorieIcons: Record<string, typeof Brain> = {
  ai: Brain, email: Mail, media: Video,
  data: Database, betaal: CreditCard, overig: Globe,
};

const categorieLabels: Record<string, string> = {
  ai: "AI & Taal", email: "E-mail", media: "Media & Video",
  data: "Data & Opslag", betaal: "Betaal & Bank", overig: "Overig",
};

const ROUTE_LABELS: Record<string, string> = {
  "/api/ai/chat": "AI Chat",
  "/api/yt-knowledge/analyze": "YouTube Analyse",
  "/api/agenda/ai-plan": "Agenda AI Planning",
  "/api/agenda/taken/schat-duur": "Taak Duurschatting",
  "/api/second-brain/verwerken": "Second Brain",
  "/api/second-brain/zoeken": "Second Brain Zoeken",
  "/api/bank/transacties/analyse": "Bank Analyse",
  "/api/bank/bonnetje": "Bonnetje Scan",
  "/api/bank/email-factuur": "Email Factuur",
  "/api/contract-analyse": "Contract Analyse",
  "/api/documenten/ai-create": "Document Generatie",
  "/api/belasting/tips/genereer": "Belasting Tips",
  "/api/ideeen/analyse": "Ideeën Analyse",
  "/api/mealplan": "Mealplan",
  "/api/mealplan/chat": "Mealplan Chat",
  "/api/radar/vraag-claude": "Radar Vraag",
  "/api/radar/week-samenvatting": "Radar Samenvatting",
  "/api/ops-room/orchestrate": "Ops Room",
  "/api/ops-room/execute": "Ops Room Execute",
  "/api/animaties/generate": "Animatie Generatie",
  "/api/content/videos/chat": "Video Chat",
  "/api/meetings/transcript": "Meeting Transcript",
  "/api/meetings/verwerk": "Meeting Verwerking",
  "/api/klanten/verrijk": "Klant Verrijking",
  "/api/screen-time/sessies": "Screen Time Sessies",
  "/api/uitgaven/scan": "Uitgaven Scan",
  "ai/client": "AI Client (Groq/Anthropic)",
};

const kostenTypeBadge: Record<string, { label: string; className: string }> = {
  usage: { label: "usage-based", className: "bg-autronis-accent/15 text-autronis-accent" },
  infra: { label: "infra", className: "bg-blue-500/15 text-blue-400" },
  gratis: { label: "gratis", className: "bg-emerald-500/10 text-emerald-400" },
};

// ── Helpers ────────────────────────────────────────────

function timeAgo(isoString: string | null | undefined): string | null {
  if (!isoString) return null;
  const date = new Date(isoString.replace(" ", "T") + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} uur geleden`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d geleden`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

// ── Add Service Modal ──────────────────────────────────

function AddServiceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [naam, setNaam] = useState("");
  const [categorie, setCategorie] = useState("overig");
  const [omschrijving, setOmschrijving] = useState("");
  const [envVar, setEnvVar] = useState("");
  const [dashboardUrl, setDashboardUrl] = useState("");
  const [kostenType, setKostenType] = useState("infra");
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const handleSave = async () => {
    if (!naam.trim()) { addToast("Naam is verplicht", "fout"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/api-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          naam: naam.trim(),
          categorie,
          omschrijving: omschrijving.trim() || null,
          envVar: envVar.trim() || null,
          dashboardUrl: dashboardUrl.trim() || null,
          kostenType,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout || "Kon service niet toevoegen");
      }
      addToast("Service toegevoegd", "succes");
      onAdded();
      onClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Fout", "fout");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent/50 transition-colors";
  const labelClass = "block text-xs font-medium text-autronis-text-secondary mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-autronis-text-primary">Service toevoegen</h2>
          <button onClick={onClose} className="text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Naam *</label>
            <input className={inputClass} value={naam} onChange={e => setNaam(e.target.value)} placeholder="Bijv. Stripe" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Categorie</label>
              <select className={inputClass} value={categorie} onChange={e => setCategorie(e.target.value)}>
                {Object.entries(categorieLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Kosten type</label>
              <select className={inputClass} value={kostenType} onChange={e => setKostenType(e.target.value)}>
                <option value="usage">Usage-based</option>
                <option value="infra">Infra (abonnement)</option>
                <option value="gratis">Gratis</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Omschrijving</label>
            <input className={inputClass} value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Wat doet deze service?" />
          </div>
          <div>
            <label className={labelClass}>Env variable naam</label>
            <input className={inputClass} value={envVar} onChange={e => setEnvVar(e.target.value)} placeholder="Bijv. STRIPE_API_KEY" />
          </div>
          <div>
            <label className={labelClass}>Dashboard URL</label>
            <input className={inputClass} value={dashboardUrl} onChange={e => setDashboardUrl(e.target.value)} placeholder="https://dashboard.stripe.com" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            Annuleren
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !naam.trim()}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-autronis-accent text-white hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Toevoegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function ApiGebruikPage() {
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [aiDetail, setAiDetail] = useState<AiDetail | null>(null);
  const [routeBreakdown, setRouteBreakdown] = useState<RouteBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/api-gebruik");
      if (!res.ok) throw new Error("Kon API gebruik niet ophalen");
      const data = await res.json();
      setServices(data.services ?? []);
      setAiDetail(data.aiDetail ?? null);
      setRouteBreakdown(data.routeBreakdown ?? []);
      if (isRefresh) addToast("Gebruik ververst", "succes");
    } catch {
      addToast("Fout bij ophalen API gebruik", "fout");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeCount = services.filter(s => s.status === "actief").length;
  const nonAiServices = services.filter(s => s.categorie !== "ai");
  const grouped = nonAiServices.reduce<Record<string, ServiceEntry[]>>((acc, svc) => {
    if (!acc[svc.categorie]) acc[svc.categorie] = [];
    acc[svc.categorie].push(svc);
    return acc;
  }, {});
  const categoryOrder = ["media", "email", "data", "betaal", "overig"];

  const currentMonth = new Date().toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">API Gebruik</h1>
            <p className="text-sm text-autronis-text-secondary mt-1">
              Alle services in één overzicht — live status en kosten
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-card border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 transition-all disabled:opacity-50"
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Verversen
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-card border border-autronis-accent/30 text-sm text-autronis-accent hover:bg-autronis-accent/10 transition-all"
            >
              <Plus size={14} />
              Service toevoegen
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-autronis-accent" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Zone 1: Status Grid ── */}
            <div>
              <h2 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-3">
                Alle Services ({activeCount}/{services.length} actief)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
                {services.map(svc => {
                  const isActive = svc.status === "actief";
                  const ago = timeAgo(svc.laatsteCall);
                  return (
                    <div
                      key={svc.slug}
                      className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2.5 flex items-center gap-2.5 hover:border-autronis-border/80 transition-colors"
                    >
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isActive
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                            : "bg-neutral-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isActive ? "text-autronis-text-primary" : "text-autronis-text-secondary/50"}`}>
                          {svc.naam}
                        </div>
                        {ago && (
                          <div className="text-[10px] text-autronis-text-secondary/60">{ago}</div>
                        )}
                        {!ago && isActive && (
                          <div className="text-[10px] text-autronis-text-secondary/40">actief</div>
                        )}
                        {!isActive && (
                          <div className="text-[10px] text-autronis-text-secondary/30">niet geconfigureerd</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Zone 2: AI Kosten Detail ── */}
            {aiDetail && (
              <div className="bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-autronis-accent/10">
                      <Brain size={20} className="text-autronis-accent" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-autronis-text-primary">
                        AI Kosten — {currentMonth}
                      </h2>
                      <p className="text-xs text-autronis-text-secondary">
                        {aiDetail.totaalCalls.toLocaleString("nl-NL")} calls deze maand
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-autronis-accent">
                      &euro;{aiDetail.totaalKostenEuro}
                    </div>
                  </div>
                </div>

                {/* Provider cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {aiDetail.providers.map(p => (
                    <div key={p.naam} className="bg-autronis-bg/50 border border-autronis-border/50 rounded-xl p-4">
                      <div className="text-sm font-semibold text-autronis-text-primary">{p.naam}</div>
                      <div className="text-xs text-autronis-text-secondary mt-0.5">
                        {p.calls.toLocaleString("nl-NL")} calls · {formatTokens(p.tokens.totaal)} tokens
                      </div>
                      <div className={`text-xl font-bold mt-2 ${Number(p.kostenEuro) === 0 ? "text-emerald-400" : "text-autronis-accent"}`}>
                        {Number(p.kostenEuro) === 0 ? (
                          <>€0,00 <span className="text-xs font-normal">gratis</span></>
                        ) : (
                          `€${p.kostenEuro}`
                        )}
                      </div>
                      {p.laatsteCall && (
                        <div className="text-[10px] text-autronis-text-secondary/50 mt-1">
                          Laatste call: {timeAgo(p.laatsteCall)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Route breakdown table */}
                {routeBreakdown.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-3">
                      Kosten per Feature
                    </h3>
                    <div className="bg-autronis-bg/30 border border-autronis-border/50 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-autronis-border/50">
                            <th className="text-left p-3 text-xs font-semibold text-autronis-text-secondary">Feature</th>
                            <th className="text-left p-3 text-xs font-semibold text-autronis-text-secondary">Provider</th>
                            <th className="text-right p-3 text-xs font-semibold text-autronis-text-secondary">Calls</th>
                            <th className="text-right p-3 text-xs font-semibold text-autronis-text-secondary">Tokens</th>
                            <th className="text-right p-3 text-xs font-semibold text-autronis-text-secondary">Kosten</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routeBreakdown.map((r, i) => {
                            const maxKosten = routeBreakdown[0]?.kostenCent || 1;
                            const barWidth = Math.max(4, (r.kostenCent / maxKosten) * 100);
                            return (
                              <tr key={i} className="border-b border-autronis-border/30 last:border-0 hover:bg-autronis-accent/5 transition-colors">
                                <td className="p-3">
                                  <span className="text-autronis-text-primary font-medium">
                                    {ROUTE_LABELS[r.route || ""] || r.route || "Onbekend"}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    r.provider === "anthropic" ? "bg-orange-500/10 text-orange-400" :
                                    r.provider === "openai" ? "bg-emerald-500/10 text-emerald-400" :
                                    "bg-blue-500/10 text-blue-400"
                                  }`}>
                                    {r.provider === "anthropic" ? "Claude" : r.provider === "openai" ? "GPT" : r.provider}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-autronis-text-secondary">{r.aantalCalls}</td>
                                <td className="p-3 text-right text-autronis-text-secondary">
                                  {r.tokens >= 1_000_000 ? `${(r.tokens / 1_000_000).toFixed(1)}M` :
                                   r.tokens >= 1_000 ? `${(r.tokens / 1_000).toFixed(1)}K` :
                                   r.tokens}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-autronis-border rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-autronis-accent rounded-full"
                                        style={{ width: `${barWidth}%` }}
                                      />
                                    </div>
                                    <span className="text-autronis-text-primary font-medium min-w-[60px] text-right">
                                      {r.kostenCent > 0 ? `€${(r.kostenCent / 100).toFixed(2)}` : "Gratis"}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Zone 3: Service Rijen per Categorie ── */}
            <div className="space-y-6">
              {categoryOrder.map(cat => {
                const entries = grouped[cat];
                if (!entries || entries.length === 0) return null;
                const CatIcon = categorieIcons[cat] || Globe;

                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-3">
                      <CatIcon size={16} className="text-autronis-accent" />
                      <h2 className="text-sm font-semibold text-autronis-text-secondary">
                        {categorieLabels[cat]}
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {entries.map(svc => {
                        const isActive = svc.status === "actief";
                        const badge = kostenTypeBadge[svc.kostenType] || kostenTypeBadge.infra;
                        const isExpanded = expandedSlug === svc.slug;

                        return (
                          <div key={svc.slug}>
                            <div
                              onClick={() => setExpandedSlug(isExpanded ? null : svc.slug)}
                              className={`bg-autronis-card border border-autronis-border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:border-autronis-accent/20 transition-all ${
                                isExpanded ? "rounded-b-none border-b-transparent" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    isActive
                                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]"
                                      : "bg-neutral-600"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <span className={`text-sm font-medium ${isActive ? "text-autronis-text-primary" : "text-autronis-text-secondary/50"}`}>
                                    {svc.naam}
                                  </span>
                                  {svc.omschrijving && (
                                    <span className="text-xs text-autronis-text-secondary ml-2 hidden sm:inline">
                                      {svc.omschrijving}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {svc.gebruik && (
                                  <span className="text-xs text-autronis-text-secondary hidden md:inline">
                                    {svc.gebruik.verbruikt} {svc.gebruik.eenheid}
                                  </span>
                                )}
                                <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                                {svc.dashboardUrl && (
                                  <a
                                    href={svc.dashboardUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                                <ChevronRight
                                  size={14}
                                  className={`text-autronis-text-secondary/30 transition-transform duration-200 ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div className="bg-autronis-bg/50 border border-autronis-border border-t-0 rounded-b-xl px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Status</div>
                                    <div className={isActive ? "text-emerald-400" : "text-autronis-text-secondary/50"}>
                                      {isActive ? "Actief" : "Niet geconfigureerd"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Kosten type</div>
                                    <div className="text-autronis-text-primary">{badge.label}</div>
                                  </div>
                                  {svc.gebruik && (
                                    <div>
                                      <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Gebruik</div>
                                      <div className="text-autronis-text-primary">{svc.gebruik.verbruikt} {svc.gebruik.eenheid}</div>
                                      {svc.gebruik.details && (
                                        <div className="text-autronis-text-secondary/50 mt-0.5">{svc.gebruik.details}</div>
                                      )}
                                    </div>
                                  )}
                                  {svc.dashboardUrl && (
                                    <div>
                                      <div className="text-autronis-text-secondary/50 uppercase tracking-wider mb-1">Dashboard</div>
                                      <a
                                        href={svc.dashboardUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-autronis-accent hover:text-autronis-accent-hover transition-colors inline-flex items-center gap-1"
                                      >
                                        Openen <ExternalLink size={10} />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Add Service Modal */}
        {showAddModal && (
          <AddServiceModal
            onClose={() => setShowAddModal(false)}
            onAdded={() => fetchData(true)}
          />
        )}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any unused import warnings (remove `Activity` if unused).

- [ ] **Step 3: Visual test in browser**

```bash
npm run dev
```

Open `http://localhost:3000/api-gebruik` in de browser. Verify:
- Zone 1: status grid shows all services with green/gray dots
- Zone 2: AI kosten section shows providers + route breakdown
- Zone 3: service rows grouped by category, expand/collapse works
- "+ Service toevoegen" button opens modal
- "Verversen" button reloads data
- External links open in new tab

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/api-gebruik/page.tsx
git commit -m "feat: three-zone layout for API gebruik page

Status grid, AI costs detail, expandable service rows.
Services from DB registry, add-service modal."
```

---

### Task 5: Final Verification & Cleanup

- [ ] **Step 1: Full type check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: successful build with no errors

- [ ] **Step 3: End-to-end manual test**

1. Open `/api-gebruik` — verify all 20 services visible
2. Click a service row — verify expand shows details + dashboard link
3. Click external link icon — verify opens correct URL in new tab
4. Click "+ Service toevoegen" — add a test service
5. Verify new service appears in the grid after adding
6. Click "Verversen" — verify data reloads
7. Check AI kosten section shows real data from `api_token_gebruik`

- [ ] **Step 4: Remove test service**

If you added a test service in step 3, remove it:
```bash
sqlite3 data/autronis.db "UPDATE api_services SET is_actief = 0 WHERE slug = '<test-slug>';"
```

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: cleanup after API gebruik page verification"
```
