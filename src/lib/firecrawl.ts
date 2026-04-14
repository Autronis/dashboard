// Minimal Firecrawl client — used by /api/animaties/generate en /api/scrape.
// Returns the markdown content of the page, optionally truncated.

export type ScrapeResult = {
  markdown: string;
  title: string | null;
  url: string;
};

export async function scrapeUrl(url: string, maxChars = 12000): Promise<ScrapeResult> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY niet ingesteld");
  }

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    success: boolean;
    data?: { markdown?: string; metadata?: { title?: string; sourceURL?: string } };
  };

  if (!data.success || !data.data?.markdown) {
    throw new Error("Geen content gevonden");
  }

  const md = data.data.markdown.slice(0, maxChars);
  return {
    markdown: md,
    title: data.data.metadata?.title ?? null,
    url: data.data.metadata?.sourceURL ?? url,
  };
}
