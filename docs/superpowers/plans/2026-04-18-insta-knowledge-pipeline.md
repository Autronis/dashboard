# Insta Knowledge Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instagram reels en posts die Sem handmatig submit worden door de Vercel-function gescraped, voor reels audio-transcribed via Whisper, daarna via Claude geanalyseerd naar `{summary, features, steps, tips, links, relevance_score}`, opgeslagen in `isk_*`-tabellen, en bij score ≥ 9 automatisch als idee aangemaakt — volledig parallel aan `yt-knowledge`.

**Architecture:** Submit-URL endpoint maakt een `isk_items` rij met `status=pending` aan en gebruikt Next.js `after()` om de zware verwerking post-response te draaien binnen dezelfde serverless function. UI polled de lijst. Daily cleanup-cron reset stale `processing`-items. Source-adapter interface zodat Apify later zonder route-wijziging erin schuift.

**Tech Stack:** Next.js 16 App Router (TypeScript), Turso/libsql via `tursoClient`, OpenAI Whisper via REST, Anthropic SDK via `TrackedAnthropic`, Tailwind + Framer Motion + lucide-react voor UI, Vitest voor tests.

---

## File Structure

**Nieuw:**
- `src/lib/insta-knowledge/types.ts` — `RawItem`, `AnalysisResult`, `SourceAdapter`, `WorkerOutcome`
- `src/lib/insta-knowledge/scrape.ts` — IG-page scrape (caption, mediaUrl, author) — pure function op HTML-string
- `src/lib/insta-knowledge/adapters/manual.ts` — `manualAdapter: SourceAdapter` (fetch + scrape)
- `src/lib/insta-knowledge/transcribe.ts` — Whisper REST wrapper
- `src/lib/insta-knowledge/prompts.ts` — `INSTA_SYSTEM_PROMPT`
- `src/lib/insta-knowledge/analyze.ts` — Claude call → gevalideerde `AnalysisResult`
- `src/lib/insta-knowledge/idea.ts` — `createIdeaIfRelevant(item, analysis)` (score ≥ 9)
- `src/lib/insta-knowledge/worker.ts` — `processItem(itemId)` orchestrator
- `src/app/api/insta-knowledge/route.ts` — `GET` (list + stats), `POST` (submit + `after()`)
- `src/app/api/insta-knowledge/items/[id]/route.ts` — `DELETE`
- `src/app/api/insta-knowledge/items/[id]/retry/route.ts` — `POST`
- `src/app/api/insta-knowledge/cleanup/route.ts` — `POST` (Vercel Cron, daily stale-processing reset)
- `src/app/(dashboard)/insta-knowledge/page.tsx` — UI-pagina

**Tests:**
- `src/lib/insta-knowledge/__tests__/scrape.test.ts` — HTML-fixtures → expected `RawItem`
- `src/lib/insta-knowledge/__tests__/analyze.test.ts` — mock Anthropic client → valid `AnalysisResult`
- `src/lib/insta-knowledge/__tests__/idea.test.ts` — score < 9 skip, score ≥ 9 insert + dedup

**Wijzigen:**
- `src/lib/db/index.ts` — CREATE TABLE IF NOT EXISTS voor `isk_sources`, `isk_items`, `isk_analyses`
- `vercel.json` — cron entry voor cleanup (dagelijks)

---

### Task 1: Database schema (tables toevoegen aan initDatabase)

**Files:**
- Modify: `src/lib/db/index.ts` (na regel 449, na de `ytk_analyses` block)

- [ ] **Step 1: Voeg CREATE TABLE statements toe**

Zoek in `src/lib/db/index.ts` de regel `client.execute("ALTER TABLE ytk_analyses ADD COLUMN links TEXT").catch(() => {});` en voeg direct daarná toe:

```ts
  // Insta Knowledge Pipeline tables
  client.execute(`CREATE TABLE IF NOT EXISTS isk_sources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    handle TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    discovered_via TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS isk_items (
    id TEXT PRIMARY KEY,
    source_id TEXT REFERENCES isk_sources(id),
    instagram_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    author_handle TEXT,
    media_url TEXT,
    discovered_at TEXT DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    processed_at TEXT
  )`).catch(() => {});

  client.execute(`CREATE INDEX IF NOT EXISTS idx_isk_items_status_discovered ON isk_items(status, discovered_at)`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS isk_analyses (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES isk_items(id),
    summary TEXT NOT NULL,
    features TEXT NOT NULL,
    steps TEXT NOT NULL,
    tips TEXT NOT NULL,
    links TEXT NOT NULL,
    relevance_score INTEGER NOT NULL,
    relevance_reason TEXT NOT NULL,
    raw_transcript TEXT,
    raw_caption TEXT,
    model_used TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
```

- [ ] **Step 2: Restart dev server om tabellen te creëren**

Run: `npm run dev` en laat 'm even draaien; de init-functie draait bij server-start. Stop met Ctrl-C.

Verify: open de DB en check:
```bash
sqlite3 data/autronis.db ".tables isk_%"
```
Expected: `isk_analyses  isk_items     isk_sources`

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/index.ts
git commit -m "feat(insta-knowledge): add isk_sources/isk_items/isk_analyses tables"
```

---

### Task 2: Types

**Files:**
- Create: `src/lib/insta-knowledge/types.ts`

- [ ] **Step 1: Schrijf types file**

```ts
export type ItemType = "reel" | "post";
export type ItemStatus = "pending" | "processing" | "done" | "failed";

export interface RawItem {
  instagramId: string;
  type: ItemType;
  url: string;
  caption: string;
  authorHandle: string;
  mediaUrl?: string;
}

export interface AnalysisFeature {
  name: string;
  description: string;
  category: "core" | "workflow" | "integration" | "tips";
}

export interface AnalysisStep {
  order: number;
  title: string;
  description: string;
  code_snippet: string;
}

export interface AnalysisTip {
  tip: string;
  context: string;
}

export interface AnalysisLink {
  url: string;
  label: string;
  type: "tool" | "docs" | "community" | "github" | "course" | "other";
}

export interface AnalysisResult {
  idea_title: string;
  summary: string;
  features: AnalysisFeature[];
  steps: AnalysisStep[];
  tips: AnalysisTip[];
  links: AnalysisLink[];
  relevance_score: number;
  relevance_reason: string;
}

