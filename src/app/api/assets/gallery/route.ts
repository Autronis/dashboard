import { NextRequest, NextResponse } from "next/server";
import { db, sqlite } from "@/lib/db";
import { assetGallery } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

interface RawGalleryRow {
  id: number;
  type: string;
  product_naam: string;
  eind_effect: string | null;
  manifest: string | null;
  prompt_a: string | null;
  prompt_b: string | null;
  prompt_video: string | null;
  afbeelding_url: string | null;
  video_url: string | null;
  lokaal_pad: string | null;
  project_id: number | null;
  project_naam: string | null;
  tags: string | null;
  is_favoriet: number | null;
  aangemaakt_op: string | null;
}

export async function GET(req: NextRequest) {
  try { await requireAuth(); } catch { /* proxy auth */ }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const projectId = searchParams.get("projectId");
  const tag = searchParams.get("tag");
  const search = searchParams.get("search");
  const favoriet = searchParams.get("favoriet");

  try {
    const conditions: string[] = ["1=1"];
    if (type) conditions.push(`ag.type = '${type.replace(/'/g, "")}'`);
    if (projectId) conditions.push(`ag.project_id = ${Number(projectId)}`);
    if (tag) conditions.push(`ag.tags LIKE '%${tag.replace(/'/g, "")}%'`);
    if (search) conditions.push(`ag.product_naam LIKE '%${search.replace(/'/g, "")}%'`);
    if (favoriet === "1") conditions.push(`ag.is_favoriet = 1`);

    const rows = sqlite.prepare(`
      SELECT ag.*, p.naam as project_naam
      FROM asset_gallery ag
      LEFT JOIN projecten p ON ag.project_id = p.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ag.aangemaakt_op DESC
    `).all() as RawGalleryRow[];

    const items = rows.map(r => ({
      id: r.id,
      type: r.type,
      productNaam: r.product_naam,
      eindEffect: r.eind_effect,
      manifest: r.manifest,
      promptA: r.prompt_a,
      promptB: r.prompt_b,
      promptVideo: r.prompt_video,
      afbeeldingUrl: r.afbeelding_url,
      videoUrl: r.video_url,
      lokaalPad: r.lokaal_pad,
      projectId: r.project_id,
      projectNaam: r.project_naam,
      tags: r.tags,
      isFavoriet: r.is_favoriet,
      aangemaaktOp: r.aangemaakt_op,
    }));

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
