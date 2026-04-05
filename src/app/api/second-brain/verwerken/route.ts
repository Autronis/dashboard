import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { secondBrainItems } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const anthropic = Anthropic();

async function genereerAiVelden(
  inhoud: string,
  type: string
): Promise<{ titel: string; samenvatting: string; tags: string[] }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `Analyseer dit ${type} item en geef JSON terug met exact deze velden:
- "titel": korte titel (max 60 tekens)
- "samenvatting": samenvatting in 1-2 zinnen
- "tags": array van relevante tags uit deze opties: technologie, klant, idee, geleerde-les, tool, referentie, proces, inspiratie. Voeg ook vrije tags toe die relevant zijn.

Inhoud:
${inhoud.slice(0, 2000)}

Antwoord alleen met valid JSON, geen andere tekst.`,
      },
    ],
  });

  const raw =
    response.content[0].type === "text" ? response.content[0].text : "";
  const text = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(text);
  return {
    titel: parsed.titel || "Zonder titel",
    samenvatting: parsed.samenvatting || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

async function verwerkAiAsync(itemId: number, inhoud: string, type: string) {
  try {
    const ai = await genereerAiVelden(inhoud, type);
    await db
      .update(secondBrainItems)
      .set({
        titel: ai.titel,
        aiSamenvatting: ai.samenvatting,
        aiTags: JSON.stringify(ai.tags),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(secondBrainItems.id, itemId));
  } catch {
    // AI verwerking is best-effort, item bestaat al
  }
}

export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const contentType = req.headers.get("content-type") || "";

    // URL verwerking
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { bronUrl } = body;

      if (!bronUrl) {
        return NextResponse.json(
          { fout: "bron_url is verplicht" },
          { status: 400 }
        );
      }

      // Fetch URL metadata
      let titel = bronUrl;
      let beschrijving = "";
      try {
        const res = await fetch(bronUrl, {
          headers: { "User-Agent": "Autronis-SecondBrain/1.0" },
          signal: AbortSignal.timeout(5000),
        });
        const html = await res.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) titel = titleMatch[1].trim();
        const descMatch = html.match(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
        );
        if (descMatch) beschrijving = descMatch[1].trim();
      } catch {
        // URL niet bereikbaar, gebruik raw URL als titel
      }

      const [item] = await db
        .insert(secondBrainItems)
        .values({
          gebruikerId: gebruiker.id,
          type: "url",
          titel,
          inhoud: beschrijving || null,
          bronUrl,
        })
        .returning();

      // AI verwerking async (fire-and-forget)
      const aiInhoud = `URL: ${bronUrl}\nTitel: ${titel}\nBeschrijving: ${beschrijving}`;
      verwerkAiAsync(item.id, aiInhoud, "url");

      return NextResponse.json({ item }, { status: 201 });
    }

    // Bestand upload
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { fout: "Bestand en type zijn verplicht" },
        { status: 400 }
      );
    }

    // Save file
    const uploadDir = path.join(process.cwd(), "data", "uploads", "second-brain");
    await mkdir(uploadDir, { recursive: true });
    const timestamp = Date.now();
    const veiligNaam = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const bestandNaam = `${timestamp}-${veiligNaam}`;
    const bestandPad = path.join(uploadDir, bestandNaam);
    const bytes = await file.arrayBuffer();
    await writeFile(bestandPad, Buffer.from(bytes));

    const relatievePad = `/data/uploads/second-brain/${bestandNaam}`;

    const [item] = await db
      .insert(secondBrainItems)
      .values({
        gebruikerId: gebruiker.id,
        type: type as "tekst" | "url" | "afbeelding" | "pdf" | "code",
        titel: file.name,
        bestandPad: relatievePad,
      })
      .returning();

    // AI verwerking async voor afbeeldingen (Vision API)
    if (type === "afbeelding") {
      const base64 = Buffer.from(bytes).toString("base64");
      const mediaType = file.type as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp";

      (async () => {
        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: base64 },
                  },
                  {
                    type: "text",
                    text: `Beschrijf deze afbeelding en geef JSON terug met:
- "titel": korte beschrijvende titel (max 60 tekens)
- "samenvatting": wat is er te zien in 1-2 zinnen
- "tags": relevante tags uit: technologie, klant, idee, geleerde-les, tool, referentie, proces, inspiratie + vrije tags
Antwoord alleen met valid JSON.`,
                  },
                ],
              },
            ],
          });

          const raw =
            response.content[0].type === "text" ? response.content[0].text : "";
          const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          await db
            .update(secondBrainItems)
            .set({
              titel: parsed.titel || file.name,
              aiSamenvatting: parsed.samenvatting || "",
              aiTags: JSON.stringify(parsed.tags || []),
              bijgewerktOp: new Date().toISOString(),
            })
            .where(eq(secondBrainItems.id, item.id));
        } catch {
          // Vision verwerking is best-effort
        }
      })();
    } else if (type === "pdf") {
      verwerkAiAsync(item.id, `PDF bestand: ${file.name}`, "pdf");
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