export interface SourceAdapter {
  readonly name: string;
  fetchItem(url: string): Promise<RawItem>;
}

export type WorkerOutcome =
  | { ok: true; analysisId: string; relevanceScore: number }
  | { ok: false; reason: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insta-knowledge/types.ts
git commit -m "feat(insta-knowledge): types for items/analyses/adapters"
```

---

### Task 3: IG-page scraper (pure, testable)

**Files:**
- Create: `src/lib/insta-knowledge/scrape.ts`
- Create: `src/lib/insta-knowledge/__tests__/scrape.test.ts`
- Create: `src/lib/insta-knowledge/__tests__/fixtures/reel.html` (plak een opgeslagen public reel HTML — zie Step 2)
- Create: `src/lib/insta-knowledge/__tests__/fixtures/post.html`

- [ ] **Step 1: Schrijf scraper**

```ts
// src/lib/insta-knowledge/scrape.ts
import type { ItemType, RawItem } from "./types";

const SHORTCODE_RE = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;

export function parseInstagramUrl(url: string): { instagramId: string; type: ItemType } | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) return null;
    const match = parsed.pathname.match(/^\/(p|reel)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    return { type: match[1] === "reel" ? "reel" : "post", instagramId: match[2] };
  } catch {
    return null;
  }
}

function decodeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

/**
 * Extract caption, author handle, and media URL from an Instagram page HTML.
 * Works on public reels/posts. Returns null fields when a value cannot be parsed.
 */
export function parseInstagramPage(html: string, url: string, type: ItemType, instagramId: string): RawItem {
  // Caption: IG embeds a meta og:description with the caption
  let caption = "";
  const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/);
  if (ogDesc) caption = ogDesc[1];

  // Author: og:title OR @handle in description
  let authorHandle = "";
  const titleMeta = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
  if (titleMeta) {
    const m = titleMeta[1].match(/@([A-Za-z0-9._]+)/);
    if (m) authorHandle = m[1];
  }

  // Media URL for reels: video_url field in the embedded JSON
  let mediaUrl: string | undefined;
  if (type === "reel") {
    const videoMatch = html.match(/"video_url":"([^"]+)"/);
    if (videoMatch) mediaUrl = decodeJsonString(videoMatch[1]);
  }

  // Fallback caption from structured edge_media_to_caption if og is empty
  if (!caption) {
    const edgeMatch = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/);
    if (edgeMatch) caption = decodeJsonString(edgeMatch[1]);
  }

  return {
    instagramId,
    type,
    url,
    caption,
    authorHandle,
    mediaUrl,
  };
}

export async function fetchInstagramPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`instagram_fetch_${res.status}`);
  return await res.text();
}
```

- [ ] **Step 2: Maak test fixtures**

Open in browser een public reel (bv. `https://www.instagram.com/reel/<shortcode>/`) en een public post. View Source, save de HTML naar:
- `src/lib/insta-knowledge/__tests__/fixtures/reel.html`
- `src/lib/insta-knowledge/__tests__/fixtures/post.html`

(Als je geen echte public samples kan vinden, minimale synthetische fixture maken: een HTML-string met `<meta property="og:description" content="Caption ..." />`, `<meta property="og:title" content="@demo" />`, en voor reel `"video_url":"https://scontent.xxx/video.mp4"`.)

- [ ] **Step 3: Schrijf falende test**

```ts
// src/lib/insta-knowledge/__tests__/scrape.test.ts
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { parseInstagramUrl, parseInstagramPage } from "../scrape";

const fixturesDir = join(__dirname, "fixtures");

describe("parseInstagramUrl", () => {
  it("extracts shortcode for reel", () => {
    expect(parseInstagramUrl("https://www.instagram.com/reel/ABC123/")).toEqual({
      type: "reel",
      instagramId: "ABC123",
    });
  });
  it("extracts shortcode for post", () => {
    expect(parseInstagramUrl("https://www.instagram.com/p/XYZ789/?hl=en")).toEqual({
      type: "post",
      instagramId: "XYZ789",
    });
  });
  it("returns null for non-instagram URL", () => {
    expect(parseInstagramUrl("https://example.com/reel/ABC")).toBeNull();
  });
});

describe("parseInstagramPage", () => {
  it("parses reel HTML into RawItem", () => {
    const html = readFileSync(join(fixturesDir, "reel.html"), "utf8");
    const item = parseInstagramPage(html, "https://www.instagram.com/reel/ABC/", "reel", "ABC");
    expect(item.type).toBe("reel");
    expect(item.caption.length).toBeGreaterThan(0);
    expect(item.mediaUrl).toMatch(/^https?:\/\//);
  });
  it("parses post HTML without mediaUrl", () => {
    const html = readFileSync(join(fixturesDir, "post.html"), "utf8");
    const item = parseInstagramPage(html, "https://www.instagram.com/p/XYZ/", "post", "XYZ");
    expect(item.type).toBe("post");
    expect(item.caption.length).toBeGreaterThan(0);
    expect(item.mediaUrl).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run test — expect pass (scraper + test are written together)**

Run: `npm test -- scrape`
Expected: beide tests in `parseInstagramUrl` PASS, beide `parseInstagramPage` tests PASS. Als fixtures niet matchen met de scraper-regex (omdat IG z'n HTML net anders structureert): fix de regex pragmatisch op basis van wat de echte HTML bevat.

- [ ] **Step 5: Commit**

```bash
git add src/lib/insta-knowledge/scrape.ts src/lib/insta-knowledge/__tests__/scrape.test.ts src/lib/insta-knowledge/__tests__/fixtures/
git commit -m "feat(insta-knowledge): page scraper + URL parser with tests"
```

---

### Task 4: Manual source adapter

**Files:**
- Create: `src/lib/insta-knowledge/adapters/manual.ts`

- [ ] **Step 1: Schrijf adapter**

```ts
// src/lib/insta-knowledge/adapters/manual.ts
import type { SourceAdapter, RawItem } from "../types";
import { parseInstagramUrl, parseInstagramPage, fetchInstagramPage } from "../scrape";

