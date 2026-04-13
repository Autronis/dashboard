import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireApiKey } from "@/lib/auth";
import { mintLeadsUserJwt } from "@/lib/supabase-leads";

// POST /api/leads/edge-function/[name]
// Proxy naar Supabase Edge Functions van het lead-dashboard-v2 project.
// Forwardt de body, zet de service role key in de Authorization header.
//
// Whitelist van toegestane function namen — voorkomt dat een kwaadaardige
// request een willekeurige endpoint aan de Supabase functions kan raken.

const ALLOWED_FUNCTIONS = new Set([
  "trigger-enrichment",
  "process-enrichment-batch",
  "timeout-pending-enrichments",
  "trigger-email-generator",
  "trigger-scraper",
  "trigger-google-maps-scraper",
  "clean-emails",
  "set-thread-id",
  "upsert-lead",
  "upsert-google-maps-lead",
  "upsert-reply",
  "enrichment-done",
  "send-email",
  "test-webhook",
]);

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    await requireApiKey(req);
  } else {
    await requireAuth();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    await authenticate(req);

    const { name } = await params;
    if (!ALLOWED_FUNCTIONS.has(name)) {
      return NextResponse.json(
        { fout: `Edge function '${name}' is niet toegestaan. Whitelist heeft ${ALLOWED_FUNCTIONS.size} opties.` },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_LEADS_URL;
    const supabaseKey = process.env.SUPABASE_LEADS_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { fout: "SUPABASE_LEADS_URL / SERVICE_KEY ontbreken in env vars" },
        { status: 500 }
      );
    }

    // Lees de incoming body (mag leeg zijn — sommige functions hebben geen body)
    let body: unknown = null;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json().catch(() => null);
    }

    const upstreamRes = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        apikey: supabaseKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const upstreamText = await upstreamRes.text();
    // Probeer als JSON te parsen, anders plain text
    let upstreamBody: unknown;
    try {
      upstreamBody = JSON.parse(upstreamText);
    } catch {
      upstreamBody = { raw: upstreamText };
    }

    return NextResponse.json(
      {
        ok: upstreamRes.ok,
        status: upstreamRes.status,
        data: upstreamBody,
      },
      { status: upstreamRes.ok ? 200 : 502 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: message },
      { status: message === "Niet geauthenticeerd" ? 401 : 500 }
    );
  }
}
