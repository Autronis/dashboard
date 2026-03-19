CREATE TABLE `agenda_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`titel` text NOT NULL,
	`omschrijving` text,
	`type` text DEFAULT 'afspraak',
	`start_datum` text NOT NULL,
	`eind_datum` text,
	`hele_dag` integer DEFAULT 0,
	`herinnering_minuten` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_gesprekken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`titel` text DEFAULT 'Nieuw gesprek',
	`berichten` text DEFAULT '[]',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`permissions` text DEFAULT '[]',
	`laatst_gebruikt_op` text,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`actie` text NOT NULL,
	`entiteit_type` text NOT NULL,
	`entiteit_id` integer,
	`oude_waarde` text,
	`nieuwe_waarde` text,
	`ip_adres` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `backup_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`code` text NOT NULL,
	`gebruikt` integer DEFAULT 0,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bank_transacties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`datum` text NOT NULL,
	`omschrijving` text NOT NULL,
	`bedrag` real NOT NULL,
	`type` text NOT NULL,
	`categorie` text,
	`gekoppeld_factuur_id` integer,
	`status` text DEFAULT 'onbekend',
	`bank` text,
	`tegenrekening` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gekoppeld_factuur_id`) REFERENCES `facturen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bedrijfsinstellingen` (
	`id` integer PRIMARY KEY NOT NULL,
	`bedrijfsnaam` text DEFAULT 'Autronis',
	`adres` text,
	`kvk_nummer` text,
	`btw_nummer` text,
	`iban` text,
	`email` text,
	`telefoon` text,
	`logo_pad` text,
	`standaard_btw` real DEFAULT 21,
	`betalingstermijn_dagen` integer DEFAULT 30,
	`herinnering_na_dagen` integer DEFAULT 7
);
--> statement-breakpoint
CREATE TABLE `belasting_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`actie` text NOT NULL,
	`entiteit_type` text NOT NULL,
	`entiteit_id` integer,
	`details` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `belasting_deadlines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`omschrijving` text NOT NULL,
	`datum` text NOT NULL,
	`kwartaal` integer,
	`jaar` integer NOT NULL,
	`herinnering_dagen` text DEFAULT '[30,14,3]',
	`afgerond` integer DEFAULT 0,
	`notities` text,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `belasting_reserveringen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`maand` text NOT NULL,
	`bedrag` real NOT NULL,
	`type` text DEFAULT 'inkomstenbelasting',
	`notities` text,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `beschikbaarheid` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`week` integer NOT NULL,
	`jaar` integer NOT NULL,
	`beschikbare_uren` real DEFAULT 40,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `briefings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`datum` text NOT NULL,
	`samenvatting` text,
	`agenda_items` text DEFAULT '[]',
	`taken_prioriteit` text DEFAULT '[]',
	`project_updates` text DEFAULT '[]',
	`quick_wins` text DEFAULT '[]',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_briefing_datum` ON `briefings` (`gebruiker_id`,`datum`);--> statement-breakpoint
