import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROJECTS_BASE = "c:/Users/semmi/OneDrive/Claude AI/Projects";

// Block helpers
const h2 = (t) => ({ object: "block", type: "heading_2", heading_2: { rich_text: [{ type: "text", text: { content: t } }] } });
const h3 = (t) => ({ object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: t } }] } });
const p = (t) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: t } }] } });
const todo = (t, checked = false) => ({ object: "block", type: "to_do", to_do: { rich_text: [{ type: "text", text: { content: t } }], checked } });
const bullet = (t) => ({ object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: t } }] } });
const divider = () => ({ object: "block", type: "divider", divider: {} });

function readFile(path) {
  try { return readFileSync(path, "utf-8"); } catch { return null; }
}

async function clearPage(pageId) {
  let hasMore = true;
  while (hasMore) {
    const children = await notion.blocks.children.list({ block_id: pageId, page_size: 100 });
    for (const block of children.results) {
      await notion.blocks.delete({ block_id: block.id }).catch(() => {});
    }
    hasMore = children.has_more;
  }
}

async function appendBlocks(pageId, blocks) {
  for (let i = 0; i < blocks.length; i += 100) {
    await notion.blocks.children.append({ block_id: pageId, children: blocks.slice(i, i + 100) });
  }
}

async function enrichProject(projectDir, projectNaam) {
  const brief = readFile(join(projectDir, "PROJECT_BRIEF.md"));
  const todoContent = readFile(join(projectDir, "TODO.md"));

  if (!brief && !todoContent) return null;

  const prompt = `Je bent een projectmanager voor Autronis, een AI- en automatiseringsbureau.
Analyseer dit project en maak een gedetailleerd, professioneel projectplan.

PROJECT: ${projectNaam}

PROJECT BRIEF:
${brief || "(geen brief)"}

TODO/HUIDIGE TAKEN:
${todoContent || "(geen todo)"}

Genereer een JSON object met dit format:
{
  "samenvatting": "2-3 zinnen over wat het project doet en voor wie",
  "probleem": "Welk probleem lost dit op?",
  "doelgroep": "Voor wie is dit?",
  "techStack": ["Next.js", "TypeScript", ...],
  "geschatteDoorlooptijd": "X weken",
  "fases": [
    {
      "naam": "Fase 1 -- Naam",
      "beschrijving": "Wat wordt er in deze fase gebouwd en waarom",
      "geschatteDuur": "X dagen",
      "taken": [
        {
          "titel": "Korte titel",
          "beschrijving": "Gedetailleerde beschrijving van wat er moet gebeuren",
          "afgerond": true
        }
      ],
      "acceptatieCriteria": "Wanneer is deze fase klaar?"
    }
  ],
  "risicos": ["Risico 1 met uitleg", "Risico 2 met uitleg"],
  "openVragen": ["Vraag 1", "Vraag 2"],
  "volgendeStappen": ["Concrete volgende actie 1", "Concrete volgende actie 2"]
}

Regels:
- Gebruik de echte taken uit de TODO, niet verzonnen taken
- Markeer taken als afgerond (true) als ze [x] zijn in de TODO
- Beschrijvingen moeten specifiek en nuttig zijn, niet generiek
- Geen emoji's
- Nederlands
- Wees concreet over tech keuzes en implementatie details
- Alleen JSON, geen extra tekst`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  let jsonStr = textBlock.text.trim();
  // Try multiple extraction methods
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  // Find first { to last }
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(jsonStr);
}