export const manualAdapter: SourceAdapter = {
  name: "manual",
  async fetchItem(url: string): Promise<RawItem> {
    const parsed = parseInstagramUrl(url);
    if (!parsed) throw new Error("invalid_instagram_url");
    const html = await fetchInstagramPage(url);
    return parseInstagramPage(html, url, parsed.type, parsed.instagramId);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insta-knowledge/adapters/manual.ts
git commit -m "feat(insta-knowledge): manual source adapter"
```

---

### Task 5: Whisper transcribe

**Files:**
- Create: `src/lib/insta-knowledge/transcribe.ts`

- [ ] **Step 1: Schrijf transcribe wrapper**

```ts
// src/lib/insta-knowledge/transcribe.ts
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB (buffer voor 25MB Whisper-limiet)

export class MediaTooLargeError extends Error {
  constructor() { super("media_too_large"); }
}

export async function transcribeReelFromUrl(mediaUrl: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY niet geconfigureerd");

  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) throw new Error(`media_fetch_${mediaRes.status}`);

  const contentLength = Number(mediaRes.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES) throw new MediaTooLargeError();

  const blob = await mediaRes.blob();
  if (blob.size > MAX_BYTES) throw new MediaTooLargeError();

  const formData = new FormData();
  formData.append("file", blob, "reel.mp4");
  formData.append("model", "whisper-1");

  const whisperRes = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!whisperRes.ok) {
    const body = await whisperRes.text().catch(() => "");
    throw new Error(`whisper_${whisperRes.status}: ${body.slice(0, 200)}`);
  }
  const data = (await whisperRes.json()) as { text?: string };
  return data.text ?? "";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insta-knowledge/transcribe.ts
git commit -m "feat(insta-knowledge): whisper reel transcribe"
```

---

### Task 6: System prompt

**Files:**
- Create: `src/lib/insta-knowledge/prompts.ts`

- [ ] **Step 1: Schrijf prompt**

```ts
// src/lib/insta-knowledge/prompts.ts
export const INSTA_SYSTEM_PROMPT = `Je bent een expert-analist die Instagram-content diepgaand analyseert over AI coding tools, Claude Code, AI agents, en automation.

Je doel: extraheer ALLES wat bruikbaar is uit de caption + (voor reels) het transcript. Wees uitgebreid en compleet — dit wordt een kennisbank waar de gebruiker later in zoekt. Mis niets.

Context over de gebruiker:
Autronis is een Nederlands tech-bedrijf (Sem & Syb) dat werkt met: Next.js, Turso (SQLite), Vercel, Python, Claude Code, n8n automation, en een custom dashboard. Ze bouwen AI-gestuurde tools en automatisering voor klanten. Score hoger als de content direct toepasbaar is voor hun stack en werkwijze.

Instagram-specifieke context:
- Posts hebben alleen een caption. Reels hebben caption + audio-transcript.
- Reels zijn KORT (15-90 sec). Score niet lager puur omdat er minder content is — waardeer dichtheid. Een reel met één heldere, direct toepasbare tip is score 8+.
- Carrousels (meerdere slides) tonen we als post met één caption; we hebben geen OCR op de slides zelf. Als caption verwijst naar "swipe voor tips" die we niet zien, noteer dat kort in relevance_reason.

Antwoord ALLEEN met valid JSON (geen markdown fences) in exact dit format:
{
  "idea_title": "Korte, actiegerichte Nederlandse titel die beschrijft wat je hiermee kunt DOEN. Niet de originele caption, maar het idee erachter.",
  "summary": "Uitgebreide samenvatting van 3-5 zinnen. Beschrijf het onderwerp, de key insights, en waarom dit relevant is.",
  "features": [
    {"name": "Feature naam", "description": "Uitgebreide beschrijving. Minimaal 2 zinnen.", "category": "core | workflow | integration | tips"}
  ],
  "steps": [
    {"order": 1, "title": "Duidelijke stap titel", "description": "Gedetailleerde uitleg. Minimaal 2-3 zinnen.", "code_snippet": "Exacte code of commando's als ze genoemd worden. Laat leeg als er geen code bij hoort."}
  ],
  "tips": [
    {"tip": "De volledige tip uitgeschreven", "context": "Wanneer en waarom dit nuttig is"}
  ],
  "links": [
    {"url": "https://example.com", "label": "Korte beschrijving", "type": "tool | docs | community | github | course | other"}
  ],
  "relevance_score": 8,
  "relevance_reason": "2-3 zinnen waarom deze score. Noem specifiek welke onderdelen relevant zijn voor de Autronis stack."
}

Regels:
- summary: 3-5 zinnen, Nederlands
- features: ELKE tool, feature, techniek. Typisch 2-8 per reel, 3-10 per post.
- steps: Als de content een stappenplan aanreikt, extraheer het compleet. Laat leeg array als er geen stappen zijn.
- tips: ELKE tip, best practice, waarschuwing.
- links: ALLE URLs die in caption of transcript genoemd worden. Alleen echte URLs, geen verzonnen.
- relevance_score: 1-10. 8+ voor direct toepasbaar op Claude Code / AI coding / automation. 5-7 indirect nuttig. 1-4 niet relevant.
- Als de content niet over AI/coding/automation gaat, geef relevance_score 1.

BELANGRIJK: Wees UITGEBREID. Meer detail is altijd beter.`;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insta-knowledge/prompts.ts
git commit -m "feat(insta-knowledge): Instagram-specifiek system prompt"
```

---

### Task 7: Claude analyze

**Files:**
- Create: `src/lib/insta-knowledge/analyze.ts`
- Create: `src/lib/insta-knowledge/__tests__/analyze.test.ts`

- [ ] **Step 1: Schrijf analyze**

```ts
// src/lib/insta-knowledge/analyze.ts
import { TrackedAnthropic } from "@/lib/ai/tracked-anthropic";
import { INSTA_SYSTEM_PROMPT } from "./prompts";
import type { AnalysisResult } from "./types";

export const INSTA_MODEL = "claude-sonnet-4-20250514";

function buildPrompt(input: { caption: string; transcript?: string }): string {
  const parts = [`--- CAPTION ---\n${input.caption || "(geen caption)"}`];
  if (input.transcript) parts.push(`--- TRANSCRIPT ---\n${input.transcript}`);
  return parts.join("\n\n");
}

function stripFences(s: string): string {
  return s
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function assertAnalysis(obj: unknown): asserts obj is AnalysisResult {
  if (!obj || typeof obj !== "object") throw new Error("analysis_not_object");
  const r = obj as Record<string, unknown>;
  if (typeof r.summary !== "string") throw new Error("analysis_missing_summary");
  if (typeof r.idea_title !== "string") throw new Error("analysis_missing_idea_title");
  if (!Array.isArray(r.features)) throw new Error("analysis_missing_features");
  if (!Array.isArray(r.steps)) throw new Error("analysis_missing_steps");
  if (!Array.isArray(r.tips)) throw new Error("analysis_missing_tips");
  if (!Array.isArray(r.links)) throw new Error("analysis_missing_links");
  if (typeof r.relevance_score !== "number") throw new Error("analysis_missing_score");
  if (typeof r.relevance_reason !== "string") throw new Error("analysis_missing_reason");
}

export async function analyzeInstaContent(input: {
  caption: string;
  transcript?: string;
}): Promise<AnalysisResult> {
  const anthropic = TrackedAnthropic(undefined, "/api/insta-knowledge");
  const response = await anthropic.messages.create({
    model: INSTA_MODEL,
    max_tokens: 4096,
    system: INSTA_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildPrompt(input) }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned) as unknown;
  assertAnalysis(parsed);
  return parsed;
}
```

- [ ] **Step 2: Schrijf test (mock Anthropic)**

```ts
// src/lib/insta-knowledge/__tests__/analyze.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/ai/tracked-anthropic", () => ({
  TrackedAnthropic: () => ({ messages: { create: mockCreate } }),
}));

