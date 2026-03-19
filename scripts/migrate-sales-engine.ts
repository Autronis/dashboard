/**
 * Migration: voeg nieuwe kolommen toe aan sales_engine_scans en sales_engine_kansen
 *
 * Gebruik: npx tsx scripts/migrate-sales-engine.ts
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(__dirname, "..", "autronis.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

function tableExists(table: string): boolean {
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as { name: string } | undefined;
  return !!result;
}

function columnExists(table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((c) => c.name === column);
}

function addColumnIfNotExists(table: string, column: string, type: string, defaultValue?: string) {
  if (columnExists(table, column)) {
    console.log(`  [skip] ${table}.${column} bestaat al`);
    return;
  }
  const defaultClause = defaultValue !== undefined ? ` DEFAULT ${defaultValue}` : "";
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultClause}`).run();
  console.log(`  [add]  ${table}.${column} (${type})`);
}

console.log("Sales Engine migratie gestart...\n");

if (!tableExists("sales_engine_scans")) {
  console.log("  [warn] Tabel sales_engine_scans bestaat nog niet - sla over");
} else {
  console.log("sales_engine_scans:");
  addColumnIfNotExists("sales_engine_scans", "automation_readiness_score", "INTEGER");
  addColumnIfNotExists("sales_engine_scans", "aanbevolen_pakket", "TEXT");
  addColumnIfNotExists("sales_engine_scans", "batch_id", "TEXT");
}

if (!tableExists("sales_engine_kansen")) {
  console.log("  [warn] Tabel sales_engine_kansen bestaat nog niet - sla over");
} else {
  console.log("\nsales_engine_kansen:");
  addColumnIfNotExists("sales_engine_kansen", "geschatte_kosten", "TEXT");
  addColumnIfNotExists("sales_engine_kansen", "geschatte_besparing", "TEXT");
  addColumnIfNotExists("sales_engine_kansen", "implementatie_effort", "TEXT");
}

console.log("\nMigratie voltooid!");
db.close();
