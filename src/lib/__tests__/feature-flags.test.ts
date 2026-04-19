import { describe, it, expect, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Minimal local feature_flags table definition — no FK to gebruikers needed.
const featureFlags = sqliteTable("feature_flags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  naam: text("naam").notNull(),
  actief: integer("actief").notNull().default(0),
  alleenVoorGebruikerId: integer("alleen_voor_gebruiker_id"),
});

// vi.mock factory is hoisted — all imports inside must be dynamic.
// We store the constructed db on globalThis so tests can reference it
// without triggering the hoisting TDZ error.
vi.mock("../db", async () => {
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  const { drizzle } = await import("drizzle-orm/better-sqlite3");

  const sqlite = new BetterSqlite3(":memory:");
  sqlite.exec(`
    CREATE TABLE feature_flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL UNIQUE,
      actief INTEGER NOT NULL DEFAULT 0,
      alleen_voor_gebruiker_id INTEGER,
      beschrijving TEXT,
      aangemaakt_op TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const db = drizzle(sqlite);
  // Expose via globalThis so test body can access without hoisting issues
  (globalThis as Record<string, unknown>).__testFeatureFlagDb = db;
  return { db };
});

import { isFeatureEnabled, clearFeatureFlagCache } from "../feature-flags";

function getTestDb() {
  return (globalThis as Record<string, unknown>).__testFeatureFlagDb as ReturnType<typeof import("drizzle-orm/better-sqlite3").drizzle>;
}

describe("feature-flags", () => {
  afterEach(async () => {
    clearFeatureFlagCache();
    await getTestDb().delete(featureFlags).where(eq(featureFlags.naam, "test_flag"));
  });

  it("returns false when flag does not exist", async () => {
    expect(await isFeatureEnabled("nonexistent_flag_xyz")).toBe(false);
  });

  it("returns true when flag is actief=1 for everyone", async () => {
    await getTestDb().insert(featureFlags).values({ naam: "test_flag", actief: 1 });
    expect(await isFeatureEnabled("test_flag")).toBe(true);
  });

  it("returns true only for matching user when alleenVoorGebruikerId set", async () => {
    await getTestDb().insert(featureFlags).values({ naam: "test_flag", actief: 1, alleenVoorGebruikerId: 1 });
    expect(await isFeatureEnabled("test_flag", 1)).toBe(true);
    expect(await isFeatureEnabled("test_flag", 2)).toBe(false);
    expect(await isFeatureEnabled("test_flag")).toBe(false);
  });
});
