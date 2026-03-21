CREATE TABLE IF NOT EXISTS `agent_activiteit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agent_id` text NOT NULL,
	`agent_type` text NOT NULL,
	`project` text NOT NULL,
	`laatste_actie` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'actief' NOT NULL,
	`tokens_gebruikt` integer DEFAULT 0,
	`laatst_gezien` text DEFAULT (datetime('now')),
	`aangemaakt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_activiteit_agent_id` ON `agent_activiteit` (`agent_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_agent_activiteit_status` ON `agent_activiteit` (`status`);
