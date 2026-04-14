import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getSupabaseLeads, SYB_USER_ID } from "@/lib/supabase-leads";
import { prepLead, type PrepLeadInput, type PrepLeadResult } from "@/lib/lead-rebuild-prep";

// Hard cap per batch — Firecrawl search is paid per query. 20 gives Sem
// plenty for one click without burning credits if the UI misbehaves.
const MAX_BATCH = 20;
const PARALLEL_LIMIT = 4;

// POST /api/leads/prep-rebuild
// Body: { leadIds: string[] }
// Each id is a google_maps_leads.id — we fetch the rows server-side so the
// client can't inject fabricated lead data. Results are returned in the same
// order as the input ids.
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = (await req.json().catch(() => ({}))) as { leadIds?: unknown };
    const rawIds = Array.isArray(body.leadIds) ? body.leadIds : [];
    const leadIds = rawIds
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .slice(0, MAX_BATCH);

    if (leadIds.length === 0) {
      return NextResponse.json(
        { fout: "leadIds is verplicht (max 20 per batch)" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseLeads();

    // Probeer beide tabellen — LinkedIn (`leads`) is waar Syb's data nu in zit,
    // Google Maps (`google_maps_leads`) is voor de toekomst. Ids zijn uniek per
    // tabel dus we kunnen ze los vragen en mergen.
    const [linkedinRes, gmapsRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, name, website, location, search_term")
        .eq("user_id", SYB_USER_ID)
        .in("id", leadIds),
      supabase
        .from("google_maps_leads")
        .select("id, name, website, location, address, category")
        .eq("user_id", SYB_USER_ID)
        .in("id", leadIds),
    ]);

    if (linkedinRes.error) {
      return NextResponse.json(
        { fout: `Supabase error (leads): ${linkedinRes.error.message}` },
        { status: 500 }
      );
    }
    if (gmapsRes.error) {
      return NextResponse.json(
        { fout: `Supabase error (google_maps_leads): ${gmapsRes.error.message}` },
        { status: 500 }
      );
    }

    const byId = new Map<string, PrepLeadInput>();
    for (const row of linkedinRes.data ?? []) {
      // LinkedIn leads hebben geen `category` of `address`, maar wel
      // `search_term` (de query waarmee Syb ze vond, bv. "bouwbedrijven utrecht")
      // — dat is genoeg signaal voor de sector-fit classifier.
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        website: row.website,
        location: row.location,
        address: null,
        category: row.search_term,
      });
    }
    for (const row of gmapsRes.data ?? []) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        website: row.website,
        location: row.location,
        address: row.address,
        category: row.category,
      });
    }

    const ordered = leadIds
      .map((id) => byId.get(id))
      .filter((l): l is PrepLeadInput => Boolean(l));

    if (ordered.length === 0) {
      return NextResponse.json(
        { fout: "Geen leads gevonden voor de opgegeven ids" },
        { status: 404 }
      );
    }

    const results = await runWithLimit(ordered, PARALLEL_LIMIT, (lead) => prepLead(lead));

    return NextResponse.json({
      totaal: results.length,
      resultaten: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json(
      { fout: msg },
      { status: msg === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}

async function runWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(runners);
  return results;
}

export type PrepRebuildResponse = {
  totaal: number;
  resultaten: PrepLeadResult[];
};
