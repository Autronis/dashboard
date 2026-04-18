import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { deepFetchJob } from "@/lib/upwork/deep-fetch";
import { classifyBudgetTier } from "@/lib/upwork/budget-tier";
import type { UpworkAccount } from "@/lib/upwork/types";

function pickAccount(seenByRaw: string): UpworkAccount {
  try {
    const parsed: unknown = JSON.parse(seenByRaw);
    if (Array.isArray(parsed)) {
      if (parsed.includes("sem")) return "sem";
      if (parsed.includes("syb")) return "syb";
    }
  } catch {
    // fall through to default
  }
  return "sem";
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const { id } = await params;
  const rowId = Number(id);
  if (!Number.isFinite(rowId) || rowId <= 0) {
    return NextResponse.json({ fout: "Ongeldig job id" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(schema.upworkJobs)
    .where(eq(schema.upworkJobs.id, rowId))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ fout: "Job niet gevonden" }, { status: 404 });
  }

  const job = rows[0];
  const account = pickAccount(job.seenBy);
  const now = new Date().toISOString();

  const result = await deepFetchJob(db, account, job.url);

  if (!result.ok) {
    const failStatus = result.reason === "session_expired" ? "session_expired" : "ingest_partial";
    await db
      .update(schema.upworkJobs)
      .set({
        status: failStatus,
        fetchError: result.message,
        bijgewerktOp: now,
      })
      .where(eq(schema.upworkJobs.id, rowId));

    return NextResponse.json(
      { fout: result.message, reason: result.reason },
      { status: 502 },
    );
  }

  const d = result.data;
  const tier =
    d.budgetType && d.budgetMin !== undefined
      ? classifyBudgetTier(d.budgetType, d.budgetMin, d.budgetMax) ?? undefined
      : undefined;

  // If the row was parked in a failure state, bring it back to "new" so it
  // shows up in the default list again. Otherwise keep whatever status the
  // user already set (claimed / viewed / submitted).
  const newStatus =
    job.status === "session_expired" || job.status === "ingest_partial" ? "new" : job.status;

  await db
    .update(schema.upworkJobs)
    .set({
      beschrijving: d.beschrijving,
      budgetType: d.budgetType,
      budgetMin: d.budgetMin,
      budgetMax: d.budgetMax,
      budgetTier: tier,
      country: d.country,
      postedAt: d.postedAt,
      durationEstimate: d.durationEstimate,
      experienceLevel: d.experienceLevel,
      categoryLabels: d.categoryLabels ? JSON.stringify(d.categoryLabels) : null,
      clientNaam: d.clientNaam,
      clientVerified: d.clientVerified ? 1 : 0,
      clientSpent: d.clientSpent,
      clientHireRate: d.clientHireRate,
      clientReviews: d.clientReviews,
      clientRating: d.clientRating,
      screeningQs: d.screeningQs ? JSON.stringify(d.screeningQs) : null,
      proposalsRangeMin: d.proposalsRangeMin,
      proposalsRangeMax: d.proposalsRangeMax,
      status: newStatus,
      fetchError: null,
      bijgewerktOp: now,
    })
    .where(eq(schema.upworkJobs.id, rowId));

  return NextResponse.json({ succes: true });
}
