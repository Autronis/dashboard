# Sales Engine MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Sales Engine that automatically scrapes prospect websites and generates AI-powered automation opportunity reports when a Cal.com booking comes in.

**Architecture:** Cal.com → n8n → POST /api/sales-engine/scan → fetch-based scraper + Claude AI analysis → store in SQLite → display in dashboard. Synchronous flow, no job queue.

**Tech Stack:** Next.js App Router, Drizzle ORM + SQLite, Anthropic SDK, fetch-based scraping, React Query, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-17-sales-engine-design.md`

---

## Task 1: Database Schema

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Add salesEngineScans table to schema**

Add at the end of `src/lib/db/schema.ts`:

```typescript
export const salesEngineScans = sqliteTable("sales_engine_scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").references(() => leads.id),
  websiteUrl: text("website_url").notNull(),
  bedrijfsgrootte: text("bedrijfsgrootte"),
  rol: text("rol"),
  grootsteKnelpunt: text("grootste_knelpunt"),
  huidigeTools: text("huidige_tools"),
  opmerkingen: text("opmerkingen"),
  scrapeResultaat: text("scrape_resultaat"),
  aiAnalyse: text("ai_analyse"),
  samenvatting: text("samenvatting"),
  status: text("status", { enum: ["pending", "completed", "failed"] }).notNull().default("pending"),
  foutmelding: text("foutmelding"),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Add salesEngineKansen table to schema**

Add right after `salesEngineScans`:

```typescript
export const salesEngineKansen = sqliteTable("sales_engine_kansen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scanId: integer("scan_id").references(() => salesEngineScans.id, { onDelete: "cascade" }),
  titel: text("titel").notNull(),
  beschrijving: text("beschrijving").notNull(),
  categorie: text("categorie", { enum: ["lead_gen", "communicatie", "administratie", "data", "content"] }).notNull(),
  impact: text("impact", { enum: ["hoog", "midden", "laag"] }).notNull(),
  geschatteTijdsbesparing: text("geschatte_tijdsbesparing"),
  prioriteit: integer("prioriteit").notNull(),
});
```

- [ ] **Step 3: Generate and run migration**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx drizzle-kit generate && npx drizzle-kit push`

Expected: Migration created and applied, two new tables in the SQLite database.

- [ ] **Step 4: Verify tables exist**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsx -e "const Database = require('better-sqlite3'); const db = new Database('./data/autronis.db'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sales_engine%'\").all());"`

Expected: `[{ name: 'sales_engine_scans' }, { name: 'sales_engine_kansen' }]`

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat(sales-engine): add database schema for scans and kansen tables"
```

---

## Task 2: Website Scraper

**Files:**
- Create: `src/lib/sales-engine/scraper.ts`

- [ ] **Step 1: Create the scraper module**

Create `src/lib/sales-engine/scraper.ts`:

```typescript
const FETCH_TIMEOUT = 5_000;
const MAX_SUBPAGES = 5;
const MAX_BODY_LENGTH = 2_000;

const COMMON_SUBPAGES = [
  "/over-ons", "/about", "/about-us",
  "/diensten", "/services",
  "/contact",
  "/producten", "/products",
  "/team",
  "/prijzen", "/pricing",
];

const TECH_SIGNATURES: Record<string, RegExp[]> = {
  WordPress: [/wp-content/i, /wp-includes/i, /wordpress/i],
  Shopify: [/cdn\.shopify\.com/i, /shopify/i],
  Wix: [/wix\.com/i, /wixsite/i],
  Squarespace: [/squarespace/i, /static1\.squarespace/i],
  WooCommerce: [/woocommerce/i, /wc-/i],
  React: [/__next/i, /react/i, /_next\/static/i],
  "Next.js": [/_next\//i, /__NEXT_DATA__/i],
  Webflow: [/webflow/i],
  Magento: [/magento/i, /mage\//i],
  Joomla: [/joomla/i, /com_content/i],
  Lightspeed: [/lightspeed/i, /seoshop/i],
};

const CHAT_SIGNATURES: Record<string, RegExp[]> = {
  Intercom: [/intercom/i, /intercomcdn/i],
  Drift: [/drift\.com/i, /driftt/i],
  Tidio: [/tidio/i, /tidiochat/i],
  "WhatsApp Widget": [/wa\.me/i, /whatsapp/i],
  LiveChat: [/livechatinc/i, /livechat/i],
  Zendesk: [/zopim/i, /zendesk/i],
  HubSpot: [/hubspot/i, /hs-scripts/i],
  Crisp: [/crisp\.chat/i],
};

export interface ScrapeResult {
  homepage: PageData;
  subpaginas: PageData[];
  techStack: string[];
  formulieren: string[];
  chatWidgets: string[];
  socialMedia: Record<string, string>;
}

interface PageData {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  bodyText: string;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    return res.text();
  } catch {
    return null;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : "";
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (match) return match[1].trim();
  const match2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return match2 ? match2[1].trim() : "";
}

function extractHeadings(html: string): string[] {
  const headings: string[] = [];
  const regex = /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && headings.length < 20) {
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (text) headings.push(`${match[1]}: ${text}`);
  }
  return headings;
}

function extractBodyText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, MAX_BODY_LENGTH);
}

