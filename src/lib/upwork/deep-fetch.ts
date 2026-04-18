import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "../db/schema";
import type { UpworkAccount, DeepFetchResult, DeepFetchData } from "./types";

type DB = BetterSQLite3Database<typeof schema> | LibSQLDatabase<typeof schema>;

/**
 * STUB: full Playwright-based implementation is still pending (Task 10).
 * Returns `session_expired` so the ingest pipeline marks rows as needing
 * manual session refresh. The API shape here matches what the full
 * implementation will produce.
 */
export async function deepFetchJob(
  _db: DB,
  _account: UpworkAccount,
  _jobUrl: string,
): Promise<DeepFetchResult> {
  return {
    ok: false,
    reason: "session_expired",
    message: "Deep-fetch not implemented yet. Run `npm run upwork:login -- <account>` to set up sessions.",
  };
}

// Exported so tests can verify extraction logic once the real deep-fetch ships.
// Currently returns empty data — replace when Playwright flow is wired up.
export function extractJobData(_html: string): DeepFetchData {
  return { beschrijving: "" };
}
