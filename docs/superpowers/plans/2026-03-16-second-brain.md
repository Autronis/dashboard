# Second Brain Module — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI-powered kennismodule waar je alles in gooit (tekst, URLs, afbeeldingen, PDFs, code) en AI het organiseert en doorzoekbaar maakt.

**Architecture:** Standalone module met eigen Drizzle tabel (`secondBrainItems`), 4 API routes, query hooks met @tanstack/react-query, en een "use client" pagina op `/second-brain`. AI-features via bestaande Anthropic SDK. Globale quick-add via bestaande CommandPalette (cmdk).

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (SQLite), Anthropic Claude API, @tanstack/react-query, lucide-react, Tailwind CSS, cmdk

**Prerequisites:** `ANTHROPIC_API_KEY` moet als environment variable gezet zijn (Anthropic SDK leest dit automatisch).

---

## Chunk 1: Database + API Foundation

### Task 1: Database schema

**Files:**
- Modify: `src/lib/db/schema.ts` (add table at the end of the file, after the last table definition)

- [ ] **Step 1: Add secondBrainItems table to schema**

Add after the last table definition in `schema.ts`:

```typescript
// ── SECOND BRAIN ─────────────────────────────────────────
export const secondBrainItems = sqliteTable("second_brain_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gebruikerId: integer("gebruiker_id").references(() => gebruikers.id).notNull(),
  type: text("type", { enum: ["tekst", "url", "afbeelding", "pdf", "code"] }).notNull(),
  titel: text("titel"),
  inhoud: text("inhoud"),
  aiSamenvatting: text("ai_samenvatting"),
  aiTags: text("ai_tags"), // JSON array string
  bronUrl: text("bron_url"),
  bestandPad: text("bestand_pad"),
  taal: text("taal"),
  isFavoriet: integer("is_favoriet").default(0),
  isGearchiveerd: integer("is_gearchiveerd").default(0),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
  bijgewerktOp: text("bijgewerkt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Push schema to database**

Run: `npx drizzle-kit push`
Expected: Table `second_brain_items` created

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(second-brain): add secondBrainItems table to schema"
```

---

### Task 2: GET + POST API route

**Files:**
- Create: `src/app/api/second-brain/route.ts`

