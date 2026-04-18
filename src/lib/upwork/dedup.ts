import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../db/schema";
import { classifyBudgetTier } from "./budget-tier";
import type { UpworkAccount, BudgetType } from "./types";

type DB = BetterSQLite3Database<typeof schema> | LibSQLDatabase<typeof schema>;

export type UpsertInput = {
  jobId: string;
  url: string;
  titel: string;
  account: UpworkAccount;
  budgetPreviewType?: BudgetType;
  budgetPreviewMin?: number;
  budgetPreviewMax?: number;
  country?: string;
};

export type UpsertResult = { wasNew: boolean; id: number };

export async function upsertJob(db: DB, input: UpsertInput): Promise<UpsertResult> {
  const existing = await db
    .select()
    .from(schema.upworkJobs)
    .where(eq(schema.upworkJobs.jobId, input.jobId))
    .limit(1);

  if (existing.length > 0) {
    const current = existing[0];
    const seen: string[] = JSON.parse(current.seenBy);
    if (!seen.includes(input.account)) {
      seen.push(input.account);
      await db
        .update(schema.upworkJobs)
        .set({ seenBy: JSON.stringify(seen), bijgewerktOp: new Date().toISOString() })
        .where(eq(schema.upworkJobs.id, current.id));
    }
    return { wasNew: false, id: current.id };
  }

  const tier = classifyBudgetTier(
    input.budgetPreviewType,
    input.budgetPreviewMin,
    input.budgetPreviewMax,
  );

  const result = await db
    .insert(schema.upworkJobs)
    .values({
      jobId: input.jobId,
      url: input.url,
      titel: input.titel,
      budgetType: input.budgetPreviewType,
      budgetMin: input.budgetPreviewMin,
      budgetMax: input.budgetPreviewMax,
      budgetTier: tier ?? undefined,
      country: input.country,
      seenBy: JSON.stringify([input.account]),
      status: "new",
    })
    .returning();

  return { wasNew: true, id: result[0].id };
}
