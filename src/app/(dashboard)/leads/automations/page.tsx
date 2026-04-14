"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
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

interface FolderRow {
  name: string;
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

interface LinkedinForm {
  searchQuery: string;
  location: string;
  maxItems: number;
  startPage: number;
  companySize: string;
  folder: string;
}

interface GmapsForm {
  searchQuery: string;
  location: string;
  maxItems: number;
  folder: string;
}

type TabKey = "linkedin" | "gmaps";

export default function LeadsAutomationsPage() {
  const { addToast } = useToast();
  const [runs, setRuns] = useState<ScraperRun[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("linkedin");
  const [linkedinSubmitting, setLinkedinSubmitting] = useState(false);
  const [gmapsSubmitting, setGmapsSubmitting] = useState(false);

  const [linkedinForm, setLinkedinForm] = useState<LinkedinForm>({
    searchQuery: "",
    location: "",
    maxItems: 10,
    startPage: 1,
    companySize: "",
    folder: "",
  });

  const [gmapsForm, setGmapsForm] = useState<GmapsForm>({
    searchQuery: "",
    location: "",
    maxItems: 50,
    folder: "",
  });

  const loadRuns = useCallback(async () => {
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

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/folders");
      if (!res.ok) return;
      const data = await res.json();
      const names = (data.folders ?? [])
        .map((f: FolderRow) => f.name)
        .filter((n: string) => !!n)
        .sort();
      setFolders(names);
    } catch {
      // niet kritisch — folder is optioneel
    }
  }, []);

  useEffect(() => {
    loadRuns();
    loadFolders();
    const interval = setInterval(loadRuns, 30000);
    return () => clearInterval(interval);
  }, [loadRuns, loadFolders]);

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

  async function submitLinkedin(e: FormEvent) {
    e.preventDefault();
    if (!linkedinForm.searchQuery.trim() || !linkedinForm.location.trim()) {
      addToast("Vul query en locatie in", "fout");
      return;
    }
    setLinkedinSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        searchQuery: linkedinForm.searchQuery.trim(),
        locations: [linkedinForm.location.trim()],
        maxItems: linkedinForm.maxItems || 10,
        startPage: linkedinForm.startPage || 1,
      };
      if (linkedinForm.companySize.trim() !== "") {
        const n = Number(linkedinForm.companySize);
        if (!Number.isNaN(n)) body.companySize = n;
      }
      if (linkedinForm.folder.trim()) body.folder = linkedinForm.folder.trim();

      const res = await fetch("/api/leads/edge-function/trigger-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(
        `LinkedIn scraper gestart: "${linkedinForm.searchQuery}" in ${linkedinForm.location}`,
        "succes"
      );
      setTimeout(loadRuns, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Trigger mislukt", "fout");
    } finally {
      setLinkedinSubmitting(false);
    }
  }

  async function submitGmaps(e: FormEvent) {
    e.preventDefault();
    if (!gmapsForm.searchQuery.trim() || !gmapsForm.location.trim()) {
      addToast("Vul query en locatie in", "fout");
      return;
    }
    setGmapsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        searchQuery: gmapsForm.searchQuery.trim(),
        locations: [gmapsForm.location.trim()],
        maxItems: gmapsForm.maxItems || 50,
      };
      if (gmapsForm.folder.trim()) body.folder = gmapsForm.folder.trim();