- [ ] **Step 1: Create the main API route with GET and POST**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, like, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const tag = searchParams.get("tag");
    const zoek = searchParams.get("zoek");
    const favoriet = searchParams.get("favoriet");
    const gearchiveerd = searchParams.get("gearchiveerd");
    const limiet = searchParams.get("limiet");

    const conditions = [
      eq(secondBrainItems.gebruikerId, gebruiker.id),
      eq(secondBrainItems.isGearchiveerd, gearchiveerd === "1" ? 1 : 0),
    ];

    if (type && type !== "alle") {
      conditions.push(eq(secondBrainItems.type, type));
    }
    if (favoriet === "1") {
      conditions.push(eq(secondBrainItems.isFavoriet, 1));
    }
    if (zoek) {
      conditions.push(
        sql`(${secondBrainItems.titel} LIKE ${`%${zoek}%`} OR ${secondBrainItems.inhoud} LIKE ${`%${zoek}%`} OR ${secondBrainItems.aiSamenvatting} LIKE ${`%${zoek}%`})`
      );
    }

    let query = db
      .select()
      .from(secondBrainItems)
      .where(and(...conditions))
      .orderBy(desc(secondBrainItems.aangemaaktOp));

    const items = limiet
      ? await query.limit(Number(limiet)).all()
      : await query.all();

    // Filter by tag in application layer (JSON field)
    const gefilterd = tag
      ? items.filter((item) => {
          const tags: string[] = item.aiTags ? JSON.parse(item.aiTags) : [];
          return tags.includes(tag);
        })
      : items;

    // KPIs
    const alleItems = await db
      .select({ type: secondBrainItems.type, id: secondBrainItems.id })
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.gebruikerId, gebruiker.id),
          eq(secondBrainItems.isGearchiveerd, 0)
        )
      )
      .all();

    const eenWeekGeleden = new Date();
    eenWeekGeleden.setDate(eenWeekGeleden.getDate() - 7);
    const dezeWeek = await db
      .select({ id: secondBrainItems.id })
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.gebruikerId, gebruiker.id),
          eq(secondBrainItems.isGearchiveerd, 0),
          sql`${secondBrainItems.aangemaaktOp} >= ${eenWeekGeleden.toISOString()}`
        )
      )
      .all();

    const perType: Record<string, number> = {};
    for (const item of alleItems) {
      perType[item.type] = (perType[item.type] || 0) + 1;
    }

    return NextResponse.json({
      items: gefilterd,
      kpis: {
        totaal: alleItems.length,
        dezeWeek: dezeWeek.length,
        perType,
      },
    });
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
    const body = await req.json();
    const { type, titel, inhoud, taal, bronUrl } = body;

    if (!type) {
      return NextResponse.json({ fout: "Type is verplicht" }, { status: 400 });
    }

    const [item] = await db
      .insert(secondBrainItems)
      .values({
        gebruikerId: gebruiker.id,
        type,
        titel: titel || null,
        inhoud: inhoud || null,
        taal: taal || null,
        bronUrl: bronUrl || null,
      })
      .returning();

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/second-brain/route.ts
git commit -m "feat(second-brain): GET/POST API route with filters and KPIs"
```

---

### Task 3: Single item CRUD API route

**Files:**
- Create: `src/app/api/second-brain/[id]/route.ts`

- [ ] **Step 1: Create the [id] route with GET, PUT, DELETE**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [item] = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.id, Number(id)),
          eq(secondBrainItems.gebruikerId, gebruiker.id)
        )
      )
      .all();

    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const [bestaand] = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.id, Number(id)),
          eq(secondBrainItems.gebruikerId, gebruiker.id)
        )
      )
      .all();

    if (!bestaand) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    const updateVelden: Record<string, unknown> = {};
    if (body.titel !== undefined) updateVelden.titel = body.titel;
    if (body.inhoud !== undefined) updateVelden.inhoud = body.inhoud;
    if (body.aiTags !== undefined) updateVelden.aiTags = JSON.stringify(body.aiTags);
    if (body.isFavoriet !== undefined) updateVelden.isFavoriet = body.isFavoriet;
    if (body.isGearchiveerd !== undefined) updateVelden.isGearchiveerd = body.isGearchiveerd;
    if (body.taal !== undefined) updateVelden.taal = body.taal;
    updateVelden.bijgewerktOp = new Date().toISOString();

    const [updated] = await db
      .update(secondBrainItems)
      .set(updateVelden)
      .where(eq(secondBrainItems.id, Number(id)))
      .returning();

    return NextResponse.json({ item: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gebruiker = await requireAuth();
    const { id } = await params;

    const [item] = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.id, Number(id)),
          eq(secondBrainItems.gebruikerId, gebruiker.id)
        )
      )
      .all();

    if (!item) {
      return NextResponse.json({ fout: "Item niet gevonden" }, { status: 404 });
    }

    await db
      .update(secondBrainItems)
      .set({ isGearchiveerd: 1, bijgewerktOp: new Date().toISOString() })
      .where(eq(secondBrainItems.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/second-brain/[id]/route.ts
git commit -m "feat(second-brain): single item CRUD API route (GET/PUT/DELETE)"
```

---

### Task 4: File upload + AI verwerking API route

**Files:**
- Create: `src/app/api/second-brain/verwerken/route.ts`

- [ ] **Step 1: Create the verwerken route for uploads and URL processing**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const anthropic = new Anthropic();

