"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  CheckCircle,
  Send,
  MessageSquare,
  Settings,
  Loader2,
  Sparkles,
  AlertTriangle,
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
  aantal_inboxes: number;
  auto_verdelen: boolean;
  per_inbox_limiet: number | null;
}

interface OutreachData {
  settings: OutreachSettings | null;
  counts: Record<string, number>;
  settingsError: string | null;
}

const KPI = [
  {
    key: "ready_for_generation",
    label: "Wacht op generatie",
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
  },
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
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draftLimit, setDraftLimit] = useState(5);
  const [draftInboxes, setDraftInboxes] = useState(1);
  const [draftAutoVerdelen, setDraftAutoVerdelen] = useState(true);
  const [draftPerInbox, setDraftPerInbox] = useState(0);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/leads/outreach");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as OutreachData;
      setData(json);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 15000);

  function openSettings() {
    const s = data?.settings;
    setDraftLimit(s?.dag_limiet ?? 5);
    setDraftInboxes(s?.aantal_inboxes ?? 1);
    setDraftAutoVerdelen(s?.auto_verdelen ?? true);
    setDraftPerInbox(s?.per_inbox_limiet ?? 0);
    setShowSettings(true);
  }

  const computedPerInbox = draftAutoVerdelen
    ? Math.floor(draftLimit / Math.max(1, draftInboxes))
    : draftPerInbox;

  async function saveSettings() {
    if (!data?.settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/leads/outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.settings.id,
          dag_limiet: draftLimit,
          aantal_inboxes: draftInboxes,
          auto_verdelen: draftAutoVerdelen,
          per_inbox_limiet: computedPerInbox,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      addToast("Limieten bijgewerkt", "succes");
      setShowSettings(false);
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
  const limietBereikt = dagLimiet > 0 && verstuurdVandaag >= dagLimiet;
  const approvedCount = counts.approved ?? 0;

  return (
    <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Send className="w-4 h-4 text-autronis-accent" />
          Outreach pipeline
        </h2>
        {data?.settings && (
          <button
            onClick={openSettings}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-accent/[0.05] transition-colors"
            title="Limieten instellen"
          >
            <Settings className="w-3 h-3" />
            Limiet: <span className="font-semibold tabular-nums">{dagLimiet}</span>/dag
            {data.settings.aantal_inboxes > 1 && (
              <span className="text-autronis-text-secondary/60">
                · {data.settings.aantal_inboxes} inboxes
              </span>
            )}
          </button>
        )}
      </div>

      {/* Queue warning — approved wacht op verzending maar daglimiet bereikt */}
      {approvedCount > 0 && limietBereikt && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <span className="text-xs text-orange-400">
            <span className="font-semibold tabular-nums">{approvedCount}</span> mails
            wachten op verzending — daglimiet bereikt
          </span>
        </div>
      )}

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
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

      {/* Settings panel — uitklapbaar */}
      {showSettings && (
        <div className="rounded-xl border border-autronis-accent/30 bg-autronis-bg/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-autronis-text-primary">
              Limieten instellen
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary"
            >
              Annuleren
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-autronis-text-secondary mb-1 block">
                Totaal dag limiet
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={draftLimit}
                onChange={(e) => setDraftLimit(parseInt(e.target.value || "1", 10))}
                className="w-full bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50"
              />
              <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
                Mails per dag over alle inboxes.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-medium text-autronis-text-secondary mb-1 block">
                Aantal inboxes
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={draftInboxes}
                onChange={(e) => setDraftInboxes(parseInt(e.target.value || "1", 10))}
                className="w-full bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50"
              />
              <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
                Verzendende domeinen.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs text-autronis-text-primary">
            <input
              type="checkbox"
              checked={draftAutoVerdelen}
              onChange={(e) => setDraftAutoVerdelen(e.target.checked)}
              className="rounded border-autronis-border accent-autronis-accent"
            />
            Automatisch verdelen over inboxes
          </label>

          <div>
            <label className="text-[11px] font-medium text-autronis-text-secondary mb-1 block">
              Per inbox limiet
              {draftAutoVerdelen && (
                <span className="text-[10px] text-autronis-text-secondary/60 ml-2">
                  (berekend: {computedPerInbox})
                </span>
              )}
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={computedPerInbox}
              onChange={(e) => setDraftPerInbox(parseInt(e.target.value || "1", 10))}
              disabled={draftAutoVerdelen}
              className="w-full bg-autronis-card border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50 disabled:opacity-60"
            />
            <p className="text-[10px] text-autronis-text-secondary/60 mt-1">
              {draftAutoVerdelen
                ? `${draftLimit} ÷ ${draftInboxes} = ${computedPerInbox} per inbox`
                : "Handmatig per-inbox limiet"}
            </p>
          </div>

          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Opslaan
          </button>
        </div>
      )}

      {data?.settingsError && (
        <p className="text-[10px] text-amber-400/80">
          Outreach settings ontbreken in Supabase ({data.settingsError}). Limieten niet beheerbaar.
        </p>
      )}
    </div>
  );
}
