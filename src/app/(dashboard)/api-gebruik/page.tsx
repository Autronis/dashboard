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
}

interface ApiEntry {
  naam: string;
  categorie: "ai" | "email" | "media" | "data" | "betaal" | "overig";
  status: "actief" | "niet_geconfigureerd";
  gebruik?: ApiGebruik;
  dashboardUrl?: string;
  fout?: string;
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

export default function ApiGebruikPage() {
  const [apis, setApis] = useState<ApiEntry[]>([]);
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
        <div className="grid grid-cols-3 gap-4">
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
      </div>
    </PageTransition>
  );
}