async function genereerAiVelden(
  inhoud: string,
  type: string
): Promise<{ titel: string; samenvatting: string; tags: string[] }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Analyseer dit ${type} item en geef JSON terug met exact deze velden:
- "titel": korte titel (max 60 tekens)
- "samenvatting": samenvatting in 1-2 zinnen
- "tags": array van relevante tags uit deze opties: technologie, klant, idee, geleerde-les, tool, referentie, proces, inspiratie. Voeg ook vrije tags toe die relevant zijn.

Inhoud:
${inhoud.slice(0, 2000)}

Antwoord alleen met valid JSON, geen andere tekst.`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(text);
  return {
    titel: parsed.titel || "Zonder titel",
    samenvatting: parsed.samenvatting || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

async function verwerkAiAsync(itemId: number, inhoud: string, type: string) {
  try {
    const ai = await genereerAiVelden(inhoud, type);
    await db
      .update(secondBrainItems)
      .set({
        titel: ai.titel,
        aiSamenvatting: ai.samenvatting,
        aiTags: JSON.stringify(ai.tags),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(secondBrainItems.id, itemId));
  } catch {
    // AI verwerking is best-effort, item bestaat al
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const contentType = req.headers.get("content-type") || "";

    // URL verwerking
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { bronUrl } = body;

      if (!bronUrl) {
        return NextResponse.json(
          { fout: "bron_url is verplicht" },
          { status: 400 }
        );
      }

      // Fetch URL metadata
      let titel = bronUrl;
      let beschrijving = "";
      try {
        const res = await fetch(bronUrl, {
          headers: { "User-Agent": "Autronis-SecondBrain/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) titel = titleMatch[1].trim();
        const descMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
        );
        if (descMatch) beschrijving = descMatch[1].trim();
      } catch {
        // URL niet bereikbaar, gebruik raw URL als titel
      }

      const [item] = await db
        .insert(secondBrainItems)
        .values({
          gebruikerId: gebruiker.id,
          type: "url",
          titel,
          inhoud: beschrijving || null,
          bronUrl,
        })
        .returning();

      // AI verwerking async (fire-and-forget)
      const aiInhoud = `URL: ${bronUrl}\nTitel: ${titel}\nBeschrijving: ${beschrijving}`;
      verwerkAiAsync(item.id, aiInhoud, "url");

      return NextResponse.json({ item }, { status: 201 });
    }

    // Bestand upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { fout: "Bestand en type zijn verplicht" },
        { status: 400 }
      );
    }

    // Save file
    const uploadDir = path.join(process.cwd(), "data", "uploads", "second-brain");
    await mkdir(uploadDir, { recursive: true });
    const timestamp = Date.now();
    const veiligNaam = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const bestandNaam = `${timestamp}-${veiligNaam}`;
    const bestandPad = path.join(uploadDir, bestandNaam);
    const bytes = await file.arrayBuffer();
    await writeFile(bestandPad, Buffer.from(bytes));

    const relatievePad = `/data/uploads/second-brain/${bestandNaam}`;

    const [item] = await db
      .insert(secondBrainItems)
      .values({
        gebruikerId: gebruiker.id,
        type,
        titel: file.name,
        bestandPad: relatievePad,
      })
      .returning();

    // AI verwerking async voor afbeeldingen (Vision API)
    if (type === "afbeelding") {
      const base64 = Buffer.from(bytes).toString("base64");
      const mediaType = file.type as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";

      (async () => {
        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: base64 },
                  },
                  {
                    type: "text",
                    text: `Beschrijf deze afbeelding en geef JSON terug met:
