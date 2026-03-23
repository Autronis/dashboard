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

function contentToBlocks(content: string): Array<Record<string, unknown>> {
  return content.split("\n\n").map((paragraph) => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: paragraph } }],
    },
  }));
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

  // Try with Klant/Project properties first, retry without if they don't exist in Notion
  let response;
  try {
    response = await withRetry(() => notion.pages.create({
      parent: { database_id: dbId },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      children: contentToBlocks(payload.content) as Parameters<typeof notion.pages.create>[0]["children"],
    }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("is not a property that exists")) {
      // Remove properties that don't exist in the Notion database
      delete properties.Klant;
      delete properties.Project;
      response = await withRetry(() => notion.pages.create({
        parent: { database_id: dbId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
        children: contentToBlocks(payload.content) as Parameters<typeof notion.pages.create>[0]["children"],
      }));
    } else {
      throw err;
    }
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
