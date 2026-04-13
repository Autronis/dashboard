"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Briefcase,
  MapPin,
  Trash2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ScraperRun {
  id: string;
  source: "linkedin" | "google_maps";
  status: "pending" | "webhook_sent" | "webhook_received" | "running" | "completed" | "failed";
  search_query: string | null;
  location: string | null;
  folder: string | null;
  max_items: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS: Record<
  ScraperRun["status"],
  { label: string; icon: typeof Clock; color: string }
> = {
  pending: { label: "Verzenden...", icon: Clock, color: "text-autronis-text-secondary" },
  webhook_sent: { label: "Verstuurd", icon: Radio, color: "text-amber-400" },
  webhook_received: { label: "Ontvangen", icon: CheckCircle2, color: "text-emerald-400" },
  running: { label: "Bezig", icon: Loader2, color: "text-blue-400" },
  completed: { label: "Voltooid", icon: CheckCircle2, color: "text-emerald-400" },
  failed: { label: "Mislukt", icon: AlertCircle, color: "text-red-400" },
};

function tijdGeleden(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin}m geleden`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}u geleden`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d geleden`;
}

export default function LeadsAutomationsPage() {
  const { addToast } = useToast();
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads/scraper-runs?limit=50");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRuns(data.runs ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh elke 30s
    return () => clearInterval(interval);
  }, [load]);

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/scraper-runs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setRuns((curr) => curr.filter((r) => r.id !== id));
      addToast("Run verwijderd", "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Verwijderen mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  async function triggerScraper(source: "linkedin" | "google_maps") {
    try {
      const res = await fetch(`/api/leads/edge-function/trigger-${source === "linkedin" ? "scraper" : "google-maps-scraper"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(`${source} scraper gestart`, "succes");
      setTimeout(load, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Trigger mislukt", "fout");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
            <Zap className="w-6 h-6 text-autronis-accent" />
            Automations
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            Scraper runs overzicht — refresht elke 30 seconden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerScraper("linkedin")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/15 text-purple-300 text-xs font-semibold hover:bg-purple-500/25 transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5" />
            LinkedIn
          </button>
          <button
            onClick={() => triggerScraper("google_maps")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors"
          >
            <MapPin className="w-3.5 h-3.5" />
            Google Maps
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && runs.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Runs laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon runs niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          Nog geen scraper runs. Klik op LinkedIn of Google Maps hierboven om er een te starten.
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="space-y-2">
          {runs.map((run) => {
            const config = STATUS[run.status];
            const Icon = config.icon;
            const animating = ["pending", "webhook_sent", "running"].includes(run.status);
            const busy = busyId === run.id;
            return (
              <div
                key={run.id}
                className="rounded-xl border border-autronis-border bg-autronis-card p-3 flex items-center gap-3"
              >
                <Icon
                  className={cn(
                    "w-4 h-4 flex-shrink-0",
                    config.color,
                    animating && "animate-pulse",
                    run.status === "running" && "animate-spin"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-autronis-text-primary truncate">
                      {run.search_query || "(geen query)"}
                      {run.location && ` — ${run.location}`}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium",
                        run.source === "linkedin"
                          ? "bg-purple-500/10 text-purple-300"
                          : "bg-autronis-accent/10 text-autronis-accent"
                      )}
                    >
                      {run.source === "linkedin" ? (
                        <Briefcase className="w-2.5 h-2.5" />
                      ) : (
                        <MapPin className="w-2.5 h-2.5" />
                      )}
                      {run.source === "linkedin" ? "LinkedIn" : "Google Maps"}
                    </span>
                    <span className={cn("text-[10px]", config.color)}>{config.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-autronis-text-secondary/60 mt-0.5">
                    <span>{tijdGeleden(run.created_at)}</span>
                    {run.max_items && <span>· max {run.max_items}</span>}
                    {run.folder && <span>· folder: {run.folder}</span>}
                    {run.error_message && (
                      <span className="text-red-400 truncate">· {run.error_message}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(run.id)}
                  disabled={busy}
                  className="p-1.5 rounded-md text-autronis-text-secondary/60 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Verwijder"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
