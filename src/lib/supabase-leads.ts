import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-leads";

// Aparte client voor de lead-dashboard-v2 Supabase instance.
// LET OP: dit is een ANDERE Supabase project dan de `administratie` Storage
// bucket die in src/lib/supabase.ts wordt gebruikt. De `leads` database
// draait op project hurzsuwaccglzoblqkxd terwijl `SUPABASE_URL` in de
// bestaande env vars naar uhdkxstedvytowbaiers (Storage project) wijst.
//
// Vereiste env vars (toevoegen aan .env.local én Vercel):
//   SUPABASE_LEADS_URL          https://hurzsuwaccglzoblqkxd.supabase.co
//   SUPABASE_LEADS_SERVICE_KEY  service role key (server-only, NOOIT in client)
//
// Alle calls gaan server-side via API routes onder /api/leads/ — geen
// client-side Supabase, geen NEXT_PUBLIC_ prefix.

let _client: SupabaseClient<Database> | null = null;

export function getSupabaseLeads(): SupabaseClient<Database> {
  if (!_client) {
    const url = process.env.SUPABASE_LEADS_URL;
    const key = process.env.SUPABASE_LEADS_SERVICE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_LEADS_URL en SUPABASE_LEADS_SERVICE_KEY zijn vereist voor de lead-integratie. " +
          "Voeg ze toe aan .env.local en Vercel environment variables. " +
          "Zie LEAD-INTEGRATIE-BRIEFING.md voor details."
      );
    }
    _client = createClient<Database>(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _client;
}

export function isLeadsSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_LEADS_URL && process.env.SUPABASE_LEADS_SERVICE_KEY);
}

// Syb's Supabase user_id — hardcoded zolang de main dashboard auth niet
// via Supabase Auth gaat. Wordt gebruikt voor user_id filters op folders
// en inserts. Vervang later door een mapping vanuit iron-session als we
// een multi-user lead systeem willen.
export const SYB_USER_ID = "9497e39a-734f-4ce4-81db-230d590064ea";
