import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiServices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

// PUT /api/api-services/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {
      bijgewerktOp: new Date().toISOString(),
    };
    if (body.naam !== undefined) updateData.naam = body.naam.trim();
    if (body.slug !== undefined) updateData.slug = body.slug.trim();
    if (body.categorie !== undefined) updateData.categorie = body.categorie;
    if (body.omschrijving !== undefined) updateData.omschrijving = body.omschrijving?.trim() || null;
    if (body.envVar !== undefined) updateData.envVar = body.envVar?.trim() || null;
    if (body.dashboardUrl !== undefined) updateData.dashboardUrl = body.dashboardUrl?.trim() || null;
    if (body.trackingType !== undefined) updateData.trackingType = body.trackingType;
    if (body.kostenType !== undefined) updateData.kostenType = body.kostenType;
    if (body.providerSlug !== undefined) updateData.providerSlug = body.providerSlug?.trim() || null;
    if (body.icon !== undefined) updateData.icon = body.icon?.trim() || null;
    if (body.volgorde !== undefined) updateData.volgorde = body.volgorde;

    const [bijgewerkt] = await db
      .update(apiServices)
      .set(updateData)
      .where(eq(apiServices.id, Number(id)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Service niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ service: bijgewerkt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}

// DELETE /api/api-services/[id] (soft delete)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    await db
      .update(apiServices)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(apiServices.id, Number(id)));

    return NextResponse.json({ succes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json({ fout: message }, { status: message === "Niet geauthenticeerd" ? 401 : 500 });
  }
}
