-- Bridge v2: agenda-item lane + audit + feature flags

ALTER TABLE agenda_items ADD COLUMN eigenaar TEXT NOT NULL DEFAULT 'vrij';
ALTER TABLE agenda_items ADD COLUMN gemaakt_door TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_agenda_eigenaar_datum
  ON agenda_items (eigenaar, start_datum);

CREATE TABLE IF NOT EXISTS feature_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  naam TEXT NOT NULL UNIQUE,
  actief INTEGER NOT NULL DEFAULT 0,
  alleen_voor_gebruiker_id INTEGER REFERENCES gebruikers(id),
  beschrijving TEXT,
  aangemaakt_op TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO feature_flags (naam, actief, beschrijving)
VALUES ('agenda_lanes_v2', 0, 'Rendert agenda als swim lanes (sem/syb/vrij) — bridge v2')
ON CONFLICT(naam) DO NOTHING;
