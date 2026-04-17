import * as schema from "./schema";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { autoMigrateSchemaDrift } from "./auto-migrate";

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

  client.execute(`CREATE TABLE IF NOT EXISTS focus_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gebruiker_id INTEGER REFERENCES gebruikers(id),
    tekst TEXT NOT NULL,
    bron TEXT DEFAULT 'claude-code',
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
  client.execute(`CREATE INDEX IF NOT EXISTS idx_focus_logs_gebr_tijd ON focus_logs(gebruiker_id, aangemaakt_op)`).catch(() => {});

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

  // Add bron / bron_tekst columns to ideeen on Turso
  for (const col of [
    "ALTER TABLE ideeen ADD COLUMN bron TEXT",
    "ALTER TABLE ideeen ADD COLUMN bron_tekst TEXT",
  ]) {
    client.execute(col).catch(() => { /* column may already exist */ });
  }

  // Track when an agenda item reminder was last sent (dedup for /api/notifications/pending)
  client.execute("ALTER TABLE agenda_items ADD COLUMN herinnering_verstuurd_op TEXT")
    .catch(() => { /* column may already exist */ });

  // Persist Recall bot dispatch errors per meeting so the UI can show them
  client.execute("ALTER TABLE meetings ADD COLUMN recall_fout TEXT")
    .catch(() => { /* column may already exist */ });

  // Eigenaarschap op projecten: sem / syb / team / vrij. Klantprojecten
  // krijgen 'team' als default backfill, alle andere blijven op 'sem'.
  client.execute("ALTER TABLE projecten ADD COLUMN eigenaar TEXT DEFAULT 'sem'")
    .then(() => {
      client.execute(
        `UPDATE projecten SET eigenaar = 'team' WHERE klant_id IS NOT NULL AND klant_id IN (SELECT id FROM klanten WHERE LOWER(bedrijfsnaam) NOT LIKE '%autronis%')`
      ).catch(() => {});
    })
    .catch(() => { /* column may already exist */ });

  // Eigenaar op losse taken (zonder project)
  client.execute("ALTER TABLE taken ADD COLUMN eigenaar TEXT DEFAULT 'sem'")
    .catch(() => { /* column may already exist */ });

  // Cluster op taken: groepering van samenhangende taken (bv. backend-infra,
  // frontend, klantcontact). Wanneer iemand een taak in een cluster oppakt
  // worden de andere open taken in datzelfde (project, cluster) tuple
  // automatisch aan hem toegewezen.
  client.execute("ALTER TABLE taken ADD COLUMN cluster TEXT")
    .catch(() => { /* column may already exist */ });
  client.execute("CREATE INDEX IF NOT EXISTS idx_taken_cluster ON taken(project_id, cluster)")
    .catch(() => {});

  // Slimme taken templates — DB-backed library van vooraf gedefinieerde
  // Claude-uitvoerbare acties. Wordt bij eerste load geseed uit de defaults
  // in src/lib/slimme-taken.ts (systeem templates, is_systeem=1).
  client.execute(`CREATE TABLE IF NOT EXISTS slimme_taken_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    naam TEXT NOT NULL,
    beschrijving TEXT,
    cluster TEXT NOT NULL,
    geschatte_duur INTEGER DEFAULT 15,
    prompt TEXT NOT NULL,
    velden TEXT,
    is_systeem INTEGER DEFAULT 0,
    is_actief INTEGER DEFAULT 1,
    recurring_day_of_week INTEGER,
    recurring_laatste_run TEXT,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_slimme_taken_actief ON slimme_taken_templates(is_actief)")
    .catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_slimme_taken_recurring ON slimme_taken_templates(recurring_day_of_week)")
    .catch(() => {});

  // Globale toggle: Google Calendar sync on/off. Default uit (0) zodat Sem's
  // agenda niet vol loopt met elke taak/deadline die hij aanmaakt.
  client.execute("ALTER TABLE bedrijfsinstellingen ADD COLUMN google_cal_sync_enabled INTEGER DEFAULT 0")
    .catch(() => { /* column may already exist */ });

  // Project intake flow (fase 2): scope storage kolommen op projecten
  client.execute("ALTER TABLE projecten ADD COLUMN scope_data TEXT")
    .catch(() => { /* column may already exist */ });
  client.execute("ALTER TABLE projecten ADD COLUMN scope_pdf_url TEXT")
    .catch(() => { /* column may already exist */ });

  // Project intakes wizard state
  client.execute(`CREATE TABLE IF NOT EXISTS project_intakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projecten(id),
    scan_id INTEGER,
    stap TEXT DEFAULT 'concept',
    klant_concept TEXT,
    creatieve_ideeen TEXT,
    gekozen_invalshoek TEXT,
    scope_status TEXT DEFAULT 'niet_gestart',
    bron TEXT DEFAULT 'dashboard',
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
  client.execute("ALTER TABLE project_intakes ADD COLUMN scan_id INTEGER").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_project_intakes_project_id ON project_intakes(project_id)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_project_intakes_scan_id ON project_intakes(scan_id)").catch(() => {});

  // remote_commits tabel voor GitHub webhook → banner flow
  client.execute(`CREATE TABLE IF NOT EXISTS remote_commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projecten(id),
    repo_url TEXT NOT NULL,
    sha TEXT NOT NULL,
    auteur_naam TEXT,
    auteur_email TEXT,
    bericht TEXT,
    branch TEXT,
    pushed_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_remote_commits_project ON remote_commits(project_id)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_remote_commits_sha ON remote_commits(sha)").catch(() => {});

  // Add missing columns to bank_transacties on Turso
  for (const col of [
    "ALTER TABLE bank_transacties ADD COLUMN ai_beschrijving TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN is_abonnement INTEGER DEFAULT 0",
    "ALTER TABLE bank_transacties ADD COLUMN overbodigheid_score TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN fiscaal_type TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN subsidie_mogelijkheden TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN btw_bedrag REAL",
    "ALTER TABLE bank_transacties ADD COLUMN kia_aftrek REAL",
    "ALTER TABLE bank_transacties ADD COLUMN valuta TEXT",
  ]) {
    client.execute(col).catch(() => { /* column may already exist */ });
  }

  // Missing facturen columns — Drizzle schema had them, Turso didn't.
  // The administratie page and factuur edit/create routes crash without these.
  for (const col of [
    "ALTER TABLE facturen ADD COLUMN pdf_storage_url TEXT",
    "ALTER TABLE facturen ADD COLUMN terugkeer_aantal INTEGER",
    "ALTER TABLE facturen ADD COLUMN terugkeer_eenheid TEXT",
    "ALTER TABLE facturen ADD COLUMN terugkeer_status TEXT",
    "ALTER TABLE facturen ADD COLUMN volgende_factuurdatum TEXT",
    "ALTER TABLE facturen ADD COLUMN bron_factuur_id INTEGER REFERENCES facturen(id)",
    "ALTER TABLE facturen ADD COLUMN verwerkt_in_aangifte TEXT",
  ]) {
    client.execute(col).catch(() => { /* column may already exist */ });
  }

  // inkomende_facturen table — needed for Gmail PDF sync + administratie page.
  client.execute(`CREATE TABLE IF NOT EXISTS inkomende_facturen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leverancier TEXT NOT NULL,
    bedrag REAL NOT NULL,
    btw_bedrag REAL,
    factuurnummer TEXT,
    datum TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    email_id TEXT UNIQUE,
    bank_transactie_id INTEGER REFERENCES bank_transacties(id),
    uitgave_id INTEGER REFERENCES uitgaven(id),
    status TEXT DEFAULT 'onbekoppeld' CHECK (status IN ('gematcht', 'onbekoppeld', 'handmatig_gematcht')),
    verwerk_op TEXT NOT NULL,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_inkomende_facturen_email_id ON inkomende_facturen(email_id)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_inkomende_facturen_status ON inkomende_facturen(status)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_inkomende_facturen_datum ON inkomende_facturen(datum)").catch(() => {});
  client.execute("ALTER TABLE inkomende_facturen ADD COLUMN verwerkt_in_aangifte TEXT").catch(() => {});
  client.execute("ALTER TABLE inkomende_facturen ADD COLUMN valuta TEXT").catch(() => {});

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

  // Maandrapport — verdeel regels en verrekeningen
  client.execute(`CREATE TABLE IF NOT EXISTS verdeel_regels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    waarde TEXT NOT NULL,
    eigenaar TEXT NOT NULL,
    split_ratio TEXT NOT NULL
  )`).catch(() => {});

  client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uniek_verdeel_type_waarde ON verdeel_regels (type, waarde)`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS openstaande_verrekeningen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    omschrijving TEXT NOT NULL,
    bedrag REAL NOT NULL,
    van_gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    naar_gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    betaald INTEGER DEFAULT 0,
    betaald_op TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  // Eigenaar kolommen op bestaande tabellen
  for (const col of [
    "ALTER TABLE uitgaven ADD COLUMN eigenaar TEXT",
    "ALTER TABLE uitgaven ADD COLUMN split_ratio TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN eigenaar TEXT",
    "ALTER TABLE bank_transacties ADD COLUMN split_ratio TEXT",
  ]) {
    client.execute(col).catch(() => {});
  }

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
    links TEXT,
    relevance_score INTEGER,
    relevance_reason TEXT,
    raw_transcript TEXT,
    model_used TEXT,
    created_at TEXT
  )`).catch(() => {});
  client.execute("ALTER TABLE ytk_analyses ADD COLUMN links TEXT").catch(() => {});

  // Kilometerregistratie: add missing columns to base table
  client.execute("ALTER TABLE kilometer_registraties ADD COLUMN opgeslagen_route_id INTEGER REFERENCES opgeslagen_routes(id)").catch(() => {});
  client.execute("ALTER TABLE kilometer_registraties ADD COLUMN terugkerende_rit_id INTEGER REFERENCES terugkerende_ritten(id)").catch(() => {});

  // Kilometerregistratie tables
  client.execute(`CREATE TABLE IF NOT EXISTS auto_instellingen (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    zakelijk_percentage REAL DEFAULT 75,
    tarief_per_km REAL DEFAULT 0.23,
    bijgewerkt_op TEXT DEFAULT (datetime('now')),
    UNIQUE(gebruiker_id)
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS km_standen (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    jaar INTEGER NOT NULL,
    maand INTEGER NOT NULL,
    begin_stand REAL NOT NULL,
    eind_stand REAL NOT NULL,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    UNIQUE(gebruiker_id, jaar, maand)
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS terugkerende_ritten (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    naam TEXT NOT NULL,
    van_locatie TEXT NOT NULL,
    naar_locatie TEXT NOT NULL,
    kilometers REAL NOT NULL,
    is_retour INTEGER DEFAULT 0,
    doel_type TEXT,
    klant_id INTEGER REFERENCES klanten(id),
    project_id INTEGER REFERENCES projecten(id),
    frequentie TEXT NOT NULL,
    dag_van_week INTEGER,
    dag_van_maand INTEGER,
    start_datum TEXT NOT NULL,
    eind_datum TEXT,
    is_actief INTEGER DEFAULT 1,
    laatste_generatie TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS brandstof_kosten (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    datum TEXT NOT NULL,
    bedrag REAL NOT NULL,
    liters REAL,
    km_stand REAL,
    bank_transactie_id INTEGER REFERENCES bank_transacties(id),
    notitie TEXT,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS locatie_aliassen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    alias TEXT NOT NULL,
    genormaliseerde_naam TEXT NOT NULL,
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    UNIQUE(gebruiker_id, alias)
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS km_stand_fotos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    km_stand_id INTEGER NOT NULL REFERENCES km_standen(id),
    gebruiker_id INTEGER NOT NULL REFERENCES gebruikers(id),
    bestandsnaam TEXT NOT NULL,
    bestandspad TEXT NOT NULL,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  client.execute(`CREATE TABLE IF NOT EXISTS opgeslagen_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    gebruiker_id INTEGER REFERENCES gebruikers(id),
    naam TEXT NOT NULL,
    van_locatie TEXT NOT NULL,
    naar_locatie TEXT NOT NULL,
    kilometers REAL NOT NULL,
    klant_id INTEGER REFERENCES klanten(id),
    project_id INTEGER REFERENCES projecten(id),
    doel_type TEXT,
    aantal_keer_gebruikt INTEGER DEFAULT 0,
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});

  // Klant-uren: automatische urenregistratie per Claude sessie
  client.execute(`CREATE TABLE IF NOT EXISTS klant_uren (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant_id INTEGER NOT NULL REFERENCES klanten(id),
    project_id INTEGER REFERENCES projecten(id),
    gebruiker_id INTEGER REFERENCES gebruikers(id),
    datum TEXT NOT NULL,
    duur_minuten INTEGER NOT NULL,
    omschrijving TEXT,
    bron TEXT DEFAULT 'claude-sessie',
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`).catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_klant_uren_klant_id ON klant_uren(klant_id)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_klant_uren_project_id ON klant_uren(project_id)").catch(() => {});
  client.execute("CREATE INDEX IF NOT EXISTS idx_klant_uren_datum ON klant_uren(datum)").catch(() => {});

  // Schema drift detector — runs after the explicit migrations above and
  // catches any columns that schema.ts adds but nobody remembered to add
  // an ALTER for. Fire-and-forget so startup isn't blocked; errors go to
  // stderr so Vercel logs them.
  autoMigrateSchemaDrift(client, schema)
    .then((drift) => {
      if (drift.applied.length > 0) {
        console.log(`[auto-migrate] added ${drift.applied.length} columns: ${drift.applied.join(", ")}`);
      }
      if (drift.errors.length > 0) {
        console.error(`[auto-migrate] ${drift.errors.length} errors:`);
        for (const err of drift.errors) console.error(`  ${err.sql}: ${err.error}`);
      }
    })
    .catch((err) => console.error("[auto-migrate] fatal:", err));

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

  const agendaCols = sqliteDb.prepare("PRAGMA table_info(agenda_items)").all() as { name: string }[];
  if (!agendaCols.some((c: { name: string }) => c.name === "herinnering_verstuurd_op")) {
    sqliteDb.exec("ALTER TABLE agenda_items ADD COLUMN herinnering_verstuurd_op TEXT");
  }

  const meetingCols = sqliteDb.prepare("PRAGMA table_info(meetings)").all() as { name: string }[];
  if (!meetingCols.some((c: { name: string }) => c.name === "recall_fout")) {
    sqliteDb.exec("ALTER TABLE meetings ADD COLUMN recall_fout TEXT");
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
  if (!bankCols.some((c: { name: string }) => c.name === "valuta")) {
    sqliteDb.exec("ALTER TABLE bank_transacties ADD COLUMN valuta TEXT");
  }

  const inkFactCols = sqliteDb.prepare("PRAGMA table_info(inkomende_facturen)").all() as { name: string }[];
  if (inkFactCols.length > 0 && !inkFactCols.some((c: { name: string }) => c.name === "valuta")) {
    sqliteDb.exec("ALTER TABLE inkomende_facturen ADD COLUMN valuta TEXT");
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

  // Ideeen bron / bron_tekst columns
  const ideeCols = sqliteDb.prepare("PRAGMA table_info(ideeen)").all() as { name: string }[];
  if (!ideeCols.some((c: { name: string }) => c.name === "bron")) {
    sqliteDb.exec("ALTER TABLE ideeen ADD COLUMN bron TEXT");
  }
  if (!ideeCols.some((c: { name: string }) => c.name === "bron_tekst")) {
    sqliteDb.exec("ALTER TABLE ideeen ADD COLUMN bron_tekst TEXT");
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

  // Project intake flow (fase 2): scope storage kolommen op projecten
  const projCols = sqliteDb.prepare("PRAGMA table_info(projecten)").all() as { name: string }[];
  const projColNames = projCols.map((c: { name: string }) => c.name);
  if (!projColNames.includes("scope_data")) {
    sqliteDb.exec("ALTER TABLE projecten ADD COLUMN scope_data TEXT");
  }
  if (!projColNames.includes("scope_pdf_url")) {
    sqliteDb.exec("ALTER TABLE projecten ADD COLUMN scope_pdf_url TEXT");
  }

  // Cluster kolom op taken: groepering van samenhangende taken (bv.
  // backend-infra, frontend, klantcontact). Wanneer iemand een taak in
  // een cluster oppakt worden de andere open taken in datzelfde (project,
  // cluster) tuple automatisch aan hem toegewezen.
  const takenCols = sqliteDb.prepare("PRAGMA table_info(taken)").all() as { name: string }[];
  if (!takenCols.some((c: { name: string }) => c.name === "cluster")) {
    sqliteDb.exec("ALTER TABLE taken ADD COLUMN cluster TEXT");
  }
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_taken_cluster ON taken(project_id, cluster)");

  // Slimme taken templates — DB-backed library van vooraf gedefinieerde
  // Claude-uitvoerbare acties. Wordt bij eerste GET geseed met de defaults
  // uit src/lib/slimme-taken.ts.
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS slimme_taken_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    naam TEXT NOT NULL,
    beschrijving TEXT,
    cluster TEXT NOT NULL,
    geschatte_duur INTEGER DEFAULT 15,
    prompt TEXT NOT NULL,
    velden TEXT,
    is_systeem INTEGER DEFAULT 0,
    is_actief INTEGER DEFAULT 1,
    recurring_day_of_week INTEGER,
    recurring_laatste_run TEXT,
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_slimme_taken_actief ON slimme_taken_templates(is_actief)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_slimme_taken_recurring ON slimme_taken_templates(recurring_day_of_week)");

  // Globale toggle: Google Calendar sync on/off
  const bedrijfCols = sqliteDb.prepare("PRAGMA table_info(bedrijfsinstellingen)").all() as { name: string }[];
  if (!bedrijfCols.some((c: { name: string }) => c.name === "google_cal_sync_enabled")) {
    sqliteDb.exec("ALTER TABLE bedrijfsinstellingen ADD COLUMN google_cal_sync_enabled INTEGER DEFAULT 0");
  }

  // Project intakes wizard state
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS project_intakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projecten(id),
    scan_id INTEGER,
    stap TEXT DEFAULT 'concept',
    klant_concept TEXT,
    creatieve_ideeen TEXT,
    gekozen_invalshoek TEXT,
    scope_status TEXT DEFAULT 'niet_gestart',
    bron TEXT DEFAULT 'dashboard',
    aangemaakt_door INTEGER REFERENCES gebruikers(id),
    aangemaakt_op TEXT DEFAULT (datetime('now')),
    bijgewerkt_op TEXT DEFAULT (datetime('now'))
  )`);
  const intakeCols = sqliteDb.prepare("PRAGMA table_info(project_intakes)").all() as { name: string }[];
  if (!intakeCols.some((c: { name: string }) => c.name === "scan_id")) {
    sqliteDb.exec("ALTER TABLE project_intakes ADD COLUMN scan_id INTEGER");
  }
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_project_intakes_project_id ON project_intakes(project_id)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_project_intakes_scan_id ON project_intakes(scan_id)");

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

  // Klant-uren: automatische urenregistratie per Claude sessie
  sqliteDb.exec(`CREATE TABLE IF NOT EXISTS klant_uren (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    klant_id INTEGER NOT NULL REFERENCES klanten(id),
    project_id INTEGER REFERENCES projecten(id),
    gebruiker_id INTEGER REFERENCES gebruikers(id),
    datum TEXT NOT NULL,
    duur_minuten INTEGER NOT NULL,
    omschrijving TEXT,
    bron TEXT DEFAULT 'claude-sessie',
    aangemaakt_op TEXT DEFAULT (datetime('now'))
  )`);
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_klant_uren_klant_id ON klant_uren(klant_id)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_klant_uren_project_id ON klant_uren(project_id)");
  sqliteDb.exec("CREATE INDEX IF NOT EXISTS idx_klant_uren_datum ON klant_uren(datum)");

  sqlite = sqliteDb;
  db = drizzleSqlite(sqliteDb, { schema });
}

export { db, sqlite, tursoClient };
