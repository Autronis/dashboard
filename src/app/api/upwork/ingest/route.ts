import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseUpworkAlertEmail } from "@/lib/upwork/email-parser";
import { isParseError } from "@/lib/upwork/types";
import { upsertJob } from "@/lib/upwork/dedup";
import { deepFetchJob } from "@/lib/upwork/deep-fetch";
import { classifyBudgetTier } from "@/lib/upwork/budget-tier";
import type { UpworkAccount } from "@/lib/upwork/types";

const INGEST_KEY = process.env.UPWORK_INGEST_API_KEY;

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (!INGEST_KEY || auth !== `Bearer ${INGEST_KEY}`) {
    return NextResponse.json({ fout: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ fout: "Invalid JSON" }, { status: 400 });
  }
  if (!isIngestBody(body)) {
    return NextResponse.json({ fout: "Invalid payload shape" }, { status: 400 });
  }

  const existingMail = await db
    .select()
    .from(schema.upworkEmailRaw)
    .where(eq(schema.upworkEmailRaw.gmailMessageId, body.gmailMessageId))
    .limit(1);
  if (existingMail.length > 0) {
    return NextResponse.json({ succes: true, dedup: "gmail_message" });
  }

  const parsed = parseUpworkAlertEmail(body.subject, body.bodyHtml);

  await db.insert(schema.upworkEmailRaw).values({
    account: body.account,
    gmailMessageId: body.gmailMessageId,
    receivedAt: body.receivedAt,
    subject: body.subject,
    bodyHtml: body.bodyHtml,
    parsedJobId: isParseError(parsed) ? null : parsed.jobId,
    parseError: isParseError(parsed) ? parsed.error : null,
  });

  if (isParseError(parsed)) {
    import("@/lib/upwork/ops-alerts")
      .then((m) => m.checkParseErrorBurst())
      .catch(() => {});
    return NextResponse.json({ succes: true, parseError: parsed.reason });
  }

  const { wasNew, id } = await upsertJob(db, {
    jobId: parsed.jobId,
    url: parsed.url,
    titel: parsed.titel,
    account: body.account,
    budgetPreviewType: parsed.budgetPreviewType,
    budgetPreviewMin: parsed.budgetPreviewMin,
    budgetPreviewMax: parsed.budgetPreviewMax,
    country: parsed.country,
  });

  if (wasNew) {
    triggerDeepFetch(body.account, parsed.url, id).catch((err) => {
      console.error("[upwork/ingest] deep-fetch error:", err);
    });
  }

  return NextResponse.json({ succes: true, jobId: parsed.jobId, wasNew, rowId: id });
}

function isIngestBody(x: unknown): x is {
  account: UpworkAccount;
  gmailMessageId: string;
  receivedAt: string;
  subject: string;
  bodyHtml: string;
} {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    (o.account === "sem" || o.account === "syb") &&
    typeof o.gmailMessageId === "string" &&
    typeof o.receivedAt === "string" &&
    typeof o.subject === "string" &&
    typeof o.bodyHtml === "string"
  );
}

async function triggerDeepFetch(account: UpworkAccount, url: string, rowId: number): Promise<void> {
  const result = await deepFetchJob(db, account, url);
  const now = new Date().toISOString();

  if (result.ok) {
    const d = result.data;
    const tier =
      d.budgetType && d.budgetMin !== undefined
        ? classifyBudgetTier(d.budgetType, d.budgetMin, d.budgetMax) ?? undefined
        : undefined;

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
        bijgewerktOp: now,
      })
      .where(eq(schema.upworkJobs.id, rowId));
  } else {
    await db
      .update(schema.upworkJobs)
      .set({
        status: result.reason === "session_expired" ? "session_expired" : "ingest_partial",
        fetchError: result.message,
        bijgewerktOp: now,
      })
      .where(eq(schema.upworkJobs.id, rowId));

    if (result.reason === "session_expired") {
      const { alertSessionExpired } = await import("@/lib/upwork/ops-alerts");
      await alertSessionExpired(account);
    }
  }
}
