import { NextRequest, NextResponse } from "next/server";
import { and, desc, inArray, isNull, like, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import type { BudgetTier, UpworkAccount } from "@/lib/upwork/types";

const VALID_TIERS: readonly BudgetTier[] = ["low", "mid", "premium"] as const;

function parseTiers(raw: string | null, includeLow: boolean): BudgetTier[] {
  const defaults: BudgetTier[] = ["mid", "premium"];
  const picked = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is BudgetTier => (VALID_TIERS as readonly string[]).includes(s))
    : defaults;

  const set = new Set<BudgetTier>(picked);
  if (includeLow) set.add("low");
  return Array.from(set);
}

function isAccountFilter(value: string | null): value is UpworkAccount | "alle" {
  return value === "sem" || value === "syb" || value === "alle";
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ fout: "Niet geauthenticeerd" }, { status: 401 });
  }

  const url = new URL(req.url);
  const accountParam = url.searchParams.get("account");
  const account: UpworkAccount | "alle" = isAccountFilter(accountParam) ? accountParam : "alle";
  const includeLow = url.searchParams.get("include_low") === "1";
  const showDismissed = url.searchParams.get("show_dismissed") === "1";
  const tiers = parseTiers(url.searchParams.get("tiers"), includeLow);

  const conditions = [] as ReturnType<typeof and>[];

  if (account === "sem" || account === "syb") {
    conditions.push(like(schema.upworkJobs.seenBy, `%"${account}"%`));
  }

  // Always include NULL tiers (unclassified jobs) alongside the selected tiers.
  // When the list is empty (e.g. ?tiers= or all values filtered out), skip the
  // filter entirely — don't degrade to only NULL, which would hide all classified jobs.
  if (tiers.length > 0) {
    conditions.push(
      or(inArray(schema.upworkJobs.budgetTier, tiers), isNull(schema.upworkJobs.budgetTier)),
    );
  }

  if (!showDismissed) {
    conditions.push(ne(schema.upworkJobs.status, "dismissed"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.upworkJobs)
    .where(where)
    .orderBy(
      sql`CASE WHEN ${schema.upworkJobs.postedAt} IS NULL THEN 1 ELSE 0 END`,
      desc(schema.upworkJobs.postedAt),
      desc(schema.upworkJobs.aangemaaktOp),
    )
    .limit(200);

  return NextResponse.json({ jobs: rows });
}
