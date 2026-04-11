# Administratie & Cloud Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloud-backed financiele documentopslag met automatische Gmail factuur-import en een overzichtspagina voor belastingaangifte.

**Architecture:** Supabase Storage als cloud backend voor alle financiele documenten. Gmail API cron pollt `zakelijk@autronis.com` voor inkomende facturen, analyseert ze met Claude Vision, en matcht ze aan Revolut transacties. Nieuwe `/administratie` pagina toont alles per jaar/kwartaal.

**Tech Stack:** Supabase Storage (bestaand project), Gmail API (googleapis — al geinstalleerd), Claude Vision (Sonnet), archiver (ZIP export), Next.js App Router, Drizzle ORM.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/supabase.ts` | Supabase client + storage helpers (upload, getSignedUrl, delete) |
| Modify | `src/lib/db/schema.ts:567` | Add `storageUrl` to bankTransacties, `pdfStorageUrl` to facturen, new `inkomende_facturen` table |
| Create | `src/app/api/administratie/gmail-sync/route.ts` | Cron: poll Gmail, download PDFs, Claude Vision analyse, auto-match |
| Create | `src/app/api/administratie/route.ts` | GET: lijst documenten met filters |
| Create | `src/app/api/administratie/koppel/route.ts` | POST: handmatig koppelen factuur ↔ transactie |
| Create | `src/app/api/administratie/upload/route.ts` | POST: handmatige upload fallback |
| Create | `src/app/api/administratie/export/route.ts` | GET: ZIP download per kwartaal |
| Create | `src/app/(dashboard)/administratie/page.tsx` | Frontend: overzichtspagina |
| Modify | `src/app/api/bank/bonnetje/route.ts:86-93` | Opslag → Supabase Storage ipv lokale disk |
| Modify | `src/app/api/facturen/[id]/pdf/route.ts:73-78` | PDF ook opslaan in Supabase Storage |
| Modify | `src/app/api/bank/email-factuur/route.ts:67-73` | Opslag → Supabase Storage ipv lokale disk |
| Modify | `src/components/layout/sidebar.tsx:66` | Add `/administratie` nav link |
| Modify | `vercel.json` | Add gmail-sync cron |
| Modify | `.env.example` | Add `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |

---

### Task 1: Install dependencies + Supabase client

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase.ts`
- Modify: `.env.example`

- [ ] **Step 1: Install packages**

```bash
cd ~/Autronis/Projects/autronis-dashboard
npm install @supabase/supabase-js archiver @types/archiver
```

- [ ] **Step 2: Add env vars to .env.example**

Add to `.env.example`:
```bash
# Supabase Storage (administratie)
SUPABASE_URL=https://uhdkxstedvytowbaiers.supabase.co
SUPABASE_SERVICE_KEY=
```

Add actual `SUPABASE_SERVICE_KEY` to `.env.local` (get from Supabase dashboard → Settings → API → service_role key).

- [ ] **Step 3: Create Supabase client with storage helpers**

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = "administratie";

export async function uploadToStorage(
  filePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return filePath;
}

export async function getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresIn);

  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

export async function downloadFromStorage(filePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFromStorage(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
```

- [ ] **Step 4: Create the Supabase Storage bucket**

Via Supabase MCP of dashboard: create bucket `administratie` (private, no public access).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts package.json package-lock.json .env.example
git commit -m "feat: add Supabase Storage client and helpers for administratie"
```

---

### Task 2: Database schema — new fields + inkomende_facturen table

**Files:**
- Modify: `src/lib/db/schema.ts:567` (after bankTransacties), `:107` (facturen), `:565` (bankTransacties)

- [ ] **Step 1: Add `storageUrl` to bankTransacties**

In `src/lib/db/schema.ts`, in the `bankTransacties` table (line 565, after `bonPad`), add:
```typescript
  storageUrl: text("storage_url"),
```

- [ ] **Step 2: Add `pdfStorageUrl` to facturen**

In `src/lib/db/schema.ts`, in the `facturen` table (line 106, after `aangemaaktOp`), add:
```typescript
  pdfStorageUrl: text("pdf_storage_url"),
