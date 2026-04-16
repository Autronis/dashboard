// Firecrawl search client — searchWeb() is nog in gebruik voor SERP checks
// in lead-rebuild-prep (fresh mode). Wordt vervangen zodra Syb zijn SerpAPI
// integratie aanbiedt.
//
// scrapeUrl() is VERWIJDERD — alle scrape calls zijn gemigreerd naar
// src/lib/scraper.ts (Jina Reader + custom fallback, gratis, geen API key).

export type SearchResult = {
  url: string;
  title: string;
  description: string | null;
};

/**
 * Google-style web search via Firecrawl's /v1/search endpoint.
 * Returns up to `limit` results. Throws if the API key is missing or the call fails.
 */
export async function searchWeb(query: string, limit = 5): Promise<SearchResult[]> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY niet ingesteld");
  }

  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl search error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    success: boolean;
    data?: Array<{ url: string; title?: string; description?: string }>;
  };

  if (!data.success || !Array.isArray(data.data)) return [];
  return data.data.map((r) => ({
    url: r.url,
    title: r.title ?? r.url,
    description: r.description ?? null,
  }));
}
