/**
 * Fix screen time data: cap durations, mark night entries, reset samenvattingen
 *
 * Usage: npx tsx scripts/fix-screen-time-data.ts
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "autronis.db");
const db = new Database(DB_PATH, { readonly: false });
db.pragma("journal_mode = WAL");

const MAX_ENTRY_DURATION = 300; // 5 min
const NACHT_START = 22;
const NACHT_EIND = 8;

interface EntryRow {
  id: number;
  start_tijd: string;
  eind_tijd: string;
  duur_seconden: number;
  categorie: string;
  client_id: string;
  app: string;
  venster_titel: string | null;
  url: string | null;
  gebruiker_id: number;
  project_id: number | null;
  klant_id: number | null;
  bron: string;
}

let gecorrigeerdeEntries = 0;
let gesplitsteEntries = 0;
let nachtEntries = 0;
let samenvattingenGereset = 0;

// 1. Find entries > 300s and split/cap them
const langeEntries = db.prepare(`
  SELECT id, client_id, app, venster_titel, url, categorie,
         start_tijd, eind_tijd, duur_seconden, gebruiker_id,
         project_id, klant_id, bron
  FROM screen_time_entries
  WHERE duur_seconden > ?
`).all(MAX_ENTRY_DURATION) as EntryRow[];

console.log(`Gevonden: ${langeEntries.length} entries met duur > ${MAX_ENTRY_DURATION}s`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO screen_time_entries
    (client_id, gebruiker_id, app, venster_titel, url, categorie, project_id, klant_id, start_tijd, eind_tijd, duur_seconden, bron)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const deleteStmt = db.prepare("DELETE FROM screen_time_entries WHERE id = ?");

const splitTransaction = db.transaction(() => {
  for (const entry of langeEntries) {
    const startMs = new Date(entry.start_tijd).getTime();
    let offset = 0;
    let chunkIdx = 0;

    // Delete original
    deleteStmt.run(entry.id);
    gecorrigeerdeEntries++;

    // Insert capped chunks
    while (offset < entry.duur_seconden) {
      const chunkDuur = Math.min(MAX_ENTRY_DURATION, entry.duur_seconden - offset);
      const chunkStart = new Date(startMs + offset * 1000).toISOString();
      const chunkEnd = new Date(startMs + (offset + chunkDuur) * 1000).toISOString();

      insertStmt.run(
        `${entry.client_id}_fixed${chunkIdx}`,
        entry.gebruiker_id,
        entry.app,
        entry.venster_titel,
        entry.url,
        entry.categorie,
        entry.project_id,
        entry.klant_id,
        chunkStart,
        chunkEnd,
        chunkDuur,
        entry.bron
      );

      offset += chunkDuur;
      chunkIdx++;
      if (chunkIdx > 1) gesplitsteEntries++;
    }
  }
});

splitTransaction();

// 2. Mark night entries (22:00-08:00) as "overig"
const nachtUpdate = db.prepare(`
  UPDATE screen_time_entries
  SET categorie = 'overig'
  WHERE categorie NOT IN ('overig', 'inactief')
    AND (
      CAST(SUBSTR(start_tijd, 12, 2) AS INTEGER) >= ?
      OR CAST(SUBSTR(start_tijd, 12, 2) AS INTEGER) < ?
    )
`).run(NACHT_START, NACHT_EIND);

nachtEntries = nachtUpdate.changes;

// 3. Delete samenvattingen so they get regenerated with correct data
const samenvattingDelete = db.prepare("DELETE FROM screen_time_samenvattingen").run();
samenvattingenGereset = samenvattingDelete.changes;

console.log("\n--- Resultaat ---");
console.log(`${gecorrigeerdeEntries} entries gecorrigeerd (duur > ${MAX_ENTRY_DURATION}s)`);
console.log(`${gesplitsteEntries} extra chunks aangemaakt door splitting`);
console.log(`${nachtEntries} nacht-entries (${NACHT_START}:00-${NACHT_EIND}:00) naar 'overig' gezet`);
console.log(`${samenvattingenGereset} samenvattingen gereset`);

db.close();