```

- [ ] **Step 3: Create `inkomende_facturen` table**

In `src/lib/db/schema.ts`, after the `bankTransacties` table (after line 567), add:
```typescript
// ============ INKOMENDE FACTUREN ============
export const inkomendeFacturen = sqliteTable("inkomende_facturen", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leverancier: text("leverancier").notNull(),
  bedrag: real("bedrag").notNull(),
  btwBedrag: real("btw_bedrag"),
  factuurnummer: text("factuurnummer"),
  datum: text("datum").notNull(),
  storageUrl: text("storage_url").notNull(),
  emailId: text("email_id").unique(),
  bankTransactieId: integer("bank_transactie_id").references(() => bankTransacties.id),
  uitgaveId: integer("uitgave_id").references(() => uitgaven.id),
  status: text("status", { enum: ["gematcht", "onbekoppeld", "handmatig_gematcht"] }).default("onbekoppeld"),
  verwerkOp: text("verwerk_op").notNull(),
  aangemaaktOp: text("aangemaakt_op").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 4: Run the migration**

```bash
# Generate SQL migration
npx drizzle-kit generate

# Apply — check if there's a push or migrate command in use
npx drizzle-kit push
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add inkomende_facturen table, storageUrl fields for cloud storage"
```

---

### Task 3: Migrate bonnetje upload to Supabase Storage

**Files:**
- Modify: `src/app/api/bank/bonnetje/route.ts:86-93`

- [ ] **Step 1: Update bonnetje route to upload to Supabase**

In `src/app/api/bank/bonnetje/route.ts`, replace lines 86-93 (the local file save block):

Old code:
```typescript
    // 1. Save the receipt image
    const uploadsDir = path.join(process.cwd(), "data", "uploads", "bonnetjes");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const ext = mediaType.includes("png") ? ".png" : ".jpg";
    const fileName = `bon_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    const bonPad = `data/uploads/bonnetjes/${fileName}`;
```

New code:
```typescript
    // 1. Save the receipt image to Supabase Storage
    const { uploadToStorage } = await import("@/lib/supabase");
    const ext = mediaType.includes("png") ? ".png" : ".jpg";
    const year = new Date().getFullYear();
    const fileName = `bon_${Date.now()}${ext}`;
    const storagePath = `${year}/bonnetjes/${fileName}`;
    await uploadToStorage(storagePath, buffer, mediaType);
    const bonPad = storagePath;
```

- [ ] **Step 2: Also store storageUrl on bankTransactie when matched**

Find the line where `bonPad` is set on the matched transaction update (around line 135-145) and also set `storageUrl`:

```typescript
    await db.update(bankTransacties).set({
      bonPad: bonPad,
      storageUrl: storagePath,
      // ... existing fields
    }).where(eq(bankTransacties.id, bestMatch.id));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bank/bonnetje/route.ts
git commit -m "feat: migrate bonnetje upload to Supabase Storage"
```

---

### Task 4: Migrate email-factuur upload to Supabase Storage

**Files:**
- Modify: `src/app/api/bank/email-factuur/route.ts:67-73`

- [ ] **Step 1: Update email-factuur route to upload to Supabase**

In `src/app/api/bank/email-factuur/route.ts`, replace lines 67-73 (local file save):

Old code:
```typescript
    // Save PDF
    const uploadsDir = path.join(process.cwd(), "data", "uploads", "facturen-inbox");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = `factuur_${Date.now()}_${pdfFileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(pdfBase64, "base64"));
    const factuurPad = `data/uploads/facturen-inbox/${fileName}`;
```

New code:
```typescript
    // Save PDF to Supabase Storage
    const { uploadToStorage } = await import("@/lib/supabase");
    const year = new Date().getFullYear();
    const fileName = `factuur_${Date.now()}_${pdfFileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const storagePath = `${year}/facturen-inkomend/${fileName}`;
    await uploadToStorage(storagePath, Buffer.from(pdfBase64, "base64"), "application/pdf");
    const factuurPad = storagePath;
```

- [ ] **Step 2: Remove unused `fs` and `path` imports if no longer needed**

Check if `fs` and `path` are still used elsewhere in the file. If not, remove the imports from lines 6-7.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bank/email-factuur/route.ts
git commit -m "feat: migrate email-factuur upload to Supabase Storage"
```

---

### Task 5: Save factuur PDFs to Supabase Storage on generation

**Files:**
- Modify: `src/app/api/facturen/[id]/pdf/route.ts:72-78`

- [ ] **Step 1: After PDF generation, upload to Supabase and store URL**

In `src/app/api/facturen/[id]/pdf/route.ts`, after line 71 (after `renderToBuffer`), before the return statement, add:

```typescript
    // Store PDF in Supabase Storage if not already stored
    const { uploadToStorage } = await import("@/lib/supabase");
    const year = factuur.factuurdatum ? new Date(factuur.factuurdatum).getFullYear() : new Date().getFullYear();
    const storagePath = `${year}/facturen-uitgaand/${factuur.factuurnummer}.pdf`;

    try {
      await uploadToStorage(storagePath, Buffer.from(pdfBuffer), "application/pdf");
      await db.update(facturen)
        .set({ pdfStorageUrl: storagePath })
        .where(eq(facturen.id, Number(id)));
    } catch {
      // Upload may fail if file already exists (upsert: false) — ignore
    }
```

- [ ] **Step 2: Add missing import for `db` and `facturen` if needed**

The file already imports `db` and `facturen` on lines 2-3. No changes needed.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/facturen/[id]/pdf/route.ts
git commit -m "feat: save factuur PDFs to Supabase Storage on generation"
```

---

### Task 6: Gmail sync cron endpoint

**Files:**
- Create: `src/app/api/administratie/gmail-sync/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the Gmail sync API route**

Create `src/app/api/administratie/gmail-sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { uploadToStorage } from "@/lib/supabase";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { getOAuth2Client } from "@/lib/google-calendar";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/administratie/gmail-sync (Vercel cron)
export async function GET(req: NextRequest) {
  // Verify cron secret or API key
  const authHeader = req.headers.get("authorization");
  const cronSecret = req.headers.get("x-vercel-cron-secret");
  if (!cronSecret && authHeader !== `Bearer ${process.env.SESSION_SECRET}`) {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  try {
    const oauth2Client = getOAuth2Client();

    // Load stored Gmail tokens from DB (reuse google_tokens table)
    const { googleTokens } = await import("@/lib/db/schema");
    const [tokens] = await db.select().from(googleTokens)
      .where(eq(googleTokens.scope, "gmail")).limit(1);

    if (!tokens) {
      return NextResponse.json({
        fout: "Gmail niet gekoppeld. Koppel eerst via /api/auth/google/gmail"
      }, { status: 400 });
    }

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Search for emails with PDF attachments from the last day
    const response = await gmail.users.messages.list({
      userId: "me",
      q: "has:attachment filename:pdf newer_than:1d",
      maxResults: 20,
    });

    const messages = response.data.messages ?? [];
    const results: Array<{ emailId: string; leverancier: string; status: string }> = [];

    for (const msg of messages) {
      // Skip if already processed
      const [existing] = await db.select({ id: inkomendeFacturen.id })
        .from(inkomendeFacturen)
        .where(eq(inkomendeFacturen.emailId, msg.id!))
        .limit(1);

      if (existing) continue;

      // Get full message
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "full",
      });

      const headers = fullMsg.data.payload?.headers ?? [];
      const from = headers.find(h => h.name?.toLowerCase() === "from")?.value ?? "";
      const subject = headers.find(h => h.name?.toLowerCase() === "subject")?.value ?? "";

      // Find PDF attachments
      const parts = fullMsg.data.payload?.parts ?? [];
      for (const part of parts) {
        if (!part.filename?.toLowerCase().endsWith(".pdf") || !part.body?.attachmentId) continue;

        // Download attachment
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: msg.id!,
          id: part.body.attachmentId,
        });

        const pdfBuffer = Buffer.from(attachment.data.data!, "base64url");
        const pdfBase64 = pdfBuffer.toString("base64");

        // Claude Vision: is this an invoice? Extract data.
        const analysis = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              },
              {
                type: "text",
                text: `Analyseer dit document. Is dit een factuur/rekening?

Als het GEEN factuur is, antwoord exact: {"isFactuur": false}

Als het WEL een factuur is, geef JSON:
{
  "isFactuur": true,
  "leverancier": "bedrijfsnaam",
  "bedrag": 123.45,
  "btwBedrag": 21.43,
  "factuurnummer": "INV-001",
  "datum": "2026-03-31"
}
Alleen JSON, geen uitleg.`,
              },
            ],
          }],
        });

        const raw = analysis.content[0].type === "text" ? analysis.content[0].text : "";
        let parsed: {
          isFactuur?: boolean;
          leverancier?: string;
          bedrag?: number;
          btwBedrag?: number;
          factuurnummer?: string;
          datum?: string;
        } = {};
        try {
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        } catch { /* skip */ }

        if (!parsed.isFactuur) continue;

        // Upload PDF to Supabase Storage
        const year = parsed.datum ? new Date(parsed.datum).getFullYear() : new Date().getFullYear();
        const safeFilename = part.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `${year}/facturen-inkomend/${Date.now()}_${safeFilename}`;
        await uploadToStorage(storagePath, pdfBuffer, "application/pdf");

        // Auto-match with Revolut transaction
        let matchedTransactieId: number | null = null;
        if (parsed.bedrag) {
          const margin = parsed.bedrag * 0.05;
          const matches = await db.select({
            id: bankTransacties.id,
            bedrag: bankTransacties.bedrag,
            datum: bankTransacties.datum,
          }).from(bankTransacties).where(
            and(
              eq(bankTransacties.type, "af"),
              sql`ABS(${bankTransacties.bedrag} - ${parsed.bedrag}) < ${margin}`,
              sql`${bankTransacties.storageUrl} IS NULL`,
              sql`${bankTransacties.bonPad} IS NULL`
            )
          ).limit(5);

          if (matches.length > 0) {
            // Pick closest by amount, then by date proximity
            const sorted = matches.sort((a, b) =>
              Math.abs(a.bedrag - (parsed.bedrag ?? 0)) - Math.abs(b.bedrag - (parsed.bedrag ?? 0))
            );
            matchedTransactieId = sorted[0].id;

            await db.update(bankTransacties).set({
              storageUrl: storagePath,
              status: "gematcht",
            }).where(eq(bankTransacties.id, matchedTransactieId));
          }
        }

        // Create inkomende_facturen record
        await db.insert(inkomendeFacturen).values({
          leverancier: parsed.leverancier ?? from,
          bedrag: parsed.bedrag ?? 0,
          btwBedrag: parsed.btwBedrag ?? null,
          factuurnummer: parsed.factuurnummer ?? null,
          datum: parsed.datum ?? new Date().toISOString().split("T")[0],
          storageUrl: storagePath,
          emailId: msg.id!,
          bankTransactieId: matchedTransactieId,
          status: matchedTransactieId ? "gematcht" : "onbekoppeld",
          verwerkOp: new Date().toISOString(),
        });

        results.push({
          emailId: msg.id!,
          leverancier: parsed.leverancier ?? from,
          status: matchedTransactieId ? "gematcht" : "onbekoppeld",
        });
      }
    }

    return NextResponse.json({
      succes: true,
      verwerkt: results.length,
      resultaten: results,
    });
  } catch (error) {
    console.error("Gmail sync error:", error);
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Gmail sync mislukt" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add cron to vercel.json**

In `vercel.json`, add after the last cron entry (before the closing `]`):

```json
    {
      "path": "/api/administratie/gmail-sync",
      "schedule": "*/30 7-22 * * *"
    }
```

This runs every 30 minutes between 7:00 and 22:00.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/administratie/gmail-sync/route.ts vercel.json
git commit -m "feat: add Gmail sync cron for automatic invoice import"
```

---

### Task 7: Gmail OAuth setup endpoint

**Files:**
- Create: `src/app/api/auth/google/gmail/route.ts`
- Create: `src/app/api/auth/google/gmail/callback/route.ts`

- [ ] **Step 1: Create Gmail OAuth initiation endpoint**

Create `src/app/api/auth/google/gmail/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getOAuth2Client } from "@/lib/google-calendar";

export async function GET() {
  await requireAuth();

  const client = getOAuth2Client();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state: "gmail",
    redirect_uri: `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/auth/google/gmail/callback`,
  });

  return NextResponse.redirect(url);
}
```

- [ ] **Step 2: Create Gmail OAuth callback endpoint**

Create `src/app/api/auth/google/gmail/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOAuth2Client } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ fout: "Geen code ontvangen" }, { status: 400 });
  }

  const client = getOAuth2Client();
  client.redirectUri = `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/auth/google/gmail/callback`;

  const { tokens } = await client.getToken(code);

  // Upsert tokens for gmail scope
  const [existing] = await db.select().from(googleTokens)
    .where(eq(googleTokens.scope, "gmail")).limit(1);

  if (existing) {
    await db.update(googleTokens).set({
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? existing.refreshToken,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    }).where(eq(googleTokens.id, existing.id));
  } else {
    await db.insert(googleTokens).values({
      scope: "gmail",
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    });
  }

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/administratie?gmail=connected`
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/google/gmail/
git commit -m "feat: add Gmail OAuth flow for administratie email sync"
```

---

### Task 8: Administratie API — list + manual match + manual upload

**Files:**
- Create: `src/app/api/administratie/route.ts`
- Create: `src/app/api/administratie/koppel/route.ts`
- Create: `src/app/api/administratie/upload/route.ts`

- [ ] **Step 1: Create list endpoint**

Create `src/app/api/administratie/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, facturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getSignedUrl } from "@/lib/supabase";

