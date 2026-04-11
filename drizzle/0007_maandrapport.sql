-- Eigenaar kolommen op uitgaven
ALTER TABLE `uitgaven` ADD COLUMN `eigenaar` text;
--> statement-breakpoint
ALTER TABLE `uitgaven` ADD COLUMN `split_ratio` text;
--> statement-breakpoint

-- Eigenaar kolommen op bank_transacties
ALTER TABLE `bank_transacties` ADD COLUMN `eigenaar` text;
--> statement-breakpoint
ALTER TABLE `bank_transacties` ADD COLUMN `split_ratio` text;
--> statement-breakpoint

-- Verdeel regels tabel
CREATE TABLE `verdeel_regels` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `type` text NOT NULL,
  `waarde` text NOT NULL,
  `eigenaar` text NOT NULL,
  `split_ratio` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_verdeel_type_waarde` ON `verdeel_regels` (`type`, `waarde`);
--> statement-breakpoint

-- Openstaande verrekeningen tabel
CREATE TABLE `openstaande_verrekeningen` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `omschrijving` text NOT NULL,
  `bedrag` real NOT NULL,
  `van_gebruiker_id` integer NOT NULL REFERENCES `gebruikers`(`id`),
  `naar_gebruiker_id` integer NOT NULL REFERENCES `gebruikers`(`id`),
  `betaald` integer DEFAULT 0,
  `betaald_op` text,
  `aangemaakt_op` text DEFAULT (datetime('now'))
);