- "titel": korte beschrijvende titel (max 60 tekens)
- "samenvatting": wat is er te zien in 1-2 zinnen
- "tags": relevante tags uit: technologie, klant, idee, geleerde-les, tool, referentie, proces, inspiratie + vrije tags
Antwoord alleen met valid JSON.`,
                  },
                ],
              },
            ],
          });

          const text =
            response.content[0].type === "text" ? response.content[0].text : "";
          const parsed = JSON.parse(text);
          await db
            .update(secondBrainItems)
            .set({
              titel: parsed.titel || file.name,
              aiSamenvatting: parsed.samenvatting || "",
              aiTags: JSON.stringify(parsed.tags || []),
              bijgewerktOp: new Date().toISOString(),
            })
            .where(eq(secondBrainItems.id, item.id));
        } catch {
          // Vision verwerking is best-effort
        }
      })();
    } else if (type === "pdf") {
      // PDF: extract text content is complex, store with filename as title for now
      // AI tags based on filename
      verwerkAiAsync(item.id, `PDF bestand: ${file.name}`, "pdf");
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/second-brain/verwerken/route.ts
git commit -m "feat(second-brain): verwerken API route for uploads and URL processing with AI"
```

---

### Task 5: AI zoeken API route

**Files:**
- Create: `src/app/api/second-brain/zoeken/route.ts`

- [ ] **Step 1: Create the AI-powered search route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const { vraag } = await req.json();

    if (!vraag || vraag.trim().length < 3) {
      return NextResponse.json(
        { fout: "Vraag moet minimaal 3 tekens zijn" },
        { status: 400 }
      );
    }

    // Haal alle niet-gearchiveerde items op
    const items = await db
      .select()
      .from(secondBrainItems)
      .where(
        and(
          eq(secondBrainItems.gebruikerId, gebruiker.id),
          eq(secondBrainItems.isGearchiveerd, 0)
        )
      )
      .all();

    if (items.length === 0) {
      return NextResponse.json({
        antwoord: "Je hebt nog geen items opgeslagen in je Second Brain.",
        bronnen: [],
      });
    }

    // Bouw context: bij 100+ items alleen titel/samenvatting/tags
    const compact = items.length > 100;
    const itemContext = items
      .map((item) => {
        const tags = item.aiTags ? JSON.parse(item.aiTags).join(", ") : "";
        if (compact) {
          return `[ID:${item.id}] ${item.titel || "Zonder titel"} | Tags: ${tags} | ${item.aiSamenvatting || ""}`;
        }
        return `[ID:${item.id}] Type: ${item.type} | Titel: ${item.titel || "Zonder titel"} | Tags: ${tags}
Samenvatting: ${item.aiSamenvatting || "Geen samenvatting"}
Inhoud: ${(item.inhoud || "").slice(0, 300)}`;
      })
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Je bent een kennisassistent. De gebruiker heeft deze items opgeslagen in zijn Second Brain:

${itemContext}

Beantwoord de volgende vraag op basis van deze kennis. Verwijs naar specifieke items met hun ID in het formaat [ID:X].
Als je het antwoord niet kunt vinden in de items, zeg dat eerlijk.

Vraag: ${vraag}`,
        },
      ],
    });

    const antwoord =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract referenced IDs from the response
    const idMatches = antwoord.match(/\[ID:(\d+)\]/g) || [];
    const bronIds = [...new Set(idMatches.map((m) => Number(m.replace(/\[ID:|]/g, ""))))];
    const bronnen = items
      .filter((item) => bronIds.includes(item.id))
      .map((item) => ({ id: item.id, titel: item.titel || "Zonder titel", type: item.type }));

    return NextResponse.json({ antwoord, bronnen });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/second-brain/zoeken/route.ts
git commit -m "feat(second-brain): AI-powered zoeken API route"
```

---

## Chunk 2: Query Hook + Page UI

### Task 6: Query hook

**Files:**
- Create: `src/hooks/queries/use-second-brain.ts`

- [ ] **Step 1: Create the query hook with CRUD mutations**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SecondBrainItem {
  id: number;
  gebruikerId: number;
  type: "tekst" | "url" | "afbeelding" | "pdf" | "code";
  titel: string | null;
  inhoud: string | null;
  aiSamenvatting: string | null;
  aiTags: string | null; // JSON string
  bronUrl: string | null;
  bestandPad: string | null;
  taal: string | null;
  isFavoriet: number;
  isGearchiveerd: number;
  aangemaaktOp: string;
  bijgewerktOp: string;
}

