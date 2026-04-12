"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity, ExternalLink, RefreshCw, Loader2,
  Brain, Mail, Video, Database, CreditCard, Globe,
  CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";

interface ApiGebruik {
  verbruikt: number | string;
  limiet?: number | string;
  eenheid: string;
  percentage?: number;
  details?: string;
}

interface ApiEntry {
  naam: string;
  categorie: "ai" | "email" | "media" | "data" | "betaal" | "overig";
  status: "actief" | "niet_geconfigureerd";
  gebruik?: ApiGebruik;
  dashboardUrl?: string;
  fout?: string;
}

interface RouteBreakdown {
  route: string;
  provider: string;
  aantalCalls: number;
  kostenCent: number;
  tokens: number;
}

const categorieIcons: Record<string, typeof Brain> = {
  ai: Brain,
  email: Mail,
  media: Video,
  data: Database,
  betaal: CreditCard,
  overig: Globe,
};

const categorieLabels: Record<string, string> = {
  ai: "AI & Taal",
  email: "E-mail",
  media: "Media & Video",
  data: "Data & Opslag",
  betaal: "Betaal",
  overig: "Overig",
};

function UsageBar({ percentage }: { percentage: number }) {
  const color =
    percentage > 90 ? "bg-red-500" :
    percentage > 70 ? "bg-yellow-500" :
    "bg-autronis-accent";

  return (
    <div className="w-full h-2 bg-autronis-border rounded-full overflow-hidden mt-2">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function ApiCard({ api }: { api: ApiEntry }) {
  const CatIcon = categorieIcons[api.categorie] || Globe;
  const isConfigured = api.status === "actief";
  const hasUsage = api.gebruik && !api.fout;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 hover:border-autronis-accent/30 transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isConfigured ? "bg-autronis-accent/10" : "bg-autronis-border/50"}`}>
            <CatIcon size={18} className={isConfigured ? "text-autronis-accent" : "text-autronis-text-secondary"} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-autronis-text-primary">{api.naam}</h3>
            <span className="text-xs text-autronis-text-secondary">{categorieLabels[api.categorie]}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConfigured ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 size={12} />
              Actief
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-autronis-text-secondary">
              <XCircle size={12} />
              Niet ingesteld
            </span>
          )}
        </div>
      </div>

      {api.fout && (
        <div className="flex items-center gap-2 text-xs text-yellow-400 mb-3">
          <AlertCircle size={12} />
          <span>Kon gebruik niet ophalen</span>
        </div>
      )}

      {hasUsage && (
        <div className="mb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-autronis-text-primary">
              {api.gebruik!.verbruikt}
            </span>
            {api.gebruik!.limiet && (
              <span className="text-xs text-autronis-text-secondary">
                van {api.gebruik!.limiet} {api.gebruik!.eenheid}
              </span>
            )}
          </div>
          {api.gebruik!.percentage != null && (
            <UsageBar percentage={api.gebruik!.percentage} />
          )}
          {!api.gebruik!.limiet && !api.gebruik!.percentage && (
            <span className="text-xs text-autronis-text-secondary">{api.gebruik!.eenheid}</span>
          )}
          {api.gebruik!.details && (
            <p className="text-xs text-autronis-text-secondary mt-1.5">{api.gebruik!.details}</p>
          )}
        </div>
      )}

      {!hasUsage && isConfigured && !api.fout && (
        <p className="text-xs text-autronis-text-secondary mb-3">
          Geen automatische usage tracking beschikbaar
        </p>
      )}

      {api.dashboardUrl && (
        <a
          href={api.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-autronis-accent hover:text-autronis-accent-hover transition-colors"
        >
          Bekijk dashboard
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

const ROUTE_LABELS: Record<string, string> = {
  "/api/ai/chat": "AI Chat",
  "/api/yt-knowledge/analyze": "YouTube Analyse",
  "/api/agenda/ai-plan": "Agenda AI Planning",
  "/api/agenda/taken/schat-duur": "Taak Duurschatting",
  "/api/second-brain/verwerken": "Second Brain",
  "/api/second-brain/zoeken": "Second Brain Zoeken",
  "/api/bank/transacties/analyse": "Bank Analyse",
  "/api/bank/bonnetje": "Bonnetje Scan",
  "/api/bank/email-factuur": "Email Factuur",
  "/api/contract-analyse": "Contract Analyse",
  "/api/documenten/ai-create": "Document Generatie",
  "/api/belasting/tips/genereer": "Belasting Tips",
  "/api/ideeen/analyse": "Ideeën Analyse",
  "/api/mealplan": "Mealplan",
  "/api/mealplan/chat": "Mealplan Chat",
  "/api/radar/vraag-claude": "Radar Vraag",
  "/api/radar/week-samenvatting": "Radar Samenvatting",
  "/api/ops-room/orchestrate": "Ops Room",
  "/api/ops-room/execute": "Ops Room Execute",
  "/api/animaties/generate": "Animatie Generatie",
  "/api/content/videos/chat": "Video Chat",
  "/api/meetings/transcript": "Meeting Transcript",
  "/api/meetings/verwerk": "Meeting Verwerking",
  "/api/klanten/verrijk": "Klant Verrijking",
  "/api/screen-time/sessies": "Screen Time Sessies",
  "/api/uitgaven/scan": "Uitgaven Scan",
  "ai/client": "AI Client (Groq/Anthropic)",
};

export default function ApiGebruikPage() {
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [totaal, setTotaal] = useState<{ kostenEuro: string; aantalCalls: number } | null>(null);
  const [routeBreakdown, setRouteBreakdown] = useState<RouteBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/api-gebruik");
      if (!res.ok) throw new Error("Kon API gebruik niet ophalen");
      const data = await res.json();
      setApis(data.apis);
      setTotaal(data.totaal ?? null);
      setRouteBreakdown(data.routeBreakdown ?? []);
      if (isRefresh) addToast("Gebruik ververst", "succes");
    } catch {
      addToast("Fout bij ophalen API gebruik", "fout");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grouped = apis.reduce<Record<string, ApiEntry[]>>((acc, api) => {
    if (!acc[api.categorie]) acc[api.categorie] = [];
    acc[api.categorie].push(api);
    return acc;
  }, {});

  const categoryOrder = ["ai", "media", "email", "data", "betaal", "overig"];
  const activeCount = apis.filter(a => a.status === "actief").length;
  const withUsageCount = apis.filter(a => a.gebruik && !a.fout).length;

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-autronis-text-primary">API Gebruik</h1>
            <p className="text-sm text-autronis-text-secondary mt-1">
              Overzicht van alle externe API&apos;s en hun verbruik
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-card border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 transition-all disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Verversen
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="text-2xl font-bold text-autronis-text-primary">{apis.length}</div>
            <div className="text-xs text-autronis-text-secondary mt-1">Totaal API&apos;s</div>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="text-2xl font-bold text-emerald-400">{activeCount}</div>
            <div className="text-xs text-autronis-text-secondary mt-1">Actief</div>
          </div>
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
            <div className="text-2xl font-bold text-autronis-accent">{withUsageCount}</div>
            <div className="text-xs text-autronis-text-secondary mt-1">Met usage data</div>
          </div>
          {totaal && (
            <div className="bg-autronis-card border border-autronis-accent/30 rounded-2xl p-5">
              <div className="text-2xl font-bold text-autronis-accent">&euro;{totaal.kostenEuro}</div>
              <div className="text-xs text-autronis-text-secondary mt-1">AI kosten deze maand · {totaal.aantalCalls} calls</div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-autronis-accent" />
          </div>
        )}

        {/* API cards by category */}
        {!loading && categoryOrder.map(cat => {
          const entries = grouped[cat];
          if (!entries) return null;

          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wider mb-4">
                {categorieLabels[cat]}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {entries.map(api => (
                  <ApiCard key={api.naam} api={api} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Route breakdown */}
        {!loading && routeBreakdown.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-autronis-text-secondary uppercase tracking-wider mb-4">
              Kosten per feature
            </h2>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-autronis-border">
                    <th className="text-left p-4 text-xs font-semibold text-autronis-text-secondary">Feature</th>
                    <th className="text-left p-4 text-xs font-semibold text-autronis-text-secondary">Provider</th>
                    <th className="text-right p-4 text-xs font-semibold text-autronis-text-secondary">Calls</th>
                    <th className="text-right p-4 text-xs font-semibold text-autronis-text-secondary">Tokens</th>
                    <th className="text-right p-4 text-xs font-semibold text-autronis-text-secondary">Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {routeBreakdown.map((r, i) => {
                    const maxKosten = routeBreakdown[0]?.kostenCent || 1;
                    const barWidth = Math.max(4, (r.kostenCent / maxKosten) * 100);
                    return (
                      <tr key={i} className="border-b border-autronis-border/50 last:border-0 hover:bg-autronis-accent/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <span className="text-autronis-text-primary font-medium">
                                {ROUTE_LABELS[r.route || ""] || r.route || "Onbekend"}
                              </span>
                              {r.route && !ROUTE_LABELS[r.route] && (
                                <span className="block text-xs text-autronis-text-secondary">{r.route}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            r.provider === "anthropic" ? "bg-orange-500/10 text-orange-400" :
                            r.provider === "openai" ? "bg-emerald-500/10 text-emerald-400" :
                            "bg-blue-500/10 text-blue-400"
                          }`}>
                            {r.provider === "anthropic" ? "Claude" : r.provider === "openai" ? "GPT" : r.provider}
                          </span>
                        </td>
                        <td className="p-4 text-right text-autronis-text-secondary">{r.aantalCalls}</td>
                        <td className="p-4 text-right text-autronis-text-secondary">
                          {r.tokens >= 1_000_000 ? `${(r.tokens / 1_000_000).toFixed(1)}M` :
                           r.tokens >= 1_000 ? `${(r.tokens / 1_000).toFixed(1)}K` :
                           r.tokens}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-autronis-border rounded-full overflow-hidden">
                              <div
                                className="h-full bg-autronis-accent rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-autronis-text-primary font-medium min-w-[60px] text-right">
                              {r.kostenCent > 0 ? `€${(r.kostenCent / 100).toFixed(2)}` : "Gratis"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
