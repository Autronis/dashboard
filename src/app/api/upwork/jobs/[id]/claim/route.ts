import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAuth, type SessionGebruiker } from "@/lib/auth";
import type { UpworkAccount } from "@/lib/upwork/types";

function resolveClaimer(user: SessionGebruiker): UpworkAccount {
  return user.naam.toLowerCase().includes("syb") ? "syb" : "sem";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: SessionGebruiker;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { id } = await params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    return NextResponse.json({ fout: "Ongeldig job id" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(schema.upworkJobs)
    .where(eq(schema.upworkJobs.id, rowId))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ fout: "Job niet gevonden" }, { status: 404 });
  }

  const claimedBy = resolveClaimer(user);
  const now = new Date().toISOString();

  await db
    .update(schema.upworkJobs)
    .set({
      claimedBy,
      claimedAt: now,
      status: "claimed",
      bijgewerktOp: now,
    })
    .where(eq(schema.upworkJobs.id, rowId));

  return NextResponse.json({ succes: true, claimedBy });
}
