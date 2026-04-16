import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taken, slimmeTakenTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, inArray } from "drizzle-orm";
import { fillPromptTemplate, fillNaamTemplate, ensureSystemTemplates } from "@/lib/slimme-taken";
import { findVrijSlot, getBlockingIntervalsVoorDag, formatSlotToIso } from "@/lib/agenda-slot-finder";

// GET /api/taken/slim — lijst van beschikbare slimme taken templates (uit DB)
export async function GET() {
  try {
    await requireAuth();

    // Sync DB met de lib: deprecate oude slugs + upsert system templates.
    // Idempotent, runt bij elke GET zodat een code-update direct zichtbaar is.
    await ensureSystemTemplates();

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
// Body (single):  { templateId: string, velden?: Record<string, string>, deadline?: string, ingeplandVoor?: string, startTijd?: string, duur?: number }
// Body (bulk):    { bulk: Array<{ templateId: string, velden?: Record<string, string> }>, deadline?: string, ingeplandVoor?: string, startTijd?: string }
//
// ingeplandVoor: ISO datum (YYYY-MM-DD) — als gezet wordt de taak direct
// gepland op die datum. startTijd (HH:MM, default "08:00") bepaalt de
// gewenste starttijd. duur (minuten) overschrijft template geschatteDuur.
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json()) as {
      templateId?: string;
      velden?: Record<string, string>;
      deadline?: string | null;
      ingeplandVoor?: string | null;
      startTijd?: string | null;
      duur?: number | null;
      stappen?: string[] | null;
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

    const aangemaakt: Array<{ id: number; titel: string; cluster: string; start?: string; eind?: string }> = [];
    const fouten: string[] = [];

    // Als ingeplandVoor is gezet, laad eenmalig de bestaande blocking
    // intervals zodat we anti-overlap kunnen doen. Bij bulk creates voegen
    // we elk nieuw slot toe aan de blockers zodat ze niet op elkaar
    // landen.
    const blockers = body.ingeplandVoor
      ? await getBlockingIntervalsVoorDag(body.ingeplandVoor)
      : [];

    for (const req of requests) {
      const template = templateBySlug.get(req.templateId);
      if (!template) {
        fouten.push(`Template '${req.templateId}' niet gevonden`);
        continue;
      }

      // Validate velden — bij quick-plan (ingeplandVoor gezet) zijn velden
      // optioneel zodat je een template snel kan plannen zonder alles in te
      // vullen. Lege placeholders worden dan gewoon niet ingevuld.
      const veldenDefinitie: Array<{ key: string; label: string }> = template.velden
        ? JSON.parse(template.velden)
        : [];
      if (!body.ingeplandVoor) {
        let validatieFout = false;
        for (const veld of veldenDefinitie) {
          if (!req.velden[veld.key]?.trim()) {
            fouten.push(`Veld '${veld.label}' is verplicht voor '${template.naam}'`);
            validatieFout = true;
            break;
          }
        }
        if (validatieFout) continue;
      }

      const titel = fillNaamTemplate(template.naam, req.velden);
      const prompt = fillPromptTemplate(template.prompt, req.velden);

      // Als ingeplandVoor is gezet: zoek een vrij slot via de shared
      // anti-overlap helper. Start vanaf 08:00, schuift door bij elke
      // botsing met bestaande ingeplande items of items die we in deze
      // call al hebben gepland.
      let ingeplandStart: string | null = null;
      let ingeplandEind: string | null = null;
      if (body.ingeplandVoor) {
        const duurMin = body.duur ?? template.geschatteDuur ?? 15;
        const gewensteStart = body.startTijd ?? "08:00";
        const slot = findVrijSlot(body.ingeplandVoor, gewensteStart, duurMin, blockers);
        if (slot) {
          ingeplandStart = formatSlotToIso(slot.start);
          ingeplandEind = formatSlotToIso(slot.eind);
          // Voeg dit slot toe als blocker zodat volgende bulk items er
          // niet op landen
          blockers.push({
            start: slot.start,
            eind: slot.eind,
            label: titel,
          });
        }
        // Als er geen vrij slot is (dag vol) laten we ingeplandStart/Eind
        // op null staan — de taak wordt aangemaakt zonder tijd en kan
        // later handmatig worden ingepland.
      }

      // Bouw omschrijving: template beschrijving + AI stappenplan indien aanwezig
      let omschrijving = template.beschrijving ?? "";
      if (body.stappen && body.stappen.length > 0) {
        const stappenTekst = body.stappen.map((s, i) => `${i + 1}. ${s}`).join("\n");
        omschrijving = omschrijving
          ? `${omschrijving}\n\n**Stappenplan:**\n${stappenTekst}`
          : `**Stappenplan:**\n${stappenTekst}`;
      }

      const [nieuw] = await db
        .insert(taken)
        .values({
          projectId: null,
          aangemaaktDoor: gebruiker.id,
          toegewezenAan: null,
          eigenaar: "vrij",
          titel,
          omschrijving,
          cluster: template.cluster,
          fase: "Slimme taken",
          status: "open",
          prioriteit: "normaal",
          uitvoerder: "claude",
          prompt,
          geschatteDuur: body.duur ?? template.geschatteDuur,
          deadline: body.deadline || null,
          ingeplandStart,
          ingeplandEind,
        })
        .returning();

      aangemaakt.push({
        id: nieuw.id,
        titel: nieuw.titel,
        cluster: nieuw.cluster ?? "",
        start: nieuw.ingeplandStart ?? undefined,
        eind: nieuw.ingeplandEind ?? undefined,
      });
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
