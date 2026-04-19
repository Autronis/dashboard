import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { assetGallery } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";

const isTurso = !!process.env.TURSO_DATABASE_URL;

// External AI image/video providers (Kie.ai, fal.media, OpenAI image API, ...)
// return temporary URLs that expire within hours/days. Persist them to Vercel
// Blob immediately so the gallery never points at a 404 later. See
// memory: feedback_kie_temp_urls_expire.md
const PERSISTENT_BLOB_HOSTS = ["public.blob.vercel-storage.com", "blob.vercel-storage.com"];
function isAlreadyPersistent(url: string): boolean {
  try { return PERSISTENT_BLOB_HOSTS.some((h) => new URL(url).hostname.endsWith(h)); }
  catch { return false; }
}
async function persistAssetToBlob(
  url: string,
  kind: "image" | "video",
  productNaam: string,
): Promise<string> {
  if (isAlreadyPersistent(url)) return url;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = kind === "video" ? "mp4" : "png";
    const ct = res.headers.get("content-type") ?? (kind === "video" ? "video/mp4" : "image/png");
    const slug = productNaam.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || kind;
    const blob = await put(`asset-gallery/${slug}-${Date.now()}.${ext}`, buf, {
      access: "public",
      contentType: ct,
      addRandomSuffix: true,
    });
    return blob.url;
  } catch {
    return url;
  }
}

// On local (better-sqlite3): use raw SQL to avoid column order mismatch from ALTER TABLE
// On Turso: use Drizzle ORM (no column order issues with libsql)
function getLocalDb() {
  if (isTurso) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  return new Database(path.join(process.cwd(), "data", "autronis.db"));
}

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    type: r.type as string,
    productNaam: (r.product_naam ?? r.productNaam) as string,
    eindEffect: (r.eind_effect ?? r.eindEffect) as string | null,
    manifest: r.manifest as string | null,
    promptA: (r.prompt_a ?? r.promptA) as string | null,
    promptB: (r.prompt_b ?? r.promptB) as string | null,
    promptVideo: (r.prompt_video ?? r.promptVideo) as string | null,
    afbeeldingUrl: (r.afbeelding_url ?? r.afbeeldingUrl) as string | null,
    videoUrl: (r.video_url ?? r.videoUrl) as string | null,
    lokaalPad: (r.lokaal_pad ?? r.lokaalPad) as string | null,
    projectId: (r.project_id ?? r.projectId) as number | null,
    projectNaam: (r.project_naam ?? r.projectNaam) as string | null,
    tags: r.tags as string | null,
    isFavoriet: (r.is_favoriet ?? r.isFavoriet) as number | null,
    aangemaaktOp: (r.aangemaakt_op ?? r.aangemaaktOp) as string | null,
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
    let rows: Record<string, unknown>[];

    if (isTurso) {
      // Turso: use Drizzle ORM
      const conditions = [];
      if (type) conditions.push(eq(assetGallery.type, type as "scroll-stop" | "logo-animatie"));
      if (projectId) conditions.push(eq(assetGallery.projectId, Number(projectId)));
      if (tag) conditions.push(like(assetGallery.tags, `%${tag}%`));
      if (search) conditions.push(like(assetGallery.productNaam, `%${search}%`));
      if (favoriet === "1") conditions.push(eq(assetGallery.isFavoriet, 1));

      const drizzleRows = await db
        .select()
        .from(assetGallery)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(assetGallery.aangemaaktOp));

      rows = drizzleRows as unknown as Record<string, unknown>[];
    } else {
      // Local: raw SQL to bypass column order issues
      const rawDb = getLocalDb()!;
      rows = rawDb.prepare(`
        SELECT ag.*, p.naam as project_naam
        FROM asset_gallery ag
        LEFT JOIN projecten p ON ag.project_id = p.id
        ORDER BY ag.aangemaakt_op DESC
      `).all() as Record<string, unknown>[];
      rawDb.close();
    }

    // Client-side filtering for Turso (already filtered by Drizzle, but tag/search may need JS filtering)
    let filtered = rows;
    if (isTurso) {
      // Already filtered by Drizzle, no extra filtering needed
    } else {
      if (type) filtered = filtered.filter(r => r.type === type);
      if (projectId) filtered = filtered.filter(r => String(r.project_id) === projectId);
      if (tag) filtered = filtered.filter(r => ((r.tags as string) ?? "").toLowerCase().includes(tag.toLowerCase()));
      if (search) filtered = filtered.filter(r => ((r.product_naam as string) ?? "").toLowerCase().includes(search.toLowerCase()));
      if (favoriet === "1") filtered = filtered.filter(r => r.is_favoriet === 1);
    }

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

    // Persist external (expiring) AI provider URLs to Vercel Blob before storing.
    if (body.afbeeldingUrl) {
      body.afbeeldingUrl = await persistAssetToBlob(body.afbeeldingUrl, "image", body.productNaam);
    }
    if (body.videoUrl) {
      body.videoUrl = await persistAssetToBlob(body.videoUrl, "video", body.productNaam);
    }

    // Local-only: keep an extra on-disk copy for offline dev convenience.
    let lokaalPad: string | undefined;
    if (body.afbeeldingUrl && !isTurso) {
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

    if (isTurso) {
      // Turso: use Drizzle
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
        projectId: body.projectId,
        tags: body.tags,
      }).returning();
      return NextResponse.json({ item: item ? mapRow(item as unknown as Record<string, unknown>) : null });
    } else {
      // Local: raw SQL
      const rawDb = getLocalDb()!;
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
    }
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

  try {
    if (isTurso) {
      // Turso: use Drizzle
      const updateItem = async (id: number) => {
        const updates: Record<string, unknown> = {};
        if (body.projectId !== undefined) updates.projectId = body.projectId;
        if (body.tags !== undefined) updates.tags = body.tags;
        if (body.isFavoriet !== undefined) updates.isFavoriet = body.isFavoriet;
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
      };

      if (body.ids?.length) {
        for (const id of body.ids) await updateItem(id);
        return NextResponse.json({ succes: true, bijgewerkt: body.ids.length });
      }
      if (!body.id) return NextResponse.json({ fout: "ID is vereist" }, { status: 400 });
      await updateItem(body.id);
      return NextResponse.json({ succes: true });
    } else {
      // Local: raw SQL
      const rawDb = getLocalDb()!;
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
    }
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Update mislukt" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try { await requireAuth(); } catch { /* proxy auth */ }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const idsParam = searchParams.get("ids");
  const idsToDelete = idsParam ? idsParam.split(",").map(Number) : id ? [Number(id)] : [];

  if (idsToDelete.length === 0) return NextResponse.json({ fout: "ID is vereist" }, { status: 400 });

  if (isTurso) {
    for (const deleteId of idsToDelete) {
      await db.delete(assetGallery).where(eq(assetGallery.id, deleteId));
    }
  } else {
    const rawDb = getLocalDb()!;
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
  }

  return NextResponse.json({ succes: true, verwijderd: idsToDelete.length });
}
