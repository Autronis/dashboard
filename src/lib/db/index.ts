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

  // Auto-migrate Turso
  client.execute(`CREATE TABLE IF NOT EXISTS belasting_tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categorie TEXT NOT NULL,
    titel TEXT NOT NULL,
    beschrijving TEXT NOT NULL,
    voordeel TEXT,
    bron TEXT,
    bron_naam TEXT,
    jaar INTEGER,
    is_ai_gegenereerd INTEGER DEFAULT 0,
    toegepast INTEGER DEFAULT 0,
    toegepast_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => { /* table may already exist */ });

  client.execute(`CREATE TABLE IF NOT EXISTS asset_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    product_naam TEXT NOT NULL,
    eind_effect TEXT,
    manifest TEXT,
    prompt_a TEXT,
    prompt_b TEXT,
    prompt_video TEXT,
    afbeelding_url TEXT,
    video_url TEXT,
    lokaal_pad TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => { /* table may already exist */ });

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

  // Auto-migrate
  const klantCols = sqliteDb.prepare("PRAGMA table_info(klanten)").all() as { name: string }[];
  if (!klantCols.some((c: { name: string }) => c.name === "klant_type")) {
    sqliteDb.exec("ALTER TABLE klanten ADD COLUMN klant_type TEXT DEFAULT 'klant'");
  }

  // Revolut integration tables
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS revolut_verbinding (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    access_token TEXT, refresh_token TEXT, token_verloopt_op TEXT,
    account_id TEXT, webhook_id TEXT, webhook_secret TEXT,
    laatste_sync_op TEXT, is_actief INTEGER DEFAULT 1,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);

  const bankCols = sqliteDb.prepare("PRAGMA table_info(bank_transacties)").all() as { name: string }[];
  if (!bankCols.some((c: { name: string }) => c.name === "revolut_transactie_id")) {
    sqliteDb.exec("ALTER TABLE bank_transacties ADD COLUMN revolut_transactie_id TEXT");
    sqliteDb.exec("ALTER TABLE bank_transacties ADD COLUMN merchant_naam TEXT");
    sqliteDb.exec("ALTER TABLE bank_transacties ADD COLUMN merchant_categorie TEXT");
  }

  // Asset gallery table
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS asset_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    product_naam TEXT NOT NULL,
    eind_effect TEXT,
    manifest TEXT,
    prompt_a TEXT,
    prompt_b TEXT,
    prompt_video TEXT,
    afbeelding_url TEXT,
    video_url TEXT,
    lokaal_pad TEXT,
    project_id INTEGER REFERENCES projecten(id),
    tags TEXT,
    is_favoriet INTEGER DEFAULT 0,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);

  // Asset gallery: add missing columns
  const galleryCols = sqliteDb.prepare("PRAGMA table_info(asset_gallery)").all() as { name: string }[];
  const galColNames = galleryCols.map((c: { name: string }) => c.name);
  if (galleryCols.length > 0) {
    if (!galColNames.includes("video_url")) sqliteDb.exec("ALTER TABLE asset_gallery ADD COLUMN video_url TEXT");
    if (!galColNames.includes("project_id")) sqliteDb.exec("ALTER TABLE asset_gallery ADD COLUMN project_id INTEGER REFERENCES projecten(id)");
    if (!galColNames.includes("tags")) sqliteDb.exec("ALTER TABLE asset_gallery ADD COLUMN tags TEXT");
    if (!galColNames.includes("is_favoriet")) sqliteDb.exec("ALTER TABLE asset_gallery ADD COLUMN is_favoriet INTEGER DEFAULT 0");
  }

  // Belasting tips table
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS belasting_tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categorie TEXT NOT NULL,
    titel TEXT NOT NULL,
    beschrijving TEXT NOT NULL,
    voordeel TEXT,
    bron TEXT,
    bron_naam TEXT,
    jaar INTEGER,
    is_ai_gegenereerd INTEGER DEFAULT 0,
    toegepast INTEGER DEFAULT 0,
    toegepast_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);

  sqlite = sqliteDb;
  db = drizzleSqlite(sqliteDb, { schema });
}

export { db, sqlite };