      const res = await fetch("/api/leads/edge-function/trigger-google-maps-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(
        `Google Maps scraper gestart: "${gmapsForm.searchQuery}" in ${gmapsForm.location}`,
        "succes"
      );
      setTimeout(loadRuns, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Trigger mislukt", "fout");
    } finally {
      setGmapsSubmitting(false);
    }
  }

  const activeRuns = runs.filter((r) =>
    ["pending", "webhook_sent", "running"].includes(r.status)
  );

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary flex items-center gap-3">
          <Zap className="w-7 h-7 text-autronis-accent" />
          Automations
        </h1>
        <p className="text-sm text-autronis-text-secondary mt-1.5">
          Vind nieuwe leads via verschillende bronnen
        </p>
      </div>

      {/* Actieve runs banner */}
      {activeRuns.length > 0 && (
        <div className="rounded-xl border border-autronis-accent/30 bg-autronis-accent/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-autronis-accent mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Actieve runs ({activeRuns.length})
          </div>
          <div className="space-y-1.5">
            {activeRuns.map((run) => {
              const config = STATUS[run.status];
              const Icon = config.icon;
              return (
                <div key={run.id} className="flex items-center gap-2 text-xs">
                  <Icon
                    className={cn(
                      "w-3 h-3 flex-shrink-0",
                      config.color,
                      run.status === "running" && "animate-spin"
                    )}
                  />
                  <span className="text-autronis-text-primary truncate">
                    {run.search_query || "(geen query)"}
                    {run.location && ` — ${run.location}`}
                  </span>
                  <span className={cn("ml-auto", config.color)}>{config.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Form panel */}
        <div className="space-y-4">
          {/* Tabs */}
          <div className="inline-flex rounded-xl bg-autronis-card border border-autronis-border p-1 gap-1">
            <button
              onClick={() => setTab("linkedin")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors",
                tab === "linkedin"
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Bedrijfsplatform
            </button>
            <button
              onClick={() => setTab("gmaps")}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors",
                tab === "gmaps"
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary"
              )}
            >
              <MapPin className="w-3.5 h-3.5" />
              Locaties
            </button>
          </div>

          {tab === "linkedin" && (
            <form
              onSubmit={submitLinkedin}
              className="rounded-2xl border border-autronis-border bg-autronis-card p-6 space-y-4"
            >
              <div className="flex items-center gap-3 pb-2">
                <div className="h-11 w-11 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-purple-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-autronis-text-primary">
                    Bedrijfsplatform
                  </h3>
                  <p className="text-[11px] text-autronis-text-secondary mt-0.5">
                    Vind bedrijven via professionele netwerken
                  </p>
                </div>
              </div>
              <FormField label="Folder / Categorie">
                <FolderInput
                  value={linkedinForm.folder}
                  onChange={(v) => setLinkedinForm({ ...linkedinForm, folder: v })}
                  folders={folders}
                />
              </FormField>
              <FormField label="Wat voor bedrijf?" required>
                <input
                  type="text"
                  required
                  placeholder="bijv. Marketing Agency"
                  value={linkedinForm.searchQuery}
                  onChange={(e) =>
                    setLinkedinForm({ ...linkedinForm, searchQuery: e.target.value })
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label="Waar?" required>
                <input
                  type="text"
                  required
                  placeholder="bijv. Amsterdam"
                  value={linkedinForm.location}
                  onChange={(e) =>
                    setLinkedinForm({ ...linkedinForm, location: e.target.value })
                  }
                  className={inputClass}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Hoeveel leads?">
                  <input
                    type="number"
                    min={1}
                    value={linkedinForm.maxItems}
                    onChange={(e) =>
                      setLinkedinForm({
                        ...linkedinForm,
                        maxItems: parseInt(e.target.value || "10", 10),
                      })
                    }
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Start pagina">
                  <input
                    type="number"
                    min={1}
                    value={linkedinForm.startPage}
                    onChange={(e) =>
                      setLinkedinForm({
                        ...linkedinForm,
                        startPage: parseInt(e.target.value || "1", 10),
                      })
                    }
                    className={inputClass}
                  />
                </FormField>
              </div>
              <FormField label="Bedrijfsgrootte (optioneel)">
                <select
                  value={linkedinForm.companySize}
                  onChange={(e) =>
                    setLinkedinForm({ ...linkedinForm, companySize: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">— geen filter —</option>
                  <option value="1">1-10</option>
                  <option value="2">11-50</option>
                  <option value="3">51-200</option>
                  <option value="4">201-500</option>
                  <option value="5">501-1000</option>
                  <option value="6">1000+</option>
                </select>
              </FormField>
              <button
                type="submit"
                disabled={linkedinSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
              >
                {linkedinSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Zoekopdracht
              </button>
            </form>
          )}

          {tab === "gmaps" && (
            <form
              onSubmit={submitGmaps}
              className="rounded-2xl border border-autronis-border bg-autronis-card p-6 space-y-4"
            >
              <div className="flex items-center gap-3 pb-2">
                <div className="h-11 w-11 rounded-xl bg-autronis-accent/15 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-autronis-accent" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-autronis-text-primary">
                    Locatie Zoeken
                  </h3>
                  <p className="text-[11px] text-autronis-text-secondary mt-0.5">
                    Vind bedrijven op basis van locatie
                  </p>
                </div>
              </div>
              <FormField label="Folder / Categorie">
                <FolderInput
                  value={gmapsForm.folder}
                  onChange={(v) => setGmapsForm({ ...gmapsForm, folder: v })}
                  folders={folders}
                />
              </FormField>
              <FormField label="Wat voor bedrijf?" required>
                <input
                  type="text"
                  required
                  placeholder="bijv. Restaurant"
                  value={gmapsForm.searchQuery}
                  onChange={(e) =>
                    setGmapsForm({ ...gmapsForm, searchQuery: e.target.value })
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label="Waar?" required>
                <input
                  type="text"
                  required
                  placeholder="bijv. Amsterdam"
                  value={gmapsForm.location}
                  onChange={(e) =>
                    setGmapsForm({ ...gmapsForm, location: e.target.value })
                  }
                  className={inputClass}
                />
              </FormField>
              <FormField label="Hoeveel leads?">
                <input
                  type="number"
                  min={1}
                  value={gmapsForm.maxItems}
                  onChange={(e) =>
                    setGmapsForm({
                      ...gmapsForm,
                      maxItems: parseInt(e.target.value || "50", 10),
                    })
                  }
                  className={inputClass}
                />
              </FormField>
              <button
                type="submit"
                disabled={gmapsSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
              >
                {gmapsSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Start Zoekopdracht
              </button>
            </form>
          )}
        </div>

        {/* Run history panel */}
        <div>
          <h2 className="text-sm font-semibold text-autronis-text-primary mb-3">
            Recente runs
          </h2>

          {loading && runs.length === 0 && (
            <div className="flex items-center justify-center py-12 text-autronis-text-secondary text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
            <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-6 text-center text-autronis-text-secondary text-sm">
              Nog geen scraper runs.
            </div>
          )}

          {!loading && !error && runs.length > 0 && (
            <div className="space-y-2">
              {runs.slice(0, 20).map((run) => {
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
                      {busy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50";

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-autronis-text-secondary uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function FolderInput({
  value,
  onChange,
  folders,
}: {
  value: string;
  onChange: (v: string) => void;
  folders: string[];
}) {
  return (
    <>
      <input
        type="text"
        list="leads-folder-list"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="kies of typ folder naam (optioneel)"
        className={inputClass}
      />
      <datalist id="leads-folder-list">
        {folders.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </>
  );
}
