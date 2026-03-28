import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Direct DB connection — bypasses Drizzle ORM column mapping issues
// (asset_gallery was created then ALTER TABLE'd, causing column order mismatch)
function getDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  return new Database(path.join(process.cwd(), "data", "autronis.db"));
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    type: r.type as string,
    productNaam: r.product_naam as string,
    eindEffect: r.eind_effect as string | null,
    manifest: r.manifest as string | null,
    promptA: r.prompt_a as string | null,
    promptB: r.prompt_b as string | null,
    promptVideo: r.prompt_video as string | null,
    afbeeldingUrl: r.afbeelding_url as string | null,
    videoUrl: r.video_url as string | null,
    lokaalPad: r.lokaal_pad as string | null,
    projectId: r.project_id as number | null,
    projectNaam: r.project_naam as string | null,
    tags: r.tags as string | null,
    isFavoriet: r.is_favoriet as number | null,
    aangemaaktOp: r.aangemaakt_op as string | null,
  };
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
    const rawDb = getDb();
    const rows = rawDb.prepare(`
      SELECT ag.*, p.naam as project_naam
      FROM asset_gallery ag
      LEFT JOIN projecten p ON ag.project_id = p.id
      ORDER BY ag.aangemaakt_op DESC
    `).all() as Record<string, unknown>[];
    rawDb.close();

    let filtered = rows;
    if (type) filtered = filtered.filter(r => r.type === type);
    if (projectId) filtered = filtered.filter(r => r.project_id === Number(projectId));
    if (tag) filtered = filtered.filter(r => ((r.tags as string) ?? "").toLowerCase().includes(tag.toLowerCase()));
    if (search) filtered = filtered.filter(r => ((r.product_naam as string) ?? "").toLowerCase().includes(search.toLowerCase()));
    if (favoriet === "1") filtered = filtered.filter(r => r.is_favoriet === 1);

    const items = filtered.map(mapRow);

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

    // Download image locally if URL provided
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

    const rawDb = getDb();
    const result = rawDb.prepare(`
      INSERT INTO asset_gallery (type, product_naam, eind_effect, manifest, prompt_a, prompt_b, prompt_video, afbeelding_url, video_url, lokaal_pad, project_id, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      body.type, body.productNaam, body.eindEffect ?? null, body.manifest ?? null,
      body.promptA ?? null, body.promptB ?? null, body.promptVideo ?? null,
      body.afbeeldingUrl ?? null, body.videoUrl ?? null, lokaalPad ?? null,
      body.projectId ?? null, body.tags ?? null
    );
    const item = rawDb.prepare("SELECT * FROM asset_gallery WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
    rawDb.close();

    return NextResponse.json({ item: item ? mapRow(item) : null });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Opslaan mislukt" },
      { status: 500 }
    );
  }
}

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

  const rawDb = getDb();

  try {
    const updateItem = (id: number) => {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (body.projectId !== undefined) { sets.push("project_id = ?"); params.push(body.projectId); }
      if (body.tags !== undefined) { sets.push("tags = ?"); params.push(body.tags); }
      if (body.isFavoriet !== undefined) { sets.push("is_favoriet = ?"); params.push(body.isFavoriet); }
      if (body.addTag) {
        const existing = rawDb.prepare("SELECT tags FROM asset_gallery WHERE id = ?").get(id) as { tags: string | null } | undefined;
        const currentTags = existing?.tags ? existing.tags.split(",").map(t => t.trim()) : [];
        if (!currentTags.includes(body.addTag)) {
          currentTags.push(body.addTag);
          sets.push("tags = ?");
          params.push(currentTags.filter(Boolean).join(", "));
        }
      }

      if (sets.length > 0) {
        params.push(id);
        rawDb.prepare(`UPDATE asset_gallery SET ${sets.join(", ")} WHERE id = ?`).run(...params);
      }
    };

    if (body.ids?.length) {
      for (const id of body.ids) updateItem(id);
      rawDb.close();
      return NextResponse.json({ succes: true, bijgewerkt: body.ids.length });
    }

    if (!body.id) { rawDb.close(); return NextResponse.json({ fout: "ID is vereist" }, { status: 400 }); }
    updateItem(body.id);
    rawDb.close();
    return NextResponse.json({ succes: true });
  } catch (error) {
    rawDb.close();
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Update mislukt" }, { status: 500 });
  }
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

  const rawDb = getDb();
  for (const deleteId of idsToDelete) {
    const existing = rawDb.prepare("SELECT lokaal_pad FROM asset_gallery WHERE id = ?").get(deleteId) as { lokaal_pad: string | null } | undefined;
    if (existing?.lokaal_pad) {
      try {
        const filePath = path.join(process.cwd(), existing.lokaal_pad);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch { /* ignore */ }
    }
    rawDb.prepare("DELETE FROM asset_gallery WHERE id = ?").run(deleteId);
  }
  rawDb.close();

  return NextResponse.json({ succes: true, verwijderd: idsToDelete.length });
}
