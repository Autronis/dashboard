import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { SLIMME_TAKEN, getSlimmeTaakById, fillPromptTemplate, fillNaamTemplate } from "@/lib/slimme-taken";

// GET /api/taken/slim — lijst van beschikbare slimme taken
export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({ templates: SLIMME_TAKEN });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/taken/slim — maak een slimme taak aan
// Body: { templateId: string, velden: Record<string, string>, deadline?: string }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json()) as {
      templateId?: string;
      velden?: Record<string, string>;
      deadline?: string | null;
    };

    if (!body.templateId) {
      return NextResponse.json({ fout: "templateId is verplicht" }, { status: 400 });
    }

    const template = getSlimmeTaakById(body.templateId);
    if (!template) {
      return NextResponse.json({ fout: `Slimme taak '${body.templateId}' niet gevonden` }, { status: 404 });
    }

    const veldWaarden = body.velden ?? {};

    // Validate: alle verplichte velden moeten gevuld zijn
    if (template.velden && template.velden.length > 0) {
      for (const veld of template.velden) {
        if (!veldWaarden[veld.key]?.trim()) {
          return NextResponse.json(
            { fout: `Veld '${veld.label}' is verplicht voor deze slimme taak` },
            { status: 400 }
          );
        }
      }
    }

    // Fill templates
    const titel = fillNaamTemplate(template.naam, veldWaarden);
    const prompt = fillPromptTemplate(template.prompt, veldWaarden);

    // Insert als losse taak (geen project) — eigenaar 'vrij' zodat beiden
    // 'm kunnen pakken. Cluster wordt uit de template overgenomen.
    const [nieuw] = await db
      .insert(taken)
      .values({
        projectId: null,
        aangemaaktDoor: gebruiker.id,
        toegewezenAan: null, // Niet direct aan iemand toewijzen — beiden mogen 'm pakken
        eigenaar: "vrij",
        titel,
        omschrijving: template.beschrijving,
        cluster: template.cluster,
        fase: "Slimme taken",
        status: "open",
        prioriteit: "normaal",
        uitvoerder: "claude",
        prompt,
        geschatteDuur: template.geschatteDuur,
        deadline: body.deadline || null,
      })
      .returning();

    return NextResponse.json({ taak: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
