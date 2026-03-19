CREATE TABLE IF NOT EXISTS `contracten` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `klant_id` integer REFERENCES `klanten`(`id`),
  `titel` text NOT NULL,
  `type` text NOT NULL DEFAULT 'samenwerkingsovereenkomst',
  `inhoud` text DEFAULT '',
  `status` text DEFAULT 'concept',
  `aangemaakt_door` integer REFERENCES `gebruikers`(`id`),
  `aangemaakt_op` text DEFAULT (datetime('now')),
  `bijgewerkt_op` text DEFAULT (datetime('now'))
);