interface SecondBrainResponse {
  items: SecondBrainItem[];
  kpis: {
    totaal: number;
    dezeWeek: number;
    perType: Record<string, number>;
  };
}

interface ZoekenResponse {
  antwoord: string;
  bronnen: { id: number; titel: string; type: string }[];
}

async function fetchItems(
  type: string,
  tag: string,
  zoek: string,
  favoriet: boolean
): Promise<SecondBrainResponse> {
  const params = new URLSearchParams();
  if (type !== "alle") params.set("type", type);
  if (tag) params.set("tag", tag);
  if (zoek) params.set("zoek", zoek);
  if (favoriet) params.set("favoriet", "1");
  const res = await fetch(`/api/second-brain?${params}`);
  if (!res.ok) throw new Error("Kon items niet laden");
  return res.json();
}

export function useSecondBrain(
  type: string,
  tag: string,
  zoek: string,
  favoriet: boolean
) {
  return useQuery({
    queryKey: ["second-brain", type, tag, zoek, favoriet],
    queryFn: () => fetchItems(type, tag, zoek, favoriet),
    staleTime: 30_000,
  });
}

export function useRecentSecondBrain(limiet: number = 5) {
  return useQuery({
    queryKey: ["second-brain", "recent", limiet],
    queryFn: async () => {
      const res = await fetch(`/api/second-brain?limiet=${limiet}`);
      if (!res.ok) throw new Error("Kon items niet laden");
      const data: SecondBrainResponse = await res.json();
      return data.items;
    },
    staleTime: 30_000,
  });
}

