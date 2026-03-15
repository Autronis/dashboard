use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenTimeRecord {
    pub client_id: String,
    pub app: String,
    pub title: String,
    pub url: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub duration_secs: i64,
    pub synced: bool,
}

pub struct Storage {
    conn: Connection,
}

impl Storage {
    pub fn new() -> rusqlite::Result<Self> {
        let db_path = Self::db_path();
        let conn = Connection::open(&db_path)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id TEXT NOT NULL UNIQUE,
                app TEXT NOT NULL,
                title TEXT,
                url TEXT,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_secs INTEGER NOT NULL,
                synced INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_synced ON entries(synced);
            CREATE INDEX IF NOT EXISTS idx_start ON entries(start_time);"
        )?;
        Ok(Self { conn })
    }

    fn db_path() -> PathBuf {
        let data_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("autronis-screentime");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir.join("screentime.db")
    }

    /// Insert a new tracking record. Merges with the previous record
    /// if it's the same app within the tracking interval.
    pub fn record(&self, app: &str, title: &str, url: Option<&str>, duration_secs: i64) -> rusqlite::Result<()> {
        // Check if last unsynced entry is the same app — extend it instead of creating new
        let last: Option<(i64, String, i64)> = self.conn.query_row(
            "SELECT id, app, duration_secs FROM entries WHERE synced = 0 ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).ok();

        if let Some((id, last_app, last_duration)) = last {
            if last_app == app {
                let now = Utc::now().to_rfc3339();
                self.conn.execute(
                    "UPDATE entries SET end_time = ?1, duration_secs = ?2, title = ?3 WHERE id = ?4",
                    params![now, last_duration + duration_secs, title, id],
                )?;
                return Ok(());
            }
        }

        let now = Utc::now().to_rfc3339();
        let client_id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO entries (client_id, app, title, url, start_time, end_time, duration_secs)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)",
            params![client_id, app, title, url, now, duration_secs],
        )?;
        Ok(())
    }

    /// Get all unsynced entries for batch sync
    pub fn get_unsynced(&self) -> rusqlite::Result<Vec<ScreenTimeRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT client_id, app, title, url, start_time, end_time, duration_secs
             FROM entries WHERE synced = 0 ORDER BY start_time LIMIT 100"
        )?;

        let records = stmt.query_map([], |row| {
            Ok(ScreenTimeRecord {
                client_id: row.get(0)?,
                app: row.get(1)?,
                title: row.get(2)?,
                url: row.get(3)?,
                start_time: row.get(4)?,
                end_time: row.get(5)?,
                duration_secs: row.get(6)?,
                synced: false,
            })
        })?.collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(records)
    }

    /// Mark entries as synced by their client_ids
    pub fn mark_synced(&self, client_ids: &[String]) -> rusqlite::Result<()> {
        for id in client_ids {
            self.conn.execute(
                "UPDATE entries SET synced = 1 WHERE client_id = ?1",
                params![id],
            )?;
        }
        Ok(())
    }

    /// Clean up old synced entries (older than 7 days)
    pub fn cleanup(&self) -> rusqlite::Result<usize> {
        self.conn.execute(
            "DELETE FROM entries WHERE synced = 1 AND created_at < datetime('now', '-7 days')",
            [],
        )
    }

    /// Get stats for the tray tooltip
    pub fn today_stats(&self) -> rusqlite::Result<(i64, String)> {
        let today = Utc::now().format("%Y-%m-%d").to_string();
        let total_secs: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(duration_secs), 0) FROM entries WHERE start_time >= ?1",
            params![format!("{today}T00:00:00")],
            |row| row.get(0),
        )?;
        let top_app: String = self.conn.query_row(
            "SELECT COALESCE(app, '-') FROM entries WHERE start_time >= ?1
             GROUP BY app ORDER BY SUM(duration_secs) DESC LIMIT 1",
            params![format!("{today}T00:00:00")],
            |row| row.get(0),
        ).unwrap_or_else(|_| "-".to_string());

        Ok((total_secs, top_app))
    }
}
