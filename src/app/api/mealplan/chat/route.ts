import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }, "/api/mealplan/chat");

export async function POST(req: NextRequest) {
  await requireAuth();

  const { bericht, huidigeVoorkeuren, huidigeUitsluitingen, chatHistorie } = await req.json() as {
    bericht: string;
    huidigeVoorkeuren: string;
    huidigeUitsluitingen: string;
    chatHistorie: { role: "user" | "ai"; text: string }[];
  };

  const historie = chatHistorie
    .map(m => `${m.role === "user" ? "Gebruiker" : "AI"}: ${m.text}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `Je bent een Nederlandse maaltijdplanner assistent. De gebruiker vertelt wat hij wil eten of niet wil eten.

Huidige voorkeuren: "${huidigeVoorkeuren || "geen"}"
Huidige uitsluitingen: "${huidigeUitsluitingen || "geen"}"

Eerdere chat:
${historie || "geen"}

Gebruiker zegt nu: "${bericht}"

Je taak:
1. Geef een kort, vriendelijk antwoord (1-2 zinnen, Nederlands) dat bevestigt wat je hebt begrepen
2. Update de voorkeuren en uitsluitingen op basis van ALLES wat de gebruiker tot nu toe heeft gezegd

Voorkeuren = dingen die de gebruiker WEL wil (specifieke gerechten, ingrediënten, stijlen, bereidingswijzen).
Bijv: "pasta pesto met kip, boter gebruiken bij bakken, Lidl protein shakes voor smoothies, kaas bij pasta, penne/fusilli als pasta"

Uitsluitingen = dingen die de gebruiker NIET wil.
Bijv: "geen spaghetti, geen cottage cheese, geen vis, geen quinoa"

BELANGRIJK: Neem ALLES mee — ook eerdere wensen uit de chathistorie. Bouw de lijst op, verwijder niets tenzij de gebruiker dat expliciet zegt.

Antwoord ALLEEN als JSON:
{
  "antwoord": "Kort bevestigend antwoord in het Nederlands",
  "voorkeuren": "Volledige bijgewerkte voorkeurenlijst als komma-gescheiden string",
  "uitsluitingen": "Volledige bijgewerkte uitsluitingenlijst als komma-gescheiden string"
}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json({ antwoord: "Sorry, ik kon dat niet verwerken. Probeer het anders te zeggen." });
  }

  const result = JSON.parse(jsonMatch[0]) as {
    antwoord: string;
    voorkeuren?: string;
    uitsluitingen?: string;
  };

  return NextResponse.json(result);
}
