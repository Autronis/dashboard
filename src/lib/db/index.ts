import * as schema from "./schema";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";

// Use the better-sqlite3 type as base — libsql is API-compatible at runtime
type DrizzleDB = ReturnType<typeof drizzleSqlite<typeof schema>>;

const isTurso = !!process.env.TURSO_DATABASE_URL;

let db: DrizzleDB;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite: any = null;

if (isTurso) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/libsql");

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  db = drizzle(client, { schema }) as DrizzleDB;
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");

  const dbDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqliteDb = new Database(path.join(dbDir, "autronis.db"));
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");

  // Auto-migrate: add type column to klanten if missing
  const cols = sqliteDb.prepare("PRAGMA table_info(klanten)").all() as { name: string }[];
  if (!cols.some((c: { name: string }) => c.name === "klant_type")) {
    sqliteDb.exec("ALTER TABLE klanten ADD COLUMN klant_type TEXT DEFAULT 'klant'");
  }

  sqlite = sqliteDb;
  db = drizzleSqlite(sqliteDb, { schema });
}

export { db, sqlite };
