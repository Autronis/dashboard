import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { Client } from "@notionhq/client";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { db } from "@/lib/db";
import { projecten } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

interface TodoTask {
  titel: string;
  done: boolean;
  fase: string;
}

function parseTodoMd(content: string): { taken: TodoTask[]; fases: string[] } {
  const lines = content.split("\n");
  const taken: TodoTask[] = [];
  const fases: string[] = [];
  let currentFase = "Algemeen";

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect fase headers: ## Fase 1: Setup, ## Setup, etc.
    const faseMatch = trimmed.match(/^#{1,3}\s+(?:Fase\s*\d+[:.]\s*)?(.+)/);
    if (faseMatch && !trimmed.startsWith("# TODO")) {
      currentFase = faseMatch[1].trim();
      if (!fases.includes(currentFase)) fases.push(currentFase);
      continue;
    }

    // Detect tasks: - [x] Done task, - [ ] Open task
    const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)/);
    if (taskMatch) {
      taken.push({
        titel: taskMatch[2].trim(),
        done: taskMatch[1] !== " ",
        fase: currentFase,
      });
    }
  }

  return { taken, fases };
}

// POST /api/projecten/[id]/sync-notion — sync TODO.md → Notion
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth: session or internal token
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const { id } = await params;
    const project = await db.select().from(projecten).where(eq(projecten.id, Number(id))).get();

    if (!project) {
      return NextResponse.json({ fout: "Project niet gevonden" }, { status: 404 });
    }

    if (!project.notionPageId) {
      return NextResponse.json({ fout: "Project heeft geen Notion page ID" }, { status: 400 });
    }

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) {
      return NextResponse.json({ fout: "NOTION_API_KEY niet geconfigureerd" }, { status: 500 });
    }

    const notion = new Client({ auth: notionKey });

    // 1. Read TODO.md from project directory
    let todoContent = "";
    if (project.projectDir) {
      try {
        todoContent = await readFile(path.join(project.projectDir, "TODO.md"), "utf-8");
      } catch {
        return NextResponse.json({ fout: "TODO.md niet gevonden in project directory" }, { status: 404 });
      }
    } else {
      return NextResponse.json({ fout: "Geen project directory geconfigureerd" }, { status: 400 });
    }

    // 2. Parse TODO.md
    const { taken, fases } = parseTodoMd(todoContent);
    const totalTaken = taken.length;
    const doneTaken = taken.filter((t) => t.done).length;
    const voortgang = totalTaken > 0 ? Math.round((doneTaken / totalTaken) * 100) : 0;

    // 3. Get existing Notion page content (to_do blocks)
    const existingBlocks = await notion.blocks.children.list({
      block_id: project.notionPageId,
      page_size: 100,
    });

    // Map existing to_do blocks by their text content
    const existingTodos = new Map<string, { id: string; checked: boolean }>();
    for (const block of existingBlocks.results) {
      if ("type" in block && block.type === "to_do" && "to_do" in block) {
        const text = block.to_do.rich_text.map((t) => t.plain_text).join("");
        existingTodos.set(text.toLowerCase().trim(), { id: block.id, checked: block.to_do.checked ?? false });
      }
    }

    // 4. Sync: update existing, collect new tasks
    let updated = 0;
    let added = 0;
    const newTasks: TodoTask[] = [];
    let lastFase = "";

    for (const task of taken) {
      const key = task.titel.toLowerCase().trim();
      const existing = existingTodos.get(key);

      if (existing) {
        if (existing.checked !== task.done) {
          await notion.blocks.update({
            block_id: existing.id,
            to_do: { checked: task.done },
          });
          updated++;
        }
      } else {
        newTasks.push(task);
        added++;
      }
    }

    // 4b. Generate descriptions for new tasks via Claude Haiku
    const descriptions = new Map<string, string>();
    if (newTasks.length > 0 && process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = Anthropic();
        const taskList = newTasks.map((t) => `- ${t.titel} (fase: ${t.fase})`).join("\n");
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: `Je bent een project-assistent voor "${project.naam}". Geef per taak een korte beschrijving (1 zin, max 15 woorden, Nederlands). Antwoord als JSON object met taak-titel als key en beschrijving als value.\n\nTaken:\n${taskList}`,
          }],
        });
        const text = msg.content[0].type === "text" ? msg.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
          for (const [key, val] of Object.entries(parsed)) {
            descriptions.set(key.toLowerCase().trim(), val);
          }
        }
      } catch {
        // If AI call fails, continue without descriptions
      }
    }

    // 4c. Build Notion blocks for new tasks
    const newBlocks: Parameters<typeof notion.blocks.children.append>[0]["children"] = [];
    for (const task of newTasks) {
      if (task.fase !== lastFase) {
        newBlocks.push({
          object: "block",
          type: "heading_3",
          heading_3: {
            rich_text: [{ type: "text", text: { content: task.fase } }],
          },
        });
        lastFase = task.fase;
      }

      const desc = descriptions.get(task.titel.toLowerCase().trim());
      const richText: Array<{ type: "text"; text: { content: string }; annotations?: { color: "gray" } }> = [
        { type: "text", text: { content: task.titel } },
      ];
      if (desc) {
        richText.push({ type: "text", text: { content: ` — ${desc}` }, annotations: { color: "gray" } });
      }

      newBlocks.push({
        object: "block",
        type: "to_do",
        to_do: {
          rich_text: richText,
          checked: task.done,
        },
      });
    }

    // Append new blocks
    if (newBlocks.length > 0) {
      await notion.blocks.children.append({
        block_id: project.notionPageId,
        children: newBlocks,
      });
    }

    // 5. Update Notion page properties (voortgang, status)
    const newStatus = voortgang === 100 ? "Afgerond" : voortgang > 0 ? "In Development" : "In Planning";
    try {
      await notion.pages.update({
        page_id: project.notionPageId,
        properties: {
          Status: { select: { name: newStatus } },
        },
      });
    } catch {
      // Properties might have different schema — skip
    }

    // 6. Update local DB voortgang
    await db.update(projecten).set({
      voortgangPercentage: voortgang,
      bijgewerktOp: new Date().toISOString(),
    }).where(eq(projecten.id, Number(id)));

    return NextResponse.json({
      succes: true,
      voortgang,
      totalTaken,
      doneTaken,
      updated,
      added,
      fases,
    });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekend" },
      { status: 500 }
    );
  }
}