// GET /api/administratie?jaar=2026&kwartaal=1&type=inkomend
export async function GET(req: NextRequest) {
  await requireAuth();

  const jaar = req.nextUrl.searchParams.get("jaar") ?? String(new Date().getFullYear());
  const kwartaal = req.nextUrl.searchParams.get("kwartaal");
  const type = req.nextUrl.searchParams.get("type"); // "inkomend" | "uitgaand" | "bonnetjes"

  // Calculate date range
  let startDate = `${jaar}-01-01`;
  let endDate = `${jaar}-12-31`;
  if (kwartaal) {
    const q = Number(kwartaal);
    const startMonth = (q - 1) * 3 + 1;
    startDate = `${jaar}-${String(startMonth).padStart(2, "0")}-01`;
    const endMonth = q * 3;
    const lastDay = new Date(Number(jaar), endMonth, 0).getDate();
    endDate = `${jaar}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
  }

  const documenten: Array<{
    id: number;
    type: "inkomend" | "uitgaand" | "bonnetje";
    leverancier: string;
    bedrag: number;
    btwBedrag: number | null;
    datum: string;
    status: string;
    storageUrl: string;
    factuurnummer: string | null;
    transactieId: number | null;
  }> = [];

  // Inkomende facturen
  if (!type || type === "inkomend") {
    const inkomend = await db.select().from(inkomendeFacturen)
      .where(and(
        gte(inkomendeFacturen.datum, startDate),
        lte(inkomendeFacturen.datum, endDate),
      ))
      .orderBy(desc(inkomendeFacturen.datum));

    for (const f of inkomend) {
      documenten.push({
        id: f.id,
        type: "inkomend",
        leverancier: f.leverancier,
        bedrag: f.bedrag,
        btwBedrag: f.btwBedrag,
        datum: f.datum,
        status: f.status ?? "onbekoppeld",
        storageUrl: f.storageUrl,
        factuurnummer: f.factuurnummer,
        transactieId: f.bankTransactieId,
      });
    }
  }

  // Uitgaande facturen (eigen facturen met opgeslagen PDF)
  if (!type || type === "uitgaand") {
    const uitgaand = await db.select({
      id: facturen.id,
      factuurnummer: facturen.factuurnummer,
      bedragInclBtw: facturen.bedragInclBtw,
      btwBedrag: facturen.btwBedrag,
      factuurdatum: facturen.factuurdatum,
      status: facturen.status,
      pdfStorageUrl: facturen.pdfStorageUrl,
    }).from(facturen).where(and(
      gte(facturen.factuurdatum, startDate),
      lte(facturen.factuurdatum, endDate),
      sql`${facturen.pdfStorageUrl} IS NOT NULL`,
    )).orderBy(desc(facturen.factuurdatum));

    for (const f of uitgaand) {
      documenten.push({
        id: f.id,
        type: "uitgaand",
        leverancier: "Autronis",
        bedrag: f.bedragInclBtw ?? 0,
        btwBedrag: f.btwBedrag ?? null,
        datum: f.factuurdatum ?? "",
        status: f.status ?? "concept",
        storageUrl: f.pdfStorageUrl!,
        factuurnummer: f.factuurnummer,
        transactieId: null,
      });
    }
  }

  // Bonnetjes (bank transactions with storageUrl containing /bonnetjes/)
  if (!type || type === "bonnetjes") {
    const bonnetjes = await db.select({
      id: bankTransacties.id,
      omschrijving: bankTransacties.omschrijving,
      bedrag: bankTransacties.bedrag,
      datum: bankTransacties.datum,
      storageUrl: bankTransacties.storageUrl,
      btwBedrag: bankTransacties.btwBedrag,
      merchantNaam: bankTransacties.merchantNaam,
    }).from(bankTransacties).where(and(
      gte(bankTransacties.datum, startDate),
      lte(bankTransacties.datum, endDate),
      sql`${bankTransacties.storageUrl} IS NOT NULL`,
      sql`${bankTransacties.storageUrl} LIKE '%/bonnetjes/%'`,
    )).orderBy(desc(bankTransacties.datum));

    for (const b of bonnetjes) {
      documenten.push({
        id: b.id,
        type: "bonnetje",
        leverancier: b.merchantNaam ?? b.omschrijving,
        bedrag: Math.abs(b.bedrag),
        btwBedrag: b.btwBedrag,
        datum: b.datum,
        status: "gematcht",
        storageUrl: b.storageUrl!,
        factuurnummer: null,
        transactieId: b.id,
      });
    }
  }

  // Sort all by date descending
  documenten.sort((a, b) => b.datum.localeCompare(a.datum));

  // Count unmatched
  const [onbekoppeld] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(inkomendeFacturen)
    .where(eq(inkomendeFacturen.status, "onbekoppeld"));

  // Quarterly totals
  const totaalInkomend = documenten
    .filter(d => d.type === "inkomend")
    .reduce((sum, d) => sum + d.bedrag, 0);
  const totaalUitgaand = documenten
    .filter(d => d.type === "uitgaand")
    .reduce((sum, d) => sum + d.bedrag, 0);
  const totaalBtw = documenten
    .reduce((sum, d) => sum + (d.btwBedrag ?? 0), 0);

  return NextResponse.json({
    documenten,
    onbekoppeld: onbekoppeld?.count ?? 0,
    totalen: {
      inkomend: totaalInkomend,
      uitgaand: totaalUitgaand,
      btw: totaalBtw,
    },
  });
}
```

- [ ] **Step 2: Create manual match endpoint**

Create `src/app/api/administratie/koppel/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/administratie/koppel
export async function POST(req: NextRequest) {
  await requireAuth();

  const { factuurId, transactieId } = await req.json() as {
    factuurId: number;
    transactieId: number;
  };

  if (!factuurId || !transactieId) {
    return NextResponse.json({ fout: "factuurId en transactieId zijn verplicht" }, { status: 400 });
  }

  // Verify both exist
  const [factuur] = await db.select().from(inkomendeFacturen)
    .where(eq(inkomendeFacturen.id, factuurId)).limit(1);
  const [transactie] = await db.select().from(bankTransacties)
    .where(eq(bankTransacties.id, transactieId)).limit(1);

  if (!factuur) return NextResponse.json({ fout: "Factuur niet gevonden" }, { status: 404 });
  if (!transactie) return NextResponse.json({ fout: "Transactie niet gevonden" }, { status: 404 });

  // Link them
  await db.update(inkomendeFacturen).set({
    bankTransactieId: transactieId,
    status: "handmatig_gematcht",
  }).where(eq(inkomendeFacturen.id, factuurId));

  await db.update(bankTransacties).set({
    storageUrl: factuur.storageUrl,
    status: "gematcht",
  }).where(eq(bankTransacties.id, transactieId));

  return NextResponse.json({ succes: true });
}
```

- [ ] **Step 3: Create manual upload endpoint**

Create `src/app/api/administratie/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { uploadToStorage } from "@/lib/supabase";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/administratie/upload
export async function POST(req: NextRequest) {
  await requireAuth();

  const formData = await req.formData();
  const file = formData.get("bestand") as File | null;

  if (!file) {
    return NextResponse.json({ fout: "Geen bestand meegestuurd" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");

  // Claude Vision analysis
  const analysis = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
        },
        {
          type: "text",
          text: `Analyseer deze factuur. Geef JSON:
{
  "leverancier": "bedrijfsnaam",
  "bedrag": 123.45,
  "btwBedrag": 21.43,
  "factuurnummer": "INV-001",
  "datum": "2026-03-31"
}
Alleen JSON, geen uitleg.`,
        },
      ],
    }],
  });

  const raw = analysis.content[0].type === "text" ? analysis.content[0].text : "";
  let parsed: {
    leverancier?: string;
    bedrag?: number;
    btwBedrag?: number;
    factuurnummer?: string;
    datum?: string;
  } = {};
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch { /* fallback */ }

  // Upload to Supabase
  const year = parsed.datum ? new Date(parsed.datum).getFullYear() : new Date().getFullYear();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const storagePath = `${year}/facturen-inkomend/${Date.now()}_${safeFilename}`;
  await uploadToStorage(storagePath, buffer, "application/pdf");

  // Auto-match
  let matchedTransactieId: number | null = null;
  if (parsed.bedrag) {
    const margin = parsed.bedrag * 0.05;
    const matches = await db.select({
      id: bankTransacties.id,
      bedrag: bankTransacties.bedrag,
    }).from(bankTransacties).where(
      and(
        eq(bankTransacties.type, "af"),
        sql`ABS(${bankTransacties.bedrag} - ${parsed.bedrag}) < ${margin}`,
        sql`${bankTransacties.storageUrl} IS NULL`,
        sql`${bankTransacties.bonPad} IS NULL`
      )
    ).limit(5);

    if (matches.length > 0) {
      const sorted = matches.sort((a, b) =>
        Math.abs(a.bedrag - (parsed.bedrag ?? 0)) - Math.abs(b.bedrag - (parsed.bedrag ?? 0))
      );
      matchedTransactieId = sorted[0].id;

      await db.update(bankTransacties).set({
        storageUrl: storagePath,
        status: "gematcht",
      }).where(eq(bankTransacties.id, matchedTransactieId));
    }
  }

  // Save record
  const [record] = await db.insert(inkomendeFacturen).values({
    leverancier: parsed.leverancier ?? file.name,
    bedrag: parsed.bedrag ?? 0,
    btwBedrag: parsed.btwBedrag ?? null,
    factuurnummer: parsed.factuurnummer ?? null,
    datum: parsed.datum ?? new Date().toISOString().split("T")[0],
    storageUrl: storagePath,
    bankTransactieId: matchedTransactieId,
    status: matchedTransactieId ? "gematcht" : "onbekoppeld",
    verwerkOp: new Date().toISOString(),
  }).returning();

  return NextResponse.json({
    succes: true,
    factuur: record,
    status: matchedTransactieId ? "gematcht" : "onbekoppeld",
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/administratie/
git commit -m "feat: add administratie API — list, manual match, manual upload"
```

---

### Task 9: ZIP export endpoint

**Files:**
- Create: `src/app/api/administratie/export/route.ts`

- [ ] **Step 1: Create export endpoint**

Create `src/app/api/administratie/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inkomendeFacturen, facturen, bankTransacties } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { and, gte, lte, sql } from "drizzle-orm";
import { downloadFromStorage } from "@/lib/supabase";
import archiver from "archiver";

// GET /api/administratie/export?jaar=2026&kwartaal=1
export async function GET(req: NextRequest) {
  await requireAuth();

  const jaar = req.nextUrl.searchParams.get("jaar") ?? String(new Date().getFullYear());
  const kwartaal = req.nextUrl.searchParams.get("kwartaal");

  let startDate = `${jaar}-01-01`;
  let endDate = `${jaar}-12-31`;
  let label = jaar;

  if (kwartaal) {
    const q = Number(kwartaal);
    const startMonth = (q - 1) * 3 + 1;
    startDate = `${jaar}-${String(startMonth).padStart(2, "0")}-01`;
    const endMonth = q * 3;
    const lastDay = new Date(Number(jaar), endMonth, 0).getDate();
    endDate = `${jaar}-${String(endMonth).padStart(2, "0")}-${lastDay}`;
    label = `${jaar}-Q${kwartaal}`;
  }

  // Collect all storage paths
  const files: Array<{ folder: string; name: string; path: string }> = [];

  // Inkomende facturen
  const inkomend = await db.select({
    leverancier: inkomendeFacturen.leverancier,
    datum: inkomendeFacturen.datum,
    storageUrl: inkomendeFacturen.storageUrl,
  }).from(inkomendeFacturen).where(and(
    gte(inkomendeFacturen.datum, startDate),
    lte(inkomendeFacturen.datum, endDate),
  ));

  for (const f of inkomend) {
    const ext = f.storageUrl.split(".").pop() ?? "pdf";
    files.push({
      folder: "facturen-inkomend",
      name: `${f.datum}_${f.leverancier.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`,
      path: f.storageUrl,
    });
  }

  // Uitgaande facturen
  const uitgaand = await db.select({
    factuurnummer: facturen.factuurnummer,
    factuurdatum: facturen.factuurdatum,
    pdfStorageUrl: facturen.pdfStorageUrl,
  }).from(facturen).where(and(
    gte(facturen.factuurdatum, startDate),
    lte(facturen.factuurdatum, endDate),
    sql`${facturen.pdfStorageUrl} IS NOT NULL`,
  ));

  for (const f of uitgaand) {
    files.push({
      folder: "facturen-uitgaand",
      name: `${f.factuurdatum}_${f.factuurnummer}.pdf`,
      path: f.pdfStorageUrl!,
    });
  }

  // Bonnetjes
  const bonnetjes = await db.select({
    datum: bankTransacties.datum,
    merchantNaam: bankTransacties.merchantNaam,
    omschrijving: bankTransacties.omschrijving,
    storageUrl: bankTransacties.storageUrl,
  }).from(bankTransacties).where(and(
    gte(bankTransacties.datum, startDate),
    lte(bankTransacties.datum, endDate),
    sql`${bankTransacties.storageUrl} IS NOT NULL`,
    sql`${bankTransacties.storageUrl} LIKE '%/bonnetjes/%'`,
  ));

  for (const b of bonnetjes) {
    const ext = b.storageUrl!.split(".").pop() ?? "jpg";
    const name = (b.merchantNaam ?? b.omschrijving).replace(/[^a-zA-Z0-9]/g, "_");
    files.push({
      folder: "bonnetjes",
      name: `${b.datum}_${name}.${ext}`,
      path: b.storageUrl!,
    });
  }

  if (files.length === 0) {
    return NextResponse.json({ fout: "Geen documenten gevonden voor deze periode" }, { status: 404 });
  }

  // Create ZIP
  const chunks: Buffer[] = [];
  const archive = archiver("zip", { zlib: { level: 5 } });

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  const archiveFinished = new Promise<void>((resolve, reject) => {
    archive.on("end", resolve);
    archive.on("error", reject);
  });

  for (const file of files) {
    try {
      const buffer = await downloadFromStorage(file.path);
      archive.append(buffer, { name: `${file.folder}/${file.name}` });
    } catch {
      // Skip files that fail to download
    }
  }

  archive.finalize();
  await archiveFinished;

  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="administratie-${label}.zip"`,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/administratie/export/route.ts
git commit -m "feat: add ZIP export for administratie documents per quarter"
```

---

### Task 10: Administratie frontend page

**Files:**
- Create: `src/app/(dashboard)/administratie/page.tsx`
- Modify: `src/components/layout/sidebar.tsx:66`

- [ ] **Step 1: Add nav link to sidebar**

In `src/components/layout/sidebar.tsx`, after line 66 (after the Belasting entry), add:

```typescript
          { label: "Administratie", icon: FolderArchive, href: "/administratie" },
```

Also add `FolderArchive` to the lucide-react import at the top of the file.

- [ ] **Step 2: Create the administratie page**

Create `src/app/(dashboard)/administratie/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Receipt, Upload, Download, Link, AlertTriangle, Check, Clock } from "lucide-react";
import { useToast } from "@/components/toast-provider";
import { getSignedUrl } from "@/lib/supabase";

interface Document {
  id: number;
  type: "inkomend" | "uitgaand" | "bonnetje";
  leverancier: string;
  bedrag: number;
  btwBedrag: number | null;
  datum: string;
  status: string;
  storageUrl: string;
  factuurnummer: string | null;
  transactieId: number | null;
}

interface ApiResponse {
  documenten: Document[];
  onbekoppeld: number;
  totalen: { inkomend: number; uitgaand: number; btw: number };
}

const KWARTALEN = [
  { label: "Alles", value: "" },
  { label: "Q1", value: "1" },
  { label: "Q2", value: "2" },
  { label: "Q3", value: "3" },
  { label: "Q4", value: "4" },
];

const TABS = [
  { label: "Alle", value: "" },
  { label: "Inkomend", value: "inkomend" },
  { label: "Uitgaand", value: "uitgaand" },
  { label: "Bonnetjes", value: "bonnetjes" },
];

export default function AdministratiePage() {
  const { addToast } = useToast();
  const [jaar, setJaar] = useState(new Date().getFullYear());
  const [kwartaal, setKwartaal] = useState("");
  const [tab, setTab] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ jaar: String(jaar) });
      if (kwartaal) params.set("kwartaal", kwartaal);
      if (tab) params.set("type", tab);

      const res = await fetch(`/api/administratie?${params}`);
      if (!res.ok) throw new Error("Ophalen mislukt");
      setData(await res.json());
    } catch {
      addToast("Kon documenten niet ophalen", "fout");
    } finally {
      setLoading(false);
    }
  }, [jaar, kwartaal, tab, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("bestand", file);
      const res = await fetch("/api/administratie/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.fout);
      addToast(
        result.status === "gematcht"
          ? `Factuur van ${result.factuur.leverancier} automatisch gekoppeld`
          : `Factuur opgeslagen — nog niet gekoppeld aan een transactie`,
        result.status === "gematcht" ? "succes" : "info"
      );
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload mislukt", "fout");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ jaar: String(jaar) });
    if (kwartaal) params.set("kwartaal", kwartaal);
    window.open(`/api/administratie/export?${params}`, "_blank");
  };

  const handlePreview = async (storageUrl: string) => {
    try {
      const res = await fetch(`/api/administratie/signed-url?path=${encodeURIComponent(storageUrl)}`);
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch {
      addToast("Kon document niet openen", "fout");
    }
  };

  // Group documents by month
  const grouped = (data?.documenten ?? []).reduce<Record<string, Document[]>>((acc, doc) => {
    const month = doc.datum.substring(0, 7); // "2026-03"
    if (!acc[month]) acc[month] = [];
    acc[month].push(doc);
    return acc;
  }, {});

  const monthNames: Record<string, string> = {
    "01": "Januari", "02": "Februari", "03": "Maart", "04": "April",
    "05": "Mei", "06": "Juni", "07": "Juli", "08": "Augustus",
    "09": "September", "10": "Oktober", "11": "November", "12": "December",
  };

  const jaren = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administratie</h1>
          <p className="text-sm text-white/50 mt-1">Alle financiele documenten op een plek</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 rounded-xl bg-[#192225] border border-[#2A3538] hover:border-[#17B8A5] cursor-pointer transition-colors flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" />
            {uploading ? "Uploaden..." : "Upload factuur"}
            <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-xl bg-[#192225] border border-[#2A3538] hover:border-[#17B8A5] transition-colors flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Download {kwartaal ? `Q${kwartaal}` : jaar}
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {(data?.onbekoppeld ?? 0) > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-200">
            {data!.onbekoppeld} factuur{data!.onbekoppeld > 1 ? "en" : ""} wacht{data!.onbekoppeld > 1 ? "en" : ""} op koppeling
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Jaar */}
        <div className="flex gap-1">
          {jaren.map(j => (
            <button
              key={j}
              onClick={() => setJaar(j)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                jaar === j ? "bg-[#17B8A5] text-white" : "bg-[#192225] text-white/60 hover:text-white"
              }`}
            >
              {j}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 ml-4">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                tab === t.value ? "bg-[#17B8A5] text-white" : "bg-[#192225] text-white/60 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Kwartaal */}
        <div className="flex gap-1 ml-4">
          {KWARTALEN.map(q => (
            <button
              key={q.value}
              onClick={() => setKwartaal(q.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                kwartaal === q.value ? "bg-[#17B8A5] text-white" : "bg-[#192225] text-white/60 hover:text-white"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents grouped by month */}
      {loading ? (
        <div className="text-center text-white/40 py-12">Laden...</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center text-white/40 py-12">Geen documenten gevonden</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([month, docs]) => {
            const [y, m] = month.split("-");
            return (
              <div key={month} className="rounded-2xl bg-[#192225] border border-[#2A3538] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#2A3538] bg-[#0E1719]/50">
                  <h3 className="font-medium text-sm text-white/70">{monthNames[m]} {y}</h3>
                </div>
                <div className="divide-y divide-[#2A3538]">
                  {docs.map(doc => (
                    <button
                      key={`${doc.type}-${doc.id}`}
                      onClick={() => handlePreview(doc.storageUrl)}
                      className="w-full px-5 py-3 flex items-center gap-4 hover:bg-[#0E1719]/30 transition-colors text-left"
                    >
                      {doc.type === "bonnetje" ? (
                        <Receipt className="w-4 h-4 text-white/40 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-white/40 shrink-0" />
                      )}
                      <span className="flex-1 text-sm truncate">{doc.leverancier}</span>
                      {doc.factuurnummer && (
                        <span className="text-xs text-white/30">{doc.factuurnummer}</span>
                      )}
                      <span className="text-sm font-mono w-24 text-right">
                        {doc.type === "uitgaand" ? "+" : "-"}€{doc.bedrag.toFixed(2)}
                      </span>
                      <span className="text-xs text-white/40 w-20">{doc.datum}</span>
                      {doc.status === "gematcht" || doc.status === "handmatig_gematcht" || doc.status === "betaald" ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : doc.status === "onbekoppeld" ? (
                        <Clock className="w-4 h-4 text-amber-400" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
      )}

      {/* Totals */}
      {data && !loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#192225] border border-[#2A3538] p-5">
            <p className="text-xs text-white/40 mb-1">Inkomend (kosten)</p>
            <p className="text-xl font-bold">€{data.totalen.inkomend.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-[#192225] border border-[#2A3538] p-5">
            <p className="text-xs text-white/40 mb-1">Uitgaand (omzet)</p>
            <p className="text-xl font-bold">€{data.totalen.uitgaand.toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-[#192225] border border-[#2A3538] p-5">
            <p className="text-xs text-white/40 mb-1">BTW te verrekenen</p>
            <p className="text-xl font-bold">€{data.totalen.btw.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create signed URL helper endpoint**

Create `src/app/api/administratie/signed-url/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSignedUrl } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  await requireAuth();

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ fout: "Pad is verplicht" }, { status: 400 });

  const url = await getSignedUrl(path, 3600);
  return NextResponse.json({ url });
}
```

- [ ] **Step 4: Remove the unused import of `getSignedUrl` from the page**

The page uses `/api/administratie/signed-url` via fetch, not the server-side `getSignedUrl` directly (since it's a `"use client"` component). Remove the import:

```typescript
// Remove this line from page.tsx:
import { getSignedUrl } from "@/lib/supabase";
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Start dev server and test the page**

```bash
npm run dev
```

Open http://localhost:3000/administratie and verify:
- Page loads without errors
- Year/quarter/tab filters work
- Upload button shows file picker
- Navigation link appears in sidebar under Financien

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/administratie/ src/app/api/administratie/signed-url/ src/components/layout/sidebar.tsx
git commit -m "feat: add /administratie page with document overview, filters, upload"
```

---

### Task 11: Migrate existing local files to Supabase Storage

**Files:**
- Create: `scripts/migrate-storage.ts`

- [ ] **Step 1: Create migration script**

Create `scripts/migrate-storage.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import { db } from "../src/lib/db";
import { bankTransacties, uitgaven } from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET = "administratie";

async function migrate() {
  console.log("Starting storage migration...");

  // 1. Migrate bonnetjes
  const bonnetjesDir = path.join(process.cwd(), "data", "uploads", "bonnetjes");
  if (fs.existsSync(bonnetjesDir)) {
    const files = fs.readdirSync(bonnetjesDir);
    console.log(`Found ${files.length} bonnetjes to migrate`);

    for (const file of files) {
      const filePath = path.join(bonnetjesDir, file);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(file).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : "image/jpeg";
      const storagePath = `2026/bonnetjes/${file}`;

      try {
        await supabase.storage.from(BUCKET).upload(storagePath, buffer, { contentType });

        // Update any bank transaction that references this file
        await db.update(bankTransacties).set({ storageUrl: storagePath })
          .where(eq(bankTransacties.bonPad, `data/uploads/bonnetjes/${file}`));

        console.log(`  Migrated: ${file}`);
      } catch (err) {
        console.error(`  Failed: ${file}`, err);
      }
    }
  }

  // 2. Migrate facturen-inbox
  const facturenDir = path.join(process.cwd(), "data", "uploads", "facturen-inbox");
  if (fs.existsSync(facturenDir)) {
    const files = fs.readdirSync(facturenDir);
    console.log(`Found ${files.length} inkomende facturen to migrate`);

    for (const file of files) {
      const filePath = path.join(facturenDir, file);
      const buffer = fs.readFileSync(filePath);
      const storagePath = `2026/facturen-inkomend/${file}`;

      try {
        await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
          contentType: "application/pdf",
        });

        // Update any bank transaction that references this file
        await db.update(bankTransacties).set({ storageUrl: storagePath })
          .where(eq(bankTransacties.bonPad, `data/uploads/facturen-inbox/${file}`));

        console.log(`  Migrated: ${file}`);
      } catch (err) {
        console.error(`  Failed: ${file}`, err);
      }
    }
  }

  console.log("Migration complete!");
}

migrate().catch(console.error);
```

- [ ] **Step 2: Run the migration**

```bash
npx tsx scripts/migrate-storage.ts
```

- [ ] **Step 3: Verify files are in Supabase Storage**

Check via Supabase dashboard → Storage → administratie bucket.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-storage.ts
git commit -m "feat: add migration script for local files to Supabase Storage"
```

---

### Task 12: Final integration test + Google OAuth setup

- [ ] **Step 1: Create Supabase Storage bucket**

Via Supabase MCP tool or dashboard:
- Bucket name: `administratie`
- Public: `false`
- File size limit: `10MB`
- Allowed MIME types: `application/pdf, image/jpeg, image/png`

- [ ] **Step 2: Add Gmail scope to Google Cloud Console**

In Google Cloud Console (same project as Calendar):
1. Go to APIs & Services → Library → Enable Gmail API
2. Go to OAuth consent screen → Add scope `https://www.googleapis.com/auth/gmail.readonly`

- [ ] **Step 3: Connect Gmail OAuth**

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/api/auth/google/gmail`
3. Authorize with `zakelijk@autronis.com`
4. Should redirect to `/administratie?gmail=connected`

- [ ] **Step 4: Test Gmail sync manually**

```bash
curl -H "Authorization: Bearer $SESSION_SECRET" http://localhost:3000/api/administratie/gmail-sync
```

Verify:
- Returns `{ succes: true, verwerkt: N, resultaten: [...] }`
- PDFs appear in Supabase Storage
- Records created in `inkomende_facturen` table
- Auto-matched where possible

- [ ] **Step 5: Test full flow**

1. Upload a test PDF via `/administratie` page → verify it appears
2. Check auto-matching works
3. Manual match via the UI
4. Download ZIP export
5. Check notification badge shows unmatched count

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete administratie & cloud storage integration"
```