CREATE TABLE `btw_aangiftes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kwartaal` integer NOT NULL,
	`jaar` integer NOT NULL,
	`btw_ontvangen` real DEFAULT 0,
	`btw_betaald` real DEFAULT 0,
	`btw_afdragen` real DEFAULT 0,
	`status` text DEFAULT 'open',
	`ingediend_op` text,
	`notities` text,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `client_berichten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`gebruiker_id` integer,
	`bericht` text NOT NULL,
	`van_klant` integer DEFAULT 0,
	`gelezen` integer DEFAULT 0,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `client_portal_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`token` text NOT NULL,
	`actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`laatst_ingelogd_op` text,
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_portal_tokens_token_unique` ON `client_portal_tokens` (`token`);--> statement-breakpoint
CREATE TABLE `content_banners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer,
	`template_type` text NOT NULL,
	`template_variant` integer DEFAULT 0,
	`formaat` text NOT NULL,
	`data` text NOT NULL,
	`image_path` text,
	`status` text DEFAULT 'concept',
	`grid_positie` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`post_id`) REFERENCES `content_posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_inzichten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`inhoud` text NOT NULL,
	`categorie` text NOT NULL,
	`klant_id` integer,
	`project_id` integer,
	`is_gebruikt` integer DEFAULT 0,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`inhoud` text NOT NULL,
	`platform` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'concept',
	`batch_id` text,
	`batch_week` text,
	`inzicht_id` integer,
	`bewerkte_inhoud` text,
	`afwijs_reden` text,
	`gegenereerde_hashtags` text,
	`gepland_op` text,
	`gepubliceerd_op` text,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`inzicht_id`) REFERENCES `content_inzichten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_profiel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`onderwerp` text NOT NULL,
	`inhoud` text NOT NULL,
	`bijgewerkt_door` integer,
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`bijgewerkt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer,
	`script` text NOT NULL,
	`status` text DEFAULT 'script',
	`video_path` text,
	`duur_seconden` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`post_id`) REFERENCES `content_posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `documenten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`project_id` integer,
	`lead_id` integer,
	`naam` text NOT NULL,
	`bestandspad` text DEFAULT '',
	`url` text,
	`type` text DEFAULT 'overig',
	`versie` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `doelen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`type` text NOT NULL,
	`maand` integer NOT NULL,
	`jaar` integer NOT NULL,
	`doelwaarde` real NOT NULL,
	`huidige_waarde` real DEFAULT 0,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_doel` ON `doelen` (`gebruiker_id`,`type`,`maand`,`jaar`);--> statement-breakpoint
CREATE TABLE `facturen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`project_id` integer,
	`factuurnummer` text NOT NULL,
	`status` text DEFAULT 'concept',
	`bedrag_excl_btw` real NOT NULL,
	`btw_percentage` real DEFAULT 21,
	`btw_bedrag` real,
	`bedrag_incl_btw` real,
	`factuurdatum` text,
	`vervaldatum` text,
	`betaald_op` text,
	`is_terugkerend` integer DEFAULT 0,
	`terugkeer_interval` text,
	`notities` text,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facturen_factuurnummer_unique` ON `facturen` (`factuurnummer`);--> statement-breakpoint
CREATE TABLE `factuur_regels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factuur_id` integer,
	`omschrijving` text NOT NULL,
	`aantal` real NOT NULL,
	`eenheidsprijs` real NOT NULL,
	`btw_percentage` real DEFAULT 21,
	`totaal` real,
	FOREIGN KEY (`factuur_id`) REFERENCES `facturen`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feestdagen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`datum` text NOT NULL,
	`jaar` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `focus_sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`project_id` integer,
	`taak_id` integer,
	`geplande_duur_minuten` integer NOT NULL,
	`werkelijke_duur_minuten` integer,
	`reflectie` text,
	`tijdregistratie_id` integer NOT NULL,
	`status` text DEFAULT 'actief' NOT NULL,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taak_id`) REFERENCES `taken`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tijdregistratie_id`) REFERENCES `tijdregistraties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gebruikers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`email` text NOT NULL,
	`wachtwoord_hash` text NOT NULL,
	`rol` text DEFAULT 'gebruiker',
	`uurtarief_standaard` real,
	`thema_voorkeur` text DEFAULT 'donker',
	`twee_factor_geheim` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gebruikers_email_unique` ON `gebruikers` (`email`);--> statement-breakpoint
CREATE TABLE `gewoonte_logboek` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gewoonte_id` integer,
	`gebruiker_id` integer,
	`datum` text NOT NULL,
	`voltooid` integer DEFAULT 1,
	`notitie` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gewoonte_id`) REFERENCES `gewoontes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_logboek_gewoonte_datum` ON `gewoonte_logboek` (`gewoonte_id`,`datum`);--> statement-breakpoint
CREATE INDEX `idx_logboek_gebruiker_datum` ON `gewoonte_logboek` (`gebruiker_id`,`datum`);--> statement-breakpoint
CREATE TABLE `gewoontes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`naam` text NOT NULL,
	`icoon` text DEFAULT 'Target' NOT NULL,
	`frequentie` text DEFAULT 'dagelijks',
	`streefwaarde` text,
	`volgorde` integer DEFAULT 0,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ideeen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nummer` integer,
	`naam` text NOT NULL,
	`categorie` text,
	`status` text DEFAULT 'idee',
	`omschrijving` text,
	`uitwerking` text,
	`prioriteit` text DEFAULT 'normaal',
	`project_id` integer,
	`notion_page_id` text,
	`ai_score` integer,
	`ai_haalbaarheid` integer,
	`ai_marktpotentie` integer,
	`ai_fit_autronis` integer,
	`doelgroep` text,
	`verdienmodel` text,
	`is_ai_suggestie` integer DEFAULT 0,
	`gepromoveerd` integer DEFAULT 0,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inkomsten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`factuur_id` integer,
	`klant_id` integer,
	`omschrijving` text NOT NULL,
	`bedrag` real NOT NULL,
	`datum` text NOT NULL,
	`categorie` text,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`factuur_id`) REFERENCES `facturen`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `investeringen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`bedrag` real NOT NULL,
	`datum` text NOT NULL,
	`categorie` text DEFAULT 'overig',
	`afschrijvingstermijn` integer DEFAULT 5,
	`restwaarde` real DEFAULT 0,
	`notities` text,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kilometer_registraties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`datum` text NOT NULL,
	`van_locatie` text NOT NULL,
	`naar_locatie` text NOT NULL,
	`kilometers` real NOT NULL,
	`zakelijk_doel` text,
	`klant_id` integer,
	`project_id` integer,
	`tarief_per_km` real DEFAULT 0.23,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `klanten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bedrijfsnaam` text NOT NULL,
	`contactpersoon` text,
	`email` text,
	`telefoon` text,
	`adres` text,
	`uurtarief` real,
	`notities` text,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `klanttevredenheid` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`project_id` integer,
	`score` integer NOT NULL,
	`opmerking` text,
	`token` text,
	`ingevuld_op` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `klanttevredenheid_token_unique` ON `klanttevredenheid` (`token`);--> statement-breakpoint
