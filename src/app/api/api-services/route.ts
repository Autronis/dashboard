import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiServices } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// GET /api/api-services — alle services ophalen
export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select()
      .from(apiServices)
      .where(eq(apiServices.isActief, 1))
      .orderBy(asc(apiServices.categorie), asc(apiServices.volgorde));

    return NextResponse.json({ services: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}

// POST /api/api-services — nieuwe service toevoegen
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();

    if (!body.naam?.trim()) {
      return NextResponse.json({ fout: "Naam is verplicht" }, { status: 400 });
    }

    const slug = body.slug?.trim() || body.naam.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const [nieuw] = await db
      .insert(apiServices)
      .values({
        naam: body.naam.trim(),
        slug,
        categorie: body.categorie || "overig",
        omschrijving: body.omschrijving?.trim() || null,
        envVar: body.envVar?.trim() || null,
        dashboardUrl: body.dashboardUrl?.trim() || null,
        trackingType: body.trackingType || "geen",
        kostenType: body.kostenType || "infra",
        providerSlug: body.providerSlug?.trim() || null,
        icon: body.icon?.trim() || null,
        volgorde: body.volgorde ?? 0,
      })
      .returning();

    return NextResponse.json({ service: nieuw }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    if (message.includes("UNIQUE constraint")) {
      return NextResponse.json({ fout: "Een service met deze slug bestaat al" }, { status: 409 });
    }
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}
