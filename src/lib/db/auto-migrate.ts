// Schema drift detector — runs at server start, diffs the drizzle schema
// defined in `./schema.ts` against the live Turso/SQLite tables, and applies
// `ALTER TABLE ADD COLUMN` for any columns the app expects but that don't
// yet exist in the database.
//
// Limitations (by design):
//   - Only ADDs columns. Never drops, renames, or changes types. That's a
//     manual migration job and needs review — we don't want surprise DROPs.
//   - Adds columns as nullable without defaults, regardless of the drizzle
//     schema, because SQLite can't add NOT NULL columns to existing tables
//     without a default and defaults from drizzle aren't trivially
//     serializable.
//   - Skips foreign-key constraints on added columns. SQLite doesn't support
//     adding a FK via ALTER TABLE anyway; the drizzle `.references()`
//     relationship still works at the app level.
//   - Never creates new tables. If a table is missing entirely the app
//     should add an explicit `CREATE TABLE IF NOT EXISTS` block.
//
// Purpose: end the repeating "field missing" 500 errors where schema.ts
// gets a new column but Turso doesn't — the feature we're shipping just
// works after deploy without someone remembering to add an ALTER block.

import { getTableConfig } from "drizzle-orm/sqlite-core";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TursoClient = { execute: (sql: string) => Promise<any> };

interface DriftResult {
  applied: string[];
  skipped: string[];
  errors: Array<{ sql: string; error: string }>;
}

// Detect if an exported value from schema.ts is a drizzle SQLite table.
// Tables have a special Symbol set by drizzle — getTableConfig throws on
// anything else, so we try/catch.
function isSqliteTable(value: unknown): value is SQLiteTable {
  if (!value || typeof value !== "object") return false;
  try {
    getTableConfig(value as SQLiteTable);
    return true;
  } catch {
    return false;
  }
}

export async function autoMigrateSchemaDrift(
  client: TursoClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: Record<string, any>
): Promise<DriftResult> {
  const result: DriftResult = { applied: [], skipped: [], errors: [] };

  for (const [exportName, exported] of Object.entries(schema)) {
    if (!isSqliteTable(exported)) continue;

    const config = getTableConfig(exported);
    const tableName = config.name;

    // Get existing columns from the database
    let existingCols: Set<string>;
    try {
      const info = await client.execute(`PRAGMA table_info("${tableName}")`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (info as any).rows as Array<{ name: string }>;
      if (!rows || rows.length === 0) {
        // Table doesn't exist in DB — skip (explicit CREATE TABLE elsewhere)
        result.skipped.push(`${tableName} (table missing entirely)`);
        continue;
      }
      existingCols = new Set(rows.map((r) => r.name));
    } catch (e) {
      result.errors.push({
        sql: `PRAGMA table_info("${tableName}")`,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    // For each column in the schema, check if it's missing from the table
    for (const col of config.columns) {
      if (existingCols.has(col.name)) continue;

      const sqlType = col.getSQLType();
      // Strip any inline `NOT NULL` / reference markers — SQLite can't add
      // NOT NULL without a default via ALTER. We add as nullable.
      const type = sqlType
        .replace(/\s+NOT\s+NULL/gi, "")
        .replace(/\s+PRIMARY\s+KEY.*$/i, "")
        .trim();

      const alterSql = `ALTER TABLE "${tableName}" ADD COLUMN "${col.name}" ${type}`;
      try {
        await client.execute(alterSql);
        result.applied.push(`${tableName}.${col.name} (${type})`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Duplicate column = someone else added it, that's fine
        if (/duplicate column|already exists/i.test(msg)) {
          result.skipped.push(`${tableName}.${col.name} (already exists)`);
        } else {
          result.errors.push({ sql: alterSql, error: msg });
        }
      }
    }

    // Silence unused var — exportName is useful if we want to log which
    // drizzle export name mapped to this table, but we don't need it today.
    void exportName;
  }

  return result;
}