CREATE TABLE `lead_activiteiten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`gebruiker_id` integer NOT NULL,
	`type` text NOT NULL,
	`titel` text NOT NULL,
	`omschrijving` text,
	`aangemaakt_op` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bedrijfsnaam` text NOT NULL,
	`contactpersoon` text,
	`email` text,
	`telefoon` text,
	`waarde` real,
	`status` text DEFAULT 'nieuw',
	`bron` text,
	`notities` text,
	`volgende_actie` text,
	`volgende_actie_datum` text,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`project_id` integer,
	`titel` text NOT NULL,
	`datum` text NOT NULL,
	`audio_pad` text,
	`transcript` text,
	`samenvatting` text,
	`actiepunten` text DEFAULT '[]',
	`besluiten` text DEFAULT '[]',
	`open_vragen` text DEFAULT '[]',
	`status` text DEFAULT 'verwerken',
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mollie_instellingen` (
	`id` integer PRIMARY KEY NOT NULL,
	`api_key` text,
	`actief` integer DEFAULT 0,
	`bijgewerkt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `notificaties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer NOT NULL,
	`type` text NOT NULL,
	`titel` text NOT NULL,
	`omschrijving` text,
	`link` text,
	`gelezen` integer DEFAULT 0 NOT NULL,
	`aangemaakt_op` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `notities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`klant_id` integer,
	`project_id` integer,
	`lead_id` integer,
	`inhoud` text NOT NULL,
	`type` text DEFAULT 'notitie',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offerte_regels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offerte_id` integer,
	`omschrijving` text NOT NULL,
	`aantal` real NOT NULL,
	`eenheidsprijs` real NOT NULL,
	`btw_percentage` real DEFAULT 21,
	`totaal` real,
	FOREIGN KEY (`offerte_id`) REFERENCES `offertes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `offertes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`project_id` integer,
	`offertenummer` text NOT NULL,
	`titel` text,
	`status` text DEFAULT 'concept',
	`datum` text,
	`geldig_tot` text,
	`bedrag_excl_btw` real DEFAULT 0,
	`btw_percentage` real DEFAULT 21,
	`btw_bedrag` real DEFAULT 0,
	`bedrag_incl_btw` real DEFAULT 0,
	`notities` text,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `offertes_offertenummer_unique` ON `offertes` (`offertenummer`);--> statement-breakpoint
CREATE TABLE `okr_key_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`objective_id` integer,
	`titel` text NOT NULL,
	`doelwaarde` real NOT NULL,
	`huidige_waarde` real DEFAULT 0,
	`eenheid` text,
	`auto_koppeling` text DEFAULT 'geen',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`objective_id`) REFERENCES `okr_objectives`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `okr_objectives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`omschrijving` text,
	`eigenaar_id` integer,
	`kwartaal` integer NOT NULL,
	`jaar` integer NOT NULL,
	`status` text DEFAULT 'actief',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`eigenaar_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `onkosten_declaraties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`datum` text NOT NULL,
	`omschrijving` text NOT NULL,
	`bedrag` real NOT NULL,
	`categorie` text DEFAULT 'overig',
	`bonnetje_url` text,
	`status` text DEFAULT 'ingediend',
	`beoordeeld_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beoordeeld_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `project_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`beschrijving` text,
	`categorie` text,
	`taken` text DEFAULT '[]',
	`geschatte_uren` real,
	`uurtarief` real,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `projecten` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`naam` text NOT NULL,
	`omschrijving` text,
	`status` text DEFAULT 'actief',
	`voortgang_percentage` integer DEFAULT 0,
	`deadline` text,
	`geschatte_uren` real,
	`werkelijke_uren` real DEFAULT 0,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposal_regels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposal_id` integer,
	`omschrijving` text NOT NULL,
	`aantal` real NOT NULL,
	`eenheidsprijs` real NOT NULL,
	`totaal` real,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`klant_id` integer,
	`titel` text NOT NULL,
	`status` text DEFAULT 'concept',
	`secties` text DEFAULT '[]',
	`totaal_bedrag` real DEFAULT 0,
	`geldig_tot` text,
	`token` text,
	`ondertekend_op` text,
	`ondertekend_door` text,
	`ondertekening` text,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_token_unique` ON `proposals` (`token`);--> statement-breakpoint
CREATE TABLE `radar_bronnen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`naam` text NOT NULL,
	`url` text NOT NULL,
	`type` text DEFAULT 'rss',
	`actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_radar_bron_url` ON `radar_bronnen` (`url`);--> statement-breakpoint
