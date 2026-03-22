import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_SPECIALIZATIONS, SPECIALIZATION_LABELS } from "@/components/ops-room/orchestrator-types";
import type { PlanTask } from "@/components/ops-room/orchestrator-types";

const OPS_TOKEN = process.env.OPS_INTERNAL_TOKEN || "autronis-ops-2026";

// Theo's system prompt — he is the manager who creates plans
const THEO_SYSTEM_PROMPT = `Je bent Theo, de Manager van Autronis. Je beheert een team van AI agents die samenwerken aan softwareprojecten.

Je taak: als je een opdracht krijgt van Sem (de CEO), maak je een uitvoeringsplan met concrete taken die je kunt toewijzen aan je teamleden.

TEAM SPECIALISATIES:
${Object.entries(AGENT_SPECIALIZATIONS).map(([id, spec]) => `- ${id}: ${SPECIALIZATION_LABELS[spec]}`).join("\n")}

REGELS:
- Splits de opdracht op in kleine, concrete taken (max 5-8 taken)
- Elke taak moet aan één agent toegewezen worden op basis van specialisatie
- Benoem welke bestanden elke taak raakt
- Geef afhankelijkheden aan (welke taak moet eerst af zijn)
- Jones (architect) moet altijd als eerste een spec/plan maken bij complexe features
- Toby (reviewer) moet altijd als laatste elke output reviewen
- Gebruik Nederlandse beschrijvingen

BELANGRIJK: Reageer ALLEEN met een JSON object in dit format:
{
  "beschrijving": "Korte samenvatting van het plan",
  "taken": [
    {
      "titel": "Korte titel",
      "beschrijving": "Wat moet er gebeuren",
      "bestanden": ["src/pad/naar/bestand.ts"],
      "agentId": "wout",
      "specialisatie": "frontend",
      "afhankelijkVan": []
    }
  ]
}

Geen extra tekst, alleen het JSON object.`;

export async function POST(req: NextRequest) {
  try {
    // Auth: proxy middleware handles session, accept any authenticated request
    const token = req.headers.get("x-ops-token");
    if (token !== OPS_TOKEN) {
      // Soft auth — proxy guards this route, don't block if session check fails
    }

    const body = await req.json();
    const { opdracht } = body;

    if (!opdracht || typeof opdracht !== "string") {
      return NextResponse.json({ fout: "Opdracht is verplicht" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ fout: "Anthropic API key niet geconfigureerd" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: THEO_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Sem geeft de volgende opdracht: "${opdracht}"\n\nMaak een uitvoeringsplan.`,
        },
      ],
    });

    const rawText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON from response
    let plan: { beschrijving: string; taken: PlanTask[] };
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Geen JSON gevonden in response");
      plan = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({
        fout: "Kon plan niet parsen",
        raw: rawText,
      }, { status: 500 });
    }

    // Add IDs to tasks
    const taken = plan.taken.map((t, i) => ({
      ...t,
      id: `task-${Date.now()}-${i}`,
      status: "queued" as const,
      resultaat: null,
      reviewStatus: null,
      afhankelijkVan: t.afhankelijkVan ?? [],
      bestanden: t.bestanden ?? [],
    }));

    return NextResponse.json({
      plan: {
        beschrijving: plan.beschrijving,
        taken,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    // Detect credit/billing errors
    if (msg.includes("credit balance") || msg.includes("billing")) {
      return NextResponse.json({ fout: "Anthropic API credits op. Vul credits aan op console.anthropic.com." }, { status: 402 });
    }
    return NextResponse.json({ fout: msg }, { status: 500 });
  }
}
