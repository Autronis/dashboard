import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clientAutomaties, klanten } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  try {
    await requireAuth();

    const rows = await db
      .select({
        id: clientAutomaties.id,
        naam: clientAutomaties.naam,
        type: clientAutomaties.type,
        url: clientAutomaties.url,
        status: clientAutomaties.status,
        lastRunAt: clientAutomaties.lastRunAt,
        lastRunStatus: clientAutomaties.lastRunStatus,
        notities: clientAutomaties.notities,
        klantId: klanten.id,
        klantNaam: klanten.bedrijfsnaam,
      })
      .from(clientAutomaties)
      .leftJoin(klanten, eq(clientAutomaties.klantId, klanten.id))
      .where(eq(clientAutomaties.isActief, 1))
      .orderBy(desc(clientAutomaties.lastRunAt));

    const totaal = rows.length;
    const fouten = rows.filter((r) => r.status === "fout").length;
    const actief = rows.filter((r) => r.status === "actief").length;
    const onbekend = rows.filter((r) => r.status === "onbekend").length;

    return NextResponse.json({ automaties: rows, kpis: { totaal, fouten, actief, onbekend } });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as {
      klantId: number; naam: string; type?: string; url?: string; notities?: string;
    };
    const [record] = await db.insert(clientAutomaties).values({
      klantId: body.klantId,
      naam: body.naam,
      type: (body.type ?? "overig") as "webhook" | "cron" | "integration" | "n8n" | "make" | "zapier" | "api" | "overig",
      url: body.url ?? null,
      notities: body.notities ?? null,
      status: "onbekend",
    }).returning();
    return NextResponse.json({ automatie: record });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json() as { id: number; status?: string; lastRunAt?: string; lastRunStatus?: string; naam?: string; notities?: string };
    await db.update(clientAutomaties)
      .set({
        ...(body.status ? { status: body.status as "actief" | "fout" | "gepauzeerd" | "onbekend" } : {}),
        ...(body.lastRunAt ? { lastRunAt: body.lastRunAt } : {}),
        ...(body.lastRunStatus !== undefined ? { lastRunStatus: body.lastRunStatus } : {}),
        ...(body.naam ? { naam: body.naam } : {}),
        ...(body.notities !== undefined ? { notities: body.notities } : {}),
        bijgewerktOp: new Date().toISOString(),
      })
      .where(eq(clientAutomaties.id, body.id));
    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Fout" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    await db.update(clientAutomaties).set({ isActief: 0 }).where(eq(clientAutomaties.id, id));
    return NextResponse.json({ succes: true });
  } catch (error) {
    return NextResponse.json({ fout: error instanceof Error ? error.message : "Fout" }, { status: 500 });
  }
}