export function useCreateSecondBrainItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      type: string;
      titel?: string;
      inhoud?: string;
      taal?: string;
      bronUrl?: string;
    }) => {
      const res = await fetch("/api/second-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet opslaan");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useVerwerkenSecondBrain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: FormData | { bronUrl: string }
    ) => {
      const isFormData = data instanceof FormData;
      const res = await fetch("/api/second-brain/verwerken", {
        method: "POST",
        headers: isFormData ? undefined : { "Content-Type": "application/json" },
        body: isFormData ? data : JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet verwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useUpdateSecondBrainItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; [key: string]: unknown }) => {
      const res = await fetch(`/api/second-brain/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet bijwerken");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useDeleteSecondBrainItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/second-brain/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Kon item niet verwijderen");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["second-brain"] });
    },
  });
}

export function useAiZoeken() {
  return useMutation({
    mutationFn: async (vraag: string): Promise<ZoekenResponse> => {
      const res = await fetch("/api/second-brain/zoeken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vraag }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Zoeken mislukt");
      }
      return res.json();
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/queries/use-second-brain.ts
git commit -m "feat(second-brain): query hook with CRUD mutations and AI search"
```

---

### Task 7: Sidebar navigation

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Second Brain to sidebar navigation**

Add `Brain` to the lucide-react import. Add a new nav item in the "Content & Kennis" section, after the "Learning Radar" item:

```typescript
{ label: "Second Brain", icon: Brain, href: "/second-brain" },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(second-brain): add to sidebar navigation"
```

---

### Task 8: Second Brain page — Feed tab

**Files:**
- Create: `src/app/(dashboard)/second-brain/page.tsx`

- [ ] **Step 1: Create the main page with quick-add bar, filters, and feed**

Build the page following the established pattern from `src/app/(dashboard)/taken/page.tsx`. The page has these sections:

**Structure:**
- "use client" directive
- Imports: hooks from `use-second-brain.ts`, lucide icons, PageTransition, useToast, useQueryClient
- `typeConfig` constant mapping types to icons and labels: `FileText` (tekst), `Link2` (url), `ImageIcon` (afbeelding), `FileDown` (pdf), `Code` (code)
- `useState` for: `activeTab` ("feed" | "zoeken"), `typeFilter`, `tagFilter`, `zoek`, `favoriet`, `selectedItem`, `nieuwInput`
- `useSecondBrain(typeFilter, tagFilter, zoek, favoriet)` for data
- `useCreateSecondBrainItem()` and `useVerwerkenSecondBrain()` mutations
- `handleSubmit` function: auto-detect type from input (URL regex `/^https?:\/\//` → verwerken endpoint, triple backtick → code, else → tekst)

**Layout (top to bottom):**
1. KPI cards row: totaal items, deze week, per-type mini breakdown
2. Quick-add bar: `bg-autronis-card border border-autronis-border rounded-2xl p-4` with `text-lg` input, placeholder "Typ, plak een URL, of sleep een bestand...", submit on Enter. Upload button (Paperclip icon) triggers hidden `<input type="file" accept="image/*,.pdf" />`
3. Tab buttons: "Feed" and "AI Zoeken" (styled like status filter buttons in taken page)
4. Filter bar (only in Feed tab): type buttons (Alles / Tekst / URLs / Afbeeldingen / PDFs / Code) + tag dropdown
5. Feed: card list, each card `bg-autronis-card border border-autronis-border rounded-2xl p-5 hover:border-autronis-accent/30 transition-colors cursor-pointer`. Shows: type icon, titel, ai_samenvatting preview (1 line truncated), tag pills (`bg-autronis-accent/10 text-autronis-accent rounded-full px-2.5 py-0.5 text-xs`), relative datum. Star icon for favoriet toggle. Pulsing skeleton pills when `aiTags` is null.
6. Click card → `setSelectedItem(item)` → renders `<DetailModal />`
7. Empty state via EmptyState component
8. Wrap in `<PageTransition>`

Target: ~250 lines. Detail modal and AI search are separate components (Tasks 9 and 10).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test in browser**

Run: `npm run dev`
Navigate to `/second-brain`. Verify:
- Page loads with KPI cards
- Quick-add bar accepts text input and submitting creates an item
- Type filters work
- Cards show in feed with correct type icons

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/second-brain/page.tsx
git commit -m "feat(second-brain): main page with quick-add, filters, and feed"
```

---

### Task 9: Detail modal

**Files:**
- Create: `src/app/(dashboard)/second-brain/detail-modal.tsx`
- Modify: `src/app/(dashboard)/second-brain/page.tsx` (import and render DetailModal)

- [ ] **Step 1: Create the detail modal component**

Create `detail-modal.tsx` as a separate "use client" component:

```typescript
// Props interface
interface DetailModalProps {
  item: SecondBrainItem;
  onClose: () => void;
  onUpdate: () => void; // trigger refetch after mutation
}
```

**Content:**
- Import `SecondBrainItem` from `use-second-brain.ts`
- Import `useUpdateSecondBrainItem`, `useDeleteSecondBrainItem` from hooks
- Import `useToast`, `ConfirmDialog`
- Backdrop: `fixed inset-0 z-50 bg-black/60 flex items-center justify-center` with onClick close
- Modal card: `bg-autronis-card border border-autronis-border rounded-2xl p-6 lg:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto`
- Header: titel (editable on click), type badge, favoriet star toggle, close X button
- Body varies by type:
  - `afbeelding`: `<img src={item.bestandPad} />` preview
  - `code`: `<pre className="bg-black/30 rounded-xl p-4 overflow-x-auto font-mono text-sm">{item.inhoud}</pre>`
  - `url`: clickable `<a href={item.bronUrl} target="_blank">` link + samenvatting
  - `tekst`/`pdf`: inhoud as text
- AI samenvatting box: `bg-autronis-accent/5 border border-autronis-accent/20 rounded-xl p-4`
- Tags section: existing tags as removable pills (click X → PUT without that tag), input field to add new tag (Enter → PUT with new tag appended)
- Footer: "Archiveren" button (red, triggers ConfirmDialog → DELETE mutation → onClose)
- Close on Esc key (useEffect with keydown listener)
- Toast on success/error for all mutations

Target: ~150-180 lines.

- [ ] **Step 2: Import and render in page.tsx**

In `page.tsx`, add: `import { DetailModal } from "./detail-modal"` and render `{selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["second-brain"] })} />}`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test in browser**

Click an item in the feed → modal opens with full details. Edit tags, toggle favoriet, archiveer.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/second-brain/detail-modal.tsx src/app/(dashboard)/second-brain/page.tsx
git commit -m "feat(second-brain): detail modal with edit/favorite/archive"
```