function buildBlocks(enriched) {
  const blocks = [];

  // Overzicht
  blocks.push(h2("Overzicht"));
  blocks.push(p(enriched.samenvatting));
  blocks.push(divider());

  // Details
  blocks.push(h2("Details"));
  blocks.push(h3("Probleem"));
  blocks.push(p(enriched.probleem));
  blocks.push(h3("Doelgroep"));
  blocks.push(p(enriched.doelgroep));
  if (enriched.techStack && enriched.techStack.length > 0) {
    blocks.push(h3("Tech Stack"));
    blocks.push(p(enriched.techStack.join(", ")));
  }
  blocks.push(h3("Geschatte doorlooptijd"));
  blocks.push(p(enriched.geschatteDoorlooptijd));
  blocks.push(divider());

  // Fases
  for (const fase of enriched.fases) {
    blocks.push(h2(fase.naam));
    blocks.push(p(fase.beschrijving));
    if (fase.geschatteDuur) {
      blocks.push(p("Geschatte duur: " + fase.geschatteDuur));
    }

    for (const taak of fase.taken) {
      const label = taak.beschrijving
        ? taak.titel + "\n" + taak.beschrijving
        : taak.titel;
      blocks.push(todo(label, taak.afgerond === true));
    }

    if (fase.acceptatieCriteria) {
      blocks.push(p("Klaar wanneer: " + fase.acceptatieCriteria));
    }
    blocks.push(divider());
  }

  // Risico's
  if (enriched.risicos && enriched.risicos.length > 0) {
    blocks.push(h2("Risicos"));
    for (const r of enriched.risicos) {
      blocks.push(bullet(r));
    }
    blocks.push(divider());
  }

  // Open vragen
  if (enriched.openVragen && enriched.openVragen.length > 0) {
    blocks.push(h2("Open Vragen"));
    for (const v of enriched.openVragen) {
      blocks.push(bullet(v));
    }
    blocks.push(divider());
  }

  // Volgende stappen
  if (enriched.volgendeStappen && enriched.volgendeStappen.length > 0) {
    blocks.push(h2("Volgende Stappen"));
    for (const s of enriched.volgendeStappen) {
      blocks.push(todo(s, false));
    }
  }

  return blocks;
}

const projects = [
  { id: '328bd171-7d1d-8195-878e-d76033b79f55', naam: 'Agent Office / Ops Room', dir: 'agent-office--ops-room', status: 'In Development' },
  { id: '328bd171-7d1d-81cc-8db4-ccbc3035b738', naam: 'Investment Engine', dir: 'investment-engine', status: 'In Development' },
  { id: '328bd171-7d1d-8187-8634-fb4debc6059b', naam: 'Autronis Dashboard', dir: 'autronis-dashboard', status: 'In Development' },
];

async function run() {
  for (const project of projects) {
    const projectDir = join(PROJECTS_BASE, project.dir);
    console.log("Enriching: " + project.naam);

    try {
      const enriched = await enrichProject(projectDir, project.naam);
      if (!enriched) {
        console.log("  Skipped (no brief/todo)");
        continue;
      }

      const blocks = buildBlocks(enriched);

      console.log("  Clearing page...");
      await clearPage(project.id);

      console.log("  Writing " + blocks.length + " blocks...");
      await appendBlocks(project.id, blocks);

      // Count done/total
      const totalTaken = enriched.fases.reduce((sum, f) => sum + f.taken.length, 0);
      const doneTaken = enriched.fases.reduce((sum, f) => sum + f.taken.filter((t) => t.afgerond).length, 0);
      const pct = totalTaken > 0 ? Math.round((doneTaken / totalTaken) * 100) : 0;

      await notion.pages.update({
        page_id: project.id,
        properties: {
          Titel: { title: [{ text: { content: project.naam + " -- Projectplan" } }] },
          Status: { select: { name: project.status } },
          Samenvatting: { rich_text: [{ text: { content: pct + "% afgerond (" + doneTaken + "/" + totalTaken + " taken). " + enriched.samenvatting.slice(0, 150) } }] },
        },
      });

      console.log("  Done (" + pct + "%, " + doneTaken + "/" + totalTaken + " taken)");
    } catch (e) {
      console.error("  Error: " + e.message);
    }
  }
  console.log("\nAll plans enriched and updated");
}

run();