function parsePage(url: string, html: string): PageData {
  return {
    url,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    headings: extractHeadings(html),
    bodyText: extractBodyText(html),
  };
}

function detectTechStack(html: string): string[] {
  const found: string[] = [];
  for (const [tech, patterns] of Object.entries(TECH_SIGNATURES)) {
    if (patterns.some((p) => p.test(html))) {
      found.push(tech);
    }
  }
  return found;
}

function detectForms(html: string): string[] {
  const forms: string[] = [];
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = formRegex.exec(html)) !== null) {
    const formContent = match[0].toLowerCase();
    if (/contact|bericht|message|vraag/i.test(formContent)) forms.push("contact");
    else if (/offerte|quote|aanvraag/i.test(formContent)) forms.push("offerte-aanvraag");
    else if (/newsletter|nieuwsbrief|subscribe|inschrijv/i.test(formContent)) forms.push("nieuwsbrief");
    else if (/search|zoek/i.test(formContent)) forms.push("zoekformulier");
    else forms.push("formulier");
  }
  return [...new Set(forms)];
}

function detectChatWidgets(html: string): string[] {
  const found: string[] = [];
  for (const [widget, patterns] of Object.entries(CHAT_SIGNATURES)) {
    if (patterns.some((p) => p.test(html))) {
      found.push(widget);
    }
  }
  return found;
}

function detectSocialMedia(html: string): Record<string, string> {
  const social: Record<string, string> = {};
  const patterns: Record<string, RegExp> = {
    linkedin: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"'\s]+)["']/i,
    instagram: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'\s]+)["']/i,
    facebook: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'\s]+)["']/i,
    twitter: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"'\s]+)["']/i,
    youtube: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"'\s]+)["']/i,
  };
  for (const [platform, pattern] of Object.entries(patterns)) {
    const match = html.match(pattern);
    if (match) social[platform] = match[1];
  }
  return social;
}

function findInternalLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1].trim();
    if (href.startsWith("/") && !href.startsWith("//")) {
      links.push(href);
    } else if (href.startsWith(baseUrl)) {
      links.push(href.replace(baseUrl, ""));
    }
  }
  return [...new Set(links)];
}

function isSSRFSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;
    if (hostname.startsWith("10.")) return false;
    if (hostname.startsWith("172.") && /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname.startsWith("192.168.")) return false;
    if (hostname.startsWith("169.254.")) return false;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

export async function scrapeWebsite(websiteUrl: string): Promise<ScrapeResult> {
  if (!isSSRFSafe(websiteUrl)) {
    throw new Error("URL niet toegestaan: privé netwerk of ongeldig protocol");
  }

  const baseUrl = websiteUrl.replace(/\/+$/, "");
  const homepageHtml = await fetchPage(baseUrl);

  if (!homepageHtml) {
    throw new Error(`Kon ${baseUrl} niet bereiken`);
  }

  const homepage = parsePage(baseUrl, homepageHtml);
  const techStack = detectTechStack(homepageHtml);
  const formulieren = detectForms(homepageHtml);
  const chatWidgets = detectChatWidgets(homepageHtml);
  const socialMedia = detectSocialMedia(homepageHtml);

  // Find subpages to scrape
  const internalLinks = findInternalLinks(homepageHtml, baseUrl);
  const subpageUrls: string[] = [];

  for (const commonPath of COMMON_SUBPAGES) {
    const matchingLink = internalLinks.find(
      (link) => link.toLowerCase().includes(commonPath.replace("/", ""))
    );
    if (matchingLink && subpageUrls.length < MAX_SUBPAGES) {
      subpageUrls.push(matchingLink.startsWith("http") ? matchingLink : `${baseUrl}${matchingLink}`);
    }
  }

  // Scrape subpages
  const subpaginas: PageData[] = [];
  for (const url of subpageUrls) {
    if (!isSSRFSafe(url)) continue;
    const html = await fetchPage(url);
    if (html) {
      subpaginas.push(parsePage(url, html));
      // Merge additional detections from subpages
      for (const tech of detectTechStack(html)) {
        if (!techStack.includes(tech)) techStack.push(tech);
      }
      for (const form of detectForms(html)) {
        if (!formulieren.includes(form)) formulieren.push(form);
      }
      for (const widget of detectChatWidgets(html)) {
        if (!chatWidgets.includes(widget)) chatWidgets.push(widget);
      }
      const subSocial = detectSocialMedia(html);
      for (const [platform, url] of Object.entries(subSocial)) {
        if (!socialMedia[platform]) socialMedia[platform] = url;
      }
    }
  }

  return { homepage, subpaginas, techStack, formulieren, chatWidgets, socialMedia };
}
```

- [ ] **Step 2: Verify the scraper compiles**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit src/lib/sales-engine/scraper.ts 2>&1 || echo "Check errors above"`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sales-engine/scraper.ts
git commit -m "feat(sales-engine): add fetch-based website scraper with SSRF protection"
```

---

## Task 3: AI Analyzer (Claude Prompt + Parser)

**Files:**
- Create: `src/lib/sales-engine/prompts.ts`
- Create: `src/lib/sales-engine/analyzer.ts`

- [ ] **Step 1: Create the prompt template**

Create `src/lib/sales-engine/prompts.ts`:

```typescript
import type { ScrapeResult } from "./scraper";

