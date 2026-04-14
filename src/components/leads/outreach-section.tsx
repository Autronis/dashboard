"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  CheckCircle,
  Send,
  MessageSquare,
  Settings,
  Loader2,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePoll } from "@/lib/use-poll";

interface OutreachSettings {
  id: string;
  dag_limiet: number | null;
  emails_verstuurd_vandaag: number | null;
  laatst_gereset: string | null;
  warmup_gestart_op: string | null;
}

interface OutreachData {
  settings: OutreachSettings | null;
  counts: Record<string, number>;
  settingsError: string | null;
}

const KPI = [
  {
    key: "ready_for_review",
    label: "Wacht op review",
    icon: Clock,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
  },
  {
    key: "approved",
    label: "Goedgekeurd",
    icon: CheckCircle,
    color: "text-autronis-accent",
    bg: "bg-autronis-accent/10",
    border: "border-autronis-accent/30",
  },
  {
    key: "emailed",
    label: "Verstuurd",
    icon: Send,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  {
    key: "replied",
    label: "Beantwoord",
    icon: MessageSquare,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
] as const;

export default function OutreachSection() {
  const { addToast } = useToast();
  const [data, setData] = useState<OutreachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitDraft, setLimitDraft] = useState<number>(5);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads/outreach");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as OutreachData;
      setData(json);
      if (json.settings?.dag_limiet) setLimitDraft(json.settings.dag_limiet);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime-ish: refetch elke 15s
  usePoll(load, 15000);

  async function saveLimit() {
    if (!data?.settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/leads/outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.settings.id, dag_limiet: limitDraft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      addToast("Dag limiet bijgewerkt", "succes");
      setEditingLimit(false);
      await load();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Opslaan mislukt", "fout");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5 flex items-center justify-center text-autronis-text-secondary text-sm">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Outreach pipeline laden...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        <p className="font-medium">Kon outreach pipeline niet laden</p>
        <p className="mt-1 text-red-400/80">{error}</p>
      </div>
    );
  }

  const counts = data?.counts ?? {};
  const verstuurdVandaag = data?.settings?.emails_verstuurd_vandaag ?? 0;
  const dagLimiet = data?.settings?.dag_limiet ?? 0;
  const limietPct = dagLimiet > 0 ? Math.min(100, (verstuurdVandaag / dagLimiet) * 100) : 0;

  return (
    <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Send className="w-4 h-4 text-autronis-accent" />
          Outreach pipeline
        </h2>
        {data?.settings && !editingLimit && (
          <button
            onClick={() => setEditingLimit(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-accent/[0.05] transition-colors"
            title="Pas dag limiet aan"
          >
            <Settings className="w-3 h-3" />
            Limiet: <span className="font-semibold tabular-nums">{dagLimiet}</span>/dag
          </button>
        )}
        {editingLimit && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={500}
              value={limitDraft}
              onChange={(e) => setLimitDraft(parseInt(e.target.value || "0", 10))}
              className="w-16 bg-autronis-bg border border-autronis-accent/40 rounded-lg px-2 py-1 text-[11px] text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50"
            />
            <button
              onClick={saveLimit}
              disabled={saving}
              className="p-1 rounded-md text-autronis-accent hover:bg-autronis-accent/10 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            </button>
            <button
              onClick={() => {
                setEditingLimit(false);
                setLimitDraft(data?.settings?.dag_limiet ?? 5);
              }}
              className="text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary px-1.5"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Send progress vandaag */}
      {data?.settings && dagLimiet > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-autronis-text-secondary">
            <span>Vandaag verstuurd</span>
            <span className="tabular-nums">
              {verstuurdVandaag} / {dagLimiet}
            </span>
          </div>
          <div className="h-1.5 bg-autronis-bg rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                limietPct >= 100 ? "bg-red-400" : "bg-autronis-accent"
              )}
              style={{ width: `${limietPct}%` }}
            />
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {KPI.map((kpi) => {
          const Icon = kpi.icon;
          const value = counts[kpi.key] ?? 0;
          return (
            <div
              key={kpi.key}
              className={cn("rounded-xl border p-3", kpi.border, kpi.bg)}
            >
              <div className={cn("flex items-center gap-1.5 text-[10px] mb-1", kpi.color)}>
                <Icon className="w-3 h-3" />
                {kpi.label}
              </div>
              <div className="text-xl font-bold text-autronis-text-primary tabular-nums">
                {value}
              </div>
            </div>
          );
        })}
      </div>

      {data?.settingsError && (
        <p className="text-[10px] text-amber-400/80">
          ⚠️ Outreach settings ontbreken in Supabase ({data.settingsError}). Limiet niet beheerbaar.
        </p>
      )}
    </div>
  );
}