---

### Task 10: AI Zoeken tab

**Files:**
- Create: `src/app/(dashboard)/second-brain/ai-zoeken-tab.tsx`
- Modify: `src/app/(dashboard)/second-brain/page.tsx` (import and render tab)

- [ ] **Step 1: Create the AI search tab component**

Create `ai-zoeken-tab.tsx` as a separate "use client" component:

```typescript
interface AiZoekenTabProps {
  onSelectItem: (item: SecondBrainItem) => void; // opens detail modal in parent
}
```

**Content:**
- Import `useAiZoeken` from hooks
- `useState` for `vraag` (input) and `resultaat` (response)
- Large search input: same style as quick-add bar, placeholder "Stel een vraag over je opgeslagen kennis..."
- Submit on Enter or button click → `zoekMutation.mutate(vraag)`
- Loading state: spinner + "Even denken..." text
- Response area: `bg-autronis-card rounded-2xl p-6`, Claude's `antwoord` as text (replace `[ID:X]` references with bold text)
- Bronnen section below response: horizontal flex row of mini cards, each with type icon + titel, clickable → `onSelectItem`
- Empty state before first search: "Stel een vraag om je kennis te doorzoeken"
- Error state: toast via useToast

Target: ~100-120 lines.

- [ ] **Step 2: Import and render in page.tsx**

In `page.tsx`, add: `import { AiZoekenTab } from "./ai-zoeken-tab"` and render it when `activeTab === "zoeken"`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test in browser**

