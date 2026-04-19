import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slimmeTakenTemplates } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { ensureSystemTemplates } from "@/lib/slimme-taken";

// GET /api/taken/slim/templates
// Returnt alle actieve templates uit DB. Sync system templates met de
// lib bij elke call (idempotent).
export async function GET() {
  try {
    await requireAuth();

    // Sync: deprecate oude slugs + upsert huidige system templates
    await ensureSystemTemplates();

    const rows = await db
      .select()
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.isActief, 1))
      .orderBy(desc(slimmeTakenTemplates.isSysteem), slimmeTakenTemplates.naam);

    // Parse velden JSON terug naar array
    const templates = rows.map((r) => ({
      ...r,
      velden: r.velden ? JSON.parse(r.velden) : null,
    }));

    return NextResponse.json({ templates });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// POST /api/taken/slim/templates — nieuwe custom template aanmaken
// Body: { naam, beschrijving?, cluster, geschatteDuur?, prompt, velden? }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuth();
    const body = (await req.json()) as {
      naam?: string;
      beschrijving?: string;
      cluster?: string;
      geschatteDuur?: number;
      prompt?: string;
      velden?: Array<{ key: string; label: string; placeholder?: string; type?: string }>;
      recurringDayOfWeek?: number | null;
      uitvoerder?: "claude" | "handmatig";
    };

    if (!body.naam?.trim()) {
      return NextResponse.json({ fout: "naam is verplicht" }, { status: 400 });
    }
    const uitvoerder = body.uitvoerder === "handmatig" ? "handmatig" : "claude";
    // Voor Claude templates is prompt verplicht — Claude moet iets
    // uitvoerbaars hebben. Voor handmatige templates kan prompt leeg of
    // een checklist zijn; we slaan alsnog iets op zodat de kolom NOT NULL
    // constraint niet klapt.
    if (uitvoerder === "claude" && !body.prompt?.trim()) {
      return NextResponse.json({ fout: "prompt is verplicht voor Claude templates" }, { status: 400 });
    }
    const VALID_CLUSTERS = ["backend-infra", "frontend", "klantcontact", "content", "admin", "research"];
    if (!body.cluster || !VALID_CLUSTERS.includes(body.cluster)) {
      return NextResponse.json(
        { fout: `cluster moet een van ${VALID_CLUSTERS.join(", ")} zijn` },
        { status: 400 }
      );
    }

    // Generate slug uit naam
    const slug = body.naam
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    // Check uniek
    const bestaand = await db
      .select({ id: slimmeTakenTemplates.id })
      .from(slimmeTakenTemplates)
      .where(eq(slimmeTakenTemplates.slug, slug))
      .limit(1);
    if (bestaand.length > 0) {
      return NextResponse.json(
        { fout: `Template met slug '${slug}' bestaat al — kies andere naam` },
        { status: 409 }
      );
    }

    const [nieuw] = await db
      .insert(slimmeTakenTemplates)
      .values({
        slug,
        naam: body.naam.trim(),
        beschrijving: body.beschrijving?.trim() || null,
        cluster: body.cluster as "backend-infra" | "frontend" | "klantcontact" | "content" | "admin" | "research",
        geschatteDuur: body.geschatteDuur ?? 15,
        prompt: body.prompt?.trim() || "",
        velden: body.velden && body.velden.length > 0 ? JSON.stringify(body.velden) : null,
        isSysteem: 0,
        isActief: 1,
        recurringDayOfWeek: body.recurringDayOfWeek ?? null,
        uitvoerder,
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    return NextResponse.json({ template: nieuw }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
