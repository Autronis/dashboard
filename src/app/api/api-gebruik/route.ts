import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

interface ApiUsageResult {
  naam: string;
  categorie: "ai" | "email" | "media" | "data" | "betaal" | "overig";
  status: "actief" | "niet_geconfigureerd";
  gebruik?: {
    verbruikt: number | string;
    limiet?: number | string;
    eenheid: string;
    percentage?: number;
  };
  dashboardUrl?: string;
  fout?: string;
}

async function fetchFalUsage(): Promise<ApiUsageResult> {
  const key = process.env.FAL_API_KEY;
  if (!key) return { naam: "FAL.ai", categorie: "media", status: "niet_geconfigureerd", dashboardUrl: "https://fal.ai/dashboard" };

  try {
    const res = await fetch("https://rest.fal.run/billing/usage", {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return {
      naam: "FAL.ai",
      categorie: "media",
      status: "actief",
      gebruik: {
        verbruikt: data.total_usage_usd ? `$${Number(data.total_usage_usd).toFixed(2)}` : data.total_usage ?? "onbekend",
        eenheid: "credits",
      },
      dashboardUrl: "https://fal.ai/dashboard/billing",
    };
  } catch (e) {
    return { naam: "FAL.ai", categorie: "media", status: "actief", fout: String(e), dashboardUrl: "https://fal.ai/dashboard/billing" };
  }
}

async function fetchFirecrawlUsage(): Promise<ApiUsageResult> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return { naam: "Firecrawl", categorie: "data", status: "niet_geconfigureerd", dashboardUrl: "https://www.firecrawl.dev/app" };

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/team/credits", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const remaining = data.data?.remaining_credits ?? data.remaining_credits;
    const used = data.data?.total_credits_used ?? data.total_credits_used;
    const total = remaining != null && used != null ? remaining + used : undefined;

    return {
      naam: "Firecrawl",
      categorie: "data",
      status: "actief",
      gebruik: {
        verbruikt: used ?? "onbekend",
        limiet: total,
        eenheid: "credits",
        percentage: total ? Math.round((used / total) * 100) : undefined,
      },
      dashboardUrl: "https://www.firecrawl.dev/app",
    };
  } catch (e) {
    return { naam: "Firecrawl", categorie: "data", status: "actief", fout: String(e), dashboardUrl: "https://www.firecrawl.dev/app" };
  }
}

function buildStaticEntries(): ApiUsageResult[] {
  return [
    {
      naam: "Anthropic (Claude)",
      categorie: "ai",
      status: process.env.ANTHROPIC_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://console.anthropic.com/settings/billing",
    },
    {
      naam: "Groq",
      categorie: "ai",
      status: process.env.GROQ_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://console.groq.com/settings/billing",
    },
    {
      naam: "OpenAI",
      categorie: "ai",
      status: process.env.OPENAI_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://platform.openai.com/usage",
    },
    {
      naam: "Resend",
      categorie: "email",
      status: process.env.RESEND_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://resend.com/overview",
    },
    {
      naam: "AWS SES",
      categorie: "email",
      status: process.env.AWS_ACCESS_KEY_ID ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://eu-west-1.console.aws.amazon.com/ses/home",
    },
    {
      naam: "KIE.ai (Runway)",
      categorie: "media",
      status: process.env.KIE_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://kie.ai/dashboard",
    },
    {
      naam: "Recall.ai",
      categorie: "media",
      status: process.env.RECALL_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://www.recall.ai/dashboard",
    },
    {
      naam: "Notion",
      categorie: "data",
      status: process.env.NOTION_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://www.notion.so/my-integrations",
    },
    {
      naam: "Supabase",
      categorie: "data",
      status: process.env.SUPABASE_URL ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://supabase.com/dashboard/project/_/settings/billing/usage",
    },
    {
      naam: "Turso",
      categorie: "data",
      status: process.env.TURSO_DATABASE_URL ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://turso.tech/app",
    },
    {
      naam: "Google Calendar",
      categorie: "overig",
      status: process.env.GOOGLE_CLIENT_ID ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://console.cloud.google.com/apis/dashboard",
    },
    {
      naam: "Mollie",
      categorie: "betaal",
      status: process.env.MOLLIE_API_KEY ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://my.mollie.com/dashboard",
    },
    {
      naam: "Revolut Business",
      categorie: "betaal",
      status: process.env.REVOLUT_CLIENT_ID ? "actief" : "niet_geconfigureerd",
      dashboardUrl: "https://business.revolut.com",
    },
  ];
}

export async function GET() {
  await requireAuth();

  const [fal, firecrawl] = await Promise.all([
    fetchFalUsage(),
    fetchFirecrawlUsage(),
  ]);

  const staticEntries = buildStaticEntries();
  const apis = [fal, firecrawl, ...staticEntries];

  return NextResponse.json({ apis });
}
