import { Client } from "@notionhq/client";
import { DocumentType, DocumentBase, DocumentPayload, PaginatedDocumenten, SortOption, DOCUMENT_TYPE_NOTION_DB_KEYS } from "@/types/documenten";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error && "status" in error && (error as { status: number }).status === 429;
      if (isRateLimit && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

function getNotionDbId(type: DocumentType): string {
  const envKey = DOCUMENT_TYPE_NOTION_DB_KEYS[type];
  const dbId = process.env[envKey];
  if (!dbId) throw new Error(`Notion database ID niet geconfigureerd: ${envKey}`);
  return dbId;
}

function buildProperties(payload: DocumentPayload, samenvatting: string, aangemaaktDoor: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    Titel: { title: [{ text: { content: payload.titel } }] },
    Samenvatting: { rich_text: [{ text: { content: samenvatting } }] },
    "Aangemaakt door": { rich_text: [{ text: { content: aangemaaktDoor } }] },
    "Aangemaakt op": { date: { start: new Date().toISOString().split("T")[0] } },
    "Document type": { rich_text: [{ text: { content: payload.type } }] },
  };

  switch (payload.type) {
    case "contract":
      if (payload.status) base.Status = { select: { name: payload.status } };
      if (payload.startdatum) base.Startdatum = { date: { start: payload.startdatum } };
      if (payload.einddatum) base.Einddatum = { date: { start: payload.einddatum } };
      if (payload.bedrag !== undefined) base.Bedrag = { number: payload.bedrag };
      break;
    case "klantdocument":
      base.Type = { select: { name: payload.subtype } };
      break;
    case "intern":
      base.Categorie = { select: { name: payload.categorie } };
      if (payload.eigenaar) base.Eigenaar = { rich_text: [{ text: { content: payload.eigenaar } }] };
      break;
    case "belangrijke-info":
      base.Urgentie = { select: { name: payload.urgentie } };
      base["Gerelateerd aan"] = { select: { name: payload.gerelateerdAan } };
      break;
    case "plan":
      if (payload.status) base.Status = { select: { name: payload.status } };
      break;
    case "notitie":
      base.Type = { select: { name: payload.subtype } };
      if (payload.datum) base.Datum = { date: { start: payload.datum } };
      break;
  }

  return base;
}

function parseInlineRichText(text: string): Array<Record<string, unknown>> {
  const segments: Array<Record<string, unknown>> = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: { content: text.slice(lastIndex, match.index) } });
    }
    if (match[2]) {
      segments.push({ type: "text", text: { content: match[2] }, annotations: { bold: true, italic: true } });
    } else if (match[3]) {
      segments.push({ type: "text", text: { content: match[3] }, annotations: { bold: true } });
    } else if (match[4]) {
      segments.push({ type: "text", text: { content: match[4] }, annotations: { italic: true } });
    } else if (match[5]) {
      segments.push({ type: "text", text: { content: match[5] }, annotations: { code: true } });
    } else if (match[6]) {
      segments.push({ type: "text", text: { content: match[6] }, annotations: { strikethrough: true } });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", text: { content: text.slice(lastIndex) } });
  }

  return segments.length > 0 ? segments : [{ type: "text", text: { content: text } }];
}

