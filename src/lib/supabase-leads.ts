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

// HS256 JWT signer voor Supabase Edge Functions. De edge functions in het
// lead-dashboard-v2 project valideren de Authorization header via
// `auth.getClaims(token)` — dat verwacht een USER JWT (gesigneerd met de
// project JWT secret), niet de service role key. Omdat ons dashboard geen
// Supabase Auth user heeft (we gebruiken iron-session), minten we hier zelf
// een korte-levende user JWT voor SYB_USER_ID.
//
// Vereist env var SUPABASE_LEADS_JWT_SECRET. Vind 'm in Supabase dashboard:
//   Settings → API → JWT Settings → JWT Secret
//
// Als de env var ontbreekt valt mintLeadsUserJwt() terug op null — de
// proxy gebruikt dan de service role key (wat voor de meeste edge functions
// een 401 'Invalid token' oplevert, met een duidelijke hint in de response).
import { createHmac } from "crypto";

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function mintLeadsUserJwt(userId: string = SYB_USER_ID, ttlSeconds = 3600): string | null {
  const secret = process.env.SUPABASE_LEADS_JWT_SECRET;
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + ttlSeconds,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  const signatureB64 = base64UrlEncode(signature);
  return `${signingInput}.${signatureB64}`;
}