interface CalComContext {
  bedrijfsnaam: string;
  bedrijfsgrootte: string;
  rol: string;
  grootsteKnelpunt: string;
  huidigeTools: string;
}

export function buildAnalysisPrompt(scrapeResult: ScrapeResult, context: CalComContext): string {
  const websiteData = JSON.stringify(
    {
      homepage: {
        title: scrapeResult.homepage.title,
        metaDescription: scrapeResult.homepage.metaDescription,
        headings: scrapeResult.homepage.headings,
        bodyText: scrapeResult.homepage.bodyText,
      },
      subpaginas: scrapeResult.subpaginas.map((p) => ({
        url: p.url,
        title: p.title,
        headings: p.headings,
        bodyText: p.bodyText,
      })),
      techStack: scrapeResult.techStack,
      formulieren: scrapeResult.formulieren,
      chatWidgets: scrapeResult.chatWidgets,
      socialMedia: scrapeResult.socialMedia,
    },
    null,
    2
  );

  return `Je bent een business analyst voor Autronis, een AI- en automatiseringsbureau dat MKB-bedrijven helpt slimmer en efficiënter te werken.

Autronis biedt deze diensten aan:
- Workflow automatisering (Make.com, n8n, API-integraties)
- AI integraties (OpenAI API, custom agents, AI workflows)
- Systeem integraties (CRM, boekhouding, webshops, databases)
- Data & dashboards (realtime KPIs, rapportages, BI)

Een prospect heeft een gesprek geboekt. Analyseer hun bedrijf en identificeer automatiseringskansen.

## Prospect Context (uit booking formulier)
- Bedrijfsnaam: ${context.bedrijfsnaam}
- Bedrijfsgrootte: ${context.bedrijfsgrootte}
- Rol van de booker: ${context.rol}
- Grootste knelpunt: ${context.grootsteKnelpunt}
- Huidige tools: ${context.huidigeTools || "Niet opgegeven"}

## Website Scan Data
${websiteData}

## Opdracht

Analyseer het bedrijf en identificeer de top 3 automatiseringskansen die Autronis kan bouwen. Focus op kansen die:
1. Direct aansluiten bij het genoemde knelpunt
2. Passen bij de huidige tech stack en tools
3. Concrete, meetbare tijdsbesparing opleveren

Geef je antwoord als JSON in exact dit formaat (geen andere tekst, alleen JSON):

{
  "bedrijfsProfiel": {
    "branche": "De branche/sector van het bedrijf",
    "watZeDoen": "Korte omschrijving van kernactiviteiten (1-2 zinnen)",
    "doelgroep": "B2B/B2C en type klanten"
  },
  "kansen": [
    {
      "titel": "Korte titel van de automatiseringskans",
      "beschrijving": "Uitleg: huidige situatie, wat Autronis kan bouwen, en het verwachte resultaat. 2-3 zinnen, concreet en specifiek voor dit bedrijf.",
      "categorie": "lead_gen | communicatie | administratie | data | content",
      "impact": "hoog | midden | laag",
      "geschatteTijdsbesparing": "X uur per week",
      "prioriteit": 1
    }
  ],
  "samenvatting": "Conclusie over het totale besparingspotentieel in 2-3 zinnen. Noem het totale aantal uren dat bespaard kan worden."
}

Regels:
- Exact 3 kansen, gerangschikt op impact (prioriteit 1 = hoogste impact)
- Categorieën: lead_gen, communicatie, administratie, data, content
- Impact: hoog, midden, of laag
- Tijdsbesparing moet realistisch zijn voor een MKB
- Schrijf in het Nederlands
- Kansen moeten specifiek zijn voor DIT bedrijf, niet generiek`;
}

export type { CalComContext };
```

- [ ] **Step 2: Create the analyzer module**

Create `src/lib/sales-engine/analyzer.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ScrapeResult } from "./scraper";
import { buildAnalysisPrompt, type CalComContext } from "./prompts";

export interface AnalysisResult {
  bedrijfsProfiel: {
    branche: string;
    watZeDoen: string;
    doelgroep: string;
  };
  kansen: Array<{
    titel: string;
    beschrijving: string;
    categorie: "lead_gen" | "communicatie" | "administratie" | "data" | "content";
    impact: "hoog" | "midden" | "laag";
    geschatteTijdsbesparing: string;
    prioriteit: number;
  }>;
  samenvatting: string;
}

export async function analyzeWithClaude(
  scrapeResult: ScrapeResult,
  context: CalComContext
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildAnalysisPrompt(scrapeResult, context);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr) as AnalysisResult;

    // Validate required fields
    if (!parsed.bedrijfsProfiel?.branche || !parsed.kansen?.length || !parsed.samenvatting) {
      throw new Error("Onvolledige AI response");
    }

    return parsed;
  } catch (parseError) {
    throw new Error(
      `AI analyse kon niet worden geparsed: ${parseError instanceof Error ? parseError.message : "onbekend"}`
    );
  }
}
```

- [ ] **Step 3: Verify both files compile**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit src/lib/sales-engine/analyzer.ts 2>&1 || echo "Check errors"`

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sales-engine/prompts.ts src/lib/sales-engine/analyzer.ts
git commit -m "feat(sales-engine): add Claude AI analyzer with structured prompt"
```

---

## Task 4: Scan API Endpoint

**Files:**
- Create: `src/app/api/sales-engine/scan/route.ts`

- [ ] **Step 1: Create the scan endpoint**

Create `src/app/api/sales-engine/scan/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { leads, salesEngineScans, salesEngineKansen } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { scrapeWebsite } from "@/lib/sales-engine/scraper";
import { analyzeWithClaude } from "@/lib/sales-engine/analyzer";
import { eq, and, gte } from "drizzle-orm";

