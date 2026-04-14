"use client";

import { useState } from "react";
import { Globe, Loader2, Copy, Check, ExternalLink, Trash2 } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";

type ScrapeResult = {
  markdown: string;
  title: string | null;
  url: string;
};

export default function ScrapePage() {
  const { addToast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [copied, setCopied] = useState(false);

  const scrape = async () => {
    if (!url.trim()) {
      addToast("Plak een URL", "fout");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Scrape mislukt");
      setResult(data);
      addToast("Content opgehaald", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Scrape mislukt", "fout");
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    addToast("Gekopieerd", "succes");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-autronis-accent/10 flex items-center justify-center">
              <Globe className="w-3.5 h-3.5 text-autronis-accent" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-autronis-accent">
              Website Scrape
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-autronis-text-primary">
            Scrape een <span className="text-autronis-text-secondary">URL</span>
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-2">
            Haal de complete content van een website op via Firecrawl. Gebruik daarna de
            output om Claude Code (bv. <code className="px-1.5 py-0.5 rounded bg-autronis-card text-autronis-accent text-xs">scroll-stop build</code>)
            context te geven over het bedrijf waar je een site voor bouwt.
          </p>
        </div>

        {/* Input */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
              URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://voorbeeld.nl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && scrape()}
                className="flex-1 px-4 py-3 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
              />
              <button
                type="button"
                onClick={scrape}
                disabled={loading || !url.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50 hover:bg-autronis-accent-hover transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scrapen...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Scrape
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1">
                  Resultaat
                </div>
                <div className="text-base font-semibold text-autronis-text-primary truncate">
                  {result.title ?? "(geen titel)"}
                </div>
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-autronis-text-secondary hover:text-autronis-accent mt-1 truncate"
                >
                  <ExternalLink className="w-3 h-3" />
                  {result.url}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-autronis-text-secondary tabular-nums">
                  {result.markdown.length.toLocaleString("nl-NL")} tekens
                </span>
                <button
                  type="button"
                  onClick={copyAll}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-primary hover:bg-autronis-card hover:border-autronis-accent/40 text-sm font-semibold transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      Gekopieerd
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Kopieer alles
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="p-2 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-secondary hover:text-red-400 transition-colors"
                  title="Wis resultaat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-autronis-border bg-autronis-bg p-4 max-h-[600px] overflow-auto">
              <pre className="text-xs text-autronis-text-primary whitespace-pre-wrap font-mono leading-relaxed">
                {result.markdown}
              </pre>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
