import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { followUpLog } from "@/lib/db/schema";
import { requireApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";

// POST /api/followup/webhook — n8n calls this to update log status after sending
export async function POST(req: NextRequest) {
  try {
    await requireApiKey(req);
    const body = await req.json();

    if (!body.logId || !body.status) {
      return NextResponse.json({ fout: "logId en status zijn verplicht." }, { status: 400 });
    }

    const validStatuses = ["verstuurd", "mislukt", "overgeslagen", "gesnoozed"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ fout: "Ongeldige status." }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      status: body.status,
    };

    if (body.status === "verstuurd") {
      updateData.verstuurdOp = new Date().toISOString();
    }
    if (body.status === "mislukt" && body.foutmelding) {
      updateData.foutmelding = body.foutmelding;
    }
    if (body.notitie) {
      updateData.notitie = body.notitie;
    }

    const [bijgewerkt] = await db
      .update(followUpLog)
      .set(updateData)
      .where(eq(followUpLog.id, Number(body.logId)))
      .returning();

    if (!bijgewerkt) {
      return NextResponse.json({ fout: "Log entry niet gevonden." }, { status: 404 });
    }

    return NextResponse.json({ succes: true, log: bijgewerkt });
  } catch (error) {
    return NextResponse.json(
      { fout: error instanceof Error ? error.message : "Fout" },
      { status: error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
