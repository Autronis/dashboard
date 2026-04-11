/**
 * Migration: upload local files to Supabase Storage and update bankTransacties records
 *
 * Gebruik: npx tsx scripts/migrate-storage.ts
 *
 * Vereiste env vars:
 *   SUPABASE_URL            — Supabase project URL
 *   SUPABASE_SERVICE_KEY    — Supabase service role key (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUCKET = "administratie";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const dbPath = path.resolve(__dirname, "..", "autronis.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function migrateDirectory(
  localDir: string,
  storageFolderPath: string
): Promise<void> {
  if (!fs.existsSync(localDir)) {
    console.log(`[skip] Map bestaat niet: ${localDir}`);
    return;
  }

  const files = fs.readdirSync(localDir).filter((f) => {
    const fullPath = path.join(localDir, f);
    return fs.statSync(fullPath).isFile();
  });

  if (files.length === 0) {
    console.log(`[skip] Geen bestanden in: ${localDir}`);
    return;
  }

  for (const filename of files) {
    const fullLocalPath = path.join(localDir, filename);
    const storageKey = `${storageFolderPath}/${filename}`;

    // --- Upload naar Supabase Storage ---
    const fileBuffer = fs.readFileSync(fullLocalPath);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, fileBuffer, {
        upsert: true,
        contentType: guessContentType(filename),
      });

    if (uploadError) {
      console.error(`[error] Upload mislukt voor ${filename}: ${uploadError.message}`);
      continue;
    }

    // Opaque storage path (geen signed URL — kan later worden opgehaald via storage API)
    const storagePath = `${BUCKET}/${storageKey}`;

    // --- Update bankTransacties waar bon_pad overeenkomt ---
    // Lokale pad zoals het opgeslagen is in de database
    const localDbPath = `data/uploads/${path.basename(localDir)}/${filename}`;

    const result = sqlite
      .prepare(
        "UPDATE bank_transacties SET storage_url = ? WHERE bon_pad = ?"
      )
      .run(storagePath, localDbPath);

    if (result.changes > 0) {
      console.log(
        `Migrated: ${filename} → ${storagePath} (${result.changes} record(s) bijgewerkt)`
      );
    } else {
      console.log(
        `Migrated: ${filename} → ${storagePath} (geen overeenkomende transactie gevonden)`
      );
    }
  }
}

function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".svg": "image/svg+xml",
    ".xml": "application/xml",
    ".csv": "text/csv",
    ".txt": "text/plain",
  };
  return map[ext] ?? "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error(
      "Fout: SUPABASE_URL en SUPABASE_SERVICE_KEY moeten als omgevingsvariabelen zijn ingesteld."
    );
    process.exit(1);
  }

  const dataRoot = path.resolve(__dirname, "..", "data", "uploads");

  console.log("=== Supabase Storage migratie gestart ===\n");

  // 1. Bonnetjes
  await migrateDirectory(
    path.join(dataRoot, "bonnetjes"),
    "2026/bonnetjes"
  );

  // 2. Facturen inbox
  await migrateDirectory(
    path.join(dataRoot, "facturen-inbox"),
    "2026/facturen-inkomend"
  );

  console.log("\nMigration complete!");
  sqlite.close();
}

main().catch((err) => {
  console.error("Onverwachte fout:", err);
  sqlite.close();
  process.exit(1);
});

