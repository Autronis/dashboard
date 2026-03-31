"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, CheckCircle2, AlertTriangle, Pause, HelpCircle, Plus,
  Loader2, Trash2, RefreshCw, ExternalLink, Clock, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

type AutomatieStatus = "actief" | "fout" | "gepauzeerd" | "onbekend";
type AutomatieType = "webhook" | "cron" | "integration" | "n8n" | "make" | "zapier" | "api" | "overig";

interface Automatie {
  id: number;
  naam: string;
  type: AutomatieType;
  url?: string | null;
  status: AutomatieStatus;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  notities?: string | null;
  klantId: number;
  klantNaam: string;
}

interface StatusData {
  automaties: Automatie[];
  kpis: { totaal: number; fouten: number; actief: number; onbekend: number };
}

const statusConfig: Record<AutomatieStatus, { label: string; color: string; bg: string; border: string; strip: string; icon: typeof CheckCircle2 }> = {
  actief: { label: "Actief", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", strip: "bg-emerald-400", icon: CheckCircle2 },
  fout: { label: "Fout", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", strip: "bg-red-400", icon: AlertTriangle },
  gepauzeerd: { label: "Gepauzeerd", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", strip: "bg-amber-400", icon: Pause },
  onbekend: { label: "Onbekend", color: "text-autronis-text-secondary", bg: "bg-autronis-border/30", border: "border-autronis-border", strip: "bg-autronis-border", icon: HelpCircle },
};

const TYPE_BADGES: Record<AutomatieType, string> = {
  webhook: "bg-blue-500/15 text-blue-400",
  cron: "bg-purple-500/15 text-purple-400",
  integration: "bg-autronis-accent/15 text-autronis-accent",
  n8n: "bg-orange-500/15 text-orange-400",
  make: "bg-violet-500/15 text-violet-400",
  zapier: "bg-yellow-500/15 text-yellow-400",
  api: "bg-slate-500/15 text-slate-400",
  overig: "bg-autronis-border text-autronis-text-secondary",
};

function timeSince(iso: string | null | undefined): string {
  if (!iso) return "Nooit";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Zojuist";
  if (mins < 60) return `${mins}m geleden`;
  const uren = Math.floor(mins / 60);
  if (uren < 24) return `${uren}u geleden`;
  return `${Math.floor(uren / 24)}d geleden`;
}

export default function ClientStatusPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNieuw, setShowNieuw] = useState(false);
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [nieuwKlantId, setNieuwKlantId] = useState<number | null>(null);
  const [nieuwType, setNieuwType] = useState<AutomatieType>("overig");
  const [nieuwUrl, setNieuwUrl] = useState("");
  const [savingNieuw, setSavingNieuw] = useState(false);
  const [klanten, setKlanten] = useState<{ id: number; bedrijfsnaam: string }[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, klantRes] = await Promise.all([
        fetch("/api/client-status"),
        fetch("/api/klanten"),
      ]);
      const statusJson = await statusRes.json();
      const klantJson = await klantRes.json() as { klanten: typeof klanten };
      if (!statusRes.ok || !statusJson.kpis) {
        addToast(statusJson.fout ?? "Kon status niet laden", "fout");
        return;
      }
      setData(statusJson as StatusData);
      setKlanten(klantJson.klanten ?? []);
    } catch {
      addToast("Kon data niet laden", "fout");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateStatus = useCallback(async (id: number, status: AutomatieStatus) => {
    setUpdatingId(id);
    try {
      await fetch("/api/client-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, lastRunAt: new Date().toISOString(), lastRunStatus: status === "actief" ? "ok" : "fout" }),
      });
      fetchData();
    } catch {
      addToast("Updaten mislukt", "fout");
    } finally {
      setUpdatingId(null);
    }
  }, [fetchData, addToast]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await fetch(`/api/client-status?id=${id}`, { method: "DELETE" });
      addToast("Verwijderd", "succes");
      fetchData();
    } catch {
      addToast("Verwijderen mislukt", "fout");
    }
  }, [fetchData, addToast]);

  const handleNieuwSave = useCallback(async () => {
    if (!nieuwNaam.trim() || !nieuwKlantId) return;
    setSavingNieuw(true);
    try {
      await fetch("/api/client-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klantId: nieuwKlantId, naam: nieuwNaam, type: nieuwType, url: nieuwUrl || undefined }),
      });
      addToast("Automatie toegevoegd", "succes");
      setShowNieuw(false);
      setNieuwNaam(""); setNieuwUrl(""); setNieuwKlantId(null);
      fetchData();
    } catch {
      addToast("Toevoegen mislukt", "fout");
    } finally {
      setSavingNieuw(false);
    }
  }, [nieuwNaam, nieuwKlantId, nieuwType, nieuwUrl, fetchData, addToast]);

  // Group by klant
  const byKlant = (data?.automaties ?? []).reduce<Record<number, { naam: string; items: Automatie[] }>>((acc, a) => {
    if (!acc[a.klantId]) acc[a.klantId] = { naam: a.klantNaam, items: [] };
    acc[a.klantId].items.push(a);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-autronis-accent animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-autronis-accent" />
              <h1 className="text-2xl font-bold text-autronis-text-primary">Client systeem status</h1>
            </div>
            <p className="text-sm text-autronis-text-secondary">
              Overzicht van alle automations en koppelingen die je voor klanten draait.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="p-2 rounded-xl border border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/50 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNieuw(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Toevoegen
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Totaal", value: data?.kpis?.totaal ?? 0, color: "text-autronis-text-primary", icon: Activity },
            { label: "Actief", value: data?.kpis?.actief ?? 0, color: "text-emerald-400", icon: CheckCircle2 },
            { label: "Fouten", value: data?.kpis?.fouten ?? 0, color: "text-red-400", icon: AlertTriangle },
            { label: "Onbekend", value: data?.kpis?.onbekend ?? 0, color: "text-autronis-text-secondary", icon: HelpCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-autronis-card border border-autronis-border rounded-xl p-3.5">
              <p className="text-[11px] text-autronis-text-secondary flex items-center gap-1 mb-1">
                <Icon className="w-3 h-3" />{label}
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Per-klant groups */}
        {Object.entries(byKlant).map(([klantId, group]) => (
          <div key={klantId} className="space-y-2">
            <h2 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
              {group.naam}
              <span className="text-autronis-text-secondary font-normal">({group.items.length})</span>
              {group.items.some((i) => i.status === "fout") && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400">Aandacht nodig</span>
              )}
            </h2>
            <div className="space-y-2">
              {group.items.map((a) => {
                const sc = statusConfig[a.status];
                const Icon = sc.icon;
                return (
                  <motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden flex items-center gap-4 bg-autronis-card border border-autronis-border rounded-xl pl-5 pr-4 py-3"
                  >
                    <div className={cn("absolute left-0 top-0 bottom-0 w-[3px]", sc.strip)} />
                    <div className={cn("flex items-center justify-center w-7 h-7 rounded-lg shrink-0", sc.bg)}>
                      <Icon className={cn("w-4 h-4", sc.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-autronis-text-primary truncate">{a.naam}</p>
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0", TYPE_BADGES[a.type])}>
                          {a.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn("text-xs font-medium", sc.color)}>{sc.label}</span>
                        <span className="flex items-center gap-1 text-xs text-autronis-text-secondary">
                          <Clock className="w-3 h-3" />
                          {timeSince(a.lastRunAt)}
                        </span>
                        {a.lastRunStatus && a.lastRunStatus !== "ok" && (
                          <span className="text-xs text-red-400 truncate">{a.lastRunStatus}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Quick status buttons */}
                      <button
                        onClick={() => handleUpdateStatus(a.id, "actief")}
                        disabled={updatingId === a.id}
                        title="Markeer als actief"
                        className={cn("p-1.5 rounded-lg transition-colors", a.status === "actief" ? "text-emerald-400 bg-emerald-500/15" : "text-autronis-text-secondary hover:text-emerald-400 hover:bg-emerald-500/10")}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(a.id, "fout")}
                        disabled={updatingId === a.id}
                        title="Markeer als fout"
                        className={cn("p-1.5 rounded-lg transition-colors", a.status === "fout" ? "text-red-400 bg-red-500/15" : "text-autronis-text-secondary hover:text-red-400 hover:bg-red-500/10")}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {(data?.automaties.length ?? 0) === 0 && (
          <div className="text-center py-12 text-autronis-text-secondary">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="mb-3">Nog geen automations bijgehouden.</p>
            <button onClick={() => setShowNieuw(true)} className="text-autronis-accent text-sm hover:underline">Eerste toevoegen →</button>
          </div>
        )}

        {/* Nieuw modal */}
        <AnimatePresence>
          {showNieuw && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setShowNieuw(false); }}
            >
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                className="bg-autronis-card border border-autronis-border rounded-2xl p-6 w-full max-w-md space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-autronis-text-primary">Automatie toevoegen</h3>
                  <button onClick={() => setShowNieuw(false)}><X className="w-4 h-4 text-autronis-text-secondary" /></button>
                </div>
                <div className="space-y-3">
                  <select
                    value={nieuwKlantId ?? ""}
                    onChange={(e) => setNieuwKlantId(Number(e.target.value) || null)}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
                  >
                    <option value="">Selecteer klant...</option>
                    {klanten.map((k) => <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>)}
                  </select>
                  <input
                    type="text"
                    value={nieuwNaam}
                    onChange={(e) => setNieuwNaam(e.target.value)}
                    placeholder="Naam (bijv: Leadbot Whatsapp)"
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
                  />
                  <select
                    value={nieuwType}
                    onChange={(e) => setNieuwType(e.target.value as AutomatieType)}
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
                  >
                    {(["webhook","cron","integration","n8n","make","zapier","api","overig"] as AutomatieType[]).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={nieuwUrl}
                    onChange={(e) => setNieuwUrl(e.target.value)}
                    placeholder="URL (optioneel)"
                    className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:border-autronis-accent"
                  />
                </div>
                <button
                  onClick={handleNieuwSave}
                  disabled={savingNieuw || !nieuwNaam.trim() || !nieuwKlantId}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-autronis-accent text-autronis-bg rounded-xl text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
                >
                  {savingNieuw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Toevoegen
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
