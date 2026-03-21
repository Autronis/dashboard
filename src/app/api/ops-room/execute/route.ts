import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_SPECIALIZATIONS, SPECIALIZATION_LABELS } from "@/components/ops-room/orchestrator-types";
import type { PlanTask, AgentSpecialization } from "@/components/ops-room/orchestrator-types";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// Agent names for personality
const AGENT_NAMES: Record<string, string> = {
  wout: "Wout", bas: "Bas", gabriel: "Gabriel", tijmen: "Tijmen",
  pedro: "Pedro", vincent: "Vincent", jones: "Jones", toby: "Toby",
  ari: "Ari", rodi: "Rodi", adam: "Adam", noah: "Noah",
  jack: "Jack", nikkie: "Nikkie", xia: "Xia", thijs: "Thijs",
  leonard: "Leonard", rijk: "Rijk", coen: "Coen", senna: "Senna",
};

function buildAgentPrompt(agentId: string, task: PlanTask, context: string): string {
  const name = AGENT_NAMES[agentId] ?? agentId;
  const spec = AGENT_SPECIALIZATIONS[agentId] ?? "frontend";
  const specLabel = SPECIALIZATION_LABELS[spec as AgentSpecialization] ?? spec;

  return `Je bent ${name}, een ${specLabel} specialist bij Autronis.

Je werkt aan het volgende project. Hier is de context:
${context}

Je huidige taak:
- Titel: ${task.titel}
- Beschrijving: ${task.beschrijving}
- Bestanden: ${task.bestanden.length > 0 ? task.bestanden.join(", ") : "Nog te bepalen"}

REGELS:
- Schrijf productie-klare code (TypeScript, Next.js, Tailwind)
- Geen \`any\` types
- Code in het Engels, UI-teksten in het Nederlands
- Geef je output als een JSON object:
{
  "bestanden": [
    {
      "pad": "src/pad/naar/bestand.ts",
      "actie": "create" | "edit",
      "inhoud": "volledige bestandsinhoud of diff"
    }
  ],
  "samenvatting": "Korte beschrijving van wat je gedaan hebt"
}

Geen extra tekst, alleen het JSON object.`;
}

function buildReviewPrompt(task: PlanTask, output: string): string {
  return `Je bent Toby, de Code Reviewer bij Autronis. Je bent een strenge maar eerlijke reviewer.

Bekijk de volgende output van een teamlid:

TAAK: ${task.titel}
BESCHRIJVING: ${task.beschrijving}

OUTPUT:
${output}

Beoordeel de code op:
1. TypeScript kwaliteit (geen any, goede types)
2. Functionaliteit (doet het wat gevraagd is?)
3. Code stijl (clean, DRY, geen console.log)
4. Security (geen kwetsbaarheden)

Reageer met een JSON object:
{
  "goedgekeurd": true | false,
  "score": 1-10,
  "feedback": "Je feedback",
  "issues": ["issue 1", "issue 2"]
}

Geen extra tekst.`;
}

// POST /api/ops-room/execute
// Body: { task: PlanTask, context: string, mode: "execute" | "review" }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
    }

    const body = await req.json();
    const { task, context, mode } = body as {
      task: PlanTask;
      context: string;
      mode: "execute" | "review";
    };

    if (!task || !mode) {
      return NextResponse.json({ fout: "task en mode zijn verplicht" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "API key niet geconfigureerd" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const systemPrompt = mode === "review"
      ? buildReviewPrompt(task, context)
      : buildAgentPrompt(task.agentId ?? "wout", task, context);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: mode === "review"
            ? "Review deze code output."
            : `Voer je taak uit: "${task.titel}"`,
        },
      ],
    });

    const rawText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON
    let result: Record<string, unknown>;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Geen JSON");
      result = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ fout: "Output parsing mislukt", raw: rawText }, { status: 500 });
    }

    return NextResponse.json({ result, tokens: message.usage });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekend";
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