interface ScanRequestBody {
  naam: string;
  email: string;
  bedrijfsnaam: string;
  bedrijfsgrootte: string;
  rol: string;
  websiteUrl: string;
  grootsteKnelpunt: string;
  huidigeTools?: string;
  opmerkingen?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateBody(body: Record<string, unknown>): ScanRequestBody {
  const required = ["naam", "email", "bedrijfsnaam", "bedrijfsgrootte", "rol", "websiteUrl", "grootsteKnelpunt"];
  for (const field of required) {
    if (!body[field] || typeof body[field] !== "string" || !(body[field] as string).trim()) {
      throw new Error(`Veld '${field}' is verplicht`);
    }
  }
  if (!validateEmail(body.email as string)) {
    throw new Error("Ongeldig e-mailadres");
  }
  if (!validateUrl(body.websiteUrl as string)) {
    throw new Error("Ongeldige website URL (moet http:// of https:// zijn)");
  }
  return {
    naam: (body.naam as string).trim(),
    email: (body.email as string).trim().toLowerCase(),
    bedrijfsnaam: (body.bedrijfsnaam as string).trim(),
    bedrijfsgrootte: (body.bedrijfsgrootte as string).trim(),
    rol: (body.rol as string).trim(),
    websiteUrl: (body.websiteUrl as string).trim(),
    grootsteKnelpunt: (body.grootsteKnelpunt as string).trim(),
    huidigeTools: (body.huidigeTools as string)?.trim() || "",
    opmerkingen: (body.opmerkingen as string)?.trim() || "",
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireApiKey(req);

    let rawBody: Record<string, unknown>;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Ongeldig JSON verzoek" }, { status: 400 });
    }

    const body = validateBody(rawBody);

    // Deduplication: check for recent scan with same email + URL
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const existingLeadForDedup = db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, body.email))
      .get();

    const recentScan = existingLeadForDedup
      ? db
          .select({ id: salesEngineScans.id, leadId: salesEngineScans.leadId })
          .from(salesEngineScans)
          .where(
            and(
              eq(salesEngineScans.leadId, existingLeadForDedup.id),
              eq(salesEngineScans.websiteUrl, body.websiteUrl),
              gte(salesEngineScans.aangemaaktOp, tenMinutesAgo)
            )
          )
          .get()
      : null;

    if (recentScan) {
      return NextResponse.json({
        success: true,
        scanId: recentScan.id,
        leadId: recentScan.leadId,
        deduplicated: true,
      });
    }

    // Match or create lead
    let existingLead = db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, body.email))
      .get();

    if (existingLead) {
      db.update(leads)
        .set({
          bedrijfsnaam: body.bedrijfsnaam,
          contactpersoon: body.naam,
          telefoon: null,
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(leads.id, existingLead.id))
        .run();
    } else {
      const [newLead] = db
        .insert(leads)
        .values({
          bedrijfsnaam: body.bedrijfsnaam,
          contactpersoon: body.naam,
          email: body.email,
          status: "nieuw",
          bron: "cal.com",
          notities: `Rol: ${body.rol}\nBedrijfsgrootte: ${body.bedrijfsgrootte}\nKnelpunt: ${body.grootsteKnelpunt}`,
        })
        .returning();
      existingLead = { id: newLead.id };
    }

    // Create scan record
    const [scan] = db
      .insert(salesEngineScans)
      .values({
        leadId: existingLead.id,
        websiteUrl: body.websiteUrl,
        bedrijfsgrootte: body.bedrijfsgrootte,
        rol: body.rol,
        grootsteKnelpunt: body.grootsteKnelpunt,
        huidigeTools: body.huidigeTools || null,
        opmerkingen: body.opmerkingen || null,
        status: "pending",
      })
      .returning();

    try {
      // Scrape website
      const scrapeResult = await scrapeWebsite(body.websiteUrl);
      db.update(salesEngineScans)
        .set({
          scrapeResultaat: JSON.stringify(scrapeResult),
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      // AI analysis
      const analysis = await analyzeWithClaude(scrapeResult, {
        bedrijfsnaam: body.bedrijfsnaam,
        bedrijfsgrootte: body.bedrijfsgrootte,
        rol: body.rol,
        grootsteKnelpunt: body.grootsteKnelpunt,
        huidigeTools: body.huidigeTools || "",
      });

      // Save kansen
      for (const kans of analysis.kansen) {
        db.insert(salesEngineKansen)
          .values({
            scanId: scan.id,
            titel: kans.titel,
            beschrijving: kans.beschrijving,
            categorie: kans.categorie,
            impact: kans.impact,
            geschatteTijdsbesparing: kans.geschatteTijdsbesparing,
            prioriteit: kans.prioriteit,
          })
          .run();
      }

      // Update scan to completed
      db.update(salesEngineScans)
        .set({
          aiAnalyse: JSON.stringify(analysis),
          samenvatting: analysis.samenvatting,
          status: "completed",
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      return NextResponse.json({ success: true, scanId: scan.id, leadId: existingLead.id }, { status: 201 });
    } catch (processingError) {
      // Mark scan as failed
      db.update(salesEngineScans)
        .set({
          status: "failed",
          foutmelding: processingError instanceof Error ? processingError.message : "Onbekende fout",
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(salesEngineScans.id, scan.id))
        .run();

      return NextResponse.json(
        { success: false, error: processingError instanceof Error ? processingError.message : "Scan mislukt" },
        { status: 500 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    const status = message.includes("API key") || message.includes("Ongeldige") ? 401 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
```

- [ ] **Step 2: Verify the endpoint compiles**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit src/app/api/sales-engine/scan/route.ts 2>&1 || echo "Check errors"`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sales-engine/scan/route.ts
git commit -m "feat(sales-engine): add POST /api/sales-engine/scan endpoint with validation and dedup"
```

---

## Task 5: Sales Engine GET API (for dashboard)

**Files:**
- Create: `src/app/api/sales-engine/route.ts`
- Create: `src/app/api/sales-engine/[id]/route.ts`

- [ ] **Step 1: Create the list endpoint**

Create `src/app/api/sales-engine/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const conditions = [];
    if (status && status !== "alle") {
      conditions.push(eq(salesEngineScans.status, status as "pending" | "completed" | "failed"));
    }

    const scans = db
      .select({
        id: salesEngineScans.id,
        leadId: salesEngineScans.leadId,
        websiteUrl: salesEngineScans.websiteUrl,
        samenvatting: salesEngineScans.samenvatting,
        status: salesEngineScans.status,
        foutmelding: salesEngineScans.foutmelding,
        aangemaaktOp: salesEngineScans.aangemaaktOp,
        bedrijfsnaam: leads.bedrijfsnaam,
        contactpersoon: leads.contactpersoon,
        email: leads.email,
      })
      .from(salesEngineScans)
      .leftJoin(leads, eq(salesEngineScans.leadId, leads.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(salesEngineScans.aangemaaktOp))
      .all();

    // Fetch kansen count per scan
    const scansWithKansen = scans.map((scan) => {
      const kansen = db
        .select({ impact: salesEngineKansen.impact })
        .from(salesEngineKansen)
        .where(eq(salesEngineKansen.scanId, scan.id))
        .all();

      const hoogsteImpact = kansen.find((k) => k.impact === "hoog")
        ? "hoog"
        : kansen.find((k) => k.impact === "midden")
          ? "midden"
          : kansen.length > 0
            ? "laag"
            : null;

      return { ...scan, aantalKansen: kansen.length, hoogsteImpact };
    });

    // KPIs
    const totaal = scans.length;
    const dezeWeek = scans.filter((s) => {
      if (!s.aangemaaktOp) return false;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return s.aangemaaktOp >= weekAgo;
    }).length;
    const completed = scans.filter((s) => s.status === "completed").length;
    const failed = scans.filter((s) => s.status === "failed").length;

    return NextResponse.json({
      scans: scansWithKansen,
      kpis: {
        totaal,
        dezeWeek,
        succesRatio: totaal > 0 ? Math.round((completed / totaal) * 100) : 0,
        failed,
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

- [ ] **Step 2: Create the detail endpoint**

Create `src/app/api/sales-engine/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { salesEngineScans, salesEngineKansen, leads } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const scanId = parseInt(id, 10);

    if (isNaN(scanId)) {
      return NextResponse.json({ fout: "Ongeldig scan ID" }, { status: 400 });
    }

    const scan = db
      .select()
      .from(salesEngineScans)
      .where(eq(salesEngineScans.id, scanId))
      .get();

    if (!scan) {
      return NextResponse.json({ fout: "Scan niet gevonden" }, { status: 404 });
    }

    const lead = scan.leadId
      ? db.select().from(leads).where(eq(leads.id, scan.leadId)).get()
      : null;

    const kansen = db
      .select()
      .from(salesEngineKansen)
      .where(eq(salesEngineKansen.scanId, scanId))
      .orderBy(salesEngineKansen.prioriteit)
      .all();

    return NextResponse.json({
      scan: {
        ...scan,
        scrapeResultaat: scan.scrapeResultaat ? JSON.parse(scan.scrapeResultaat) : null,
        aiAnalyse: scan.aiAnalyse ? JSON.parse(scan.aiAnalyse) : null,
      },
      lead,
      kansen,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 3: Verify both endpoints compile**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit 2>&1 | head -20`

Expected: No TypeScript errors related to sales-engine files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sales-engine/route.ts src/app/api/sales-engine/\[id\]/route.ts
git commit -m "feat(sales-engine): add GET endpoints for scan list and detail"
```

---

## Task 6: React Query Hook

**Files:**
- Create: `src/hooks/queries/use-sales-engine.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/queries/use-sales-engine.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";

interface ScanListItem {
  id: number;
  leadId: number | null;
  websiteUrl: string;
  samenvatting: string | null;
  status: string;
  foutmelding: string | null;
  aangemaaktOp: string | null;
  bedrijfsnaam: string | null;
  contactpersoon: string | null;
  email: string | null;
  aantalKansen: number;
  hoogsteImpact: string | null;
}

interface ScanKPIs {
  totaal: number;
  dezeWeek: number;
  succesRatio: number;
  failed: number;
}

interface ScanListData {
  scans: ScanListItem[];
  kpis: ScanKPIs;
}

interface ScanKans {
  id: number;
  scanId: number;
  titel: string;
  beschrijving: string;
  categorie: string;
  impact: string;
  geschatteTijdsbesparing: string | null;
  prioriteit: number;
}

interface ScrapeResultaat {
  homepage: {
    url: string;
    title: string;
    metaDescription: string;
    headings: string[];
    bodyText: string;
  };
  subpaginas: Array<{
    url: string;
    title: string;
    headings: string[];
    bodyText: string;
  }>;
  techStack: string[];
  formulieren: string[];
  chatWidgets: string[];
  socialMedia: Record<string, string>;
}

interface ScanDetail {
  scan: {
    id: number;
    leadId: number | null;
    websiteUrl: string;
    bedrijfsgrootte: string | null;
    rol: string | null;
    grootsteKnelpunt: string | null;
    huidigeTools: string | null;
    opmerkingen: string | null;
    scrapeResultaat: ScrapeResultaat | null;
    aiAnalyse: Record<string, unknown> | null;
    samenvatting: string | null;
    status: string;
    foutmelding: string | null;
    aangemaaktOp: string | null;
    bijgewerktOp: string | null;
  };
  lead: {
    id: number;
    bedrijfsnaam: string;
    contactpersoon: string | null;
    email: string | null;
  } | null;
  kansen: ScanKans[];
}

async function fetchScans(status?: string): Promise<ScanListData> {
  const params = new URLSearchParams();
  if (status && status !== "alle") params.set("status", status);
  const res = await fetch(`/api/sales-engine?${params}`);
  if (!res.ok) throw new Error("Kon scans niet laden");
  return res.json();
}

async function fetchScanDetail(id: number): Promise<ScanDetail> {
  const res = await fetch(`/api/sales-engine/${id}`);
  if (!res.ok) throw new Error("Kon scan niet laden");
  return res.json();
}

export function useSalesEngineScans(status?: string) {
  return useQuery({
    queryKey: ["sales-engine-scans", status],
    queryFn: () => fetchScans(status),
    staleTime: 30_000,
  });
}

export function useSalesEngineScanDetail(id: number | null) {
  return useQuery({
    queryKey: ["sales-engine-scan", id],
    queryFn: () => fetchScanDetail(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export type { ScanListItem, ScanKPIs, ScanListData, ScanKans, ScanDetail, ScrapeResultaat };
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/queries/use-sales-engine.ts
git commit -m "feat(sales-engine): add React Query hooks for scans data"
```

---

## Task 7: Dashboard Overview Page

**Files:**
- Create: `src/app/(dashboard)/sales-engine/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Sales Engine to the sidebar**

In `src/components/layout/Sidebar.tsx`, find the "Klanten & Sales" section and add a Sales Engine item after "Leads". Import `Rocket` from lucide-react.

Add this item after the Leads entry:

```typescript
{ label: "Sales Engine", icon: Rocket, href: "/sales-engine" },
```

And add `Rocket` to the lucide-react import at the top of the file.

- [ ] **Step 2: Create the overview page**

Create `src/app/(dashboard)/sales-engine/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useSalesEngineScans } from "@/hooks/queries/use-sales-engine";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import {
  Rocket,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Zap,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  pending: { label: "Bezig", kleur: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  completed: { label: "Voltooid", kleur: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  failed: { label: "Mislukt", kleur: "text-red-400 bg-red-400/10", icon: AlertCircle },
};

const impactConfig: Record<string, string> = {
  hoog: "text-emerald-400 bg-emerald-400/10",
  midden: "text-yellow-400 bg-yellow-400/10",
  laag: "text-[var(--text-tertiary)] bg-[var(--border)]/30",
};

export default function SalesEnginePage() {
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const { data, isLoading } = useSalesEngineScans(statusFilter);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const scans = data?.scans ?? [];
  const kpis = data?.kpis;

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8 text-[var(--accent)]" />
            <h1 className="text-3xl font-bold">Sales Engine</h1>
          </div>
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
                <span className="text-sm text-[var(--text-secondary)]">Totaal scans</span>
              </div>
              <p className="text-3xl font-bold">{kpis.totaal}</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-[var(--accent)]" />
                <span className="text-sm text-[var(--text-secondary)]">Deze week</span>
              </div>
              <p className="text-3xl font-bold">{kpis.dezeWeek}</p>
            </div>
            <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-[var(--text-secondary)]">Succesratio</span>
              </div>
              <p className="text-3xl font-bold">{kpis.succesRatio}%</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {["alle", "completed", "pending", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)]"
              }`}
            >
              {s === "alle" ? "Alle" : statusConfig[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Scan List */}
        {scans.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl p-12 text-center border border-[var(--border)]">
            <Rocket className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">
              Nog geen scans. Scans worden automatisch aangemaakt wanneer iemand een call boekt via Cal.com.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map((scan) => {
              const status = statusConfig[scan.status] ?? statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <Link
                  key={scan.id}
                  href={`/sales-engine/${scan.id}`}
                  className="block bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all card-glow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg truncate">
                          {scan.bedrijfsnaam ?? "Onbekend bedrijf"}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.kleur}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        {scan.hoogsteImpact && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              impactConfig[scan.hoogsteImpact] ?? ""
                            }`}
                          >
                            {scan.hoogsteImpact} impact
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3.5 h-3.5" />
                          {(() => { try { return new URL(scan.websiteUrl).hostname; } catch { return scan.websiteUrl; } })()}
                        </span>
                        {scan.contactpersoon && <span>{scan.contactpersoon}</span>}
                        {scan.aantalKansen > 0 && (
                          <span>{scan.aantalKansen} kansen gevonden</span>
                        )}
                        {scan.aangemaaktOp && (
                          <span>{formatDatum(scan.aangemaaktOp)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 3: Verify the page compiles**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit 2>&1 | head -20`

Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/sales-engine/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(sales-engine): add overview page and sidebar navigation"
```

---

## Task 8: Dashboard Detail Page

**Files:**
- Create: `src/app/(dashboard)/sales-engine/[id]/page.tsx`

- [ ] **Step 1: Create the detail page**

Create `src/app/(dashboard)/sales-engine/[id]/page.tsx`:

```typescript
"use client";

import { use, useState } from "react";
import { useSalesEngineScanDetail } from "@/hooks/queries/use-sales-engine";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
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
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  pending: { label: "Bezig", kleur: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  completed: { label: "Voltooid", kleur: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  failed: { label: "Mislukt", kleur: "text-red-400 bg-red-400/10", icon: AlertCircle },
};

const categorieConfig: Record<string, { label: string; kleur: string }> = {
  lead_gen: { label: "Lead Generatie", kleur: "text-blue-400 bg-blue-400/10" },
  communicatie: { label: "Communicatie", kleur: "text-purple-400 bg-purple-400/10" },
  administratie: { label: "Administratie", kleur: "text-orange-400 bg-orange-400/10" },
  data: { label: "Data & Inzicht", kleur: "text-cyan-400 bg-cyan-400/10" },
  content: { label: "Content", kleur: "text-pink-400 bg-pink-400/10" },
};

const impactConfig: Record<string, { label: string; kleur: string }> = {
  hoog: { label: "Hoge impact", kleur: "text-emerald-400 bg-emerald-400/10" },
  midden: { label: "Medium impact", kleur: "text-yellow-400 bg-yellow-400/10" },
  laag: { label: "Lage impact", kleur: "text-[var(--text-tertiary)] bg-[var(--border)]/30" },
};

export default function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const scanId = parseInt(id, 10);
  const { data, isLoading } = useSalesEngineScanDetail(isNaN(scanId) ? null : scanId);
  const [scrapeOpen, setScrapeOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-secondary)]">Scan niet gevonden.</p>
        <Link href="/sales-engine" className="text-[var(--accent)] hover:underline mt-2 inline-block">
          ← Terug naar overzicht
        </Link>
      </div>
    );
  }

  const { scan, lead, kansen } = data;
  const status = statusConfig[scan.status] ?? statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Back + Header */}
        <div>
          <Link
            href="/sales-engine"
            className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">{lead?.bedrijfsnaam ?? "Onbekend bedrijf"}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${status.kleur}`}
            >
              <StatusIcon className="w-4 h-4" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
            <a
              href={scan.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-[var(--accent)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {scan.websiteUrl}
            </a>
            {scan.aangemaaktOp && <span>Gescand op {formatDatum(scan.aangemaaktOp)}</span>}
            {lead && (
              <Link href={`/leads`} className="hover:text-[var(--accent)]">
                Bekijk lead →
              </Link>
            )}
          </div>
        </div>

        {/* Failed State */}
        {scan.status === "failed" && scan.foutmelding && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-5">
            <div className="flex items-center gap-2 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-semibold">Scan mislukt</span>
            </div>
            <p className="text-sm text-red-300">{scan.foutmelding}</p>
          </div>
        )}

        {/* Cal.com Context */}
        <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--accent)]" />
            Prospect Info
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scan.bedrijfsgrootte && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Bedrijfsgrootte</p>
                <p className="text-sm">{scan.bedrijfsgrootte}</p>
              </div>
            )}
            {scan.rol && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Rol</p>
                <p className="text-sm">{scan.rol}</p>
              </div>
            )}
            {scan.grootsteKnelpunt && (
              <div className="md:col-span-2">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Grootste Knelpunt
                </p>
                <p className="text-sm">{scan.grootsteKnelpunt}</p>
              </div>
            )}
            {scan.huidigeTools && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Wrench className="w-3 h-3" /> Huidige Tools
                </p>
                <p className="text-sm">{scan.huidigeTools}</p>
              </div>
            )}
            {scan.opmerkingen && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Opmerkingen
                </p>
                <p className="text-sm">{scan.opmerkingen}</p>
              </div>
            )}
          </div>
        </div>

        {/* Bedrijfsprofiel (from AI) */}
        {scan.aiAnalyse && (
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--accent)]" />
              Bedrijfsprofiel
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Branche</p>
                <p className="text-sm">{(scan.aiAnalyse as Record<string, Record<string, string>>).bedrijfsProfiel?.branche}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Wat ze doen</p>
                <p className="text-sm">{(scan.aiAnalyse as Record<string, Record<string, string>>).bedrijfsProfiel?.watZeDoen}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Doelgroep</p>
                <p className="text-sm">{(scan.aiAnalyse as Record<string, Record<string, string>>).bedrijfsProfiel?.doelgroep}</p>
              </div>
            </div>
          </div>
        )}

        {/* Automatiseringskansen */}
        {kansen.length > 0 && (
          <div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--accent)]" />
              Automatiseringskansen
            </h2>
            <div className="space-y-3">
              {kansen.map((kans) => {
                const categorie = categorieConfig[kans.categorie];
                const impact = impactConfig[kans.impact];

                return (
                  <div
                    key={kans.id}
                    className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-[var(--accent)]">
                          #{kans.prioriteit}
                        </span>
                        <h3 className="font-semibold text-lg">{kans.titel}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {categorie && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categorie.kleur}`}>
                            {categorie.label}
                          </span>
                        )}
                        {impact && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${impact.kleur}`}>
                            {impact.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">{kans.beschrijving}</p>
                    {kans.geschatteTijdsbesparing && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--accent)]">
                        <Clock className="w-4 h-4" />
                        Geschatte besparing: {kans.geschatteTijdsbesparing}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Samenvatting */}
        {scan.samenvatting && (
          <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-5">
            <h2 className="font-semibold text-lg mb-2 text-[var(--accent)]">Samenvatting</h2>
            <p className="text-sm text-[var(--text-secondary)]">{scan.samenvatting}</p>
          </div>
        )}

        {/* Scrape Data (collapsible) */}
        {scan.scrapeResultaat && (
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setScrapeOpen(!scrapeOpen)}
              className="w-full flex items-center justify-between p-5 text-left"
            >
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-[var(--accent)]" />
                Scrape Data
              </h2>
              {scrapeOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {scrapeOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-[var(--border)] pt-4">
                {/* Tech Stack */}
                {(scan.scrapeResultaat as Record<string, unknown>).techStack && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Tech Stack</p>
                    <div className="flex flex-wrap gap-2">
                      {((scan.scrapeResultaat as Record<string, unknown>).techStack as string[]).map((tech) => (
                        <span
                          key={tech}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--text-secondary)]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulieren */}
                {((scan.scrapeResultaat as Record<string, unknown>).formulieren as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Formulieren</p>
                    <div className="flex flex-wrap gap-2">
                      {((scan.scrapeResultaat as Record<string, unknown>).formulieren as string[]).map((form) => (
                        <span
                          key={form}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--text-secondary)]"
                        >
                          {form}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat Widgets */}
                {((scan.scrapeResultaat as Record<string, unknown>).chatWidgets as string[])?.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Chat Widgets</p>
                    <div className="flex flex-wrap gap-2">
                      {((scan.scrapeResultaat as Record<string, unknown>).chatWidgets as string[]).map((widget) => (
                        <span
                          key={widget}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--text-secondary)]"
                        >
                          {widget}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Media */}
                {Object.keys((scan.scrapeResultaat as Record<string, unknown>).socialMedia as Record<string, string> ?? {}).length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Social Media</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries((scan.scrapeResultaat as Record<string, unknown>).socialMedia as Record<string, string>).map(
                        ([platform, url]) => (
                          <a
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--border)]/30 text-[var(--accent)] hover:underline"
                          >
                            {platform}
                          </a>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Gescande pagina's */}
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Gescande Pagina&apos;s</p>
                  <div className="space-y-1 text-sm text-[var(--text-secondary)]">
                    <p>{(scan.scrapeResultaat as Record<string, Record<string, string>>).homepage?.url}</p>
                    {((scan.scrapeResultaat as Record<string, unknown>).subpaginas as Array<Record<string, string>>)?.map((p) => (
                      <p key={p.url}>{p.url}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Verify the page compiles**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit 2>&1 | head -20`

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/sales-engine/\[id\]/page.tsx
git commit -m "feat(sales-engine): add scan detail page with kansen, profiel, and scrape data"
```

---

## Task 9: Build Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx tsc --noEmit`

Expected: No errors. Fix any that appear.

- [ ] **Step 2: Run dev server to verify pages load**

Run: `cd "c:/Users/semmi/OneDrive/Claude AI/Projects/autronis-dashboard" && npx next build 2>&1 | tail -30`

Expected: Build succeeds. All sales-engine routes compile.

- [ ] **Step 3: Test the scan endpoint with curl**

Start the dev server first, then in another terminal:

```bash
curl -X POST http://localhost:3000/api/sales-engine/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "naam": "Test Persoon",
    "email": "test@example.com",
    "bedrijfsnaam": "Test BV",
    "bedrijfsgrootte": "1-10",
    "rol": "Eigenaar",
    "websiteUrl": "https://autronis.com",
    "grootsteKnelpunt": "Te veel handmatig werk",
    "huidigeTools": "Excel"
  }'
```

Expected: `{ "success": true, "scanId": 1, "leadId": N }`

- [ ] **Step 4: Verify the scan appears in the dashboard**

Open `http://localhost:3000/sales-engine` in the browser.

Expected: The test scan appears in the list. Click through to the detail page to verify all cards render correctly.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(sales-engine): address build and runtime issues"
```
