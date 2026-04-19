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
  "clean-emails",
  "enrichment-done",
  "log-workflow-error",
  "process-clean-emails-batch",
  "process-enrichment-batch",
  "send-email",
  "set-thread-id",
  "test-webhook",
  "timeout-pending-enrichments",
  "trigger-email-generator",
  "trigger-enrichment",
  "trigger-google-maps-scraper",
  "trigger-scraper",
  "upsert-google-maps-lead",
  "upsert-lead",
  "upsert-reply",
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

    // De edge functions in lead-dashboard-v2 valideren de Authorization header
    // als USER JWT (auth.getClaims). Service role key faalt → 'Invalid token'.
    // Dus minten we hier server-side een user JWT voor SYB_USER_ID.
    const userJwt = mintLeadsUserJwt();
    if (!userJwt) {
      return NextResponse.json(
        {
          fout:
            "SUPABASE_LEADS_JWT_SECRET ontbreekt in env vars. Vind 'm in Supabase " +
            "dashboard → Settings → API → JWT Settings → JWT Secret en voeg toe " +
            "aan .env.local én Vercel. Zonder deze key krijg je 'Invalid token' " +
            "van de edge functions omdat ze een user JWT verwachten, geen service role.",
        },
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
        Authorization: `Bearer ${userJwt}`,
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