Switch to AI Zoeken tab, type a question, verify response appears with source references.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/second-brain/ai-zoeken-tab.tsx src/app/(dashboard)/second-brain/page.tsx
git commit -m "feat(second-brain): AI search tab with conversational answers"
```

---

## Chunk 3: Integrations

### Task 11: CommandPalette integration

**Files:**
- Modify: `src/components/ui/command-palette.tsx`

- [ ] **Step 1: Add "Opslaan in Second Brain" action to CommandPalette**

Add `Brain` to the lucide-react imports. Add `useToast` import from `@/hooks/use-toast` (Zustand store, works in any component). Add `const { addToast } = useToast();` inside the `CommandPalette` function body.

Add a `handleSaveToSecondBrain` async function:
```typescript
const handleSaveToSecondBrain = async () => {
  if (!search.trim()) return;
  try {
    const isUrl = /^https?:\/\//.test(search.trim());
    if (isUrl) {
      await fetch("/api/second-brain/verwerken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bronUrl: search.trim() }),
      });
    } else {
      await fetch("/api/second-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "tekst", inhoud: search.trim() }),
      });
    }
    addToast("Opgeslagen in Second Brain", "succes");
  } catch {
    addToast("Kon niet opslaan in Second Brain", "fout");
  }
  setSearch("");
  onClose();
};
```

Add a new `<Command.Group heading="Acties">` section after the existing groups, visible when `search.length > 0`:
```tsx
{search.length > 0 && (
  <Command.Group heading="Acties">
    <Command.Item onSelect={handleSaveToSecondBrain}>
      <Brain className="w-4 h-4 mr-2 text-autronis-accent" />
      Opslaan in Second Brain
    </Command.Item>
  </Command.Group>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test in browser**

Open ⌘K, type some text, select "Opslaan in Second Brain", verify toast appears and item shows in /second-brain feed.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/command-palette.tsx
git commit -m "feat(second-brain): CommandPalette integration for global quick-add"
```

---

### Task 12: Dashboard widget

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Add "Recent opgeslagen" widget to dashboard**

Add a widget section to the dashboard homepage:
- Uses `useRecentSecondBrain(5)` hook
- Card style: same as other dashboard widgets (`bg-autronis-card border border-autronis-accent/20 rounded-2xl p-6`)
- Header: "Second Brain" with Brain icon + "Bekijk alles →" link to `/second-brain`
- List: 5 recent items with type icon, titel, relative timestamp
- Click item → navigate to `/second-brain` (or open in new context)
- Empty state: "Nog geen items opgeslagen"
- Loading state: skeleton lines

Place the widget in an appropriate position in the dashboard grid (near existing content widgets).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Test in browser**

Dashboard shows "Recent opgeslagen" widget with items (or empty state if none).

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/page.tsx
git commit -m "feat(second-brain): dashboard widget showing recent items"
```

---

### Task 13: Search API integration

**Files:**
- Modify: `src/app/api/zoeken/route.ts`
- Modify: `src/components/ui/command-palette.tsx`

- [ ] **Step 1: Update ZoekResultaat type in zoeken/route.ts**

Add `"second-brain"` to the `ZoekResultaat` type union. Import `secondBrainItems` from schema. Add a new query to the existing `Promise.all()`:

```typescript
// Add to the Promise.all array:
db.select({ id: secondBrainItems.id, titel: secondBrainItems.titel, samenvatting: secondBrainItems.aiSamenvatting })
  .from(secondBrainItems)
  .where(
    and(
      eq(secondBrainItems.gebruikerId, gebruiker.id),
      eq(secondBrainItems.isGearchiveerd, 0),
      or(
        like(secondBrainItems.titel, zoekterm),
        like(secondBrainItems.inhoud, zoekterm),
        like(secondBrainItems.aiSamenvatting, zoekterm)
      )
    )
  )
  .limit(5),
```

Map results to ZoekResultaat format:
```typescript
for (const sb of secondBrainRes) {
  resultaten.push({
    type: "second-brain",
    id: sb.id,
    titel: sb.titel || "Zonder titel",
    subtitel: sb.samenvatting,
    link: "/second-brain",
  });
}
```

- [ ] **Step 2: Update ZoekResultaat type and typeIcons in command-palette.tsx**

Add `"second-brain"` to the `ZoekResultaat["type"]` union. Add to `typeIcons`: `"second-brain": Brain`. Add to `typeLabels` (if exists): `"second-brain": "Second Brain"`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/zoeken/route.ts src/components/ui/command-palette.tsx
git commit -m "feat(second-brain): integrate with global search"
```

---

### Task 14: Final verification + AI async polling

**Files:**
- Modify: `src/app/(dashboard)/second-brain/page.tsx` (add polling for AI fields)

- [ ] **Step 1: Add refetch polling for newly created items**

After creating an item, if `aiTags` is null, set a short `refetchInterval` on the query (e.g., 3000ms) until the AI fields are populated. Once all visible items have `aiTags`, disable the interval.

Implementation: track `needsRefetch` state. After creating an item, set it to true. In the useSecondBrain hook options, add `refetchInterval: needsRefetch ? 3000 : false`. When data arrives and all items have `aiTags`, set `needsRefetch` to false.

- [ ] **Step 2: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual end-to-end test**

Test the full flow:
1. Navigate to /second-brain
2. Type text in quick-add → submits → appears in feed → AI tags populate after a few seconds
3. Paste a URL → submits → title fetched → AI summary appears
4. Upload an image → submits → AI describes it
5. Switch to AI Zoeken → ask a question → get answer with sources
6. Open ⌘K → type something → "Opslaan in Second Brain" → toast → appears in feed
7. Dashboard widget shows recent items
8. Click item → detail modal → edit tags, toggle favoriet, archiveer
9. Filters work (type, tag, favoriet)

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/second-brain/page.tsx
git commit -m "feat(second-brain): async AI polling and final polish"
```
