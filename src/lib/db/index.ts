import * as schema from "./schema";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";

// Use the better-sqlite3 type as base — libsql is API-compatible at runtime
type DrizzleDB = ReturnType<typeof drizzleSqlite<typeof schema>>;

const isTurso = !!process.env.TURSO_DATABASE_URL;

let db: DrizzleDB;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tursoClient: any = null;

if (isTurso) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/libsql");

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  tursoClient = client;

  // Auto-migrate Turso
  client.execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

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
    project_id INTEGER,
    tags TEXT,
    is_favoriet INTEGER DEFAULT 0,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => { /* table may already exist */ });

  // Add missing columns to asset_gallery on Turso
  for (const col of [
    "ALTER TABLE asset_gallery ADD COLUMN project_id INTEGER",
    "ALTER TABLE asset_gallery ADD COLUMN tags TEXT",
    "ALTER TABLE asset_gallery ADD COLUMN is_favoriet INTEGER DEFAULT 0",
    "ALTER TABLE asset_gallery ADD COLUMN video_url TEXT",
  ]) {
    client.execute(col).catch(() => { /* column may already exist */ });
  }

  // Add missing columns to bank_transacties on Turso
  for (const col of [
    "ALTER TABLE bank_transacties ADD COLUMN ai_beschrijving TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN is_abonnement INTEGER DEFAULT 0",
    "ALTER TABLE bank_transacties ADD COLUMN overbodigheid_score TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN fiscaal_type TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN subsidie_mogelijkheden TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN btw_bedrag REAL",
    "ALTER TABLE bank_transacties ADD COLUMN kia_aftrek REAL",
  ]) {
    client.execute(col).catch(() => { /* column may already exist */ });
  }

  // Video samenvattingen table on Turso
  client.execute(`CREATE TABLE IF NOT EXISTS video_samenvattingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_url TEXT NOT NULL,
    youtube_id TEXT NOT NULL,
    titel TEXT,
    kanaal TEXT,
    thumbnail_url TEXT,
    transcript TEXT,
    samenvatting TEXT,
    key_takeaways TEXT,
    stappenplan TEXT,
    tags TEXT,
    relevantie_score TEXT,
    aangemaakt_door INTEGER,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => { /* table may already exist */ });

  // Mealplan cache table — ensure correct schema with status/progress columns
  client.execute("SELECT status FROM mealplan_cache LIMIT 1").catch(() => {
    // Column missing or table doesn't exist — recreate
    return client.execute("DROP TABLE IF EXISTS mealplan_cache").then(() =>
      client.execute(`CREATE TABLE mealplan_cache (
        id INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'idle',
        plan_json TEXT,
        settings_json TEXT,
        progress INTEGER DEFAULT 0,
        aangemaakt_op TEXT DEFAULT (datetime('now'))
      )`)
    );
  });

  // Mealplan plans table — per-user persistent meal plans
  client.execute(`CREATE TABLE IF NOT EXISTS mealplan_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    plan_json TEXT NOT NULL,
    settings_json TEXT,
    chat_json TEXT,
    restjes_json TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => { /* table may already exist */ });

  // BTW aangifte rubriek columns
  const btwNewColsTurso = [
    "rubriek_1a_omzet REAL DEFAULT 0", "rubriek_1a_btw REAL DEFAULT 0",
    "rubriek_1b_omzet REAL DEFAULT 0", "rubriek_1b_btw REAL DEFAULT 0",
    "rubriek_4a_omzet REAL DEFAULT 0", "rubriek_4a_btw REAL DEFAULT 0",
    "rubriek_4b_omzet REAL DEFAULT 0", "rubriek_4b_btw REAL DEFAULT 0",
    "rubriek_5a_btw REAL DEFAULT 0", "rubriek_5b_btw REAL DEFAULT 0",
    "saldo REAL DEFAULT 0", "betalingskenmerk TEXT",
  ];
  for (const col of btwNewColsTurso) {
    client.execute(`ALTER TABLE btw_aangiftes ADD COLUMN ${col}`).catch(() => {});
  }

  // Bedrijfsinstellingen website column
  client.execute("ALTER TABLE bedrijfsinstellingen ADD COLUMN website TEXT").catch(() => {});

  // Dedup taken: done — duplicates were cleaned, sync-taken now prevents new ones

  // Uitgaven is_buitenland column
  client.execute("ALTER TABLE uitgaven ADD COLUMN is_buitenland TEXT").catch(() => {});

  // Screen time locatie column
  client.execute("ALTER TABLE screen_time_entries ADD COLUMN locatie TEXT").catch(() => {});

  // API token gebruik table
  client.execute(`CREATE TABLE IF NOT EXISTS api_token_gebruik (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    kosten_cent INTEGER DEFAULT 0,
    route TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  // Worker runs table (ops-room server-side worker)
  client.execute(`CREATE TABLE IF NOT EXISTS worker_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    huidige_taak_id TEXT,
    poging INTEGER DEFAULT 0,
    max_pogingen INTEGER DEFAULT 3,
    worker_token TEXT NOT NULL,
    laatste_heartbeat TEXT DEFAULT (datetime('now')),
    fout TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  // Follow-up tables
  client.execute(`CREATE TABLE IF NOT EXISTS follow_up_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    onderwerp TEXT NOT NULL,
    inhoud TEXT NOT NULL,
    type TEXT DEFAULT 'email',
    is_actief INTEGER DEFAULT 1,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS follow_up_regels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    type TEXT NOT NULL,
    doelgroep TEXT DEFAULT 'beide',
    dagen_drempel INTEGER NOT NULL,
    template_id INTEGER REFERENCES follow_up_templates(id),
    is_actief INTEGER DEFAULT 1,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS follow_up_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    regel_id INTEGER REFERENCES follow_up_regels(id),
    template_id INTEGER REFERENCES follow_up_templates(id),
    contact_type TEXT NOT NULL,
    contact_id INTEGER NOT NULL,
    offerte_id INTEGER REFERENCES offertes(id),
    status TEXT DEFAULT 'getriggerd',
    dagen_geleden INTEGER,
    email_verstuurd TEXT,
    foutmelding TEXT,
    notitie TEXT,
    verstuurd_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  // YT Knowledge Pipeline tables
  client.execute(`CREATE TABLE IF NOT EXISTS ytk_videos (
    id TEXT PRIMARY KEY,
    youtube_id TEXT UNIQUE,
    title TEXT,
    channel_name TEXT DEFAULT '',
    channel_id TEXT DEFAULT '',
    url TEXT,
    published_at TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    discovered_at TEXT,
    processed_at TEXT,
    status TEXT DEFAULT 'pending'
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS ytk_analyses (
    id TEXT PRIMARY KEY,
    video_id TEXT REFERENCES ytk_videos(id),
    summary TEXT,
    features TEXT,
    steps TEXT,
    tips TEXT,
    relevance_score INTEGER,
    relevance_reason TEXT,
    raw_transcript TEXT,
    model_used TEXT,
    created_at TEXT
  )`).catch(() => {});

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

  // Mealplan plans table — per-user persistent meal plans
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS mealplan_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    plan_json TEXT NOT NULL,
    settings_json TEXT,
    chat_json TEXT,
    restjes_json TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);

  // BTW aangifte rubriek columns
  const btwCols = sqliteDb.prepare("PRAGMA table_info(btw_aangiftes)").all() as { name: string }[];
  const btwNewCols = [
    { name: "rubriek_1a_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_1a_btw", def: "REAL DEFAULT 0" },
    { name: "rubriek_1b_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_1b_btw", def: "REAL DEFAULT 0" },
    { name: "rubriek_4a_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_4a_btw", def: "REAL DEFAULT 0" },
    { name: "rubriek_4b_omzet", def: "REAL DEFAULT 0" }, { name: "rubriek_4b_btw", def: "REAL DEFAULT 0" },
    { name: "rubriek_5a_btw", def: "REAL DEFAULT 0" }, { name: "rubriek_5b_btw", def: "REAL DEFAULT 0" },
    { name: "saldo", def: "REAL DEFAULT 0" }, { name: "betalingskenmerk", def: "TEXT" },
  ];
  for (const col of btwNewCols) {
    if (!btwCols.some((c: { name: string }) => c.name === col.name)) {
      sqliteDb.exec(`ALTER TABLE btw_aangiftes ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  // Uitgaven is_buitenland column
  const uitgavenCols = sqliteDb.prepare("PRAGMA table_info(uitgaven)").all() as { name: string }[];
  if (!uitgavenCols.some((c: { name: string }) => c.name === "is_buitenland")) {
    sqliteDb.exec("ALTER TABLE uitgaven ADD COLUMN is_buitenland TEXT");
  }

  // Screen time locatie column
  const stCols = sqliteDb.prepare("PRAGMA table_info(screen_time_entries)").all() as { name: string }[];
  if (!stCols.some((c: { name: string }) => c.name === "locatie")) {
    sqliteDb.exec("ALTER TABLE screen_time_entries ADD COLUMN locatie TEXT");
  }

  // Tijdregistraties locatie column
  const trCols = sqliteDb.prepare("PRAGMA table_info(tijdregistraties)").all() as { name: string }[];
  if (!trCols.some((c: { name: string }) => c.name === "locatie")) {
    sqliteDb.exec("ALTER TABLE tijdregistraties ADD COLUMN locatie TEXT");
  }

  // API token gebruik table
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS api_token_gebruik (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    kosten_cent INTEGER DEFAULT 0,
    route TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);

  // Worker runs table (ops-room server-side worker)
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS worker_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    huidige_taak_id TEXT,
    poging INTEGER DEFAULT 0,
    max_pogingen INTEGER DEFAULT 3,
    worker_token TEXT NOT NULL,
    laatste_heartbeat TEXT DEFAULT (datetime('now')),
    fout TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);

  // Follow-up tables
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS follow_up_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    onderwerp TEXT NOT NULL,
    inhoud TEXT NOT NULL,
    type TEXT DEFAULT 'email',
    is_actief INTEGER DEFAULT 1,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);

  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS follow_up_regels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naam TEXT NOT NULL,
    type TEXT NOT NULL,
    doelgroep TEXT DEFAULT 'beide',
    dagen_drempel INTEGER NOT NULL,
    template_id INTEGER REFERENCES follow_up_templates(id),
    is_actief INTEGER DEFAULT 1,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);

  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS follow_up_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    regel_id INTEGER REFERENCES follow_up_regels(id),
    template_id INTEGER REFERENCES follow_up_templates(id),
    contact_type TEXT NOT NULL,
    contact_id INTEGER NOT NULL,
    offerte_id INTEGER REFERENCES offertes(id),
    status TEXT DEFAULT 'getriggerd',
    dagen_geleden INTEGER,
    email_verstuurd TEXT,
    foutmelding TEXT,
    notitie TEXT,
    verstuurd_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);

  sqlite = sqliteDb;
  db = drizzleSqlite(sqliteDb, { schema });
}

export { db, sqlite, tursoClient };
