CREATE TABLE `concurrent_scans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurrent_id` integer,
	`status` text DEFAULT 'bezig',
	`scan_datum` text NOT NULL,
	`website_changes` text,
	`vacatures` text,
	`social_activity` text,
	`ai_samenvatting` text,
	`ai_highlights` text,
	`trend_indicator` text,
	`kansen` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`concurrent_id`) REFERENCES `concurrenten`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scans_concurrent` ON `concurrent_scans` (`concurrent_id`);--> statement-breakpoint
CREATE TABLE `concurrent_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`concurrent_id` integer,
	`url` text NOT NULL,
	`content_hash` text NOT NULL,
	`extracted_text` text NOT NULL,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`concurrent_id`) REFERENCES `concurrenten`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_concurrent_url` ON `concurrent_snapshots` (`concurrent_id`,`url`);--> statement-breakpoint
CREATE TABLE `concurrenten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`website_url` text NOT NULL,
	`linkedin_url` text,
	`instagram_handle` text,
	`scan_paginas` text DEFAULT '["diensten","over-ons","pricing","cases"]',
	`notities` text,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `externe_kalenders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`naam` text NOT NULL,
	`url` text NOT NULL,
	`bron` text NOT NULL,
	`kleur` text DEFAULT '#17B8A5',
	`is_actief` integer DEFAULT 1,
	`laatst_gesynced_op` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `google_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` text NOT NULL,
	`calendar_id` text DEFAULT 'primary',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `agenda_items` ADD `google_event_id` text;--> statement-breakpoint
ALTER TABLE `taken` ADD `fase` text;--> statement-breakpoint
ALTER TABLE `taken` ADD `volgorde` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `taken` ADD `google_event_id` text;