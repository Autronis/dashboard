# Proposal Presentation Deck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vervang de bestaande traditionele proposal-offerte door een bold-agency presentatie-deck (dark Autronis palette), fix de dode `/proposals/nieuw` link, en voeg een live demo-modus toe — zowel in de browser als in de PDF-download.

**Architecture:** Discriminated union van slide-types opgeslagen als JSON in bestaande `proposals.secties` kolom (geen DB-migratie). Twee render-paths die hetzelfde `Slide[]` lezen: React/Tailwind voor web, `@react-pdf/renderer` voor PDF. Backwards-compat via `parseSlides` helper.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Drizzle ORM + Turso, `@react-pdf/renderer`, `@dnd-kit`, `framer-motion`, `marked`, `zod` (nieuw), `@vercel/blob` (nieuw), `vitest` voor unit tests.

**Gerelateerde spec:** [`docs/superpowers/specs/2026-04-13-proposal-presentation-deck-design.md`](../specs/2026-04-13-proposal-presentation-deck-design.md)

---

## Pre-flight (handmatig, vóór taak 1)

- [ ] **Worktree aanmaken** (als er nog andere Claude chats in autronis-dashboard draaien, per CLAUDE.md): `/worktree proposals` — isoleert dit werk op branch `feat/proposals` in `.worktrees/proposals/`. Alleen lezen? Overslaan.
- [ ] **Dependencies installeren:**
  ```bash
  npm install zod@^3 @vercel/blob
  ```
- [ ] **Env var toevoegen** voor Vercel Blob (Sem moet dit zelf doen — Claude kan geen secrets zetten):
  - `.env.local`: `BLOB_READ_WRITE_TOKEN=...` (haal op via `vercel env pull` of Vercel dashboard → Storage → Blob → Tokens)
  - Vercel production: zelfde var via Vercel dashboard → Settings → Environment Variables
