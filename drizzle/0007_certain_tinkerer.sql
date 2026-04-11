CREATE TABLE `inkomende_facturen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`leverancier` text NOT NULL,
	`bedrag` real NOT NULL,
	`btw_bedrag` real,
	`factuurnummer` text,
	`datum` text NOT NULL,
	`storage_url` text NOT NULL,
	`email_id` text,
	`bank_transactie_id` integer,
	`uitgave_id` integer,
	`status` text DEFAULT 'onbekoppeld',
	`verwerk_op` text NOT NULL,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`bank_transactie_id`) REFERENCES `bank_transacties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uitgave_id`) REFERENCES `uitgaven`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inkomende_facturen_email_id_unique` ON `inkomende_facturen` (`email_id`);--> statement-breakpoint
CREATE TABLE `openstaande_verrekeningen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`omschrijving` text NOT NULL,
	`bedrag` real NOT NULL,
	`van_gebruiker_id` integer NOT NULL,
	`naar_gebruiker_id` integer NOT NULL,
	`betaald` integer DEFAULT 0,
	`betaald_op` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`van_gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`naar_gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verdeel_regels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`waarde` text NOT NULL,
	`eigenaar` text NOT NULL,
	`split_ratio` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_verdeel_type_waarde` ON `verdeel_regels` (`type`,`waarde`);--> statement-breakpoint
ALTER TABLE `bank_transacties` ADD `storage_url` text;--> statement-breakpoint
ALTER TABLE `bank_transacties` ADD `eigenaar` text;--> statement-breakpoint
ALTER TABLE `bank_transacties` ADD `split_ratio` text;--> statement-breakpoint
ALTER TABLE `facturen` ADD `terugkeer_aantal` integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE `facturen` ADD `terugkeer_eenheid` text;--> statement-breakpoint
ALTER TABLE `facturen` ADD `terugkeer_status` text DEFAULT 'actief';--> statement-breakpoint
ALTER TABLE `facturen` ADD `volgende_factuurdatum` text;--> statement-breakpoint
ALTER TABLE `facturen` ADD `bron_factuur_id` integer REFERENCES facturen(id);--> statement-breakpoint
ALTER TABLE `facturen` ADD `pdf_storage_url` text;--> statement-breakpoint
ALTER TABLE `ideeen` ADD `bron` text;--> statement-breakpoint
ALTER TABLE `ideeen` ADD `bron_tekst` text;--> statement-breakpoint
ALTER TABLE `uitgaven` ADD `eigenaar` text;--> statement-breakpoint
ALTER TABLE `uitgaven` ADD `split_ratio` text;