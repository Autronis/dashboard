import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { klanten, salesEngineScans } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { getSupabaseLeads, SYB_USER_ID } from "@/lib/supabase-leads";
import { eq, ne } from "drizzle-orm";

interface Candidate {
  bedrijfsnaam: string;
  website: string;
  email?: string;
  supabaseLeadId?: string;
  bron: "supabase-leads" | "supabase-website-leads" | "klanten";
}

function normaliseHostname(raw: string): string {
  try {
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    const url = new URL(withProto);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function candidateKey(bedrijfsnaam: string, website: string): string {
  return `${bedrijfsnaam.toLowerCase().trim()}|${normaliseHostname(website)}`;
}

export async function GET() {
  try {
    await requireAuth();

    // 1. Collect scan-blocking set: anything not-failed stays out of the queue
    const existingScans = await db
      .select({
        websiteUrl: salesEngineScans.websiteUrl,
        supabaseLeadId: salesEngineScans.supabaseLeadId,
      })
      .from(salesEngineScans)
      .where(ne(salesEngineScans.status, "failed"))
      .all();

    const scannedSupabaseIds = new Set(
      existingScans.map((s) => s.supabaseLeadId).filter(Boolean) as string[],
    );
    const scannedHostnames = new Set(existingScans.map((s) => normaliseHostname(s.websiteUrl)));

    const candidates: Candidate[] = [];
    const seen = new Set<string>();

    function add(c: Candidate) {
      const key = candidateKey(c.bedrijfsnaam, c.website);
      if (seen.has(key)) return;
      if (scannedHostnames.has(normaliseHostname(c.website))) return;
      if (c.supabaseLeadId && scannedSupabaseIds.has(c.supabaseLeadId)) return;
      seen.add(key);
      candidates.push(c);
    }

    // 2. Supabase leads (Syb's lead-dashboard)
    const supabase = getSupabaseLeads();
    const supabaseLeads: Array<{
      id: string;
      name: string | null;
      website: string | null;
      emails: string | null;
    }> = [];
    {
      const PAGE_SIZE = 1000;
      let page = 0;
      while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("leads")
          .select("id,name,website,emails")
          .eq("user_id", SYB_USER_ID)
          .not("website", "is", null)
          .range(from, to);
        if (error) break;
        if (!data || data.length === 0) break;
        supabaseLeads.push(...(data as typeof supabaseLeads));
        if (data.length < PAGE_SIZE) break;
        page++;
        if (page > 50) break;
      }
    }

    for (const lead of supabaseLeads) {
      if (!lead.website?.trim()) continue;
      let email: string | undefined;
      try {
        const parsed = lead.emails ? JSON.parse(lead.emails) : null;
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
          email = parsed[0];
        }
      } catch {
        // ignore
      }
      add({
        bedrijfsnaam: lead.name || "Onbekend",
        website: lead.website,
        email,
        supabaseLeadId: lead.id,
        bron: "supabase-leads",
      });
    }

    // 3. Supabase website_leads
    const websiteLeads: Array<{
      id: string;
      name: string | null;
      website_url: string | null;
      email: string | null;
    }> = [];
    {
      const PAGE_SIZE = 1000;
      let page = 0;
      while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("website_leads")
          .select("id,name,website_url,email")
          .not("website_url", "is", null)
          .range(from, to);
        if (error) break;
        if (!data || data.length === 0) break;
        websiteLeads.push(...(data as typeof websiteLeads));
        if (data.length < PAGE_SIZE) break;
        page++;
        if (page > 50) break;
      }
    }

    for (const lead of websiteLeads) {
      if (!lead.website_url?.trim()) continue;
      add({
        bedrijfsnaam: lead.name || "Onbekend",
        website: lead.website_url,
        email: lead.email ?? undefined,
        supabaseLeadId: lead.id,
        bron: "supabase-website-leads",
      });
    }

    // 4. Turso klanten with website
    const actieveKlanten = await db
      .select({
        id: klanten.id,
        bedrijfsnaam: klanten.bedrijfsnaam,
        website: klanten.website,
        email: klanten.email,
      })
      .from(klanten)
      .where(eq(klanten.isActief, 1))
      .all();

    for (const k of actieveKlanten) {
      if (!k.website?.trim()) continue;
      add({
        bedrijfsnaam: k.bedrijfsnaam,
        website: k.website,
        email: k.email ?? undefined,
        bron: "klanten",
      });
    }

    return NextResponse.json({
      candidates,
      totaal: candidates.length,
      reedsGescand: existingScans.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 },
    );
  }
}