function contentToBlocks(content: string): Array<Record<string, unknown>> {
  const lines = content.split("\n");
  const blocks: Array<Record<string, unknown>> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") continue;

    // Headings
    const h3Match = line.match(/^###\s+(.+)/);
    if (h3Match) {
      blocks.push({ object: "block", type: "heading_3", heading_3: { rich_text: parseInlineRichText(h3Match[1]) } });
      continue;
    }
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      blocks.push({ object: "block", type: "heading_2", heading_2: { rich_text: parseInlineRichText(h2Match[1]) } });
      continue;
    }
    const h1Match = line.match(/^#\s+(.+)/);
    if (h1Match) {
      blocks.push({ object: "block", type: "heading_1", heading_1: { rich_text: parseInlineRichText(h1Match[1]) } });
      continue;
    }

    // Bulleted list
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      blocks.push({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: parseInlineRichText(bulletMatch[1]) } });
      continue;
    }

    // Numbered list
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      blocks.push({ object: "block", type: "numbered_list_item", numbered_list_item: { rich_text: parseInlineRichText(numberedMatch[1]) } });
      continue;
    }

    // Code block (``` ... ```)
    if (line.trim().startsWith("```")) {
      const codeLines: string[] = [];
      const langMatch = line.trim().match(/^```(\w*)/);
      const language = langMatch?.[1] || "plain text";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        object: "block", type: "code",
        code: { rich_text: [{ type: "text", text: { content: codeLines.join("\n") } }], language },
      });
      continue;
    }

    // Divider
    if (line.trim() === "---" || line.trim() === "***") {
      blocks.push({ object: "block", type: "divider", divider: {} });
      continue;
    }

    // Quote
    const quoteMatch = line.match(/^>\s+(.+)/);
    if (quoteMatch) {
      blocks.push({ object: "block", type: "quote", quote: { rich_text: parseInlineRichText(quoteMatch[1]) } });
      continue;
    }

    // Regular paragraph
    blocks.push({ object: "block", type: "paragraph", paragraph: { rich_text: parseInlineRichText(line) } });
  }

  return blocks;
}

export async function createNotionDocument(
  payload: DocumentPayload,
  samenvatting: string,
  aangemaaktDoor: string,
  klantNaam?: string,
  projectNaam?: string
): Promise<{ notionId: string; notionUrl: string }> {
  const dbId = getNotionDbId(payload.type);
  const properties = buildProperties(payload, samenvatting, aangemaaktDoor);

  if (klantNaam) {
    properties.Klant = { rich_text: [{ text: { content: klantNaam } }] };
  }
  if (projectNaam) {
    properties.Project = { rich_text: [{ text: { content: projectNaam } }] };
  }

  // Split blocks into batches of 100 (Notion API limit)
  const allBlocks = contentToBlocks(payload.content);
  const firstBatch = allBlocks.slice(0, 100);
  const remainingBatches: Array<Record<string, unknown>>[] = [];
  for (let i = 100; i < allBlocks.length; i += 100) {
    remainingBatches.push(allBlocks.slice(i, i + 100));
  }

  // Create page with first 100 blocks
  let response;
  try {
    response = await withRetry(() => notion.pages.create({
      parent: { database_id: dbId },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      children: firstBatch as Parameters<typeof notion.pages.create>[0]["children"],
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("is not a property that exists")) {
      delete properties.Klant;
      delete properties.Project;
      response = await withRetry(() => notion.pages.create({
        parent: { database_id: dbId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
        children: firstBatch as Parameters<typeof notion.pages.create>[0]["children"],
      }));
    } else {
      throw err;
    }
  }

  // Append remaining blocks in batches
  for (const batch of remainingBatches) {
    await withRetry(() => notion.blocks.children.append({
      block_id: response.id,
      children: batch as Parameters<typeof notion.blocks.children.append>[0]["children"],
    }));
  }

  return {
    notionId: response.id,
    notionUrl: (response as { url: string }).url,
  };
}

function getNotionSort(sort?: SortOption): Array<{ property: string; direction: "ascending" | "descending" }> {
  switch (sort) {
    case "datum-asc": return [{ property: "Aangemaakt op", direction: "ascending" }];
    case "titel-asc": return [{ property: "Titel", direction: "ascending" }];
    case "titel-desc": return [{ property: "Titel", direction: "descending" }];
    case "klant-asc": return [{ property: "Klant", direction: "ascending" }];
    case "klant-desc": return [{ property: "Klant", direction: "descending" }];
    case "datum-desc":
    default: return [{ property: "Aangemaakt op", direction: "descending" }];
  }
}

function parseNotionPage(page: { id: string; url?: string; properties?: Record<string, unknown> }, type: DocumentType): DocumentBase {
  const props = ((page as { properties: Record<string, unknown> }).properties ?? {}) as Record<string, {
    title?: Array<{ plain_text: string }>;
    rich_text?: Array<{ plain_text: string }>;
    date?: { start: string } | null;
  }>;

  return {
    notionId: page.id,
    titel: props.Titel?.title?.[0]?.plain_text ?? "Zonder titel",
    type,
    samenvatting: props.Samenvatting?.rich_text?.[0]?.plain_text ?? "",
    aangemaaktDoor: props["Aangemaakt door"]?.rich_text?.[0]?.plain_text ?? "",
    aangemaaktOp: props["Aangemaakt op"]?.date?.start ?? "",
    notionUrl: (page as { url: string }).url,
    klantNaam: props.Klant?.rich_text?.[0]?.plain_text,
    projectNaam: props.Project?.rich_text?.[0]?.plain_text,
  };
}

async function fetchFromDatabase(
  type: DocumentType,
  dbId: string,
  options?: { pageSize?: number; cursor?: string; sort?: SortOption }
): Promise<{ docs: DocumentBase[]; nextCursor?: string; hasMore: boolean }> {
  const queryParams: Record<string, unknown> = {
    database_id: dbId,
    sorts: getNotionSort(options?.sort),
    page_size: options?.pageSize ?? 20,
  };
  if (options?.cursor) {
    queryParams.start_cursor = options.cursor;
  }

  const response = await withRetry(() => notion.databases.query(queryParams as Parameters<typeof notion.databases.query>[0]));

  return {
    docs: response.results.map((page) => parseNotionPage(page as { id: string; url?: string; properties?: Record<string, unknown> }, type)),
    nextCursor: response.next_cursor ?? undefined,
    hasMore: response.has_more,
  };
}

// Fetch all documents of a single type (no pagination limit)
export async function fetchDocumentenByType(type: DocumentType): Promise<DocumentBase[]> {
  const envKey = DOCUMENT_TYPE_NOTION_DB_KEYS[type];
  const dbId = process.env[envKey];
  if (!dbId) return [];

  const allDocs: DocumentBase[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchFromDatabase(type, dbId, { pageSize: 100, cursor });
    allDocs.push(...result.docs);
    cursor = result.nextCursor;
    hasMore = result.hasMore;
  }

  return allDocs;
}

// Paginated fetch — fetches from all 6 databases with a per-db page size
export async function fetchAllDocuments(options?: {
  pageSize?: number;
  cursor?: string;
  sort?: SortOption;
}): Promise<PaginatedDocumenten> {
  const allDocs: DocumentBase[] = [];
  const types: DocumentType[] = ["contract", "klantdocument", "intern", "belangrijke-info", "plan", "notitie"];
  let lastCursor: string | undefined;
  let anyHasMore = false;

  // When cursor is provided, it's in format "type:cursor" to track which DB
  let cursorType: string | undefined;
  let cursorValue: string | undefined;
  if (options?.cursor) {
    const [t, c] = options.cursor.split(":");
    cursorType = t;
    cursorValue = c;
  }

  const perDbSize = options?.pageSize ?? 20;

  for (const type of types) {
    const envKey = DOCUMENT_TYPE_NOTION_DB_KEYS[type];
    const dbId = process.env[envKey];
    if (!dbId) continue;

    // If we have a cursor, skip DBs until we reach the right one
    if (cursorType && type !== cursorType) continue;

    try {
      const result = await fetchFromDatabase(type, dbId, {
        pageSize: perDbSize,
        cursor: cursorType === type ? cursorValue : undefined,
        sort: options?.sort,
      });
      allDocs.push(...result.docs);

      if (result.hasMore) {
        lastCursor = `${type}:${result.nextCursor}`;
        anyHasMore = true;
        break; // Stop after first DB with more results
      }
    } catch {
      // Skip this database and continue with others
    }

    // Reset cursor tracking after processing the target DB
    if (cursorType === type) {
      cursorType = undefined;
      cursorValue = undefined;
    }
  }

  // Client-side sort across databases when no cursor (first page)
  if (!options?.cursor) {
    const sortFn = getSortFn(options?.sort);
    allDocs.sort(sortFn);
  }

  return {
    documenten: allDocs,
    nextCursor: lastCursor,
    hasMore: anyHasMore,
  };
}

function getSortFn(sort?: SortOption): (a: DocumentBase, b: DocumentBase) => number {
  switch (sort) {
    case "datum-asc": return (a, b) => a.aangemaaktOp.localeCompare(b.aangemaaktOp);
    case "titel-asc": return (a, b) => a.titel.localeCompare(b.titel);
    case "titel-desc": return (a, b) => b.titel.localeCompare(a.titel);
    case "klant-asc": return (a, b) => (a.klantNaam ?? "").localeCompare(b.klantNaam ?? "");
    case "klant-desc": return (a, b) => (b.klantNaam ?? "").localeCompare(a.klantNaam ?? "");
    case "datum-desc":
    default: return (a, b) => b.aangemaaktOp.localeCompare(a.aangemaaktOp);
  }
}

interface NotionRichText {
  plain_text: string;
  annotations?: { bold?: boolean; italic?: boolean; code?: boolean; strikethrough?: boolean; underline?: boolean };
  href?: string | null;
}

interface NotionBlock {
  type: string;
  [key: string]: unknown;
}

function richTextToHtml(richText: NotionRichText[]): string {
  return richText.map((t) => {
    let text = t.plain_text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (t.annotations?.bold) text = `<strong>${text}</strong>`;
    if (t.annotations?.italic) text = `<em>${text}</em>`;
    if (t.annotations?.code) text = `<code>${text}</code>`;
    if (t.annotations?.strikethrough) text = `<s>${text}</s>`;
    if (t.href) text = `<a href="${t.href}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join("");
}

function blockToHtml(block: NotionBlock): string {
  const type = block.type;
  const data = block[type] as { rich_text?: NotionRichText[]; language?: string; checked?: boolean };

  if (type === "divider") return `<hr />`;

  const rt = data?.rich_text;
  if (!rt) return "";

  const html = richTextToHtml(rt);

  switch (type) {
    case "heading_1": return `<h1>${html}</h1>`;
    case "heading_2": return `<h2>${html}</h2>`;
    case "heading_3": return `<h3>${html}</h3>`;
    case "bulleted_list_item": return `<li>${html}</li>`;
    case "numbered_list_item": return `<li>${html}</li>`;
    case "to_do": {
      const checked = data.checked === true;
      const icon = checked ? "✅" : "⬜";
      const cls = checked ? ' style="text-decoration:line-through;opacity:0.6"' : "";
      return `<li${cls}>${icon} ${html}</li>`;
    }
    case "code": return `<pre><code>${html}</code></pre>`;
    case "quote": return `<blockquote>${html}</blockquote>`;
    case "toggle": return `<details><summary>${html}</summary></details>`;
    case "callout": return `<div class="callout">${html}</div>`;
    case "paragraph":
    default: return html ? `<p>${html}</p>` : "";
  }
}

export async function replaceNotionPageContent(pageId: string, markdownContent: string): Promise<void> {
  // Delete all existing blocks
  const existing = await withRetry(() => notion.blocks.children.list({ block_id: pageId, page_size: 100 }));
  for (const block of existing.results) {
    await withRetry(() => notion.blocks.delete({ block_id: (block as { id: string }).id }));
  }

  // Convert markdown to Notion blocks and append in batches of 100
  const newBlocks = contentToBlocks(markdownContent);
  for (let i = 0; i < newBlocks.length; i += 100) {
    const batch = newBlocks.slice(i, i + 100);
    await withRetry(() => notion.blocks.children.append({
      block_id: pageId,
      children: batch as Parameters<typeof notion.blocks.children.append>[0]["children"],
    }));
  }
}

export async function fetchNotionPageContent(pageId: string): Promise<string> {
  // Fetch all blocks with pagination
  const allBlocks: NotionBlock[] = [];
  let cursor: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const response = await withRetry(() => notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    }));
    allBlocks.push(...(response.results as NotionBlock[]));
    cursor = response.next_cursor ?? undefined;
    hasMore = response.has_more;
  }
  const blocks = { results: allBlocks };

  let html = "";
  let inBulletList = false;
  let inNumberedList = false;
  let inTodoList = false;

  for (const block of blocks.results as NotionBlock[]) {
    const isBullet = block.type === "bulleted_list_item";
    const isNumbered = block.type === "numbered_list_item";
    const isTodo = block.type === "to_do";

    if (!isBullet && inBulletList) { html += "</ul>"; inBulletList = false; }
    if (!isNumbered && inNumberedList) { html += "</ol>"; inNumberedList = false; }
    if (!isTodo && inTodoList) { html += "</ul>"; inTodoList = false; }
    if (isBullet && !inBulletList) { html += "<ul>"; inBulletList = true; }
    if (isNumbered && !inNumberedList) { html += "<ol>"; inNumberedList = true; }
    if (isTodo && !inTodoList) { html += '<ul class="todo-list">'; inTodoList = true; }

    html += blockToHtml(block);
  }

  if (inBulletList) html += "</ul>";
  if (inNumberedList) html += "</ol>";
  if (inTodoList) html += "</ul>";

  return html;
}

