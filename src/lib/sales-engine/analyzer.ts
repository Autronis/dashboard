import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import type { ScrapeResult } from "./scraper";
import { buildAnalysisPrompt, type CalComContext } from "./prompts";

export type KansCategorie = "lead_gen" | "communicatie" | "administratie" | "data" | "content" | "workflow" | "crm" | "e-commerce" | "marketing" | "klantenservice" | "facturatie" | "planning";

export interface AnalysisResult {
  bedrijfsProfiel: {
    branche: string;
    watZeDoen: string;
    doelgroep: string;
  };
  kansen: Array<{
    titel: string;
    beschrijving: string;
    categorie: KansCategorie;
    impact: "hoog" | "midden" | "laag";
    geschatteTijdsbesparing: string;
    geschatteKosten: string;
    geschatteBesparing: string;
    implementatieEffort: "laag" | "midden" | "hoog";
    prioriteit: number;
  }>;
  samenvatting: string;
  automationReadinessScore: number;
  concurrentiePositie: string;
  aanbevolenPakket: "starter" | "business" | "enterprise";
}

export async function analyzeWithClaude(
  scrapeResult: ScrapeResult,
  context: CalComContext
): Promise<AnalysisResult> {
  const client = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildAnalysisPrompt(scrapeResult, context);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonStr = responseText.replace(/```json\n?|\n?```/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr) as AnalysisResult;

    if (!parsed.bedrijfsProfiel?.branche || !parsed.kansen?.length || !parsed.samenvatting || typeof parsed.automationReadinessScore !== "number") {
      throw new Error("Onvolledige AI response");
    }

    return parsed;
  } catch (parseError) {
    throw new Error(
      `AI analyse kon niet worden geparsed: ${parseError instanceof Error ? parseError.message : "onbekend"}`
    );
  }
}
