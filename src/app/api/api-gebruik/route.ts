import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiTokenGebruik } from "@/lib/db/schema";
import { sql, gte } from "drizzle-orm";

interface ApiUsageResult {
  naam: string;
  categorie: "ai" | "email" | "media" | "data" | "betaal" | "overig";
  status: "actief" | "niet_geconfigureerd";
  gebruik?: {
    verbruikt: number | string;
    limiet?: number | string;
    eenheid: string;
    percentage?: number;
    details?: string;
  };
  dashboardUrl?: string;
  fout?: string;
}

interface TokenStats {
  provider: string;
  totalInput: number;
  totalOutput: number;
  totalKosten: number;
  aantalCalls: number;
}

async function fetchTokenStats(): Promise<TokenStats[]> {
  try {
    // Get stats for the current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthStart = startOfMonth.toISOString().slice(0, 19).replace("T", " ");

    const rows = await db
      .select({
        provider: apiTokenGebruik.provider,
        totalInput: sql<number>`COALESCE(SUM(${apiTokenGebruik.inputTokens}), 0)`,
        totalOutput: sql<number>`COALESCE(SUM(${apiTokenGebruik.outputTokens}), 0)`,
        totalKosten: sql<number>`COALESCE(SUM(${apiTokenGebruik.kostenCent}), 0)`,
        aantalCalls: sql<number>`COUNT(*)`,
      })
      .from(apiTokenGebruik)
      .where(gte(apiTokenGebruik.aangemaaktOp, monthStart))
      .groupBy(apiTokenGebruik.provider)
      .all();

    return rows;
  } catch {
    return [];
  }
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

async function fetchAnthropicUsage(allStats: TokenStats[]): Promise<ApiUsageResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { naam: "Anthropic (Claude)", categorie: "ai", status: "niet_geconfigureerd", dashboardUrl: "https://console.anthropic.com/settings/billing" };
  }

  const stats = allStats.find(s => s.provider === "anthropic");

  if (!stats || stats.aantalCalls === 0) {
    return {
      naam: "Anthropic (Claude)",
      categorie: "ai",
      status: "actief",
      gebruik: {
        verbruikt: "Nog geen data",
        eenheid: "tokens",
        details: "Tracking actief — gebruik wordt automatisch bijgehouden",
      },
      dashboardUrl: "https://console.anthropic.com/settings/billing",
    };
  }

  const totalTokens = stats.totalInput + stats.totalOutput;
  const kostenEuro = (stats.totalKosten / 100).toFixed(2);

  return {
    naam: "Anthropic (Claude)",
    categorie: "ai",
    status: "actief",
    gebruik: {
      verbruikt: `€${kostenEuro}`,
      eenheid: "deze maand",
      details: `${formatTokens(totalTokens)} tokens (${formatTokens(stats.totalInput)} in / ${formatTokens(stats.totalOutput)} uit) · ${stats.aantalCalls} calls`,
    },
    dashboardUrl: "https://console.anthropic.com/settings/billing",
  };
}

async function fetchOpenAIUsage(allStats: TokenStats[]): Promise<ApiUsageResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { naam: "OpenAI (GPT)", categorie: "ai", status: "niet_geconfigureerd", dashboardUrl: "https://platform.openai.com/usage" };
  }

  const stats = allStats.find(s => s.provider === "openai");

  if (!stats || stats.aantalCalls === 0) {
    return {
      naam: "OpenAI (GPT)",
      categorie: "ai",
      status: "actief",
      gebruik: {
        verbruikt: "Nog geen data",
        eenheid: "tokens",
        details: "Tracking actief — gebruik wordt automatisch bijgehouden",
      },
      dashboardUrl: "https://platform.openai.com/usage",
    };
  }

  const totalTokens = stats.totalInput + stats.totalOutput;
  const kostenEuro = (stats.totalKosten / 100).toFixed(2);

  return {
    naam: "OpenAI (GPT)",
    categorie: "ai",
    status: "actief",
    gebruik: {
      verbruikt: `€${kostenEuro}`,
      eenheid: "deze maand",
      details: `${formatTokens(totalTokens)} tokens (${formatTokens(stats.totalInput)} in / ${formatTokens(stats.totalOutput)} uit) · ${stats.aantalCalls} calls`,
    },
    dashboardUrl: "https://platform.openai.com/usage",
  };
}

async function fetchGroqUsage(allStats: TokenStats[]): Promise<ApiUsageResult> {
  if (!process.env.GROQ_API_KEY) {
    return { naam: "Groq", categorie: "ai", status: "niet_geconfigureerd", dashboardUrl: "https://console.groq.com/settings/billing" };
  }

  const stats = allStats.find(s => s.provider === "groq");

  if (!stats || stats.aantalCalls === 0) {
    return {
      naam: "Groq",
      categorie: "ai",
      status: "actief",
      gebruik: {
        verbruikt: "Nog geen data",
        eenheid: "tokens",
        details: "Gratis tier — tracking actief",
      },
      dashboardUrl: "https://console.groq.com/settings/billing",
    };
  }

  const totalTokens = stats.totalInput + stats.totalOutput;

  return {
    naam: "Groq",
    categorie: "ai",
    status: "actief",
    gebruik: {
      verbruikt: formatTokens(totalTokens),
      eenheid: "tokens deze maand",
      details: `${formatTokens(stats.totalInput)} in / ${formatTokens(stats.totalOutput)} uit · ${stats.aantalCalls} calls · Gratis`,
    },
    dashboardUrl: "https://console.groq.com/settings/billing",
  };
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

async function fetchRouteBreakdown(): Promise<Array<{ route: string | null; provider: string; aantalCalls: number; kostenCent: number; tokens: number }>> {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthStart = startOfMonth.toISOString().slice(0, 19).replace("T", " ");

    const rows = await db
      .select({
        route: apiTokenGebruik.route,
        provider: apiTokenGebruik.provider,
        aantalCalls: sql<number>`COUNT(*)`,
        kostenCent: sql<number>`COALESCE(SUM(${apiTokenGebruik.kostenCent}), 0)`,
        tokens: sql<number>`COALESCE(SUM(${apiTokenGebruik.inputTokens}) + SUM(${apiTokenGebruik.outputTokens}), 0)`,
      })
      .from(apiTokenGebruik)
      .where(gte(apiTokenGebruik.aangemaaktOp, monthStart))
      .groupBy(apiTokenGebruik.route, apiTokenGebruik.provider)
      .orderBy(sql`SUM(${apiTokenGebruik.kostenCent}) DESC`)
      .all();

    return rows;
  } catch {
    return [];
  }
}

export async function GET() {
  await requireAuth();

  const allStats = await fetchTokenStats();

  const [anthropic, openai, groq, fal, firecrawl] = await Promise.all([
    fetchAnthropicUsage(allStats),
    fetchOpenAIUsage(allStats),
    fetchGroqUsage(allStats),
    fetchFalUsage(),
    fetchFirecrawlUsage(),
  ]);

  const staticEntries = buildStaticEntries();
  const apis = [anthropic, openai, groq, fal, firecrawl, ...staticEntries];

  // Total AI costs this month
  const totaalAiKostenCent = allStats.reduce((sum, s) => sum + s.totalKosten, 0);
  const totaalAiCalls = allStats.reduce((sum, s) => sum + s.aantalCalls, 0);

  // Per-route breakdown for cost insights
  const routeBreakdown = await fetchRouteBreakdown();

  return NextResponse.json({
    apis,
    totaal: {
      kostenEuro: (totaalAiKostenCent / 100).toFixed(2),
      aantalCalls: totaalAiCalls,
    },
    routeBreakdown,
  });
}