import { analyzeInstaContent } from "../analyze";

describe("analyzeInstaContent", () => {
  beforeEach(() => mockCreate.mockReset());

  it("parses valid JSON response", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: JSON.stringify({
          idea_title: "Claude hooks voor auto-sync",
          summary: "Korte samenvatting.",
          features: [{ name: "Hook", description: "x y z.", category: "workflow" }],
          steps: [],
          tips: [],
          links: [],
          relevance_score: 8,
          relevance_reason: "Direct toepasbaar op Claude Code setup.",
        }),
      }],
    });
    const result = await analyzeInstaContent({ caption: "Test", transcript: "T" });
    expect(result.relevance_score).toBe(8);
    expect(result.idea_title).toContain("Claude");
  });

  it("strips markdown fences", async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: "text",
        text: "```json\n" + JSON.stringify({
          idea_title: "Test", summary: "x", features: [], steps: [], tips: [], links: [],
          relevance_score: 5, relevance_reason: "ok",
        }) + "\n```",
      }],
    });
    const r = await analyzeInstaContent({ caption: "c" });
    expect(r.relevance_score).toBe(5);
  });

  it("throws on malformed response", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ summary: "incomplete" }) }],
    });
    await expect(analyzeInstaContent({ caption: "c" })).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests — expect pass**

Run: `npm test -- analyze`
Expected: 3 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/insta-knowledge/analyze.ts src/lib/insta-knowledge/__tests__/analyze.test.ts
git commit -m "feat(insta-knowledge): Claude analyze met schema-validatie + tests"
```

---

### Task 8: Auto-idee creatie bij score ≥ 9

**Files:**
- Create: `src/lib/insta-knowledge/idea.ts`
- Create: `src/lib/insta-knowledge/__tests__/idea.test.ts`

- [ ] **Step 1: Schrijf idea module**

```ts
// src/lib/insta-knowledge/idea.ts
import { db } from "@/lib/db";
import { ideeen, gebruikers } from "@/lib/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import type { AnalysisResult } from "./types";

interface ItemContext {
  instagramId: string;
  url: string;
  authorHandle: string;
  type: "reel" | "post";
}

export async function createIdeaIfRelevant(
  item: ItemContext,
  analysis: AnalysisResult,
  analysisId: string
): Promise<{ created: boolean; ideaId?: number }> {
  if (analysis.relevance_score < 9) return { created: false };

  const existing = await db
    .select({ id: ideeen.id })
    .from(ideeen)
    .where(
      and(
        eq(ideeen.bron, "insta-knowledge"),
        like(ideeen.bronTekst, `%"instagramId":"${item.instagramId}"%`)
      )
    )
    .get();
  if (existing) return { created: false };

  const defaultUser = await db.select().from(gebruikers).limit(1).get();
  const userId = defaultUser?.id ?? 1;

  const featuresText = analysis.features
    .map((f) => `- **${f.name}**: ${f.description}`).join("\n");
  const stepsText = analysis.steps
    .map((s) => `${s.order}. **${s.title}**\n   ${s.description}${s.code_snippet ? `\n   \`${s.code_snippet}\`` : ""}`)
    .join("\n");
  const tipsText = analysis.tips.map((t) => `- ${t.tip} — _${t.context}_`).join("\n");
  const linksText = analysis.links
    .map((l) => `- [${l.label}](${l.url}) _(${l.type})_`).join("\n");

  const omschrijving =
    `${analysis.summary}\n\n**Relevantie:** ${analysis.relevance_score}/10 — ${analysis.relevance_reason}\n\n[Bekijk op Instagram](${item.url})`;
  const uitwerking =
    `## Features\n${featuresText}\n\n## Stappenplan\n${stepsText}\n\n## Tips\n${tipsText}${linksText ? `\n\n## Links\n${linksText}` : ""}\n\n---\n_Bron: Instagram ${item.type} van @${item.authorHandle} — Insta Knowledge Pipeline_`;

  const maxNummer = await db
    .select({ max: sql<number>`MAX(nummer)` })
    .from(ideeen).get();
  const nextNummer = (maxNummer?.max ?? 0) + 1;

  const bronTekst = JSON.stringify({
    instagramId: item.instagramId,
    itemUrl: item.url,
    authorHandle: item.authorHandle,
    type: item.type,
    analysisId,
    relevanceScore: analysis.relevance_score,
  });

  const inserted = await db.insert(ideeen).values({
    nummer: nextNummer,
    naam: analysis.idea_title,
    categorie: "content_media",
    status: "idee",
    prioriteit: "normaal",
    doelgroep: "persoonlijk",
    omschrijving,
    uitwerking,
    aiScore: analysis.relevance_score,
    isAiSuggestie: 1,
    gepromoveerd: 0,
    bron: "insta-knowledge",
    bronTekst,
    aangemaaktDoor: userId,
  }).returning({ id: ideeen.id }).get();

  return { created: true, ideaId: inserted?.id };
}
```

- [ ] **Step 2: Schrijf test**

```ts
// src/lib/insta-knowledge/__tests__/idea.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (..._args: unknown[]) => {
      const self: Record<string, unknown> = {};
      self.from = () => self;
      self.where = () => self;
      self.limit = () => self;
      self.get = () => mockSelect();
      return self;
    },
    insert: () => ({
      values: () => ({
        returning: () => ({ get: () => mockInsert({ id: 123 }) }),
      }),
    }),
  },
}));
vi.mock("@/lib/db/schema", () => ({ ideeen: {}, gebruikers: {} }));

