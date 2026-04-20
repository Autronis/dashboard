/* eslint-disable no-console */
import { config } from "dotenv";
import { and, eq, inArray, or, isNull } from "drizzle-orm";

// Next.js projects use .env.local as the primary env file. `dotenv/config`
// only loads `.env`, which in this repo is absent — explicit path needed so
// TURSO_DATABASE_URL / UPWORK_COOKIE_SECRET resolve when run standalone.
config({ path: ".env.local" });
config({ path: ".env" });
import * as schema from "../src/lib/db/schema";
import { deepFetchJob } from "../src/lib/upwork/deep-fetch";
import { classifyBudgetTier } from "../src/lib/upwork/budget-tier";
import type { UpworkAccount } from "../src/lib/upwork/types";

function pickAccount(seenByRaw: string): UpworkAccount {
  try {
    const parsed: unknown = JSON.parse(seenByRaw);
    if (Array.isArray(parsed)) {
      if (parsed.includes("sem")) return "sem";
      if (parsed.includes("syb")) return "syb";
    }
  } catch {
    // fall through
  }
  return "sem";
}

async function run() {
  const { db } = await import("../src/lib/db");

  const args = process.argv.slice(2);
  const onlyJobId = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50;

  const where = onlyJobId
    ? eq(schema.upworkJobs.jobId, onlyJobId)
    : and(
        inArray(schema.upworkJobs.status, ["ingest_partial", "session_expired", "new"]),
        or(
          isNull(schema.upworkJobs.beschrijving),
          eq(schema.upworkJobs.beschrijving, ""),
        ),
      );

  const rows = await db.select().from(schema.upworkJobs).where(where).limit(limit);

  if (rows.length === 0) {
    console.log("Niets om te refetchen — alle jobs hebben al een beschrijving.");
    process.exit(0);
  }

  console.log(`${rows.length} job(s) te verwerken${dryRun ? " (dry-run)" : ""}`);

  let ok = 0;
  let fail = 0;

  for (const job of rows) {
    const account = pickAccount(job.seenBy);
    console.log(`\n→ ${job.jobId} [${account}] ${job.titel ?? ""}`);

    if (dryRun) {
      console.log("  (dry-run — skipping fetch)");
      continue;
    }

    const now = new Date().toISOString();
    const result = await deepFetchJob(db, account, job.url);

    if (!result.ok) {
      fail += 1;
      console.log(`  ✗ ${result.reason}: ${result.message}`);
      const failStatus = result.reason === "session_expired" ? "session_expired" : "ingest_partial";
      await db
        .update(schema.upworkJobs)
        .set({ status: failStatus, fetchError: result.message, bijgewerktOp: now })
        .where(eq(schema.upworkJobs.id, job.id));
      continue;
    }

    const d = result.data;
    const tier =
      d.budgetType && d.budgetMin !== undefined
        ? classifyBudgetTier(d.budgetType, d.budgetMin, d.budgetMax) ?? undefined
        : undefined;

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
      .where(eq(schema.upworkJobs.id, job.id));

    ok += 1;
    console.log(`  ✓ ${d.beschrijving.length} chars beschrijving, ${d.screeningQs?.length ?? 0} screening Qs`);

    // Throttle — Upwork bot-detection
    await new Promise((r) => setTimeout(r, 15_000));
  }

  console.log(`\nKlaar: ${ok} geslaagd, ${fail} gefaald`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
