import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";

// --- Types ---

interface EnrichedPlanParams {
  projectNaam: string;
  briefContent: string | null;
  todoContent: string | null;
  status?: string;
  prioriteit?: string;
  verantwoordelijke?: string;
  klantNaam?: string;
}

interface EnrichedTaak {
  titel: string;
  beschrijving: string;
}

interface EnrichedFase {
  naam: string;
  geschatteDuur: string;
  taken: EnrichedTaak[];
  acceptatieCriteria: string;
}

interface EnrichedPlan {
  probleem: string;
  geschatteDoorlooptijd: string;
  fases: EnrichedFase[];
  risicos: string[];
  openVragen: string[];
}

interface ParsedBrief {
  goal: string;
  techStack: string[];
  integrations: string[];
}

interface ParsedFase {
  naam: string;
  taken: string[];
}

// --- Block helpers ---

type NotionBlock = Record<string, unknown>;

function heading2(text: string): NotionBlock {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function heading3(text: string): NotionBlock {
  return {
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function paragraph(text: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function bulletedListItem(text: string): NotionBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function toDo(text: string, checked = false): NotionBlock {
  return {
    object: "block",
    type: "to_do",
    to_do: { rich_text: [{ type: "text", text: { content: text } }], checked },
  };
}

// --- Parsers ---

function parseBrief(content: string | null): ParsedBrief {
  if (!content) return { goal: "", techStack: [], integrations: [] };

  const lines = content.split("\n");
  let goal = "";
  const techStack: string[] = [];
  const integrations: string[] = [];

  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();
    const lowerTrimmed = trimmed.toLowerCase();

    if (lowerTrimmed.startsWith("## goal") || lowerTrimmed.startsWith("## doel")) {
      currentSection = "goal";
      continue;
    }
    if (lowerTrimmed.startsWith("## tech") || lowerTrimmed.startsWith("## stack")) {
      currentSection = "tech";
      continue;
    }
    if (lowerTrimmed.startsWith("## integrat") || lowerTrimmed.startsWith("## api") || lowerTrimmed.startsWith("## koppeling")) {
      currentSection = "integrations";
      continue;
    }
    if (trimmed.startsWith("## ")) {
      currentSection = "other";
      continue;
    }

    if (!trimmed) continue;

    switch (currentSection) {
      case "goal":
        if (!goal) goal = trimmed;
        else goal += " " + trimmed;
        break;
      case "tech": {
        const item = trimmed.replace(/^[-*]\s*/, "");
        if (item) techStack.push(item);
        break;
      }
      case "integrations": {
        const item = trimmed.replace(/^[-*]\s*/, "");
        if (item) integrations.push(item);
        break;
      }
    }
  }

  return { goal, techStack, integrations };
}

function parseTodo(content: string | null): ParsedFase[] {
  if (!content) return [];

  const lines = content.split("\n");
  const fases: ParsedFase[] = [];
  let currentFase: ParsedFase | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect phase headers like "Phase 1 - MVP: Config-Based Video Template" or "## Fase 1"
    const phaseMatch = trimmed.match(/^(?:#{1,3}\s*)?(?:Phase|Fase)\s+\d+\s*[-—:]\s*(.+)/i);
    if (phaseMatch) {
      currentFase = { naam: trimmed.replace(/^#{1,3}\s*/, ""), taken: [] };
      fases.push(currentFase);
      continue;
    }

    // Detect task lines: [ ] or [x]
    const taskMatch = trimmed.match(/^[-*]?\s*\[[ x]]\s*(.+)/i);
    if (taskMatch && currentFase) {
      currentFase.taken.push(taskMatch[1]);
    }
  }

  return fases;
}

// --- AI Enrichment ---

async function enrichWithClaude(
  briefContent: string | null,
  todoContent: string | null
): Promise<EnrichedPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!briefContent && !todoContent) return null;

  const anthropic = new Anthropic({ apiKey });

  const prompt = `Je bent een projectmanager voor Autronis. Analyseer dit project en verrijk het plan.

PROJECT BRIEF:
${briefContent || "(geen brief beschikbaar)"}

TODO/FASES:
${todoContent || "(geen todo beschikbaar)"}

Genereer JSON:
{
  "probleem": "wat lost dit op?",
  "geschatteDoorlooptijd": "2 weken",
  "fases": [
    {
      "naam": "Fase 1 — MVP: Config-Based Video Template",
      "geschatteDuur": "3 dagen",
      "taken": [
        {"titel": "Analyseer bestaande template", "beschrijving": "Lees autronis-demo-v3.jsx, identificeer alle hardcoded waarden"}
      ],
      "acceptatieCriteria": "Video rendert correct met externe config"
    }
  ],
  "risicos": ["..."],
  "openVragen": ["..."]
}
Alleen JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = textBlock.text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as EnrichedPlan;

    // Validate structure
    if (!parsed.probleem || !Array.isArray(parsed.fases)) return null;

    return parsed;
  } catch {
    return null;
  }
}

// --- Main function ---

export async function createEnrichedNotionPlan(params: EnrichedPlanParams): Promise<{
  notionId: string;
  notionUrl: string;
}> {
  const {
    projectNaam,
    briefContent,
    todoContent,
    status = "In Planning",
    prioriteit = "Normaal",
    verantwoordelijke = "Sem",
    klantNaam,
  } = params;

  const dbId = process.env.NOTION_DB_PLANNEN;
  if (!dbId) throw new Error("NOTION_DB_PLANNEN is niet geconfigureerd");

  const notion = new Client({ auth: process.env.NOTION_API_KEY });

  // Step 1: Parse brief
  const brief = parseBrief(briefContent);

  // Step 2: Parse todo
  const todoFases = parseTodo(todoContent);

  // Step 3: AI enrichment
  const enriched = await enrichWithClaude(briefContent, todoContent);

  // Step 4: Build properties
  const properties: Record<string, unknown> = {
    Titel: { title: [{ text: { content: projectNaam + " — Projectplan" } }] },
    Status: { select: { name: status } },
    "Aangemaakt door": { rich_text: [{ text: { content: verantwoordelijke } }] },
    "Aangemaakt op": { date: { start: new Date().toISOString().split("T")[0] } },
    "Document type": { rich_text: [{ text: { content: "plan" } }] },
    Samenvatting: { rich_text: [{ text: { content: "Projectplan voor " + projectNaam } }] },
  };

  // Prioriteit might not exist as a property in the database
  try {
    properties.Prioriteit = { select: { name: prioriteit } };
  } catch {
    // Property doesn't exist, skip
  }

  if (klantNaam) {
    properties.Klant = { rich_text: [{ text: { content: klantNaam } }] };
  }

  // Step 5: Build content blocks
  const blocks: NotionBlock[] = [];

  // --- Overzicht ---
  blocks.push(heading2("Overzicht"));
  if (brief.goal) {
    blocks.push(paragraph("Doel: " + brief.goal));
  }
  if (enriched?.probleem) {
    blocks.push(paragraph("Probleem: " + enriched.probleem));
  }
  if (enriched?.geschatteDoorlooptijd) {
    blocks.push(paragraph("Geschatte doorlooptijd: " + enriched.geschatteDoorlooptijd));
  }

  // Tech Stack
  if (brief.techStack.length > 0) {
    blocks.push(heading3("Tech Stack"));
    for (const item of brief.techStack) {
      blocks.push(bulletedListItem(item));
    }
  }

  // Integrations
  if (brief.integrations.length > 0) {
    blocks.push(heading3("Integrations & API's"));
    for (const item of brief.integrations) {
      blocks.push(bulletedListItem(item));
    }
  }

  // --- Fases ---
  if (enriched?.fases && enriched.fases.length > 0) {
    // Use enriched fases
    for (const fase of enriched.fases) {
      blocks.push(heading2("\u25B6 " + fase.naam + " (geschat: " + fase.geschatteDuur + ")"));
      for (const taak of fase.taken) {
        blocks.push(toDo(taak.titel + "\n\u2192 " + taak.beschrijving));
      }
      if (fase.acceptatieCriteria) {
        blocks.push(paragraph("\u2705 Klaar wanneer: " + fase.acceptatieCriteria));
      }
    }
  } else if (todoFases.length > 0) {
    // Fallback: use parsed todo fases without enrichment
    for (const fase of todoFases) {
      blocks.push(heading2("\u25B6 " + fase.naam));
      for (const taak of fase.taken) {
        blocks.push(toDo(taak));
      }
    }
  }

  // --- Risico's & Open Vragen ---
  if (enriched?.risicos?.length || enriched?.openVragen?.length) {
    blocks.push(heading2("Risico's & Open Vragen"));

    if (enriched.risicos && enriched.risicos.length > 0) {
      blocks.push(heading3("Risico's"));
      for (const r of enriched.risicos) {
        blocks.push(bulletedListItem(r));
      }
    }

    if (enriched.openVragen && enriched.openVragen.length > 0) {
      blocks.push(heading3("Open Vragen"));
      for (const v of enriched.openVragen) {
        blocks.push(bulletedListItem(v));
      }
    }
  }

  // Ensure at least one block
  if (blocks.length === 0) {
    blocks.push(paragraph("Projectplan voor " + projectNaam + " — nog geen inhoud beschikbaar."));
  }

  // Step 6: Create Notion page (batch blocks if > 100)
  const firstBatch = blocks.slice(0, 100);
  const remainingBatches: NotionBlock[][] = [];
  for (let i = 100; i < blocks.length; i += 100) {
    remainingBatches.push(blocks.slice(i, i + 100));
  }

  let response: { id: string; url: string };

  try {
    const result = await notion.pages.create({
      parent: { database_id: dbId },
      properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
      children: firstBatch as Parameters<typeof notion.pages.create>[0]["children"],
    });
    response = { id: result.id, url: (result as unknown as { url: string }).url };
  } catch (error) {
    // If Prioriteit property doesn't exist, retry without it
    if (
      error instanceof Error &&
      error.message.includes("Prioriteit")
    ) {
      delete properties.Prioriteit;
      const result = await notion.pages.create({
        parent: { database_id: dbId },
        properties: properties as Parameters<typeof notion.pages.create>[0]["properties"],
        children: firstBatch as Parameters<typeof notion.pages.create>[0]["children"],
      });
      response = { id: result.id, url: (result as unknown as { url: string }).url };
    } else {
      throw error;
    }
  }

  // Append remaining blocks in batches
  for (const batch of remainingBatches) {
    await notion.blocks.children.append({
      block_id: response.id,
      children: batch as Parameters<typeof notion.blocks.children.append>[0]["children"],
    });
  }

  return {
    notionId: response.id,
    notionUrl: response.url,
  };
}
