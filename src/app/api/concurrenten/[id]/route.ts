import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { concurrenten, concurrentScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/concurrenten/[id] — detail + alle scans
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const concurrentId = parseInt(id, 10);

    const concurrent = await db
      .select()
      .from(concurrenten)
      .where(eq(concurrenten.id, concurrentId))
      .get();

    if (!concurrent) {
      return NextResponse.json({ fout: "Concurrent niet gevonden" }, { status: 404 });
    }

    const scans = await db
      .select()
      .from(concurrentScans)
      .where(eq(concurrentScans.concurrentId, concurrentId))
      .orderBy(desc(concurrentScans.aangemaaktOp))
      .all();

    return NextResponse.json({ concurrent, scans });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// PUT /api/concurrenten/[id] — bijwerken
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const concurrentId = parseInt(id, 10);
    const body = await req.json();

    const updated = await db
      .update(concurrenten)
      .set({
        ...(body.naam !== undefined && { naam: body.naam.trim() }),
        ...(body.websiteUrl !== undefined && { websiteUrl: body.websiteUrl.trim() }),
        ...(body.linkedinUrl !== undefined && { linkedinUrl: body.linkedinUrl?.trim() || null }),
        ...(body.instagramHandle !== undefined && {
          instagramHandle: body.instagramHandle?.trim()?.replace(/^@/, "") || null,
        }),
        ...(body.scanPaginas !== undefined && { scanPaginas: JSON.stringify(body.scanPaginas) }),
        ...(body.notities !== undefined && { notities: body.notities?.trim() || null }),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(concurrenten.id, concurrentId))
      .returning()
      .get();

    if (!updated) {
      return NextResponse.json({ fout: "Concurrent niet gevonden" }, { status: 404 });
    }

    return NextResponse.json({ concurrent: updated });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

// DELETE /api/concurrenten/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireAuth();
    const { id } = await params;
    const concurrentId = parseInt(id, 10);

    await db.update(concurrenten)
      .set({ isActief: 0, bijgewerktOp: new Date().toISOString() })
      .where(eq(concurrenten.id, concurrentId))
      .run();

    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Onbekende fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
