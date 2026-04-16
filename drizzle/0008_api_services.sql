CREATE TABLE `api_services` (
  `id` integer PRIMARY KEY AUTOINCREMENT,
  `naam` text NOT NULL,
  `slug` text NOT NULL,
  `categorie` text NOT NULL DEFAULT 'overig',
  `omschrijving` text,
  `env_var` text,
  `dashboard_url` text,
  `tracking_type` text NOT NULL DEFAULT 'geen',
  `kosten_type` text NOT NULL DEFAULT 'infra',
  `provider_slug` text,
  `icon` text,
  `volgorde` integer DEFAULT 0,
  `is_actief` integer DEFAULT 1,
  `aangemaakt_op` text DEFAULT (datetime('now')),
  `bijgewerkt_op` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_services_slug_unique` ON `api_services` (`slug`);
--> statement-breakpoint

-- Seed data: alle services
INSERT INTO `api_services` (`naam`, `slug`, `categorie`, `omschrijving`, `env_var`, `dashboard_url`, `tracking_type`, `kosten_type`, `provider_slug`, `icon`, `volgorde`) VALUES
  ('Anthropic (Claude)', 'anthropic', 'ai', 'Core AI voor chat, analyse, content generatie', 'ANTHROPIC_API_KEY', 'https://console.anthropic.com/settings/billing', 'db', 'usage', 'anthropic', 'Brain', 1),
  ('OpenAI (GPT)', 'openai', 'ai', 'Meeting analyse, transcriptie verwerking', 'OPENAI_API_KEY', 'https://platform.openai.com/usage', 'db', 'usage', 'openai', 'Brain', 2),
  ('Groq (Llama)', 'groq', 'ai', 'Gratis snelle LLM fallback', 'GROQ_API_KEY', 'https://console.groq.com/settings/billing', 'db', 'usage', 'groq', 'Brain', 3),
  ('FAL.ai (Kling)', 'fal-ai', 'media', 'AI video generatie (image-to-video, upscaling)', 'FAL_API_KEY', 'https://fal.ai/dashboard/billing', 'api', 'usage', NULL, 'Video', 1),
  ('Firecrawl', 'firecrawl', 'overig', 'Web search & scraping voor leads en concurrenten', 'FIRECRAWL_API_KEY', 'https://www.firecrawl.dev/app', 'api', 'usage', NULL, 'Globe', 1),
  ('Resend', 'resend', 'email', 'Facturen, offertes, contracten versturen', 'RESEND_API_KEY', 'https://resend.com/overview', 'geen', 'usage', NULL, 'Mail', 1),
  ('AWS SES', 'aws-ses', 'email', 'Follow-ups en notificaties', 'AWS_ACCESS_KEY_ID', 'https://eu-west-1.console.aws.amazon.com/ses/home', 'geen', 'usage', NULL, 'Mail', 2),
  ('Recall.ai', 'recall-ai', 'media', 'Meeting opnames & transcriptie (Nova-3)', 'RECALL_API_KEY', 'https://www.recall.ai/dashboard', 'geen', 'usage', NULL, 'Video', 2),
  ('KIE AI', 'kie-ai', 'media', 'Banner & animatie generatie', 'KIE_API_KEY', 'https://kie.ai/dashboard', 'geen', 'usage', NULL, 'Video', 3),
  ('Notion', 'notion', 'data', 'Documenten, contracten, plannen, notities', 'NOTION_API_KEY', 'https://www.notion.so/my-integrations', 'geen', 'infra', NULL, 'Database', 1),
  ('Supabase (Main)', 'supabase', 'data', 'Auth, storage, database voor leads', 'SUPABASE_URL', 'https://supabase.com/dashboard/project/_/settings/billing/usage', 'geen', 'infra', NULL, 'Database', 2),
  ('Supabase (Leads)', 'supabase-leads', 'data', 'Syb''s lead-dashboard instance', 'SUPABASE_LEADS_URL', 'https://supabase.com/dashboard/project/hurzsuwaccglzoblqkxd', 'geen', 'infra', NULL, 'Database', 3),
  ('Turso', 'turso', 'data', 'SQLite database met replicatie', 'TURSO_DATABASE_URL', 'https://turso.tech/app', 'geen', 'infra', NULL, 'Database', 4),
  ('Vercel Blob', 'vercel-blob', 'data', 'File storage voor PDFs, scopes, media', 'BLOB_READ_WRITE_TOKEN', 'https://vercel.com/dashboard', 'geen', 'infra', NULL, 'Database', 5),
  ('Mollie', 'mollie', 'betaal', 'iDEAL betalingen voor facturen', 'MOLLIE_API_KEY', 'https://my.mollie.com/dashboard', 'geen', 'usage', NULL, 'CreditCard', 1),
  ('Revolut Business', 'revolut', 'betaal', 'Bankrekening sync & transacties', 'REVOLUT_CLIENT_ID', 'https://business.revolut.com', 'geen', 'infra', NULL, 'CreditCard', 2),
  ('Google Maps / Places', 'google-maps', 'overig', 'Afstanden, routes, bedrijfsinfo lookup', 'GOOGLE_MAPS_API_KEY', 'https://console.cloud.google.com/apis/dashboard', 'geen', 'usage', NULL, 'Globe', 2),
  ('GitHub', 'github', 'overig', 'Repo management, webhooks, issue tracking', 'GITHUB_TOKEN', 'https://github.com/orgs/autronis/settings/billing', 'geen', 'gratis', NULL, 'Globe', 3),
  ('Jina Reader', 'jina-reader', 'overig', 'Web scraping (gratis tier)', 'JINA_API_KEY', 'https://jina.ai/reader', 'geen', 'gratis', NULL, 'Globe', 4),
  ('Google OAuth', 'google-oauth', 'overig', 'Login, Gmail/Calendar toegang', 'GOOGLE_CLIENT_ID', 'https://console.cloud.google.com/apis/credentials', 'geen', 'gratis', NULL, 'Globe', 5);
