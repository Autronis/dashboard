import { NextRequest, NextResponse } from "next/server";
import { getSupabaseLeads, SYB_USER_ID } from "@/lib/supabase-leads";
import { requireAuth, requireApiKey } from "@/lib/auth";

const WEBHOOK_URL = "https://n8n.srv1166699.hstgr.cloud/webhook/website-leads-search";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

// POST /api/leads/website-leads/search
// Body: { query: string, city: string, maxResults?: number }
// Slaat een search record op in Supabase en triggert de n8n Google Maps
// scraper webhook. De resultaten komen asynchroon binnen in website_leads.
export async function POST(req: NextRequest) {
  try {
    await authenticate(req);

    const body = (await req.json()) as {
      query?: string;
      city?: string;
      maxResults?: number;
    };
    const query = body.query?.trim();
    const city = body.city?.trim();
    const maxResults = Math.max(1, Math.min(500, body.maxResults ?? 50));

    if (!query || !city) {
      return NextResponse.json(
        { fout: "query en city zijn verplicht" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseLeads();

    // 1. Insert search record
    const { data: searchRecord, error: insertErr } = await supabase
      .from("website_lead_searches")
      .insert({
        user_id: SYB_USER_ID,
        query,
        city,
        source: "google_maps",
        max_results: maxResults,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json(
        { fout: `Supabase insert failed: ${insertErr.message}` },
        { status: 500 }
      );
    }

    // 2. Trigger n8n webhook (best effort — als die faalt is de search record er wel)
    let webhookOk = false;
    let webhookError: string | null = null;
    try {
      const searchQuery = `${query} ${city}`;
      const webhookRes = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "google_maps",
          userId: SYB_USER_ID,
          searchQuery,
          apifyInput: {
            searchStringsArray: [query],
            locationQuery: `${city}, Nederland`,
            maxCrawledPlacesPerSearch: maxResults,
            website: "withoutWebsite",
            scrapeContacts: true,
            maxImages: 0,
            skipClosedPlaces: false,
          },
        }),
      });
      webhookOk = webhookRes.ok;
      if (!webhookOk) {
        webhookError = `n8n responded ${webhookRes.status}`;
      }
    } catch (e) {
      webhookError = e instanceof Error ? e.message : "Unknown webhook error";
    }

    // 3. Update last_run op de search record
    if (searchRecord && webhookOk) {
      await supabase
        .from("website_lead_searches")
        .update({ last_run: new Date().toISOString() })
        .eq("id", searchRecord.id);
    }

    return NextResponse.json({
      ok: true,
      search: searchRecord,
      webhookOk,
      webhookError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
