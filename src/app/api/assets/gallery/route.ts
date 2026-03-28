import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assetGallery, projecten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, and, like, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { /* proxy auth */ }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const projectId = searchParams.get("projectId");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");
  const favoriet = searchParams.get("favoriet");

  try {
    const conditions = [];
    if (type) conditions.push(eq(assetGallery.type, type as "scroll-stop" | "logo-animatie"));
    if (projectId) conditions.push(eq(assetGallery.projectId, Number(projectId)));
    if (tag) conditions.push(like(assetGallery.tags, `%${tag}%`));
    if (search) conditions.push(like(assetGallery.productNaam, `%${search}%`));
    if (favoriet === "1") conditions.push(eq(assetGallery.isFavoriet, 1));

    const items = await db
      .select({
        id: assetGallery.id,
        type: assetGallery.type,
        productNaam: assetGallery.productNaam,
        eindEffect: assetGallery.eindEffect,
        manifest: assetGallery.manifest,
        promptA: assetGallery.promptA,
        promptB: assetGallery.promptB,
        promptVideo: assetGallery.promptVideo,
        afbeeldingUrl: assetGallery.afbeeldingUrl,
        videoUrl: assetGallery.videoUrl,
        lokaalPad: assetGallery.lokaalPad,
        projectId: assetGallery.projectId,
        projectNaam: projecten.naam,
        tags: assetGallery.tags,
        isFavoriet: assetGallery.isFavoriet,
        aangemaaktOp: assetGallery.aangemaaktOp,
      })
      .from(assetGallery)
      .leftJoin(projecten, eq(assetGallery.projectId, projecten.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(assetGallery.aangemaaktOp));

    // Get all unique tags
    const allTags = new Set<string>();
    for (const item of items) {
      if (item.tags) {
        item.tags.split(",").map(t => t.trim()).filter(Boolean).forEach(t => allTags.add(t));
      }
    }

    return NextResponse.json({ items, allTags: Array.from(allTags).sort() });
  } catch (error) {
    return NextResponse.json(
      { items: [], allTags: [], fout: error instanceof Error ? error.message : "Kon galerij niet laden" },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch { /* proxy auth */ }

  try {
    const body = await req.json() as {
      type: "scroll-stop" | "logo-animatie";
      productNaam: string;
      eindEffect?: string;
      manifest?: string;
      promptA?: string;
      promptB?: string;
      promptVideo?: string;
      afbeeldingUrl?: string;
      videoUrl?: string;
      projectId?: number;
      tags?: string;
    };

    if (!body.productNaam || !body.type) {
      return NextResponse.json({ fout: "type en productNaam zijn verplicht" }, { status: 400 });
    }

    let lokaalPad: string | undefined;
    if (body.afbeeldingUrl) {
      try {
        const uploadsDir = path.join(process.cwd(), "data", "uploads", "assets");
        fs.mkdirSync(uploadsDir, { recursive: true });
        const fileName = `asset_${Date.now()}.png`;
        const filePath = path.join(uploadsDir, fileName);
        const imgRes = await fetch(body.afbeeldingUrl);
        if (imgRes.ok) {
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(filePath, buffer);
          lokaalPad = `data/uploads/assets/${fileName}`;
        }
      } catch { /* ignore */ }
    }

    const [item] = await db.insert(assetGallery).values({
      type: body.type,
      productNaam: body.productNaam,
      eindEffect: body.eindEffect,
      manifest: body.manifest,
      promptA: body.promptA,
      promptB: body.promptB,
      promptVideo: body.promptVideo,
      afbeeldingUrl: body.afbeeldingUrl,
      videoUrl: body.videoUrl,
      lokaalPad,
      projectId: body.projectId,
      tags: body.tags,
    }).returning();

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Opslaan mislukt" },
      { status: 500 }
    );
  }
}

// PATCH: Update item (project, tags, favoriet)
export async function PATCH(req: NextRequest) {
  try { await requireAuth(); } catch { /* proxy auth */ }

  const body = await req.json() as {
    id?: number;
    ids?: number[];
    projectId?: number | null;
    tags?: string;
    addTag?: string;
    isFavoriet?: number;
  };

  // Bulk update
  if (body.ids?.length) {
    for (const id of body.ids) {
      const updates: Record<string, unknown> = {};
      if (body.projectId !== undefined) updates.projectId = body.projectId;
      if (body.tags !== undefined) updates.tags = body.tags;
      if (body.addTag) {
        const [existing] = await db.select({ tags: assetGallery.tags }).from(assetGallery).where(eq(assetGallery.id, id));
        const currentTags = existing?.tags ? existing.tags.split(",").map(t => t.trim()) : [];
        if (!currentTags.includes(body.addTag)) {
          currentTags.push(body.addTag);
          updates.tags = currentTags.filter(Boolean).join(", ");
        }
      }
      if (Object.keys(updates).length > 0) {
        await db.update(assetGallery).set(updates).where(eq(assetGallery.id, id));
      }
    }
    return NextResponse.json({ succes: true, bijgewerkt: body.ids.length });
  }

  // Single update
  if (!body.id) return NextResponse.json({ fout: "ID is vereist" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.projectId !== undefined) updates.projectId = body.projectId;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.isFavoriet !== undefined) updates.isFavoriet = body.isFavoriet;
  if (body.addTag) {
    const [existing] = await db.select({ tags: assetGallery.tags }).from(assetGallery).where(eq(assetGallery.id, body.id));
    const currentTags = existing?.tags ? existing.tags.split(",").map(t => t.trim()) : [];
    if (!currentTags.includes(body.addTag)) {
      currentTags.push(body.addTag);
      updates.tags = currentTags.filter(Boolean).join(", ");
    }
  }

  await db.update(assetGallery).set(updates).where(eq(assetGallery.id, body.id));
  return NextResponse.json({ succes: true });
}

export async function DELETE(req: NextRequest) {
  try { await requireAuth(); } catch { /* proxy auth */ }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idsParam = searchParams.get("ids");

  const idsToDelete = idsParam
    ? idsParam.split(",").map(Number)
    : id ? [Number(id)] : [];

  if (idsToDelete.length === 0) return NextResponse.json({ fout: "ID is vereist" }, { status: 400 });

  for (const deleteId of idsToDelete) {
    const [existing] = await db.select().from(assetGallery).where(eq(assetGallery.id, deleteId));
    if (existing?.lokaalPad) {
      try {
        const filePath = path.join(process.cwd(), existing.lokaalPad);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch { /* ignore */ }
    }
    await db.delete(assetGallery).where(eq(assetGallery.id, deleteId));
  }

  return NextResponse.json({ succes: true, verwijderd: idsToDelete.length });
}