- [ ] **Fonts downloaden** (Inter + Space Grotesk) en plaatsen in `public/fonts/`:
  - [Inter-Regular.ttf, Inter-SemiBold.ttf, Inter-Bold.ttf](https://github.com/rsms/inter/releases) → extract `.ttf` files
  - [SpaceGrotesk-Bold.ttf](https://github.com/floriankarsten/space-grotesk/releases) → extract
  - Verify: `ls public/fonts/` toont 4 `.ttf` files

---

## File Structure Overview

**Nieuwe files:**
```
src/lib/proposal-deck-tokens.ts                        # gedeelde design tokens
src/lib/proposal-schema.ts                             # zod schema + parseSlides
src/lib/proposal-schema.test.ts                        # unit tests voor parseSlides
src/lib/proposal-pdf/
├── index.tsx                                          # ProposalPDF root (replaces old file)
├── fonts.ts
├── styles.ts
├── primitives.tsx
└── pages/
    ├── CoverPage.tsx
    ├── MarkdownPage.tsx
    ├── DeliverablesPage.tsx
    ├── TijdlijnPage.tsx
    └── InvesteringPage.tsx
src/components/proposal-deck/
├── types.ts
├── defaults.ts
├── styles.ts                                          # Tailwind class constants
├── Deck.tsx
├── DeckViewer.tsx
├── DeckEditor.tsx
├── DemoMode.tsx
├── BackgroundImageUploader.tsx
├── slides/
│   ├── CoverSlide.tsx
│   ├── MarkdownSlide.tsx
│   ├── DeliverablesSlide.tsx
│   ├── TijdlijnSlide.tsx
│   └── InvesteringSlide.tsx
└── editors/
    ├── SlideCardShell.tsx
    ├── MarkdownEditor.tsx
    ├── DeliverablesEditor.tsx
    └── TijdlijnEditor.tsx
src/app/(dashboard)/proposals/nieuw/page.tsx
src/app/api/proposals/upload-image/route.ts
src/app/api/proposals/[id]/accepteren/route.ts
public/fonts/Inter-Regular.ttf
public/fonts/Inter-SemiBold.ttf
public/fonts/Inter-Bold.ttf
public/fonts/SpaceGrotesk-Bold.ttf
```

**Gemodificeerde files:**
```
src/app/api/proposals/route.ts                         # POST: zod validatie
src/app/api/proposals/[id]/route.ts                    # GET: parseSlides, PUT: zod
src/app/api/proposals/[id]/pdf/route.ts                # update import + parseSlides
src/app/(dashboard)/proposals/[id]/page.tsx            # herschreven (gebruikt DeckEditor)
src/app/proposal/[token]/page.tsx                      # herschreven (gebruikt DeckViewer)
```

**Verwijderde files:**
```
src/lib/proposal-pdf.tsx                               # vervangen door proposal-pdf/ dir
```

---

## Task 1: Gedeelde design tokens

**Files:**
- Create: `src/lib/proposal-deck-tokens.ts`

- [ ] **Step 1: Create the tokens file**

```ts
// src/lib/proposal-deck-tokens.ts
// Gedeelde waardes gebruikt door zowel de web-deck (Tailwind) als de PDF (@react-pdf/renderer).
// Wijzig hier = wijzigt overal. DRY.

export const DECK_COLORS = {
  bg: "#0E1719",
  card: "#192225",
  border: "#2A3538",
  accent: "#17B8A5",
  accentHover: "#4DC9B4",
  textPrimary: "#FFFFFF",
  textSecondary: "#A1AEB1",
  overlayDark: "rgba(14, 23, 25, 0.75)",
} as const;

export const DECK_FONTS = {
  heading: "SpaceGrotesk",
  body: "Inter",
} as const;

export const DECK_SIZES = {
  // PDF point sizes (A4 landscape = 842x595pt)
  pdfCoverHeading: 72,
  pdfHeading: 40,
  pdfSubheading: 24,
  pdfBody: 14,
  pdfSmall: 10,
  pdfTotaalImpact: 100,
  // Web uses Tailwind classes, not these numbers
} as const;
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/proposal-deck-tokens.ts
git commit -m "feat(proposals): add shared design tokens for deck and pdf"
```

---

## Task 2: Slide types en defaults

**Files:**
- Create: `src/components/proposal-deck/types.ts`
- Create: `src/components/proposal-deck/defaults.ts`

- [ ] **Step 1: Create types.ts**

```ts
// src/components/proposal-deck/types.ts

export type SlideBase = {
  id: string;
  actief: boolean;
  bgImageUrl?: string;
};

export type CoverSlide = SlideBase & {
  type: "cover";
  actief: true;
};

export type InvesteringSlide = SlideBase & {
  type: "investering";
  actief: true;
};

export type MarkdownSlideType = "situatie" | "aanpak" | "waarom" | "volgende_stap" | "vrij";

export type MarkdownSlide = SlideBase & {
  type: MarkdownSlideType;
  titel: string;
  body: string;
};

export type DeliverablesSlide = SlideBase & {
  type: "deliverables";
  titel: string;
  items: string[];
};

export type TijdlijnFase = {
  naam: string;
  duur: string;
  omschrijving: string;
};

export type TijdlijnSlide = SlideBase & {
  type: "tijdlijn";
  titel: string;
  fases: TijdlijnFase[];
};

export type Slide =
  | CoverSlide
  | InvesteringSlide
  | MarkdownSlide
  | DeliverablesSlide
  | TijdlijnSlide;

export type SlideType = Slide["type"];

export const SYSTEM_SLIDE_TYPES: SlideType[] = ["cover", "investering"];

export function isSystemSlide(slide: Slide): boolean {
  return SYSTEM_SLIDE_TYPES.includes(slide.type);
}
```

- [ ] **Step 2: Create defaults.ts**

```ts
// src/components/proposal-deck/defaults.ts
import { Slide } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function defaultSlides(): Slide[] {
  return [
    { id: newId(), type: "cover", actief: true },
    { id: newId(), type: "situatie", titel: "De situatie", body: "", actief: true },
    { id: newId(), type: "aanpak", titel: "Onze aanpak", body: "", actief: true },
    { id: newId(), type: "deliverables", titel: "Wat je krijgt", items: [], actief: true },
    { id: newId(), type: "tijdlijn", titel: "Tijdlijn", fases: [], actief: true },
    { id: newId(), type: "investering", actief: true },
    { id: newId(), type: "waarom", titel: "Waarom Autronis", body: "", actief: true },
    { id: newId(), type: "volgende_stap", titel: "Volgende stap", body: "", actief: true },
  ];
}

export const ADDABLE_SLIDE_TYPES: Array<{
  type: Exclude<Slide["type"], "cover" | "investering">;
  label: string;
}> = [
  { type: "situatie", label: "Situatie" },
  { type: "aanpak", label: "Aanpak" },
  { type: "deliverables", label: "Deliverables" },
  { type: "tijdlijn", label: "Tijdlijn" },
  { type: "waarom", label: "Waarom Autronis" },
  { type: "volgende_stap", label: "Volgende stap" },
  { type: "vrij", label: "Vrije slide (markdown)" },
];

export function emptySlideOfType(type: Exclude<Slide["type"], "cover" | "investering">): Slide {
  switch (type) {
    case "situatie":
    case "aanpak":
    case "waarom":
    case "volgende_stap":
    case "vrij":
      return { id: newId(), type, titel: "", body: "", actief: true };
    case "deliverables":
      return { id: newId(), type, titel: "", items: [], actief: true };
    case "tijdlijn":
      return { id: newId(), type, titel: "", fases: [], actief: true };
  }
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/proposal-deck/types.ts src/components/proposal-deck/defaults.ts
git commit -m "feat(proposals): add slide type definitions and defaults"
```

---

## Task 3: Zod schema + parseSlides helper (TDD)

**Files:**
- Create: `src/lib/proposal-schema.ts`
- Create: `src/lib/proposal-schema.test.ts`

- [ ] **Step 1: Write failing tests first**

```ts
// src/lib/proposal-schema.test.ts
import { describe, it, expect } from "vitest";
import { parseSlides, slidesSchema } from "./proposal-schema";

describe("parseSlides", () => {
  it("returns default slides when raw is null", () => {
    const result = parseSlides(null);
    expect(result.length).toBe(8);
    expect(result[0].type).toBe("cover");
    expect(result[result.length - 1].type).toBe("volgende_stap");
  });

  it("returns default slides when raw is empty string", () => {
    const result = parseSlides("");
    expect(result.length).toBe(8);
  });

  it("returns default slides when raw is empty array JSON", () => {
    const result = parseSlides("[]");
    expect(result.length).toBe(8);
  });

  it("parses valid new-shape slides", () => {
    const valid = JSON.stringify([
      { id: "a", type: "cover", actief: true },
      { id: "b", type: "situatie", titel: "X", body: "Y", actief: true },
      { id: "c", type: "investering", actief: true },
    ]);
    const result = parseSlides(valid);
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe("situatie");
    if (result[1].type === "situatie") {
      expect(result[1].titel).toBe("X");
      expect(result[1].body).toBe("Y");
    }
  });

  it("maps old {titel, inhoud} shape to vrij slides", () => {
    const old = JSON.stringify([
      { id: "1", titel: "Oude sectie", inhoud: "Inhoud hier", actief: true },
      { id: "2", titel: "Tweede", inhoud: "Meer", actief: false },
    ]);
    const result = parseSlides(old);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("vrij");
    if (result[0].type === "vrij") {
      expect(result[0].titel).toBe("Oude sectie");
      expect(result[0].body).toBe("Inhoud hier");
    }
    expect(result[1].actief).toBe(false);
  });

  it("generates IDs when old shape lacks them", () => {
    const old = JSON.stringify([{ titel: "Zonder id", inhoud: "Body", actief: true }]);
    const result = parseSlides(old);
    expect(result[0].id).toBeTruthy();
    expect(typeof result[0].id).toBe("string");
  });

  it("returns empty array on malformed JSON", () => {
    const result = parseSlides("not-json");
    expect(result).toEqual([]);
  });

  it("returns empty array on completely unknown shape", () => {
    const result = parseSlides(JSON.stringify([{ foo: "bar" }]));
    expect(result).toEqual([]);
  });

  it("rejects invalid slide via slidesSchema safeParse", () => {
    const result = slidesSchema.safeParse([{ id: "x", type: "cover" }]); // missing actief
    expect(result.success).toBe(false);
  });

  it("accepts deliverables with items array", () => {
    const raw = JSON.stringify([
      { id: "d", type: "deliverables", titel: "T", items: ["A", "B"], actief: true },
    ]);
    const result = parseSlides(raw);
    expect(result).toHaveLength(1);
    if (result[0].type === "deliverables") {
      expect(result[0].items).toEqual(["A", "B"]);
    }
  });

  it("accepts tijdlijn with fases array", () => {
    const raw = JSON.stringify([
      {
        id: "t",
        type: "tijdlijn",
        titel: "T",
        fases: [{ naam: "F1", duur: "2w", omschrijving: "O" }],
        actief: true,
      },
    ]);
    const result = parseSlides(raw);
    if (result[0].type === "tijdlijn") {
      expect(result[0].fases).toHaveLength(1);
      expect(result[0].fases[0].naam).toBe("F1");
    }
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/lib/proposal-schema.test.ts`
Expected: FAIL (module not found — `./proposal-schema`)

- [ ] **Step 3: Create proposal-schema.ts**

```ts
// src/lib/proposal-schema.ts
import { z } from "zod";
import { Slide } from "@/components/proposal-deck/types";
import { defaultSlides, newId } from "@/components/proposal-deck/defaults";

const baseFields = {
  id: z.string(),
  bgImageUrl: z.string().url().optional(),
};

const coverSchema = z.object({
  ...baseFields,
  type: z.literal("cover"),
  actief: z.literal(true),
});

const investeringSchema = z.object({
  ...baseFields,
  type: z.literal("investering"),
  actief: z.literal(true),
});

const markdownSchema = z.object({
  ...baseFields,
  type: z.enum(["situatie", "aanpak", "waarom", "volgende_stap", "vrij"]),
  titel: z.string(),
  body: z.string(),
  actief: z.boolean(),
});

const deliverablesSchema = z.object({
  ...baseFields,
  type: z.literal("deliverables"),
  titel: z.string(),
  items: z.array(z.string()),
  actief: z.boolean(),
});

const tijdlijnSchema = z.object({
  ...baseFields,
  type: z.literal("tijdlijn"),
  titel: z.string(),
  fases: z.array(
    z.object({
      naam: z.string(),
      duur: z.string(),
      omschrijving: z.string(),
    })
  ),
  actief: z.boolean(),
});

export const slideSchema = z.discriminatedUnion("type", [
  coverSchema,
  investeringSchema,
  markdownSchema,
  deliverablesSchema,
  tijdlijnSchema,
]);

export const slidesSchema = z.array(slideSchema);

// Old shape detection
const oldShapeItem = z.object({
  id: z.string().optional(),
  titel: z.string(),
  inhoud: z.string(),
  actief: z.boolean().optional(),
});
const oldShapeSchema = z.array(oldShapeItem);

export function parseSlides(raw: string | null): Slide[] {
  if (!raw) return defaultSlides();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(parsed) && parsed.length === 0) {
    return defaultSlides();
  }
  const newShape = slidesSchema.safeParse(parsed);
  if (newShape.success) {
    return newShape.data as Slide[];
  }
  const old = oldShapeSchema.safeParse(parsed);
  if (old.success) {
    return old.data.map((s) => ({
      id: s.id ?? newId(),
      type: "vrij" as const,
      titel: s.titel ?? "",
      body: s.inhoud ?? "",
      actief: s.actief ?? true,
    }));
  }
  console.error("parseSlides: onbekende shape", newShape.error);
  return [];
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run src/lib/proposal-schema.test.ts`
Expected: PASS (11 tests pass)

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/proposal-schema.ts src/lib/proposal-schema.test.ts
git commit -m "feat(proposals): add zod schema and parseSlides with backwards-compat"
```

---

## Task 4: Update POST /api/proposals with zod validation

**Files:**
- Modify: `src/app/api/proposals/route.ts`

- [ ] **Step 1: Update POST handler**

Replace the body destructuring and validation section (around line 86-97) with:

```ts
// POST /api/proposals
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = await req.json();

    const { klantId, titel, secties, geldigTot, regels } = body;

    if (!klantId) {
      return NextResponse.json({ fout: "Klant is verplicht." }, { status: 400 });
    }
    if (!titel?.trim()) {
      return NextResponse.json({ fout: "Titel is verplicht." }, { status: 400 });
    }

    // Validate slides shape
    const slidesResult = slidesSchema.safeParse(secties ?? []);
    if (!slidesResult.success) {
      return NextResponse.json(
        { fout: "Ongeldige slide structuur: " + slidesResult.error.issues[0]?.message },
        { status: 400 }
      );
    }
```

Add at top of file:
```ts
import { slidesSchema } from "@/lib/proposal-schema";
```

The rest of the POST handler (total calculation, insert, etc.) stays identical.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proposals/route.ts
git commit -m "feat(api): validate proposal slides with zod on POST"
```

---

## Task 5: Update GET/PUT /api/proposals/[id] with parseSlides + zod

**Files:**
- Modify: `src/app/api/proposals/[id]/route.ts`

- [ ] **Step 1: Update GET handler**

At top of file, add:
```ts
import { parseSlides, slidesSchema } from "@/lib/proposal-schema";
```

In the `GET` handler, after fetching the proposal and regels, replace the return with:
```ts
const slides = parseSlides(proposal.secties);
return NextResponse.json({
  proposal: {
    ...proposal,
    secties: slides,  // now always the new shape
  },
  regels,
});
```

- [ ] **Step 2: Update PUT handler**

Replace the body handling section:
```ts
const { klantId, titel, secties, geldigTot, regels } = body;

// Validate slides
if (secties !== undefined) {
  const slidesResult = slidesSchema.safeParse(secties);
  if (!slidesResult.success) {
    return NextResponse.json(
      { fout: "Ongeldige slide structuur: " + slidesResult.error.issues[0]?.message },
      { status: 400 }
    );
  }
}
```

The rest (update query, regel replacement) stays identical.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/api/proposals/[id]/route.ts
git commit -m "feat(api): parse slides on GET and validate on PUT"
```

---

## Task 6: Create POST /api/proposals/upload-image

**Files:**
- Create: `src/app/api/proposals/upload-image/route.ts`

- [ ] **Step 1: Create route**

```ts
// src/app/api/proposals/upload-image/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/auth";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { fout: "BLOB_READ_WRITE_TOKEN niet ingesteld in env." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ fout: "Geen bestand ontvangen." }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { fout: `Bestandstype niet toegestaan (${file.type}). Alleen JPEG, PNG of WebP.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { fout: `Bestand te groot (max ${MAX_BYTES / 1024 / 1024}MB).` },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "bin";
    const filename = `proposals/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Upload mislukt" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proposals/upload-image/route.ts
git commit -m "feat(api): add Vercel Blob image upload endpoint for proposals"
```

---

## Task 7: Create POST /api/proposals/[id]/accepteren

**Files:**
- Create: `src/app/api/proposals/[id]/accepteren/route.ts`

- [ ] **Step 1: Create route**

```ts
// src/app/api/proposals/[id]/accepteren/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { proposals } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const naam: string | undefined = body.naam;

    const [bestaand] = await db
      .select({ id: proposals.id, status: proposals.status })
      .from(proposals)
      .where(eq(proposals.id, Number(id)));

    if (!bestaand) {
      return NextResponse.json({ fout: "Proposal niet gevonden." }, { status: 404 });
    }

    await db
      .update(proposals)
      .set({
        status: "ondertekend",
        ondertekendOp: new Date().toISOString(),
        ondertekendDoor: naam ?? null,
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(proposals.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/app/api/proposals/[id]/accepteren/route.ts
git commit -m "feat(api): add manual accept endpoint for proposals"
```

---

## Task 8: Deck container + web styles constants

**Files:**
- Create: `src/components/proposal-deck/styles.ts`
- Create: `src/components/proposal-deck/Deck.tsx`

- [ ] **Step 1: Create styles.ts (Tailwind class constants)**

```ts
// src/components/proposal-deck/styles.ts
// Tailwind class sets used across slide components. Keep DRY.

export const SLIDE_BASE =
  "relative w-full h-screen flex items-center justify-center px-12 md:px-20 lg:px-32 overflow-hidden";

export const SLIDE_BG_LAYER = "absolute inset-0 z-0";
export const SLIDE_BG_OVERLAY = "absolute inset-0 bg-[#0E1719]/75 z-10";
export const SLIDE_CONTENT = "relative z-20 w-full max-w-6xl mx-auto";

export const HEADING_XL =
  "text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.95] tracking-tight text-white";
export const HEADING_LG =
  "text-[clamp(2rem,5vw,4.5rem)] font-bold leading-tight tracking-tight text-white";
export const HEADING_MD =
  "text-[clamp(1.5rem,3vw,2.5rem)] font-semibold leading-snug text-white";

export const BODY_LG = "text-[clamp(1.125rem,1.5vw,1.5rem)] text-white/80 leading-relaxed";
export const BODY_MD = "text-base md:text-lg text-white/70 leading-relaxed";

export const ACCENT_TEXT = "text-[#17B8A5]";
export const ACCENT_BG = "bg-[#17B8A5]";

export const TYPE_LABEL =
  "text-xs font-semibold tracking-widest uppercase text-[#17B8A5] mb-6";
```

Use `SpaceGrotesk` via a class defined in `globals.css` (next step).

- [ ] **Step 2: Add font-face declarations in globals.css**

Modify `src/app/globals.css`, append at the bottom:

```css
@font-face {
  font-family: "SpaceGrotesk";
  src: url("/fonts/SpaceGrotesk-Bold.ttf") format("truetype");
  font-weight: 700;
  font-display: swap;
}

@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-Regular.ttf") format("truetype");
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-SemiBold.ttf") format("truetype");
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-Bold.ttf") format("truetype");
  font-weight: 700;
  font-display: swap;
}

.font-deck-heading {
  font-family: "SpaceGrotesk", "Inter", system-ui, sans-serif;
}
.font-deck-body {
  font-family: "Inter", system-ui, sans-serif;
}
```

Then update `styles.ts` headings to append `font-deck-heading`:
```ts
export const HEADING_XL =
  "font-deck-heading text-[clamp(3rem,8vw,7rem)] font-bold leading-[0.95] tracking-tight text-white";
// same for HEADING_LG, HEADING_MD
```

- [ ] **Step 3: Create Deck.tsx**

```tsx
// src/components/proposal-deck/Deck.tsx
"use client";

import { Slide } from "./types";
import { CoverSlide } from "./slides/CoverSlide";
import { MarkdownSlide } from "./slides/MarkdownSlide";
import { DeliverablesSlide } from "./slides/DeliverablesSlide";
import { TijdlijnSlide } from "./slides/TijdlijnSlide";
import { InvesteringSlide } from "./slides/InvesteringSlide";

export type ProposalMeta = {
  titel: string;
  klantNaam: string;
  datum: string | null;
  geldigTot: string | null;
  totaalBedrag: number | null;
};

export type ProposalRegel = {
  id: number;
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  totaal: number | null;
};

export type DeckContext = {
  meta: ProposalMeta;
  regels: ProposalRegel[];
};

export function renderSlide(slide: Slide, ctx: DeckContext) {
  switch (slide.type) {
    case "cover":
      return <CoverSlide slide={slide} meta={ctx.meta} />;
    case "investering":
      return <InvesteringSlide slide={slide} meta={ctx.meta} regels={ctx.regels} />;
    case "situatie":
    case "aanpak":
    case "waarom":
    case "volgende_stap":
    case "vrij":
      return <MarkdownSlide slide={slide} />;
    case "deliverables":
      return <DeliverablesSlide slide={slide} />;
    case "tijdlijn":
      return <TijdlijnSlide slide={slide} />;
  }
}
```

(Components referenced here will be created in tasks 9-13 — expect tsc to fail until then.)

- [ ] **Step 4: Commit**

```bash
git add src/components/proposal-deck/styles.ts src/components/proposal-deck/Deck.tsx src/app/globals.css
git commit -m "feat(proposals): add deck container, styles, and font faces"
```

---

## Task 9: CoverSlide component

**Files:**
- Create: `src/components/proposal-deck/slides/CoverSlide.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/proposal-deck/slides/CoverSlide.tsx
"use client";

import Image from "next/image";
import { CoverSlide as CoverSlideType } from "../types";
import type { ProposalMeta } from "../Deck";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_XL,
  BODY_LG,
  ACCENT_TEXT,
  TYPE_LABEL,
} from "../styles";

export function CoverSlide({
  slide,
  meta,
}: {
  slide: CoverSlideType;
  meta: ProposalMeta;
}) {
  const datum = meta.datum ? new Date(meta.datum).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) : "";

  return (
    <section className={SLIDE_BASE} style={{ backgroundColor: "#0E1719" }}>
      {slide.bgImageUrl && (
        <>
          <img src={slide.bgImageUrl} alt="" className={`${SLIDE_BG_LAYER} object-cover w-full h-full`} />
          <div className={SLIDE_BG_OVERLAY} />
        </>
      )}
      <div className={SLIDE_CONTENT}>
        <div className="absolute top-12 left-12">
          <Image src="/icon.png" alt="Autronis" width={48} height={48} priority />
        </div>
        <div className="space-y-8">
          <div className={TYPE_LABEL}>Voor</div>
          <h1 className={HEADING_XL}>{meta.klantNaam}</h1>
          <p className={`${BODY_LG} ${ACCENT_TEXT} max-w-3xl`}>{meta.titel}</p>
          {datum && <p className={BODY_LG}>{datum}</p>}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposal-deck/slides/CoverSlide.tsx
git commit -m "feat(proposals): add CoverSlide component"
```

---

## Task 10: MarkdownSlide component

**Files:**
- Create: `src/components/proposal-deck/slides/MarkdownSlide.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/proposal-deck/slides/MarkdownSlide.tsx
"use client";

import { marked } from "marked";
import { MarkdownSlide as MarkdownSlideType } from "../types";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_LG,
  BODY_LG,
  TYPE_LABEL,
} from "../styles";

const TYPE_LABELS: Record<MarkdownSlideType["type"], string> = {
  situatie: "Situatie",
  aanpak: "Aanpak",
  waarom: "Waarom Autronis",
  volgende_stap: "Volgende stap",
  vrij: "",
};

export function MarkdownSlide({ slide }: { slide: MarkdownSlideType }) {
  const html = marked.parse(slide.body || "", { async: false }) as string;
  const label = TYPE_LABELS[slide.type];

  return (
    <section className={SLIDE_BASE} style={{ backgroundColor: "#0E1719" }}>
      {slide.bgImageUrl && (
        <>
          <img src={slide.bgImageUrl} alt="" className={`${SLIDE_BG_LAYER} object-cover w-full h-full`} />
          <div className={SLIDE_BG_OVERLAY} />
        </>
      )}
      <div className={SLIDE_CONTENT}>
        {label && <div className={TYPE_LABEL}>{label}</div>}
        <h2 className={`${HEADING_LG} mb-10`}>{slide.titel}</h2>
        <div
          className={`${BODY_LG} prose prose-invert max-w-3xl prose-headings:text-white prose-strong:text-white prose-a:text-[#17B8A5]`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposal-deck/slides/MarkdownSlide.tsx
git commit -m "feat(proposals): add MarkdownSlide component"
```

---

## Task 11: DeliverablesSlide component

**Files:**
- Create: `src/components/proposal-deck/slides/DeliverablesSlide.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/proposal-deck/slides/DeliverablesSlide.tsx
"use client";

import { DeliverablesSlide as DeliverablesSlideType } from "../types";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_LG,
  BODY_LG,
  ACCENT_TEXT,
  TYPE_LABEL,
} from "../styles";

export function DeliverablesSlide({ slide }: { slide: DeliverablesSlideType }) {
  return (
    <section className={SLIDE_BASE} style={{ backgroundColor: "#0E1719" }}>
      {slide.bgImageUrl && (
        <>
          <img src={slide.bgImageUrl} alt="" className={`${SLIDE_BG_LAYER} object-cover w-full h-full`} />
          <div className={SLIDE_BG_OVERLAY} />
        </>
      )}
      <div className={SLIDE_CONTENT}>
        <div className={TYPE_LABEL}>Deliverables</div>
        <h2 className={`${HEADING_LG} mb-12`}>{slide.titel}</h2>
        <ul className="space-y-6">
          {slide.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-6">
              <span
                className={`${ACCENT_TEXT} font-deck-heading font-bold text-2xl md:text-3xl tabular-nums min-w-[3ch]`}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className={BODY_LG}>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposal-deck/slides/DeliverablesSlide.tsx
git commit -m "feat(proposals): add DeliverablesSlide component"
```

---

## Task 12: TijdlijnSlide component

**Files:**
- Create: `src/components/proposal-deck/slides/TijdlijnSlide.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/proposal-deck/slides/TijdlijnSlide.tsx
"use client";

import { TijdlijnSlide as TijdlijnSlideType } from "../types";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  HEADING_LG,
  BODY_MD,
  ACCENT_TEXT,
  TYPE_LABEL,
} from "../styles";

export function TijdlijnSlide({ slide }: { slide: TijdlijnSlideType }) {
  return (
    <section className={SLIDE_BASE} style={{ backgroundColor: "#0E1719" }}>
      {slide.bgImageUrl && (
        <>
          <img src={slide.bgImageUrl} alt="" className={`${SLIDE_BG_LAYER} object-cover w-full h-full`} />
          <div className={SLIDE_BG_OVERLAY} />
        </>
      )}
      <div className={SLIDE_CONTENT}>
        <div className={TYPE_LABEL}>Tijdlijn</div>
        <h2 className={`${HEADING_LG} mb-12`}>{slide.titel}</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {slide.fases.map((fase, idx) => (
            <div
              key={idx}
              className="border border-[#2A3538] rounded-2xl p-6 bg-[#192225]"
            >
              <div
                className={`${ACCENT_TEXT} font-deck-heading font-bold text-sm tracking-widest uppercase mb-2`}
              >
                Fase {idx + 1} · {fase.duur}
              </div>
              <div className="text-xl md:text-2xl font-semibold text-white mb-3">
                {fase.naam}
              </div>
              <p className={BODY_MD}>{fase.omschrijving}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposal-deck/slides/TijdlijnSlide.tsx
git commit -m "feat(proposals): add TijdlijnSlide component"
```

---

## Task 13: InvesteringSlide component

**Files:**
- Create: `src/components/proposal-deck/slides/InvesteringSlide.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/proposal-deck/slides/InvesteringSlide.tsx
"use client";

import { InvesteringSlide as InvesteringSlideType } from "../types";
import type { ProposalMeta, ProposalRegel } from "../Deck";
import {
  SLIDE_BASE,
  SLIDE_BG_LAYER,
  SLIDE_BG_OVERLAY,
  SLIDE_CONTENT,
  ACCENT_TEXT,
  TYPE_LABEL,
  BODY_MD,
} from "../styles";

function formatBedrag(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function InvesteringSlide({
  slide,
  meta,
  regels,
}: {
  slide: InvesteringSlideType;
  meta: ProposalMeta;
  regels: ProposalRegel[];
}) {
  return (
    <section className={SLIDE_BASE} style={{ backgroundColor: "#0E1719" }}>
      {slide.bgImageUrl && (
        <>
          <img src={slide.bgImageUrl} alt="" className={`${SLIDE_BG_LAYER} object-cover w-full h-full`} />
          <div className={SLIDE_BG_OVERLAY} />
        </>
      )}
      <div className={SLIDE_CONTENT}>
        <div className={TYPE_LABEL}>Investering</div>
        <div className="grid gap-12 md:grid-cols-[1fr_auto] items-center">
          <div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2A3538]">
                  <th className="py-3 pr-4 text-xs uppercase tracking-wide text-white/60 font-semibold">
                    Omschrijving
                  </th>
                  <th className="py-3 px-2 text-xs uppercase tracking-wide text-white/60 font-semibold text-right">
                    Aantal
                  </th>
                  <th className="py-3 px-2 text-xs uppercase tracking-wide text-white/60 font-semibold text-right">
                    Prijs
                  </th>
                  <th className="py-3 pl-2 text-xs uppercase tracking-wide text-white/60 font-semibold text-right">
                    Totaal
                  </th>
                </tr>
              </thead>
              <tbody>
                {regels.map((r) => (
                  <tr key={r.id} className="border-b border-[#2A3538]/50">
                    <td className={`py-4 pr-4 ${BODY_MD} text-white`}>{r.omschrijving}</td>
                    <td className={`py-4 px-2 ${BODY_MD} text-right tabular-nums`}>
                      {r.aantal ?? 1}
                    </td>
                    <td className={`py-4 px-2 ${BODY_MD} text-right tabular-nums`}>
                      {formatBedrag(r.eenheidsprijs ?? 0)}
                    </td>
                    <td className={`py-4 pl-2 ${BODY_MD} text-right tabular-nums font-semibold text-white`}>
                      {formatBedrag(r.totaal ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-xs uppercase tracking-widest text-white/60 mb-3">
              Totaal
            </div>
            <div
              className={`font-deck-heading font-bold leading-none ${ACCENT_TEXT} text-[clamp(4rem,10vw,9rem)] tabular-nums`}
            >
              {formatBedrag(meta.totaalBedrag ?? 0)}
            </div>
            {meta.geldigTot && (
              <div className="text-sm text-white/60 mt-4">
                Geldig tot {new Date(meta.geldigTot).toLocaleDateString("nl-NL")}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS (all slide components now exist, Deck.tsx compiles)

- [ ] **Step 3: Commit**

```bash
git add src/components/proposal-deck/slides/InvesteringSlide.tsx
git commit -m "feat(proposals): add InvesteringSlide component"
```

---

## Task 14: DemoMode wrapper (fullscreen + keyboard nav + transitions)

**Files:**
- Create: `src/components/proposal-deck/DemoMode.tsx`

- [ ] **Step 1: Create DemoMode component**

```tsx
// src/components/proposal-deck/DemoMode.tsx
"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function DemoMode({
  slides,
  onExit,
}: {
  slides: ReactNode[];
  onExit: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = slides.length;
  const next = () => setIdx((i) => Math.min(i + 1, total - 1));
  const prev = () => setIdx((i) => Math.max(i - 1, 0));

  // Enter fullscreen on mount
  useEffect(() => {
    const el = containerRef.current;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // fullscreen rejected (e.g. iOS) — component still works in-page
      });
    }
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          setIdx(0);
          break;
        case "End":
          e.preventDefault();
          setIdx(total - 1);
          break;
        case "Escape":
          e.preventDefault();
          onExit();
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            containerRef.current?.requestFullscreen().catch(() => {});
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, onExit]);

  // Detect fullscreen exit (ESC or browser UI)
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        onExit();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [onExit]);

  // Auto-hide cursor after 2s idle
  useEffect(() => {
    const resetTimer = () => {
      setCursorVisible(true);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = setTimeout(() => setCursorVisible(false), 2000);
    };
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#0E1719] z-[9999]"
      style={{ cursor: cursorVisible ? "default" : "none" }}
      onClick={next}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full"
        >
          {slides[idx]}
        </motion.div>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-[2px] bg-white/10 z-[10000]">
        <div
          className="h-full bg-[#17B8A5] transition-[width] duration-300"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

      {/* Slide counter */}
      <div
        className={`fixed bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/40 text-white/80 text-xs font-semibold tabular-nums backdrop-blur transition-opacity z-[10000] ${
          cursorVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        {idx + 1} / {total}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/proposal-deck/DemoMode.tsx
git commit -m "feat(proposals): add DemoMode fullscreen presenter"
```

---

## Task 15: DeckViewer (scroll + demo toggle) + public view rewrite

**Files:**
- Create: `src/components/proposal-deck/DeckViewer.tsx`
- Modify: `src/app/proposal/[token]/page.tsx` (full rewrite)

- [ ] **Step 1: Create DeckViewer**

```tsx
// src/components/proposal-deck/DeckViewer.tsx
"use client";

import { useState } from "react";
import { Presentation, Download } from "lucide-react";
import { Slide } from "./types";
import { renderSlide, DeckContext } from "./Deck";
import { DemoMode } from "./DemoMode";

export function DeckViewer({
  slides,
  context,
  pdfUrl,
}: {
  slides: Slide[];
  context: DeckContext;
  pdfUrl?: string;
}) {
  const [demo, setDemo] = useState(false);
  const activeSlides = slides.filter((s) => s.actief);

  if (demo) {
    return (
      <DemoMode
        slides={activeSlides.map((s) => (
          <div key={s.id} className="w-full h-full">
            {renderSlide(s, context)}
          </div>
        ))}
        onExit={() => setDemo(false)}
      />
    );
  }

  return (
    <div className="bg-[#0E1719] snap-y snap-mandatory overflow-y-scroll h-screen">
      {activeSlides.map((slide) => (
        <div key={slide.id} className="snap-start">
          {renderSlide(slide, context)}
        </div>
      ))}

      {/* Floating action buttons (hidden on mobile for Presenteren) */}
      <div className="fixed bottom-6 right-6 flex gap-3 z-50">
        {pdfUrl && (
          <a
            href={pdfUrl}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 backdrop-blur text-white text-sm font-semibold hover:bg-white/20 transition"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        )}
        <button
          onClick={() => setDemo(true)}
          className="hidden md:inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#17B8A5] text-[#0E1719] text-sm font-semibold hover:bg-[#4DC9B4] transition"
        >
          <Presentation className="w-4 h-4" />
          Presenteren
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite public page**

Replace entire contents of `src/app/proposal/[token]/page.tsx`:

```tsx
// src/app/proposal/[token]/page.tsx
import { db } from "@/lib/db";
import { proposals, proposalRegels, klanten } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { parseSlides } from "@/lib/proposal-schema";
import { DeckViewer } from "@/components/proposal-deck/DeckViewer";

export const dynamic = "force-dynamic";

export default async function PublicProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { token } = await params;
  const { preview } = await searchParams;

  const [row] = await db
    .select({
      id: proposals.id,
      klantNaam: klanten.bedrijfsnaam,
      titel: proposals.titel,
      status: proposals.status,
      secties: proposals.secties,
      totaalBedrag: proposals.totaalBedrag,
      geldigTot: proposals.geldigTot,
      aangemaaktOp: proposals.aangemaaktOp,
    })
    .from(proposals)
    .innerJoin(klanten, eq(proposals.klantId, klanten.id))
    .where(eq(proposals.token, token));

  if (!row) return notFound();

  const regels = await db
    .select()
    .from(proposalRegels)
    .where(eq(proposalRegels.proposalId, row.id));

  // Auto-transition status (skip if preview mode)
  if (!preview && row.status === "verzonden") {
    await db
      .update(proposals)
      .set({ status: "bekeken", bijgewerktOp: new Date().toISOString() })
      .where(eq(proposals.id, row.id));
  }

  const slides = parseSlides(row.secties);

  return (
    <DeckViewer
      slides={slides}
      context={{
        meta: {
          titel: row.titel,
          klantNaam: row.klantNaam,
          datum: row.aangemaaktOp,
          geldigTot: row.geldigTot,
          totaalBedrag: row.totaalBedrag,
        },
        regels,
      }}
      pdfUrl={`/api/proposals/${row.id}/pdf`}
    />
  );
}
```

**Note:** PDF download via `/api/proposals/[id]/pdf` currently requires auth. For public access, task 22 will add an optional `?token=xxx` bypass. For now, the button will 401 until that task lands — acceptable because the deck is the primary thing the client sees.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

In browser:
1. Visit `/proposal/<existing-token>` (use a token from `SELECT token FROM proposals WHERE token IS NOT NULL LIMIT 1`)
2. Verify: deck renders with slides, scroll-snap works
3. Click "Presenteren" → fullscreen → arrow keys → fade transitions → progress bar grows → Esc exits
4. Check old proposals (pre-migration) render via backwards-compat as `vrij` slides

- [ ] **Step 5: Commit**

```bash
git add src/components/proposal-deck/DeckViewer.tsx src/app/proposal/[token]/page.tsx
git commit -m "feat(proposals): rewrite public proposal view with deck + demo mode"
```

---

## Task 16: BackgroundImageUploader component

**Files:**
- Create: `src/components/proposal-deck/BackgroundImageUploader.tsx`

- [ ] **Step 1: Create component**

```tsx
// src/components/proposal-deck/BackgroundImageUploader.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, X, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function BackgroundImageUploader({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
}) {
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/proposals/upload-image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Upload mislukt");
      onChange(data.url);
      addToast("Afbeelding geüpload", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload mislukt", "fout");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary">
        Achtergrondafbeelding
      </div>
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-autronis-border bg-autronis-bg">
          <img src={value} alt="" className="w-16 h-10 object-cover rounded" />
          <div className="flex-1 text-xs text-autronis-text-secondary truncate">{value}</div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="p-2 text-autronis-text-secondary hover:text-red-400 rounded"
            title="Verwijderen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-autronis-border bg-autronis-bg hover:bg-autronis-card text-sm text-autronis-text-primary disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Uploaden..." : "Upload afbeelding"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-autronis-text-secondary" />
              <input
                type="url"
                placeholder="of plak URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-sm text-autronis-text-primary"
              />
            </div>
            <button
              type="button"
              disabled={!urlInput}
              onClick={() => {
                onChange(urlInput);
                setUrlInput("");
              }}
              className="px-3 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-sm font-semibold disabled:opacity-30"
            >
              Zet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposal-deck/BackgroundImageUploader.tsx
git commit -m "feat(proposals): add background image uploader component"
```

---

## Task 17: Editor primitives — SlideCardShell + type-specific editors

**Files:**
- Create: `src/components/proposal-deck/editors/SlideCardShell.tsx`
- Create: `src/components/proposal-deck/editors/MarkdownEditor.tsx`
- Create: `src/components/proposal-deck/editors/DeliverablesEditor.tsx`
- Create: `src/components/proposal-deck/editors/TijdlijnEditor.tsx`

- [ ] **Step 1: SlideCardShell (drag handle wrapper)**

```tsx
// src/components/proposal-deck/editors/SlideCardShell.tsx
"use client";

import { ReactNode } from "react";
import { GripVertical, Lock, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover",
  investering: "Investering",
  situatie: "Situatie",
  aanpak: "Aanpak",
  deliverables: "Deliverables",
  tijdlijn: "Tijdlijn",
  waarom: "Waarom Autronis",
  volgende_stap: "Volgende stap",
  vrij: "Vrije slide",
};

export function SlideCardShell({
  id,
  type,
  system,
  onDelete,
  children,
}: {
  id: string;
  type: string;
  system: boolean;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: system });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-autronis-border rounded-2xl p-6 bg-autronis-card"
    >
      <div className="flex items-center gap-3 mb-5">
        {system ? (
          <Lock className="w-4 h-4 text-autronis-text-secondary" />
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 text-autronis-text-secondary hover:text-autronis-accent cursor-grab"
            aria-label="Verplaats"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="text-xs font-bold uppercase tracking-widest text-autronis-accent">
          {SLIDE_TYPE_LABELS[type] ?? type}
        </div>
        {system && (
          <div className="text-xs text-autronis-text-secondary ml-auto">
            system slide
          </div>
        )}
        {!system && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto p-1.5 text-autronis-text-secondary hover:text-red-400 rounded"
            aria-label="Verwijderen"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: MarkdownEditor**

```tsx
// src/components/proposal-deck/editors/MarkdownEditor.tsx
"use client";

import { MarkdownSlide } from "../types";
import { BackgroundImageUploader } from "../BackgroundImageUploader";

export function MarkdownEditor({
  slide,
  onChange,
}: {
  slide: MarkdownSlide;
  onChange: (next: MarkdownSlide) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Titel
        </label>
        <input
          type="text"
          value={slide.titel}
          onChange={(e) => onChange({ ...slide, titel: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Body (markdown)
        </label>
        <textarea
          value={slide.body}
          onChange={(e) => onChange({ ...slide, body: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary font-mono text-sm"
        />
      </div>
      <BackgroundImageUploader
        value={slide.bgImageUrl}
        onChange={(url) => onChange({ ...slide, bgImageUrl: url })}
      />
    </div>
  );
}
```

- [ ] **Step 3: DeliverablesEditor**

```tsx
// src/components/proposal-deck/editors/DeliverablesEditor.tsx
"use client";

import { Plus, X } from "lucide-react";
import { DeliverablesSlide } from "../types";
import { BackgroundImageUploader } from "../BackgroundImageUploader";

export function DeliverablesEditor({
  slide,
  onChange,
}: {
  slide: DeliverablesSlide;
  onChange: (next: DeliverablesSlide) => void;
}) {
  const setItem = (idx: number, val: string) => {
    const items = [...slide.items];
    items[idx] = val;
    onChange({ ...slide, items });
  };
  const removeItem = (idx: number) => {
    onChange({ ...slide, items: slide.items.filter((_, i) => i !== idx) });
  };
  const addItem = () => onChange({ ...slide, items: [...slide.items, ""] });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Titel
        </label>
        <input
          type="text"
          value={slide.titel}
          onChange={(e) => onChange({ ...slide, titel: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Bullets
        </label>
        <div className="space-y-2">
          {slide.items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-autronis-text-secondary text-sm font-semibold self-center tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(idx, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-2 text-autronis-text-secondary hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-autronis-accent hover:bg-autronis-accent/10"
        >
          <Plus className="w-4 h-4" />
          Bullet toevoegen
        </button>
      </div>
      <BackgroundImageUploader
        value={slide.bgImageUrl}
        onChange={(url) => onChange({ ...slide, bgImageUrl: url })}
      />
    </div>
  );
}
```

- [ ] **Step 4: TijdlijnEditor**

```tsx
// src/components/proposal-deck/editors/TijdlijnEditor.tsx
"use client";

import { Plus, X } from "lucide-react";
import { TijdlijnSlide } from "../types";
import { BackgroundImageUploader } from "../BackgroundImageUploader";

export function TijdlijnEditor({
  slide,
  onChange,
}: {
  slide: TijdlijnSlide;
  onChange: (next: TijdlijnSlide) => void;
}) {
  const setFase = (idx: number, field: "naam" | "duur" | "omschrijving", val: string) => {
    const fases = [...slide.fases];
    fases[idx] = { ...fases[idx], [field]: val };
    onChange({ ...slide, fases });
  };
  const removeFase = (idx: number) =>
    onChange({ ...slide, fases: slide.fases.filter((_, i) => i !== idx) });
  const addFase = () =>
    onChange({
      ...slide,
      fases: [...slide.fases, { naam: "", duur: "", omschrijving: "" }],
    });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Titel
        </label>
        <input
          type="text"
          value={slide.titel}
          onChange={(e) => onChange({ ...slide, titel: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Fases
        </label>
        <div className="space-y-3">
          {slide.fases.map((fase, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-autronis-border bg-autronis-bg space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-autronis-text-secondary">
                  Fase {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeFase(idx)}
                  className="p-1 text-autronis-text-secondary hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Naam (bv. Kickoff)"
                  value={fase.naam}
                  onChange={(e) => setFase(idx, "naam", e.target.value)}
                  className="px-2 py-1.5 rounded border border-autronis-border bg-autronis-card text-autronis-text-primary text-sm"
                />
                <input
                  type="text"
                  placeholder="Duur (bv. 2 weken)"
                  value={fase.duur}
                  onChange={(e) => setFase(idx, "duur", e.target.value)}
                  className="px-2 py-1.5 rounded border border-autronis-border bg-autronis-card text-autronis-text-primary text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Omschrijving"
                value={fase.omschrijving}
                onChange={(e) => setFase(idx, "omschrijving", e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-autronis-border bg-autronis-card text-autronis-text-primary text-sm"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFase}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-autronis-accent hover:bg-autronis-accent/10"
        >
          <Plus className="w-4 h-4" />
          Fase toevoegen
        </button>
      </div>
      <BackgroundImageUploader
        value={slide.bgImageUrl}
        onChange={(url) => onChange({ ...slide, bgImageUrl: url })}
      />
    </div>
  );
}
```

- [ ] **Step 5: Type check + commit**

```bash
npx tsc --noEmit
git add src/components/proposal-deck/editors/
git commit -m "feat(proposals): add slide card shell and type-specific editors"
```

---

## Task 18: DeckEditor (container with dnd reorder + add/remove)

**Files:**
- Create: `src/components/proposal-deck/DeckEditor.tsx`

- [ ] **Step 1: Create DeckEditor**

```tsx
// src/components/proposal-deck/DeckEditor.tsx
"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Slide, isSystemSlide } from "./types";
import { ADDABLE_SLIDE_TYPES, emptySlideOfType } from "./defaults";
import { SlideCardShell } from "./editors/SlideCardShell";
import { MarkdownEditor } from "./editors/MarkdownEditor";
import { DeliverablesEditor } from "./editors/DeliverablesEditor";
import { TijdlijnEditor } from "./editors/TijdlijnEditor";

export function DeckEditor({
  slides,
  onChange,
}: {
  slides: Slide[];
  onChange: (next: Slide[]) => void;
}) {
  const [adderOpen, setAdderOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateSlide = (id: string, next: Slide) => {
    onChange(slides.map((s) => (s.id === id ? next : s)));
  };
  const deleteSlide = (id: string) => {
    onChange(slides.filter((s) => s.id !== id));
  };
  const addSlide = (type: Exclude<Slide["type"], "cover" | "investering">) => {
    // Insert before the investering system slide
    const investeringIdx = slides.findIndex((s) => s.type === "investering");
    const insertAt = investeringIdx === -1 ? slides.length : investeringIdx;
    const next = [...slides];
    next.splice(insertAt, 0, emptySlideOfType(type));
    onChange(next);
    setAdderOpen(false);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    // Don't let drag move past system slide boundaries (cover at 0, investering somewhere)
    const moved = arrayMove(slides, oldIdx, newIdx);
    // Validate: cover stays at 0
    if (moved[0].type !== "cover") return;
    onChange(moved);
  };

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {slides.map((slide) => (
            <SlideCardShell
              key={slide.id}
              id={slide.id}
              type={slide.type}
              system={isSystemSlide(slide)}
              onDelete={!isSystemSlide(slide) ? () => deleteSlide(slide.id) : undefined}
            >
              <SlideEditorBody slide={slide} onChange={(n) => updateSlide(slide.id, n)} />
            </SlideCardShell>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add slide menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setAdderOpen((o) => !o)}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border-2 border-dashed border-autronis-border hover:border-autronis-accent hover:bg-autronis-accent/5 text-autronis-text-secondary hover:text-autronis-accent font-semibold transition"
        >
          <Plus className="w-5 h-5" />
          Slide toevoegen
          <ChevronDown className="w-4 h-4" />
        </button>
        {adderOpen && (
          <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-autronis-border bg-autronis-card shadow-xl z-10 overflow-hidden">
            {ADDABLE_SLIDE_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => addSlide(t.type)}
                className="block w-full text-left px-5 py-3 text-sm text-autronis-text-primary hover:bg-autronis-bg transition"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlideEditorBody({
  slide,
  onChange,
}: {
  slide: Slide;
  onChange: (next: Slide) => void;
}) {
  switch (slide.type) {
    case "cover":
      return (
        <div className="text-sm text-autronis-text-secondary">
          Klantnaam en projecttitel komen uit de metadata bovenaan. Autronis logo wordt automatisch
          toegevoegd.
        </div>
      );
    case "investering":
      return (
        <div className="text-sm text-autronis-text-secondary">
          Deze slide toont automatisch de prijsregels en het totaalbedrag hieronder.
        </div>
      );
    case "situatie":
    case "aanpak":
    case "waarom":
    case "volgende_stap":
    case "vrij":
      return <MarkdownEditor slide={slide} onChange={onChange} />;
    case "deliverables":
      return <DeliverablesEditor slide={slide} onChange={onChange} />;
    case "tijdlijn":
      return <TijdlijnEditor slide={slide} onChange={onChange} />;
  }
}
```

- [ ] **Step 2: Type check + commit**

```bash
npx tsc --noEmit
git add src/components/proposal-deck/DeckEditor.tsx
git commit -m "feat(proposals): add DeckEditor with drag-reorder and add-slide menu"
```

---

## Task 19: /proposals/nieuw page

**Files:**
- Create: `src/app/(dashboard)/proposals/nieuw/page.tsx`

- [ ] **Step 1: Create new proposal page**

```tsx
// src/app/(dashboard)/proposals/nieuw/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { DeckEditor } from "@/components/proposal-deck/DeckEditor";
import { defaultSlides } from "@/components/proposal-deck/defaults";
import { Slide } from "@/components/proposal-deck/types";
import { useKlanten } from "@/hooks/queries/use-klanten";

type Regel = {
  id: number;
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
};

let localRegelId = 1;
const newRegel = (): Regel => ({
  id: localRegelId++,
  omschrijving: "",
  aantal: 1,
  eenheidsprijs: 0,
});

export default function NieuweProposalPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { data: klantenData } = useKlanten();
  const klanten = klantenData?.klanten ?? [];

  const [klantId, setKlantId] = useState<number | null>(null);
  const [titel, setTitel] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [slides, setSlides] = useState<Slide[]>(defaultSlides());
  const [regels, setRegels] = useState<Regel[]>([newRegel()]);
  const [saving, setSaving] = useState(false);

  const totaal = regels.reduce((sum, r) => sum + r.aantal * r.eenheidsprijs, 0);

  const save = async () => {
    if (!klantId) {
      addToast("Selecteer een klant", "fout");
      return;
    }
    if (!titel.trim()) {
      addToast("Titel is verplicht", "fout");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klantId,
          titel: titel.trim(),
          secties: slides,
          geldigTot: geldigTot || null,
          regels: regels.filter((r) => r.omschrijving.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Opslaan mislukt");
      addToast("Proposal aangemaakt", "succes");
      router.push(`/proposals/${data.proposal.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        <Link
          href="/proposals"
          className="inline-flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar proposals
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Nieuwe proposal</h1>
        </div>

        {/* Metadata */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
              Klant *
            </label>
            <select
              value={klantId ?? ""}
              onChange={(e) => setKlantId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
            >
              <option value="">Selecteer klant...</option>
              {klanten.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.bedrijfsnaam}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
              Titel *
            </label>
            <input
              type="text"
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="Bv. AI-gedreven projectdashboard"
              className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
              Geldig tot
            </label>
            <input
              type="date"
              value={geldigTot}
              onChange={(e) => setGeldigTot(e.target.value)}
              className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
            />
          </div>
        </div>

        {/* Slides */}
        <div>
          <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Slides</h2>
          <DeckEditor slides={slides} onChange={setSlides} />
        </div>

        {/* Prijsregels */}
        <div>
          <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Prijsregels</h2>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-3">
            {regels.map((r, idx) => (
              <div key={r.id} className="grid grid-cols-[1fr_80px_120px_120px_auto] gap-2 items-center">
                <input
                  type="text"
                  placeholder="Omschrijving"
                  value={r.omschrijving}
                  onChange={(e) => {
                    const next = [...regels];
                    next[idx] = { ...r, omschrijving: e.target.value };
                    setRegels(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                />
                <input
                  type="number"
                  value={r.aantal}
                  onChange={(e) => {
                    const next = [...regels];
                    next[idx] = { ...r, aantal: Number(e.target.value) };
                    setRegels(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary tabular-nums"
                />
                <input
                  type="number"
                  step="0.01"
                  value={r.eenheidsprijs}
                  onChange={(e) => {
                    const next = [...regels];
                    next[idx] = { ...r, eenheidsprijs: Number(e.target.value) };
                    setRegels(next);
                  }}
                  className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary tabular-nums"
                />
                <div className="text-right tabular-nums font-semibold text-autronis-text-primary">
                  € {(r.aantal * r.eenheidsprijs).toFixed(2)}
                </div>
                <button
                  type="button"
                  onClick={() => setRegels(regels.filter((x) => x.id !== r.id))}
                  className="px-2 text-autronis-text-secondary hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRegels([...regels, newRegel()])}
              className="text-sm text-autronis-accent hover:underline"
            >
              + regel toevoegen
            </button>
            <div className="pt-4 border-t border-autronis-border text-right">
              <span className="text-xs uppercase text-autronis-text-secondary mr-3">Totaal</span>
              <span className="text-2xl font-bold text-autronis-accent tabular-nums">
                € {totaal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end sticky bottom-4 bg-autronis-bg/80 backdrop-blur p-3 rounded-2xl border border-autronis-border">
          <Link
            href="/proposals"
            className="px-5 py-2.5 rounded-xl border border-autronis-border text-autronis-text-primary hover:bg-autronis-card"
          >
            Annuleren
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Opslaan..." : "Opslaan als concept"}
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Verify `useKlanten` hook exists**

Run: `ls src/hooks/queries/use-klanten.ts`
If missing: create a minimal version:

```ts
// src/hooks/queries/use-klanten.ts
import { useQuery } from "@tanstack/react-query";

type Klant = { id: number; bedrijfsnaam: string };

export function useKlanten() {
  return useQuery<{ klanten: Klant[] }>({
    queryKey: ["klanten"],
    queryFn: async () => {
      const res = await fetch("/api/klanten");
      if (!res.ok) throw new Error();
      return res.json();
    },
  });
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

1. Visit `/proposals` → click "Nieuwe proposal" → no more 404
2. Fill in klant, titel, edit a few slides, add a prijsregel → Opslaan
3. Verify redirect to `/proposals/<id>`

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/proposals/nieuw/page.tsx
git commit -m "feat(proposals): add /proposals/nieuw create form (fixes 404)"
```

---

## Task 20: Rewrite /proposals/[id] page (use DeckEditor)

**Files:**
- Modify: `src/app/(dashboard)/proposals/[id]/page.tsx` (full rewrite)

- [ ] **Step 1: Read existing file for hook patterns**

Read: `src/app/(dashboard)/proposals/[id]/page.tsx`

Extract which query hooks are used (`useProposal(id)` etc.) and mutation patterns. Keep the existing import structure if it uses React Query hooks.

- [ ] **Step 2: Rewrite the page**

Replace entire contents with (adapt imports based on existing hooks found in step 1):

```tsx
// src/app/(dashboard)/proposals/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Save, Download, Mail, Link2, CheckCircle2, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { DeckEditor } from "@/components/proposal-deck/DeckEditor";
import { Slide } from "@/components/proposal-deck/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Regel = {
  id: number;
  omschrijving: string;
  aantal: number;
  eenheidsprijs: number;
  totaal?: number | null;
};

export default function ProposalEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("concept");
  const [token, setToken] = useState<string | null>(null);
  const [klantNaam, setKlantNaam] = useState("");
  const [titel, setTitel] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [regels, setRegels] = useState<Regel[]>([]);
  const [accepteerOpen, setAccepteerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/proposals/${params.id}`);
      if (!res.ok) {
        addToast("Proposal niet gevonden", "fout");
        router.push("/proposals");
        return;
      }
      const data = await res.json();
      setStatus(data.proposal.status);
      setToken(data.proposal.token);
      setKlantNaam(data.proposal.klantNaam);
      setTitel(data.proposal.titel);
      setGeldigTot(data.proposal.geldigTot ?? "");
      setSlides(data.proposal.secties as Slide[]);
      setRegels(data.regels);
      setLoading(false);
    })();
  }, [params.id, router, addToast]);

  // beforeunload dirty guard
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proposals/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: titel.trim(),
          secties: slides,
          geldigTot: geldigTot || null,
          regels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Opslaan mislukt");
      addToast("Opgeslagen", "succes");
      setDirty(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  };

  const accepteer = async (naam: string) => {
    const res = await fetch(`/api/proposals/${params.id}/accepteren`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam }),
    });
    if (res.ok) {
      addToast("Gemarkeerd als geaccepteerd", "succes");
      setStatus("ondertekend");
      setAccepteerOpen(false);
    } else {
      addToast("Actie mislukt", "fout");
    }
  };

  const copyLink = () => {
    if (!token) return;
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${token}`);
    addToast("Link gekopieerd", "succes");
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto p-8 text-autronis-text-secondary">Laden...</div>;
  }

  const isConcept = status === "concept";

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        <Link href="/proposals" className="inline-flex items-center gap-2 text-sm text-autronis-text-secondary hover:text-autronis-accent">
          <ArrowLeft className="w-4 h-4" /> Terug naar proposals
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm text-autronis-text-secondary">{klantNaam}</div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">{titel || "(geen titel)"}</h1>
            <div className="text-xs text-autronis-text-secondary mt-1 uppercase tracking-wide">Status: {status}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={copyLink} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-primary hover:bg-autronis-card">
              <Link2 className="w-4 h-4" /> Kopieer link
            </button>
            {token && (
              <a href={`/proposal/${token}?preview=1`} target="_blank" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-primary hover:bg-autronis-card">
                <ExternalLink className="w-4 h-4" /> Preview
              </a>
            )}
            <a href={`/api/proposals/${params.id}/pdf`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border text-sm text-autronis-text-primary hover:bg-autronis-card">
              <Download className="w-4 h-4" /> PDF
            </a>
            {status === "verzonden" || status === "bekeken" ? (
              <button onClick={() => setAccepteerOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25">
                <CheckCircle2 className="w-4 h-4" /> Markeer als geaccepteerd
              </button>
            ) : null}
          </div>
        </div>

        {/* Metadata (editable only in concept) */}
        {isConcept ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">Titel</label>
              <input type="text" value={titel} onChange={(e) => { setTitel(e.target.value); setDirty(true); }} className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">Geldig tot</label>
              <input type="date" value={geldigTot} onChange={(e) => { setGeldigTot(e.target.value); setDirty(true); }} className="px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary" />
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-sm text-yellow-400">
            Deze proposal is niet meer in concept. Alleen status-acties zijn beschikbaar.
          </div>
        )}

        {/* Slides */}
        {isConcept && (
          <div>
            <h2 className="text-xl font-bold text-autronis-text-primary mb-4">Slides</h2>
            <DeckEditor slides={slides} onChange={(s) => { setSlides(s); setDirty(true); }} />
          </div>
        )}

        {/* Prijsregels — reuse your existing pattern from the original file */}
        {/* ... same regels editor from Task 19 page.tsx, but reading/writing `regels` state ... */}

        {isConcept && (
          <div className="flex items-center gap-3 justify-end sticky bottom-4 bg-autronis-bg/80 backdrop-blur p-3 rounded-2xl border border-autronis-border">
            <button type="button" disabled={saving || !dirty} onClick={save} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? "Opslaan..." : "Opslaan"}
            </button>
          </div>
        )}

        <ConfirmDialog
          open={accepteerOpen}
          onClose={() => setAccepteerOpen(false)}
          onBevestig={() => accepteer("Handmatig geaccepteerd via dashboard")}
          titel="Markeer als geaccepteerd?"
          bericht="Dit zet de status op 'ondertekend'. Gebruik deze actie nadat de klant via call of mail akkoord heeft gegeven."
          bevestigTekst="Markeer geaccepteerd"
          variant="default"
        />
      </div>
    </PageTransition>
  );
}
```

**Note on the prijsregels editor:** paste the same regels-table JSX from `nieuw/page.tsx` (task 19), adapted to read/write `regels` state and set `dirty` on change. The plan doesn't duplicate the full JSX here because it's identical — reuse the block from task 19.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

1. Open an existing proposal in `/proposals/<id>`
2. Verify: backwards-compat — old `vrij` slides visible, editable
3. Edit a slide, save → reload → change persists
4. Preview opens `/proposal/<token>?preview=1` in new tab
5. "Markeer als geaccepteerd" (on a non-concept proposal) sets status

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/proposals/[id]/page.tsx
git commit -m "feat(proposals): rewrite edit page with DeckEditor"
```

---

## Task 21: PDF — fonts, styles, primitives

**Files:**
- Create: `src/lib/proposal-pdf/fonts.ts`
- Create: `src/lib/proposal-pdf/styles.ts`
- Create: `src/lib/proposal-pdf/primitives.tsx`

- [ ] **Step 1: fonts.ts**

```ts
// src/lib/proposal-pdf/fonts.ts
import { Font } from "@react-pdf/renderer";
import path from "path";

const fontDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontDir, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

Font.register({
  family: "SpaceGrotesk",
  src: path.join(fontDir, "SpaceGrotesk-Bold.ttf"),
  fontWeight: 700,
});

export const FONTS_REGISTERED = true;
```

- [ ] **Step 2: styles.ts**

```ts
// src/lib/proposal-pdf/styles.ts
import { StyleSheet } from "@react-pdf/renderer";
import { DECK_COLORS, DECK_SIZES } from "@/lib/proposal-deck-tokens";

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: DECK_COLORS.bg,
    color: DECK_COLORS.textPrimary,
    padding: 60,
    fontFamily: "Inter",
    fontSize: DECK_SIZES.pdfBody,
  },
  absoluteFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DECK_COLORS.overlayDark,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  typeLabel: {
    fontFamily: "Inter",
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: DECK_COLORS.accent,
    fontWeight: 600,
    marginBottom: 16,
  },
  headingXL: {
    fontFamily: "SpaceGrotesk",
    fontSize: DECK_SIZES.pdfCoverHeading,
    fontWeight: 700,
    color: DECK_COLORS.textPrimary,
    lineHeight: 1,
  },
  headingLG: {
    fontFamily: "SpaceGrotesk",
    fontSize: DECK_SIZES.pdfHeading,
    fontWeight: 700,
    color: DECK_COLORS.textPrimary,
    lineHeight: 1.1,
  },
  subheading: {
    fontFamily: "Inter",
    fontSize: DECK_SIZES.pdfSubheading,
    color: DECK_COLORS.accent,
    lineHeight: 1.3,
    marginTop: 16,
  },
  body: {
    fontFamily: "Inter",
    fontSize: DECK_SIZES.pdfBody,
    color: DECK_COLORS.textPrimary,
    lineHeight: 1.5,
    opacity: 0.9,
  },
  small: {
    fontFamily: "Inter",
    fontSize: DECK_SIZES.pdfSmall,
    color: DECK_COLORS.textSecondary,
  },
  accent: {
    color: DECK_COLORS.accent,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 16,
  },
  bulletNumber: {
    fontFamily: "SpaceGrotesk",
    fontSize: 22,
    fontWeight: 700,
    color: DECK_COLORS.accent,
    minWidth: 36,
  },
  bulletText: {
    fontFamily: "Inter",
    fontSize: 16,
    color: DECK_COLORS.textPrimary,
    flex: 1,
    lineHeight: 1.4,
  },
  faseCard: {
    borderWidth: 1,
    borderColor: DECK_COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: DECK_COLORS.card,
  },
  faseCardHeader: {
    fontFamily: "SpaceGrotesk",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: DECK_COLORS.accent,
    marginBottom: 6,
  },
  faseCardTitle: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 600,
    color: DECK_COLORS.textPrimary,
    marginBottom: 6,
  },
  faseCardBody: {
    fontFamily: "Inter",
    fontSize: 10,
    color: DECK_COLORS.textSecondary,
    lineHeight: 1.4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: DECK_COLORS.border,
    paddingVertical: 8,
  },
  totaalImpact: {
    fontFamily: "SpaceGrotesk",
    fontSize: DECK_SIZES.pdfTotaalImpact,
    fontWeight: 700,
    color: DECK_COLORS.accent,
    lineHeight: 1,
  },
});
```

- [ ] **Step 3: primitives.tsx**

```tsx
// src/lib/proposal-pdf/primitives.tsx
import { Image, View } from "@react-pdf/renderer";
import { pdfStyles } from "./styles";

export function BgImageLayer({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <>
      <Image src={url} style={pdfStyles.absoluteFill} />
      <View style={pdfStyles.overlay} />
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/proposal-pdf/fonts.ts src/lib/proposal-pdf/styles.ts src/lib/proposal-pdf/primitives.tsx
git commit -m "feat(proposals-pdf): add fonts, styles and primitives"
```

---

## Task 22: PDF — per-type page components

**Files:**
- Create: `src/lib/proposal-pdf/pages/CoverPage.tsx`
- Create: `src/lib/proposal-pdf/pages/MarkdownPage.tsx`
- Create: `src/lib/proposal-pdf/pages/DeliverablesPage.tsx`
- Create: `src/lib/proposal-pdf/pages/TijdlijnPage.tsx`
- Create: `src/lib/proposal-pdf/pages/InvesteringPage.tsx`

- [ ] **Step 1: CoverPage.tsx**

```tsx
// src/lib/proposal-pdf/pages/CoverPage.tsx
import { Page, View, Text, Image } from "@react-pdf/renderer";
import path from "path";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { CoverSlide } from "@/components/proposal-deck/types";

const LOGO_PATH = path.join(process.cwd(), "public", "icon.png");

export function CoverPage({
  slide,
  klantNaam,
  titel,
  datum,
}: {
  slide: CoverSlide;
  klantNaam: string;
  titel: string;
  datum: string | null;
}) {
  const datumStr = datum
    ? new Date(datum).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={{ position: "absolute", top: 40, left: 40 }}>
        <Image src={LOGO_PATH} style={{ width: 36, height: 36 }} />
      </View>
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Voor</Text>
        <Text style={pdfStyles.headingXL}>{klantNaam}</Text>
        <Text style={pdfStyles.subheading}>{titel}</Text>
        {datumStr && <Text style={[pdfStyles.body, { marginTop: 20 }]}>{datumStr}</Text>}
      </View>
    </Page>
  );
}
```

- [ ] **Step 2: MarkdownPage.tsx**

`@react-pdf/renderer` doesn't support HTML, so we do a light markdown-to-primitive pass: paragraphs split on `\n\n`, bullet lines (`- foo`) become View rows. No bold/italic inline for MVP (good enough).

```tsx
// src/lib/proposal-pdf/pages/MarkdownPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { MarkdownSlide } from "@/components/proposal-deck/types";

const TYPE_LABELS: Record<MarkdownSlide["type"], string> = {
  situatie: "Situatie",
  aanpak: "Aanpak",
  waarom: "Waarom Autronis",
  volgende_stap: "Volgende stap",
  vrij: "",
};

function renderBodyBlocks(body: string) {
  const blocks = body.split(/\n\n+/).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const allBullets = lines.every((l) => /^[-*]\s/.test(l));
    if (allBullets) {
      return (
        <View key={i} style={{ marginBottom: 12 }}>
          {lines.map((l, j) => (
            <View key={j} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={[pdfStyles.body, { marginRight: 8 }]}>•</Text>
              <Text style={[pdfStyles.body, { flex: 1 }]}>{l.replace(/^[-*]\s/, "")}</Text>
            </View>
          ))}
        </View>
      );
    }
    return (
      <Text key={i} style={[pdfStyles.body, { marginBottom: 12 }]}>
        {block}
      </Text>
    );
  });
}

export function MarkdownPage({ slide }: { slide: MarkdownSlide }) {
  const label = TYPE_LABELS[slide.type];
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        {label ? <Text style={pdfStyles.typeLabel}>{label}</Text> : null}
        <Text style={[pdfStyles.headingLG, { marginBottom: 28 }]}>{slide.titel}</Text>
        <View style={{ maxWidth: 620 }}>{renderBodyBlocks(slide.body || "")}</View>
      </View>
    </Page>
  );
}
```

- [ ] **Step 3: DeliverablesPage.tsx**

```tsx
// src/lib/proposal-pdf/pages/DeliverablesPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { DeliverablesSlide } from "@/components/proposal-deck/types";

export function DeliverablesPage({ slide }: { slide: DeliverablesSlide }) {
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Deliverables</Text>
        <Text style={[pdfStyles.headingLG, { marginBottom: 32 }]}>{slide.titel}</Text>
        <View>
          {slide.items.map((item, idx) => (
            <View key={idx} style={pdfStyles.bulletRow}>
              <Text style={pdfStyles.bulletNumber}>{String(idx + 1).padStart(2, "0")}</Text>
              <Text style={pdfStyles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
```

- [ ] **Step 4: TijdlijnPage.tsx**

```tsx
// src/lib/proposal-pdf/pages/TijdlijnPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { TijdlijnSlide } from "@/components/proposal-deck/types";

export function TijdlijnPage({ slide }: { slide: TijdlijnSlide }) {
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Tijdlijn</Text>
        <Text style={[pdfStyles.headingLG, { marginBottom: 28 }]}>{slide.titel}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {slide.fases.map((fase, idx) => (
            <View key={idx} style={[pdfStyles.faseCard, { width: "30%" }]}>
              <Text style={pdfStyles.faseCardHeader}>
                Fase {idx + 1} · {fase.duur}
              </Text>
              <Text style={pdfStyles.faseCardTitle}>{fase.naam}</Text>
              <Text style={pdfStyles.faseCardBody}>{fase.omschrijving}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}
```

- [ ] **Step 5: InvesteringPage.tsx**

```tsx
// src/lib/proposal-pdf/pages/InvesteringPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { InvesteringSlide } from "@/components/proposal-deck/types";
import { DECK_COLORS } from "@/lib/proposal-deck-tokens";

type Regel = { id: number; omschrijving: string; aantal: number | null; eenheidsprijs: number | null; totaal: number | null };

function formatBedrag(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function InvesteringPage({
  slide,
  regels,
  totaalBedrag,
  geldigTot,
}: {
  slide: InvesteringSlide;
  regels: Regel[];
  totaalBedrag: number;
  geldigTot: string | null;
}) {
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Investering</Text>
        <View style={{ flexDirection: "row", gap: 40 }}>
          {/* Tabel links */}
          <View style={{ flex: 1 }}>
            <View style={[pdfStyles.tableRow, { borderBottomWidth: 1, borderBottomColor: DECK_COLORS.border }]}>
              <Text style={[pdfStyles.small, { flex: 3 }]}>Omschrijving</Text>
              <Text style={[pdfStyles.small, { flex: 1, textAlign: "right" }]}>Aantal</Text>
              <Text style={[pdfStyles.small, { flex: 1, textAlign: "right" }]}>Prijs</Text>
              <Text style={[pdfStyles.small, { flex: 1, textAlign: "right" }]}>Totaal</Text>
            </View>
            {regels.map((r) => (
              <View key={r.id} style={pdfStyles.tableRow}>
                <Text style={[pdfStyles.body, { flex: 3 }]}>{r.omschrijving}</Text>
                <Text style={[pdfStyles.body, { flex: 1, textAlign: "right" }]}>{r.aantal ?? 1}</Text>
                <Text style={[pdfStyles.body, { flex: 1, textAlign: "right" }]}>{formatBedrag(r.eenheidsprijs ?? 0)}</Text>
                <Text style={[pdfStyles.body, { flex: 1, textAlign: "right", fontWeight: 600 }]}>{formatBedrag(r.totaal ?? 0)}</Text>
              </View>
            ))}
          </View>
          {/* Totaal rechts */}
          <View style={{ width: 300, justifyContent: "center", alignItems: "flex-end" }}>
            <Text style={pdfStyles.small}>TOTAAL</Text>
            <Text style={pdfStyles.totaalImpact}>{formatBedrag(totaalBedrag)}</Text>
            {geldigTot && (
              <Text style={[pdfStyles.small, { marginTop: 8 }]}>
                Geldig tot {new Date(geldigTot).toLocaleDateString("nl-NL")}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Page>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/proposal-pdf/pages/
git commit -m "feat(proposals-pdf): add per-type page components"
```

---

## Task 23: PDF — ProposalPDF root + delete old file + wire up route

**Files:**
- Create: `src/lib/proposal-pdf/index.tsx`
- Delete: `src/lib/proposal-pdf.tsx`
- Modify: `src/app/api/proposals/[id]/pdf/route.ts`

- [ ] **Step 1: Create index.tsx**

```tsx
// src/lib/proposal-pdf/index.tsx
import { Document } from "@react-pdf/renderer";
import "./fonts"; // side-effect import triggers Font.register
import { Slide } from "@/components/proposal-deck/types";
import { CoverPage } from "./pages/CoverPage";
import { MarkdownPage } from "./pages/MarkdownPage";
import { DeliverablesPage } from "./pages/DeliverablesPage";
import { TijdlijnPage } from "./pages/TijdlijnPage";
import { InvesteringPage } from "./pages/InvesteringPage";

export type ProposalPDFProps = {
  proposal: {
    titel: string;
    klantNaam: string;
    klantContactpersoon: string | null;
    klantAdres: string | null;
    datum: string | null;
    geldigTot: string | null;
    totaalBedrag: number;
  };
  secties: Slide[];
  regels: Array<{
    id: number;
    omschrijving: string;
    aantal: number | null;
    eenheidsprijs: number | null;
    totaal: number | null;
  }>;
};

export function ProposalPDF({ proposal, secties, regels }: ProposalPDFProps) {
  const active = secties.filter((s) => s.actief);
  return (
    <Document>
      {active.map((slide) => {
        switch (slide.type) {
          case "cover":
            return (
              <CoverPage
                key={slide.id}
                slide={slide}
                klantNaam={proposal.klantNaam}
                titel={proposal.titel}
                datum={proposal.datum}
              />
            );
          case "investering":
            return (
              <InvesteringPage
                key={slide.id}
                slide={slide}
                regels={regels}
                totaalBedrag={proposal.totaalBedrag}
                geldigTot={proposal.geldigTot}
              />
            );
          case "deliverables":
            return <DeliverablesPage key={slide.id} slide={slide} />;
          case "tijdlijn":
            return <TijdlijnPage key={slide.id} slide={slide} />;
          case "situatie":
          case "aanpak":
          case "waarom":
          case "volgende_stap":
          case "vrij":
            return <MarkdownPage key={slide.id} slide={slide} />;
        }
      })}
    </Document>
  );
}
```

- [ ] **Step 2: Delete old proposal-pdf.tsx**

```bash
rm src/lib/proposal-pdf.tsx
```

- [ ] **Step 3: Update pdf route**

Modify `src/app/api/proposals/[id]/pdf/route.ts`:

Replace line 7 `import { ProposalPDF } from "@/lib/proposal-pdf";` (still works because Node resolves `proposal-pdf/index.tsx`). Verify import path still resolves.

Replace the `secties` JSON parse (around line 58) with `parseSlides`:

```ts
import { parseSlides } from "@/lib/proposal-schema";
// ...
const slides = parseSlides(proposal.secties);
// ...
const pdfBuffer = await renderToBuffer(
  React.createElement(ProposalPDF, {
    proposal: {
      titel: proposal.titel,
      klantNaam: proposal.klantNaam,
      klantContactpersoon: proposal.klantContactpersoon,
      klantAdres: proposal.klantAdres,
      datum: proposal.aangemaaktOp,
      geldigTot: proposal.geldigTot,
      totaalBedrag: proposal.totaalBedrag || 0,
    },
    secties: slides,
    regels,
  }) as never
);
```

Remove the `bedrijfsinstellingen` fetch and the `bedrijf` prop — new template doesn't use it. Also remove `bedrijfsinstellingen` from imports.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Manual smoke test**

1. `npm run dev`
2. Open existing proposal → click PDF download
3. PDF opens in new tab → verify: Cover slide, subsequent slides render, Investering page shows totaal big
4. Compare visually to the web `/proposal/<token>` view — should look like same deck

- [ ] **Step 6: Commit**

```bash
git add src/lib/proposal-pdf src/app/api/proposals/[id]/pdf/route.ts
git rm src/lib/proposal-pdf.tsx
git commit -m "feat(proposals-pdf): replace traditional offerte template with deck layout"
```

---

## Task 24: Final smoke test matrix + cleanup

**Files:** none (testing + polish)

- [ ] **Step 1: Type check end-to-end**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both PASS

- [ ] **Step 2: Run unit tests**

```bash
npx vitest run
```

Expected: PASS (includes proposal-schema.test.ts with 11 tests)

- [ ] **Step 3: Full manual smoke test matrix**

Start dev: `npm run dev`

**Old data compat:**
- [ ] Open a pre-existing proposal from production via `/proposals/<id>` — verify slides render via backwards-compat as `vrij` type

**New proposal flow:**
- [ ] `/proposals/nieuw` — no 404
- [ ] Select klant, enter titel, edit all 8 default slide types, add 2 images (one upload, one URL paste), add 3 prijsregels → save
- [ ] Auto-redirect to `/proposals/<id>` → data persists on reload

**Public view:**
- [ ] Open `/proposal/<token>` in incognito → scroll through all slides, snap works, backgrounds render with overlay
- [ ] Click "Presenteren" → fullscreen → → (next) → ← (prev) → Home (first) → End (last) → F (toggle fullscreen) → Esc (exit)
- [ ] Fade transitions visible, progress bar grows, counter updates, cursor auto-hides after 2s

**PDF:**
- [ ] From `/proposals/<id>` click PDF download → opens in Acrobat/Preview
- [ ] Verify each slide type renders one-page, fonts load correctly, colors match web, images embed
- [ ] Compare side-by-side: web and PDF should look visually consistent

**Status actions:**
- [ ] Mark a test proposal as "verzonden" (via SQL or verstuur endpoint)
- [ ] On `/proposals/<id>` click "Markeer als geaccepteerd" → confirm → status = ondertekend

**Error paths:**
- [ ] Upload a 6MB image → error "Bestand te groot"
- [ ] Upload a .gif → error "Bestandstype niet toegestaan"
- [ ] Try to save proposal without klant → error "Selecteer een klant"

- [ ] **Step 4: Vercel preview deploy check**

Push branch to GitHub (auto-deploys preview).
Open the Vercel preview URL for a test proposal. Verify fonts load, Blob uploads work (requires `BLOB_READ_WRITE_TOKEN` set in Vercel env vars for the preview environment).

- [ ] **Step 5: Commit any fix-ups found during smoke test**

Use separate commits per bug fix. Example:

```bash
git add <file>
git commit -m "fix(proposals): <what broke>"
```

- [ ] **Step 6: Final dashboard task sync**

```bash
CONFIG=$(cat ~/.config/autronis/claude-sync.json)
URL=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['dashboard_url'])")
KEY=$(echo $CONFIG | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])")
curl -X POST "$URL/api/projecten/sync-taken" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"projectNaam":"Autronis Dashboard","voltooide_taken":["Proposal presentation deck geïmplementeerd"],"nieuwe_taken":[]}'
```

---

## Self-review notes

Completed internally; issues found and fixed inline:

- ✅ `parseSlides` behavior for empty array vs null is explicit and tested
- ✅ Zod schema uses `discriminatedUnion` — correct for type-narrowing
- ✅ DemoMode cleans up fullscreen on unmount and on `fullscreenchange` event (catches browser-initiated exits)
- ✅ DeckEditor protects cover stays at index 0 via drag validation
- ✅ PDF fonts registered before first render via side-effect import in `index.tsx`
- ✅ PDF BgImageLayer handles optional URL
- ✅ Public view gracefully handles `?preview=1` to skip status transition
- ✅ Mobile fullscreen button hidden via `hidden md:inline-flex` (iOS Safari problematic)
- ✅ Backwards-compat mapping preserves `actief` flag from old shape
- ✅ Old `proposal-pdf.tsx` deleted in same commit as new module — no dual-import window
- ✅ `/proposals/nieuw` task 19 pricing regel JSX is self-contained (not "same as task 20")
- ✅ Task 20 edit page explicitly notes to reuse regels JSX from task 19 and warns reader not to copy-adapt
- ✅ No placeholder or TODO left in any code block