CREATE TABLE `radar_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bron_id` integer,
	`titel` text NOT NULL,
	`url` text NOT NULL,
	`beschrijving` text,
	`auteur` text,
	`gepubliceerd_op` text,
	`score` integer,
	`score_redenering` text,
	`ai_samenvatting` text,
	`categorie` text,
	`bewaard` integer DEFAULT 0,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`bron_id`) REFERENCES `radar_bronnen`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_radar_item_url` ON `radar_items` (`url`);--> statement-breakpoint
CREATE INDEX `idx_radar_score` ON `radar_items` (`score`);--> statement-breakpoint
CREATE TABLE `screen_time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text,
	`gebruiker_id` integer,
	`app` text NOT NULL,
	`venster_titel` text,
	`url` text,
	`categorie` text DEFAULT 'overig',
	`project_id` integer,
	`klant_id` integer,
	`start_tijd` text NOT NULL,
	`eind_tijd` text NOT NULL,
	`duur_seconden` integer NOT NULL,
	`bron` text DEFAULT 'agent',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_client_id` ON `screen_time_entries` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_st_gebruiker_start` ON `screen_time_entries` (`gebruiker_id`,`start_tijd`);--> statement-breakpoint
CREATE INDEX `idx_st_gebruiker_cat_start` ON `screen_time_entries` (`gebruiker_id`,`categorie`,`start_tijd`);--> statement-breakpoint
CREATE TABLE `screen_time_regels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`patroon` text NOT NULL,
	`categorie` text NOT NULL,
	`project_id` integer,
	`klant_id` integer,
	`prioriteit` integer DEFAULT 0,
	`is_actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`klant_id`) REFERENCES `klanten`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `screen_time_samenvattingen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`datum` text NOT NULL,
	`samenvatting_kort` text,
	`samenvatting_detail` text,
	`totaal_seconden` integer,
	`productief_percentage` integer,
	`top_project` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniek_gebruiker_datum` ON `screen_time_samenvattingen` (`gebruiker_id`,`datum`);--> statement-breakpoint