import { createIdeaIfRelevant } from "../idea";
import type { AnalysisResult } from "../types";

const baseAnalysis: AnalysisResult = {
  idea_title: "Test idee",
  summary: "s",
  features: [], steps: [], tips: [], links: [],
  relevance_score: 5,
  relevance_reason: "r",
};

describe("createIdeaIfRelevant", () => {
  beforeEach(() => { mockInsert.mockReset(); mockSelect.mockReset(); });

  it("skips when score < 9", async () => {
    const r = await createIdeaIfRelevant(
      { instagramId: "A", url: "u", authorHandle: "h", type: "reel" },
      baseAnalysis, "aid"
    );
    expect(r.created).toBe(false);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("skips when dedup hit", async () => {
    mockSelect.mockReturnValueOnce({ id: 42 });
    const r = await createIdeaIfRelevant(
      { instagramId: "A", url: "u", authorHandle: "h", type: "reel" },
      { ...baseAnalysis, relevance_score: 10 }, "aid"
    );
    expect(r.created).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests — expect pass**

Run: `npm test -- idea`
Expected: 2 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/insta-knowledge/idea.ts src/lib/insta-knowledge/__tests__/idea.test.ts
git commit -m "feat(insta-knowledge): auto-idee bij score >= 9 + dedup"
```

---

### Task 9: Worker (orchestrator)

**Files:**
- Create: `src/lib/insta-knowledge/worker.ts`

- [ ] **Step 1: Schrijf worker**

```ts
// src/lib/insta-knowledge/worker.ts
import { tursoClient } from "@/lib/db";
import { manualAdapter } from "./adapters/manual";
import { transcribeReelFromUrl, MediaTooLargeError } from "./transcribe";
import { analyzeInstaContent, INSTA_MODEL } from "./analyze";
import { createIdeaIfRelevant } from "./idea";
import type { WorkerOutcome } from "./types";

async function markFailed(itemId: string, reason: string): Promise<void> {
  if (!tursoClient) return;
  await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'failed', failure_reason = ? WHERE id = ?",
    args: [reason, itemId],
  });
}

export async function processItem(itemId: string): Promise<WorkerOutcome> {
  if (!tursoClient) return { ok: false, reason: "no_db" };

  const itemRes = await tursoClient.execute({
    sql: "SELECT id, url, instagram_id, type FROM isk_items WHERE id = ?",
    args: [itemId],
  });
  if (!itemRes.rows.length) return { ok: false, reason: "not_found" };
  const row = itemRes.rows[0];
  const url = row.url as string;
  const instagramId = row.instagram_id as string;
  const type = row.type as "reel" | "post";

  await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'processing' WHERE id = ?",
    args: [itemId],
  });

  let rawItem;
  try {
    rawItem = await manualAdapter.fetchItem(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "scrape_failed";
    await markFailed(itemId, msg.startsWith("instagram_fetch") ? "not_public" : "scrape_failed");
    return { ok: false, reason: "scrape_failed" };
  }

  await tursoClient.execute({
    sql: "UPDATE isk_items SET caption = ?, author_handle = ?, media_url = ? WHERE id = ?",
    args: [rawItem.caption, rawItem.authorHandle, rawItem.mediaUrl ?? null, itemId],
  });

  let transcript: string | undefined;
  if (type === "reel") {
    if (!rawItem.mediaUrl) {
      await markFailed(itemId, "no_media_url");
      return { ok: false, reason: "no_media_url" };
    }
    try {
      transcript = await transcribeReelFromUrl(rawItem.mediaUrl);
    } catch (e) {
      if (e instanceof MediaTooLargeError) {
        await markFailed(itemId, "media_too_large");
        return { ok: false, reason: "media_too_large" };
      }
      await markFailed(itemId, "transcription_failed");
      return { ok: false, reason: "transcription_failed" };
    }
  }

  let analysis;
  try {
    analysis = await analyzeInstaContent({ caption: rawItem.caption, transcript });
  } catch {
    await markFailed(itemId, "analysis_failed");
    return { ok: false, reason: "analysis_failed" };
  }

  const analysisId = crypto.randomUUID();
  await tursoClient.execute({
    sql: `INSERT INTO isk_analyses
          (id, item_id, summary, features, steps, tips, links, relevance_score, relevance_reason, raw_transcript, raw_caption, model_used)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      analysisId, itemId,
      analysis.summary,
      JSON.stringify(analysis.features),
      JSON.stringify(analysis.steps),
      JSON.stringify(analysis.tips),
      JSON.stringify(analysis.links),
      analysis.relevance_score,
      analysis.relevance_reason,
      transcript ?? null,
      rawItem.caption,
      INSTA_MODEL,
    ],
  });

  await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'done', processed_at = datetime('now') WHERE id = ?",
    args: [itemId],
  });

  try {
    await createIdeaIfRelevant(
      { instagramId, url, authorHandle: rawItem.authorHandle, type },
      analysis, analysisId
    );
  } catch {
    // niet blokkerend
  }

  return { ok: true, analysisId, relevanceScore: analysis.relevance_score };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/insta-knowledge/worker.ts
git commit -m "feat(insta-knowledge): worker orchestrator (scrape → transcribe → analyze → persist)"
```

---

### Task 10: POST /api/insta-knowledge (submit + after)

**Files:**
- Create: `src/app/api/insta-knowledge/route.ts`

- [ ] **Step 1: Schrijf POST + GET**

```ts
// src/app/api/insta-knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { parseInstagramUrl } from "@/lib/insta-knowledge/scrape";
import { processItem } from "@/lib/insta-knowledge/worker";

export const maxDuration = 60;

export async function GET() {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

  const [itemsRes, statsRes] = await Promise.all([
    tursoClient.execute(
      "SELECT i.id, i.instagram_id, i.type, i.url, i.caption, i.author_handle, i.status, i.failure_reason, i.discovered_at, i.processed_at, a.summary, a.features, a.steps, a.tips, a.links, a.relevance_score, a.relevance_reason FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id ORDER BY i.discovered_at DESC LIMIT 200"
    ),
    tursoClient.execute(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS processed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, AVG(a.relevance_score) AS avg_score FROM isk_items i LEFT JOIN isk_analyses a ON a.item_id = i.id"
    ),
  ]);

  const items = itemsRes.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    instagram_id: r.instagram_id,
    type: r.type,
    url: r.url,
    caption: r.caption,
    author_handle: r.author_handle,
    status: r.status,
    failure_reason: r.failure_reason,
    discovered_at: r.discovered_at,
    processed_at: r.processed_at,
    analysis: r.summary ? {
      summary: r.summary,
      features: JSON.parse((r.features as string) || "[]"),
      steps: JSON.parse((r.steps as string) || "[]"),
      tips: JSON.parse((r.tips as string) || "[]"),
      links: JSON.parse((r.links as string) || "[]"),
      relevance_score: r.relevance_score,
      relevance_reason: r.relevance_reason,
    } : null,
  }));

  const s = statsRes.rows[0] || {};
  const stats = {
    total: Number(s.total) || 0,
    processed: Number(s.processed) || 0,
    failed: Number(s.failed) || 0,
    avg_score: Math.round((Number(s.avg_score) || 0) * 10) / 10,
  };

  return NextResponse.json({ items, stats });
}

export async function POST(request: NextRequest) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

  const { url } = await request.json();
  if (!url || typeof url !== "string") return NextResponse.json({ fout: "url is verplicht" }, { status: 400 });

  const parsed = parseInstagramUrl(url);
  if (!parsed) return NextResponse.json({ fout: "Geen geldige Instagram reel/post URL" }, { status: 400 });

  const existing = await tursoClient.execute({
    sql: "SELECT id, status FROM isk_items WHERE instagram_id = ?",
    args: [parsed.instagramId],
  });
  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    return NextResponse.json({ id: r.id, status: r.status, duplicate: true });
  }

  const id = crypto.randomUUID();
  await tursoClient.execute({
    sql: "INSERT INTO isk_items (id, instagram_id, type, url, status) VALUES (?, ?, ?, ?, 'pending')",
    args: [id, parsed.instagramId, parsed.type, url],
  });

  after(async () => {
    try { await processItem(id); } catch { /* failure is in DB status */ }
  });

  return NextResponse.json({ id, status: "pending" }, { status: 201 });
}
```

- [ ] **Step 2: Smoke-test lokaal**

Start dev server: `npm run dev`. In een andere terminal:

```bash
# login cookie eerst via browser of API
curl -b /tmp/autronis-cookie.txt http://localhost:3000/api/insta-knowledge
```

Expected: `{"items":[], "stats":{"total":0,...}}`.

```bash
curl -b /tmp/autronis-cookie.txt -X POST http://localhost:3000/api/insta-knowledge \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/reel/ABC123/"}'
```
Expected: `{"id":"<uuid>","status":"pending"}` status 201. In de server-logs zie je binnen ~1 min een fail (ABC123 bestaat niet) of done.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/insta-knowledge/route.ts
git commit -m "feat(insta-knowledge): POST submit + GET list (after() voor async werk)"
```

---

### Task 11: Retry + delete endpoints

**Files:**
- Create: `src/app/api/insta-knowledge/items/[id]/route.ts`
- Create: `src/app/api/insta-knowledge/items/[id]/retry/route.ts`

- [ ] **Step 1: Schrijf DELETE**

```ts
// src/app/api/insta-knowledge/items/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });
  const { id } = await ctx.params;
  await tursoClient.execute({ sql: "DELETE FROM isk_analyses WHERE item_id = ?", args: [id] });
  await tursoClient.execute({ sql: "DELETE FROM isk_items WHERE id = ?", args: [id] });
  return NextResponse.json({ succes: true });
}
```

- [ ] **Step 2: Schrijf retry POST**

```ts
// src/app/api/insta-knowledge/items/[id]/retry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { tursoClient } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { processItem } from "@/lib/insta-knowledge/worker";

export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await requireAuth();
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });
  const { id } = await ctx.params;

  const upd = await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'pending', failure_reason = NULL WHERE id = ? AND status IN ('failed','done')",
    args: [id],
  });
  if (upd.rowsAffected === 0) {
    return NextResponse.json({ fout: "Item niet gevonden of al pending/processing" }, { status: 409 });
  }

  after(async () => { try { await processItem(id); } catch { /* noop */ } });
  return NextResponse.json({ succes: true, id, status: "pending" });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/insta-knowledge/items/
git commit -m "feat(insta-knowledge): DELETE + retry endpoints"
```

---

### Task 12: Cleanup cron (daily stale-processing reset)

**Files:**
- Create: `src/app/api/insta-knowledge/cleanup/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Schrijf cleanup endpoint**

```ts
// src/app/api/insta-knowledge/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tursoClient } from "@/lib/db";

function isVercelCron(req: NextRequest): boolean {
  return req.headers.get("x-vercel-cron") === "1";
}

export async function POST(req: NextRequest) {
  if (!isVercelCron(req)) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ fout: "unauthorized" }, { status: 401 });
    }
  }
  if (!tursoClient) return NextResponse.json({ fout: "Geen DB" }, { status: 500 });

  const res = await tursoClient.execute({
    sql: "UPDATE isk_items SET status = 'pending' WHERE status = 'processing' AND discovered_at < datetime('now','-1 hour')",
  });

  return NextResponse.json({ succes: true, reset: res.rowsAffected });
}

export async function GET(req: NextRequest) { return POST(req); }
```

- [ ] **Step 2: Voeg cron toe aan `vercel.json`**

Open `vercel.json` en voeg binnen de `crons` array een entry toe:

```json
{ "path": "/api/insta-knowledge/cleanup", "schedule": "0 4 * * *" }
```

(4 uur 's nachts, rustigste moment.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/insta-knowledge/cleanup/ vercel.json
git commit -m "feat(insta-knowledge): daily cleanup cron voor stale processing-items"
```

---

### Task 13: UI pagina

**Files:**
- Create: `src/app/(dashboard)/insta-knowledge/page.tsx`

- [ ] **Step 1: Schrijf pagina**

```tsx
// src/app/(dashboard)/insta-knowledge/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Loader2, RefreshCw, Trash2, ExternalLink, Plus, CheckCircle2, XCircle, Clock, Play, Image as ImageIcon, Star } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { UitlegBlock } from "@/components/ui/uitleg-block";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type ItemStatus = "pending" | "processing" | "done" | "failed";

interface Analysis {
  summary: string;
  features: { name: string; description: string; category: string }[];
  steps: { order: number; title: string; description: string; code_snippet: string }[];
  tips: { tip: string; context: string }[];
  links: { url: string; label: string; type: string }[];
  relevance_score: number;
  relevance_reason: string;
}

interface Item {
  id: string;
  instagram_id: string;
  type: "reel" | "post";
  url: string;
  caption: string | null;
  author_handle: string | null;
  status: ItemStatus;
  failure_reason: string | null;
  discovered_at: string;
  processed_at: string | null;
  analysis: Analysis | null;
}

interface Stats { total: number; processed: number; failed: number; avg_score: number; }

export default function InstaKnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, processed: 0, failed: 0, avg_score: 0 });
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Item | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    const r = await fetch("/api/insta-knowledge");
    if (!r.ok) return;
    const d = await r.json();
    setItems(d.items);
    setStats(d.stats);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const hasActive = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasActive) return;
    const t = setInterval(fetchData, 4000);
    return () => clearInterval(t);
  }, [items, fetchData]);

  const submit = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/insta-knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.fout || "submit mislukt");
      if (d.duplicate) addToast("Al eerder toegevoegd", "succes");
      else addToast("Toegevoegd — analyse start", "succes");
      setUrl("");
      await fetchData();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "fout", "fout");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async (id: string) => {
    const r = await fetch(`/api/insta-knowledge/items/${id}/retry`, { method: "POST" });
    if (r.ok) { addToast("Opnieuw gestart", "succes"); fetchData(); }
    else addToast("Retry mislukt", "fout");
  };

  const del = async (id: string) => {
    if (!confirm("Item verwijderen?")) return;
    const r = await fetch(`/api/insta-knowledge/items/${id}`, { method: "DELETE" });
    if (r.ok) { addToast("Verwijderd", "succes"); fetchData(); }
  };

  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <Instagram className="w-7 h-7 text-[var(--autronis-accent)]" />
          <h1 className="text-2xl font-semibold">Insta Knowledge</h1>
        </header>

        <UitlegBlock id="insta-knowledge-intro" title="Hoe werkt dit?">
          <p>Plak een Instagram reel- of post-URL hieronder. De pipeline scraped de caption (en voor reels: transcribeert de audio via Whisper), analyseert met Claude, en scored relevance 1-10. Bij score ≥ 9 verschijnt automatisch een idee in /ideeen.</p>
          <p className="mt-2 text-sm opacity-70">Fase 1: alleen handmatige submit. Auto-scraping via Apify komt in fase 2.</p>
        </UitlegBlock>

        <section className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-5 card-glow">
          <div className="flex gap-3 items-stretch">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submit(); }}
              placeholder="https://www.instagram.com/reel/..."
              className="flex-1 bg-[var(--autronis-bg)] border border-[var(--autronis-border)] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[var(--autronis-accent)]"
            />
            <button
              onClick={submit}
              disabled={submitting || !url.trim()}
              className="bg-[var(--autronis-accent)] hover:bg-[var(--autronis-accent-hover)] disabled:opacity-50 text-black font-medium rounded-xl px-5 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Toevoegen
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Totaal" value={stats.total} />
          <StatCard label="Verwerkt" value={stats.processed} />
          <StatCard label="Mislukt" value={stats.failed} />
          <StatCard label="Gem. score" value={stats.avg_score || "—"} />
        </section>

        <section className="space-y-3">
          {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>}
          {!loading && items.length === 0 && (
            <div className="text-center py-16 opacity-60">Nog geen items. Plak een URL om te starten.</div>
          )}
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-4 card-glow cursor-pointer"
              onClick={() => setDetail(item)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {item.type === "reel" ? <Play className="w-5 h-5 opacity-70" /> : <ImageIcon className="w-5 h-5 opacity-70" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} />
                    {item.analysis && <ScoreBadge score={item.analysis.relevance_score} />}
                    {item.author_handle && <span className="text-sm opacity-60">@{item.author_handle}</span>}
                  </div>
                  <div className="font-medium truncate">
                    {item.analysis?.summary ? item.analysis.summary.slice(0, 120) + "…" : item.caption?.slice(0, 120) || item.instagram_id}
                  </div>
                  {item.failure_reason && (
                    <div className="text-sm text-red-400 mt-1">Fout: {item.failure_reason}</div>
                  )}
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <a href={item.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-[var(--autronis-border)] rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                  {(item.status === "failed" || item.status === "done") && (
                    <button onClick={() => retry(item.id)} className="p-2 hover:bg-[var(--autronis-border)] rounded-lg"><RefreshCw className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => del(item.id)} className="p-2 hover:bg-red-900/40 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        {detail && <DetailDrawer item={detail} onClose={() => setDetail(null)} />}
      </div>
    </PageTransition>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const map = {
    pending: { icon: Clock, label: "Wachtend", cls: "bg-amber-900/40 text-amber-300" },
    processing: { icon: Loader2, label: "Bezig", cls: "bg-blue-900/40 text-blue-300 animate-pulse" },
    done: { icon: CheckCircle2, label: "Klaar", cls: "bg-emerald-900/40 text-emerald-300" },
    failed: { icon: XCircle, label: "Mislukt", cls: "bg-red-900/40 text-red-300" },
  } as const;
  const { icon: Icon, label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", cls)}>
      <Icon className={cn("w-3 h-3", status === "processing" && "animate-spin")} /> {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 9 ? "text-emerald-300" : score >= 7 ? "text-amber-300" : "text-gray-400";
  return <span className={cn("inline-flex items-center gap-1 text-xs", color)}><Star className="w-3 h-3" /> {score}/10</span>;
}

function DetailDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const a = item.analysis;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--autronis-card)] border border-[var(--autronis-border)] rounded-t-2xl md:rounded-2xl w-full md:max-w-3xl max-h-[90vh] overflow-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-sm opacity-60">@{item.author_handle || "onbekend"} · {item.type}</div>
            <h2 className="text-xl font-semibold mt-1">{a?.summary ? a.summary.slice(0, 80) : item.instagram_id}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--autronis-border)] rounded-lg"><XCircle className="w-5 h-5" /></button>
        </div>
        {a ? (
          <div className="space-y-5 text-sm">
            <div><h3 className="font-semibold mb-1">Samenvatting</h3><p className="opacity-90">{a.summary}</p></div>
            <div><h3 className="font-semibold mb-1">Relevantie: {a.relevance_score}/10</h3><p className="opacity-80">{a.relevance_reason}</p></div>
            {a.features.length > 0 && (<div><h3 className="font-semibold mb-2">Features</h3><ul className="space-y-1">{a.features.map((f, i) => <li key={i}><strong>{f.name}:</strong> {f.description}</li>)}</ul></div>)}
            {a.steps.length > 0 && (<div><h3 className="font-semibold mb-2">Stappenplan</h3><ol className="space-y-2">{a.steps.map((s) => <li key={s.order}><strong>{s.order}. {s.title}</strong><div className="opacity-80">{s.description}</div>{s.code_snippet && <pre className="bg-[var(--autronis-bg)] rounded-lg p-2 mt-1 overflow-x-auto text-xs">{s.code_snippet}</pre>}</li>)}</ol></div>)}
            {a.tips.length > 0 && (<div><h3 className="font-semibold mb-2">Tips</h3><ul className="space-y-1">{a.tips.map((t, i) => <li key={i}>{t.tip} — <em className="opacity-60">{t.context}</em></li>)}</ul></div>)}
            {a.links.length > 0 && (<div><h3 className="font-semibold mb-2">Links</h3><ul className="space-y-1">{a.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noreferrer" className="text-[var(--autronis-accent)] hover:underline">{l.label}</a> <span className="opacity-50 text-xs">({l.type})</span></li>)}</ul></div>)}
          </div>
        ) : (
          <p className="opacity-60">Nog geen analyse beschikbaar.</p>
        )}
        {item.caption && <div className="mt-6 border-t border-[var(--autronis-border)] pt-4"><h4 className="font-semibold mb-1 text-sm">Originele caption</h4><p className="text-sm opacity-80 whitespace-pre-wrap">{item.caption}</p></div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test in browser**

Run: `npm run dev`. Open `http://localhost:3000/insta-knowledge` (ingelogd). Paste een geldige public IG reel-URL, klik Toevoegen. Lijst refresht elke 4s. Binnen ~1 min zou status done moeten zijn (of failed met reden).

- [ ] **Step 3: TypeScript-check**

Run: `npx tsc --noEmit`
Expected: no errors (schone compile).

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/insta-knowledge/
git commit -m "feat(insta-knowledge): UI-pagina met submit, lijst, detail-drawer"
```

---

### Task 14: Final verify + docs

**Files:**
- Modify: `CLAUDE.md` (project root, niet dashboard) — sectie "Insta Knowledge Pipeline" met usage

- [ ] **Step 1: Runn alle tests**

Run: `npm test`
Expected: alle insta-knowledge tests PASS (scrape, analyze, idea).

- [ ] **Step 2: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: geen errors.

- [ ] **Step 3: Voeg korte sectie aan root `CLAUDE.md` toe**

Open `/Users/semmiegijs/Autronis/CLAUDE.md` en voeg toe onder een nieuwe sectie `## Insta Knowledge Pipeline`:

```markdown
## Insta Knowledge Pipeline
Parallel aan yt-knowledge. Plak reel- of post-URL op `/insta-knowledge` in dashboard → automatisch gescraped + (voor reels) Whisper-transcriptie + Claude-analyse. Bij score ≥ 9 auto-idee. Fase 1 = handmatige submit; Apify-adapter komt in Fase 2.

- UI: `/insta-knowledge`
- API submit: `POST /api/insta-knowledge` body `{url}`
- Retry: `POST /api/insta-knowledge/items/<id>/retry`
- Tabellen: `isk_sources`, `isk_items`, `isk_analyses`
- Kosten Fase 1: ~$3-5/mo (Claude + Whisper)
```

- [ ] **Step 4: Push naar main (triggert Vercel-deploy)**

```bash
git add CLAUDE.md
git commit -m "docs: Insta Knowledge Pipeline sectie in CLAUDE.md"
git push origin main
```

Dit is de bewuste deploy — alles erboven was lokaal committen. Nu draait het live.

- [ ] **Step 5: E2E manueel op live**

Open `https://dashboard.autronis.nl/insta-knowledge`, submit 2-3 echte reels/posts van accounts zoals `@aipreneur`, `@codewithrio`, `@matthewberman`. Check dat:
1. Submit werkt (201 + pending)
2. Binnen ~1 min status `done`
3. Score, features, steps zijn ingevuld
4. Bij score ≥ 9: check `/ideeen` — er staat een nieuw idee met bron `insta-knowledge`

Als failures optreden: check Vercel-logs op welk failure_reason (scrape_failed / not_public / media_too_large / transcription_failed / analysis_failed).

---

## Self-Review

**Spec-coverage:**
- ✅ Content types reel + post: Task 2 (types), Task 3 (scraper herkent beide), Task 9 (worker skip transcribe voor post)
- ✅ Handmatige submit: Task 10
- ✅ Source adapter interface: Task 2 + 4 (fase 2 Apify-adapter voegt hier bij zonder route-wijziging)
- ✅ Vercel async processing: Task 10 gebruikt `after()` (Hobby-compatibel, geen per-minute cron nodig)
- ✅ Schema parallel `isk_*`: Task 1
- ✅ IG-page scrape i.p.v. ffmpeg: Task 3 + 5 (Whisper krijgt MP4-URL direct via fetch + FormData)
- ✅ Auto-idee score ≥ 9: Task 8
- ✅ UI parallel aan yt-knowledge: Task 13
- ✅ Fout-modes scrape_failed / not_public / media_too_large / transcription_failed / analysis_failed: Task 9
- ✅ Stale-processing cleanup: Task 12

**Type consistency:** `RawItem`, `AnalysisResult`, `SourceAdapter`, `ItemStatus`, `ItemType` allen gedefinieerd in Task 2 en consistent gebruikt in Task 3-13. `INSTA_MODEL` gedeeld tussen analyze.ts en worker.ts.

**Placeholder scan:** geen TBD/TODO/"implement later" gevonden. Alle code-stappen hebben complete code; alle tests hebben concrete asserties.

**Geen gaten tussen spec en plan gevonden.**
