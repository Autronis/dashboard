import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import { upsertJob } from "./dedup";

function setupDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`CREATE TABLE upwork_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    titel TEXT,
    beschrijving TEXT,
    budget_type TEXT,
    budget_min REAL,
    budget_max REAL,
    budget_tier TEXT,
    country TEXT,
    posted_at TEXT,
    duration_estimate TEXT,
    experience_level TEXT,
    category_labels TEXT,
    client_naam TEXT,
    client_verified INTEGER DEFAULT 0,
    client_spent REAL,
    client_hire_rate REAL,
    client_reviews INTEGER,
    client_rating REAL,
    screening_qs TEXT,
    proposals_range_min INTEGER,
    proposals_range_max INTEGER,
    seen_by TEXT NOT NULL DEFAULT '[]',
    claimed_by TEXT,
    claimed_at TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    fetch_error TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);
  return drizzle(sqlite, { schema });
}

describe("upsertJob", () => {
  let db: ReturnType<typeof setupDb>;

  beforeEach(() => {
    db = setupDb();
  });

  it("inserts a new job when jobId is unseen", async () => {
    await upsertJob(db, {
      jobId: "~01abc123",
      url: "https://www.upwork.com/jobs/~01abc123",
      titel: "Test job",
      account: "sem",
      budgetPreviewType: "fixed",
      budgetPreviewMin: 1000,
    });
    const rows = await db.select().from(schema.upworkJobs);
    expect(rows).toHaveLength(1);
    expect(rows[0].jobId).toBe("~01abc123");
    expect(JSON.parse(rows[0].seenBy)).toEqual(["sem"]);
    expect(rows[0].budgetTier).toBe("mid");
  });

  it("appends account to seen_by when jobId exists", async () => {
    await upsertJob(db, {
      jobId: "~01abc",
      url: "https://www.upwork.com/jobs/~01abc",
      titel: "Test",
      account: "sem",
    });
    await upsertJob(db, {
      jobId: "~01abc",
      url: "https://www.upwork.com/jobs/~01abc",
      titel: "Test",
      account: "syb",
    });
    const rows = await db.select().from(schema.upworkJobs).where(eq(schema.upworkJobs.jobId, "~01abc"));
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].seenBy).sort()).toEqual(["sem", "syb"]);
  });

  it("does not duplicate account in seen_by on repeat", async () => {
    await upsertJob(db, { jobId: "~x", url: "u", titel: "t", account: "sem" });
    await upsertJob(db, { jobId: "~x", url: "u", titel: "t", account: "sem" });
    const rows = await db.select().from(schema.upworkJobs).where(eq(schema.upworkJobs.jobId, "~x"));
    expect(JSON.parse(rows[0].seenBy)).toEqual(["sem"]);
  });

  it("returns wasNew=true for first insert, false for re-sighting", async () => {
    const first = await upsertJob(db, { jobId: "~z", url: "u", titel: "t", account: "sem" });
    const second = await upsertJob(db, { jobId: "~z", url: "u", titel: "t", account: "syb" });
    expect(first.wasNew).toBe(true);
    expect(second.wasNew).toBe(false);
  });
});