CREATE TABLE `screen_time_suggesties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`type` text NOT NULL,
	`start_tijd` text NOT NULL,
	`eind_tijd` text NOT NULL,
	`voorstel` text NOT NULL,
	`status` text DEFAULT 'openstaand',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`verwerkt_op` text,
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `second_brain_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer NOT NULL,
	`type` text NOT NULL,
	`titel` text,
	`inhoud` text,
	`ai_samenvatting` text,
	`ai_tags` text,
	`bron_url` text,
	`bestand_pad` text,
	`taal` text,
	`is_favoriet` integer DEFAULT 0,
	`is_gearchiveerd` integer DEFAULT 0,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`session_token` text NOT NULL,
	`apparaat` text,
	`browser` text,
	`ip_adres` text,
	`laatste_activiteit` text DEFAULT (datetime('now')),
	`vertrouwd_tot` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`beschrijving` text,
	`stappen` text DEFAULT '[]',
	`gekoppeld_aan` text,
	`actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `taken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer,
	`toegewezen_aan` integer,
	`aangemaakt_door` integer,
	`titel` text NOT NULL,
	`omschrijving` text,
	`status` text DEFAULT 'open',
	`deadline` text,
	`prioriteit` text DEFAULT 'normaal',
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`toegewezen_aan`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tijdregistraties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`project_id` integer,
	`omschrijving` text,
	`start_tijd` text NOT NULL,
	`eind_tijd` text,
	`duur_minuten` integer,
	`categorie` text DEFAULT 'development',
	`is_handmatig` integer DEFAULT 0,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projecten`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `uitgaven` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`omschrijving` text NOT NULL,
	`bedrag` real NOT NULL,
	`datum` text NOT NULL,
	`categorie` text DEFAULT 'overig',
	`leverancier` text,
	`btw_bedrag` real,
	`btw_percentage` real DEFAULT 21,
	`fiscaal_aftrekbaar` integer DEFAULT 1,
	`bonnetje_url` text,
	`aangemaakt_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`aangemaakt_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `uren_criterium` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`jaar` integer NOT NULL,
	`doel_uren` integer DEFAULT 1225,
	`behaald_uren` real DEFAULT 0,
	`zelfstandigenaftrek` integer DEFAULT 0,
	`mkb_vrijstelling` integer DEFAULT 0,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verlof` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gebruiker_id` integer,
	`start_datum` text NOT NULL,
	`eind_datum` text NOT NULL,
	`type` text DEFAULT 'vakantie',
	`status` text DEFAULT 'aangevraagd',
	`notities` text,
	`beoordeeld_door` integer,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beoordeeld_door`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `verwerkingsregister` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`verwerkingsdoel` text NOT NULL,
	`categorie_gegevens` text NOT NULL,
	`bewaartermijn` text,
	`rechtsgrond` text,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `voorlopige_aanslagen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jaar` integer NOT NULL,
	`type` text DEFAULT 'inkomstenbelasting',
	`bedrag` real NOT NULL,
	`betaald_bedrag` real DEFAULT 0,
	`status` text DEFAULT 'openstaand',
	`vervaldatum` text,
	`notities` text,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`events` text DEFAULT '[]',
	`secret` text NOT NULL,
	`actief` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`endpoint_id` integer,
	`event` text NOT NULL,
	`payload` text,
	`status_code` integer,
	`response` text,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wiki_artikelen` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`titel` text NOT NULL,
	`inhoud` text DEFAULT '',
	`categorie` text DEFAULT 'processen',
	`tags` text DEFAULT '[]',
	`auteur_id` integer,
	`gepubliceerd` integer DEFAULT 1,
	`aangemaakt_op` text DEFAULT (datetime('now')),
	`bijgewerkt_op` text DEFAULT (datetime('now')),
	FOREIGN KEY (`auteur_id`) REFERENCES `gebruikers`(`id`) ON UPDATE no action ON DELETE no action
);
