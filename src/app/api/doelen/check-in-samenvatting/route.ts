import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { aiComplete } from "@/lib/ai/client";

// POST /api/doelen/check-in-samenvatting — Claude 1-sentence check-in update
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as {
      doelTitel: string;
      voortgang: number;
      vorigeVoortgang?: number;
      doelwaarde?: number;
      wekenOver?: number;
      blocker?: string;
      volgendeStap?: string;
    };

    if (!body.doelTitel) {
      return NextResponse.json({ samenvatting: null });
    }

    const delta = body.vorigeVoortgang !== undefined ? body.voortgang - body.vorigeVoortgang : null;
    const context = [
      `Doel: "${body.doelTitel}"`,
      `Voortgang: ${body.voortgang}%${delta !== null ? ` (${delta >= 0 ? "+" : ""}${delta}% deze week)` : ""}`,
      body.wekenOver !== undefined ? `Nog ${body.wekenOver} weken te gaan` : null,
      body.blocker ? `Blocker: ${body.blocker}` : null,
      body.volgendeStap ? `Volgende stap: ${body.volgendeStap}` : null,
    ].filter(Boolean).join("\n");

    const result = await aiComplete({
      provider: "anthropic",
      system: "Je bent een OKR-coach. Geef een korte, motiverende 1-zin update over de voortgang. Wees concreet en gebruik de getallen. Max 120 tekens.",
      prompt: `${context}\n\nGeef één zin als voortgangsupdate voor dit doel.`,
      maxTokens: 100,
    });

    return NextResponse.json({ samenvatting: result.text.trim() });
  } catch {
    return NextResponse.json({ samenvatting: null });
  }
}