export async function archiveNotionDocument(notionId: string, archived: boolean): Promise<void> {
  await withRetry(() => notion.pages.update({
    page_id: notionId,
    archived,
  }));
}

// Search documents by content using Notion search API
export async function searchNotionDocuments(query: string): Promise<DocumentBase[]> {
  try {
    const response = await withRetry(() => notion.search({
      query,
      filter: { property: "object", value: "page" },
      page_size: 10,
    }));

    return response.results
      .filter((page) => "properties" in page)
      .map((page) => {
        const props = (page as { properties: Record<string, unknown> }).properties as Record<string, {
          rich_text?: Array<{ plain_text: string }>;
        }>;
        const storedType = props["Document type"]?.rich_text?.[0]?.plain_text;
        if (!storedType) return null; // Not a document we created
        return parseNotionPage(page as { id: string; url?: string; properties?: Record<string, unknown> }, storedType as DocumentType);
      })
      .filter((doc): doc is DocumentBase => doc !== null);
  } catch {
    return [];
  }
}

// Get page content as plain text (for bulk summary)
export async function getPageContent(pageId: string): Promise<string> {
  try {
    const response = await withRetry(() => notion.blocks.children.list({ block_id: pageId, page_size: 100 }));
    return response.results
      .map((block) => {
        const b = block as { type: string; [key: string]: unknown };
        const textBlock = b[b.type] as { rich_text?: Array<{ plain_text: string }> } | undefined;
        return textBlock?.rich_text?.map((t) => t.plain_text).join("") ?? "";
      })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "";
  }
}

// Update a Notion page's summary property
export async function updatePageSummary(pageId: string, samenvatting: string): Promise<void> {
  const properties = {
    Samenvatting: { rich_text: [{ text: { content: samenvatting } }] },
  };
  await withRetry(() => notion.pages.update({
    page_id: pageId,
    properties: properties as Parameters<typeof notion.pages.update>[0]["properties"],
  }));
}

export async function fetchNotionDocument(notionId: string): Promise<DocumentBase | null> {
  try {
    const page = await withRetry(() => notion.pages.retrieve({ page_id: notionId }));
    const props = (page as { properties: Record<string, unknown> }).properties as Record<string, {
      rich_text?: Array<{ plain_text: string }>;
    }>;
    const storedType = props["Document type"]?.rich_text?.[0]?.plain_text;
    const type = (storedType as DocumentType) ?? "intern";
    return parseNotionPage(page as { id: string; url?: string; properties?: Record<string, unknown> }, type);
  } catch {
    return null;
  }
}
