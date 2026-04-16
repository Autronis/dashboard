import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiTokenGebruik, apiServices } from "@/lib/db/schema";
import { sql, gte, eq, asc } from "drizzle-orm";

interface ServiceResponse {
  id: number;
  naam: string;
  slug: string;
  categorie: string;
  omschrijving: string | null;
  dashboardUrl: string | null;
  kostenType: string;
  status: "actief" | "niet_geconfigureerd";
  laatsteCall?: string | null;
  gebruik?: {
    verbruikt: string;
    limiet?: string;
    eenheid: string;
    percentage?: number;
    details?: string;
  };
  fout?: string;
}

interface TokenStats {
  provider: string;
  totalInput: number;
  totalOutput: number;
  totalKosten: number;
  aantalCalls: number;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function getMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchTokenStats(monthStart: string): Promise<TokenStats[]> {
  try {
    return await db
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
  } catch {
    return [];
  }
}

async function fetchLaatsteCallPerProvider(): Promise<Record<string, string>> {
  try {
    const rows = await db
      .select({
        provider: apiTokenGebruik.provider,
        laatsteCall: sql<string>`MAX(${apiTokenGebruik.aangemaaktOp})`,
      })
      .from(apiTokenGebruik)
      .groupBy(apiTokenGebruik.provider)
      .all();

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.provider] = row.laatsteCall;
    }
    return result;
  } catch {
    return {};
  }
}

function checkEnvVar(envVar: string | null): boolean {
  if (!envVar) return true;
  return !!process.env[envVar];
}

async function fetchFalUsage(): Promise<{ gebruik?: ServiceResponse["gebruik"]; fout?: string }> {
  const key = process.env.FAL_API_KEY;
  if (!key) return {};

  try {
    const res = await fetch("https://rest.fal.run/billing/usage", {
      headers: { Authorization: `Key ${key}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return {
      gebruik: {
        verbruikt: data.total_usage_usd ? `$${Number(data.total_usage_usd).toFixed(2)}` : String(data.total_usage ?? "onbekend"),
        eenheid: "credits",
      },
    };
  } catch (e) {
    return { fout: String(e) };
  }
}

async function fetchFirecrawlUsage(): Promise<{ gebruik?: ServiceResponse["gebruik"]; fout?: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return {};

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
      gebruik: {
        verbruikt: String(used ?? "onbekend"),
        limiet: total != null ? String(total) : undefined,
        eenheid: "credits",
        percentage: total ? Math.round((used / total) * 100) : undefined,
      },
    };
  } catch (e) {
    return { fout: String(e) };
  }
}

async function fetchRouteBreakdown(monthStart: string) {
  try {
    return await db
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
  } catch {
    return [];
  }
}

const apiFetchers: Record<string, () => Promise<{ gebruik?: ServiceResponse["gebruik"]; fout?: string }>> = {
  "fal-ai": fetchFalUsage,
  "firecrawl": fetchFirecrawlUsage,
};

export async function GET() {
  await requireAuth();

  // 1. Load service registry from DB
  const registeredServices = await db
    .select()
    .from(apiServices)
    .where(eq(apiServices.isActief, 1))
    .orderBy(asc(apiServices.categorie), asc(apiServices.volgorde));

  const monthStart = getMonthStart();

  // 2. Fetch all tracking data in parallel
  const [allStats, laatsteCallMap, routeBreakdown] = await Promise.all([
    fetchTokenStats(monthStart),
    fetchLaatsteCallPerProvider(),
    fetchRouteBreakdown(monthStart),
  ]);

  // 3. Fetch API-tracked usage in parallel
  const apiSlugs = registeredServices
    .filter(s => s.trackingType === "api" && apiFetchers[s.slug])
    .map(s => s.slug);

  const apiResults: Record<string, { gebruik?: ServiceResponse["gebruik"]; fout?: string }> = {};
  const apiPromises = apiSlugs.map(async (slug) => {
    apiResults[slug] = await apiFetchers[slug]();
  });
  await Promise.all(apiPromises);

  // 4. Build response per service
  const services: ServiceResponse[] = registeredServices.map(svc => {
    const isConfigured = checkEnvVar(svc.envVar);
    const base: ServiceResponse = {
      id: svc.id,
      naam: svc.naam,
      slug: svc.slug,
      categorie: svc.categorie,
      omschrijving: svc.omschrijving,
      dashboardUrl: svc.dashboardUrl,
      kostenType: svc.kostenType,
      status: isConfigured ? "actief" : "niet_geconfigureerd",
    };

    // DB-tracked: add usage from token stats + laatste call
    if (svc.trackingType === "db" && svc.providerSlug) {
      const stats = allStats.find(s => s.provider === svc.providerSlug);
      base.laatsteCall = laatsteCallMap[svc.providerSlug] ?? null;

      if (stats && stats.aantalCalls > 0) {
        const totalTokens = stats.totalInput + stats.totalOutput;
        const kostenEuro = (stats.totalKosten / 100).toFixed(2);
        base.gebruik = {
          verbruikt: `€${kostenEuro}`,
          eenheid: "deze maand",
          details: `${formatTokens(totalTokens)} tokens (${formatTokens(stats.totalInput)} in / ${formatTokens(stats.totalOutput)} uit) · ${stats.aantalCalls} calls`,
        };
      } else if (isConfigured) {
        base.gebruik = {
          verbruikt: "Nog geen data",
          eenheid: "tokens",
          details: "Tracking actief — gebruik wordt automatisch bijgehouden",
        };
      }
    }

    // API-tracked: add fetched usage
    if (svc.trackingType === "api" && apiResults[svc.slug]) {
      const result = apiResults[svc.slug];
      if (result.gebruik) base.gebruik = result.gebruik;
      if (result.fout) base.fout = result.fout;
    }

    return base;
  });

  // 5. AI detail aggregate
  const aiProviders = registeredServices
    .filter(s => s.categorie === "ai" && s.trackingType === "db" && s.providerSlug)
    .map(svc => {
      const stats = allStats.find(s => s.provider === svc.providerSlug);
      return {
        naam: svc.naam,
        calls: stats?.aantalCalls ?? 0,
        tokens: {
          input: stats?.totalInput ?? 0,
          output: stats?.totalOutput ?? 0,
          totaal: (stats?.totalInput ?? 0) + (stats?.totalOutput ?? 0),
        },
        kostenEuro: stats ? (stats.totalKosten / 100).toFixed(2) : "0.00",
        laatsteCall: laatsteCallMap[svc.providerSlug!] ?? null,
      };
    });

  const totaalAiKostenCent = allStats.reduce((sum, s) => sum + s.totalKosten, 0);
  const totaalAiCalls = allStats.reduce((sum, s) => sum + s.aantalCalls, 0);

  return NextResponse.json({
    services,
    aiDetail: {
      totaalKostenEuro: (totaalAiKostenCent / 100).toFixed(2),
      totaalCalls: totaalAiCalls,
      providers: aiProviders,
    },
    routeBreakdown,
  });
}
