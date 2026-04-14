import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, slimmeTakenTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { fillPromptTemplate, fillNaamTemplate, seedSystemTemplates } from "@/lib/slimme-taken";

// GET /api/taken/slim — lijst van beschikbare slimme taken templates (uit DB)
export async function GET() {
  try {
    await requireAuth();

    const bestaand = await db
      .select({ id: slimmeTakenTemplates.id })
      .from(slimmeTakenTemplates)
      .limit(1);
    if (bestaand.length === 0) {
      await seedSystemTemplates();
    }

    const rows = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.isActief, 1))
      .orderBy(slimmeTakenTemplates.naam);

    // Back-compat shape: include id=slug zodat de oude frontend niet breekt
    const templates = rows.map((r) => ({
      id: r.slug,
      dbId: r.id,
      slug: r.slug,
      naam: r.naam,
      beschrijving: r.beschrijving,
      cluster: r.cluster,
      geschatteDuur: r.geschatteDuur,
      prompt: r.prompt,
      velden: r.velden ? JSON.parse(r.velden) : null,
      isSysteem: r.isSysteem === 1,
      recurringDayOfWeek: r.recurringDayOfWeek,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/taken/slim — maak één of meerdere slimme taken aan uit templates
// Body (single):  { templateId: string, velden?: Record<string, string>, deadline?: string }
// Body (bulk):    { bulk: Array<{ templateId: string, velden?: Record<string, string> }>, deadline?: string }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json()) as {
      templateId?: string;
      velden?: Record<string, string>;
      deadline?: string | null;
      bulk?: Array<{ templateId: string; velden?: Record<string, string> }>;
    };

    // Normaliseer naar bulk formaat
    const requests: Array<{ templateId: string; velden: Record<string, string> }> =
      body.bulk && body.bulk.length > 0
        ? body.bulk.map((b) => ({ templateId: b.templateId, velden: b.velden ?? {} }))
        : body.templateId
          ? [{ templateId: body.templateId, velden: body.velden ?? {} }]
          : [];

    if (requests.length === 0) {
      return NextResponse.json({ fout: "templateId of bulk array is verplicht" }, { status: 400 });
    }

    // Fetch alle template slugs in één query
    const slugs = requests.map((r) => r.templateId);
    const templates = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(inArray(slimmeTakenTemplates.slug, slugs));
    const templateBySlug = new Map(templates.map((t) => [t.slug, t]));

    const aangemaakt: Array<{ id: number; titel: string; cluster: string }> = [];
    const fouten: string[] = [];

    for (const req of requests) {
      const template = templateBySlug.get(req.templateId);
      if (!template) {
        fouten.push(`Template '${req.templateId}' niet gevonden`);
        continue;
      }

      // Validate velden
      const veldenDefinitie: Array<{ key: string; label: string }> = template.velden
        ? JSON.parse(template.velden)
        : [];
      let validatieFout = false;
      for (const veld of veldenDefinitie) {
        if (!req.velden[veld.key]?.trim()) {
          fouten.push(`Veld '${veld.label}' is verplicht voor '${template.naam}'`);
          validatieFout = true;
          break;
        }
      }
      if (validatieFout) continue;

      const titel = fillNaamTemplate(template.naam, req.velden);
      const prompt = fillPromptTemplate(template.prompt, req.velden);

      const [nieuw] = await db
        .insert(taken)
        .values({
          projectId: null,
          aangemaaktDoor: gebruiker.id,
          toegewezenAan: null,
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

      aangemaakt.push({ id: nieuw.id, titel: nieuw.titel, cluster: nieuw.cluster ?? "" });
    }

    // Back-compat: single template → returnt { taak }
    if (requests.length === 1 && aangemaakt.length === 1) {
      return NextResponse.json({ taak: aangemaakt[0], aangemaakt, fouten }, { status: 201 });
    }

    return NextResponse.json({ aangemaakt, fouten }, { status: aangemaakt.length > 0 ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
