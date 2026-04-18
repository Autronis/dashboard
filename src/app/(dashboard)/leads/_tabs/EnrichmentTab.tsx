"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Globe,
  MapPin,
  Linkedin,
  Search,
  Play,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { TabInfo } from "../_components/TabInfo";

interface Lead {
  id: string;
  name: string | null;
  website: string | null;
  phone: string | null;
  emails: string | null;
  location: string | null;
  source: string | null;
  email_found: boolean | null;
  phone_found: boolean | null;
  website_found: boolean | null;
  enrichment_status: string | null;
  linkedin_url: string | null;
  created_at: string;
}

function hasEmailValue(l: Lead): boolean {
  const e = l.emails;
  return !!(e && e.trim() && e.trim() !== "[]");
}

const TABS: Array<{ key: string; label: string; icon: typeof Sparkles }> = [
  { key: "candidates", label: "Kandidaten", icon: Sparkles },
  { key: "email_found", label: "Email gevonden", icon: Mail },
  { key: "phone_found", label: "Telefoon gevonden", icon: Phone },
  { key: "website_found", label: "Website gevonden", icon: Globe },
  { key: "failed", label: "Gefaald", icon: AlertCircle },
  { key: "pending", label: "Pending", icon: Loader2 },
];

const MAX_LEADS_OPTIES = [10, 25, 50, 100, 250, 500];

export function EnrichmentTab() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("candidates");
  const [zoek, setZoek] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [maxLeads, setMaxLeads] = useState(50);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLeads(data.leads ?? []);
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

  const stats = useMemo(() => {
    const emailFound = leads.filter((l) => l.email_found).length;
    const phoneFound = leads.filter((l) => l.phone_found).length;
    const websiteFound = leads.filter((l) => l.website_found).length;
    const failed = leads.filter(
      (l) =>
        l.enrichment_status === "failed" &&
        !l.email_found &&
        !l.phone_found &&
        !l.website_found &&
        !hasEmailValue(l) &&
        !l.phone?.trim() &&
        !l.website?.trim()
    ).length;
    const pending = leads.filter((l) => l.enrichment_status === "pending").length;
    const candidates = leads.filter(
      (l) =>
        !l.email_found &&
        !l.phone_found &&
        !l.website_found &&
        l.enrichment_status !== "failed" &&
        l.enrichment_status !== "pending"
    ).length;
    const totalCompleted = leads.filter(
      (l) => l.email_found || l.phone_found || l.website_found || l.enrichment_status === "failed"
    ).length;
    const emailHitRate = totalCompleted > 0 ? Math.round((emailFound / totalCompleted) * 100) : 0;
    const phoneHitRate = totalCompleted > 0 ? Math.round((phoneFound / totalCompleted) * 100) : 0;
    return {
      candidates,
      emailFound,
      phoneFound,
      websiteFound,
      failed,
      pending,
      totalCompleted,
      emailHitRate,
      phoneHitRate,
    };
  }, [leads]);

  const tabLeads = useMemo(() => {
    if (tab === "candidates") {
      return leads.filter(
        (l) =>
          !l.email_found &&
          !l.phone_found &&
          !l.website_found &&
          l.enrichment_status !== "failed" &&
          l.enrichment_status !== "pending"
      );
    }
    if (tab === "email_found") return leads.filter((l) => l.email_found);
    if (tab === "phone_found") return leads.filter((l) => l.phone_found);
    if (tab === "website_found") return leads.filter((l) => l.website_found);
    if (tab === "failed") {
      return leads.filter(
        (l) =>
          l.enrichment_status === "failed" &&
          !l.email_found &&
          !l.phone_found &&
          !l.website_found &&
          !hasEmailValue(l) &&
          !l.phone?.trim() &&
          !l.website?.trim()
      );
    }
    if (tab === "pending") return leads.filter((l) => l.enrichment_status === "pending");
    return leads;
  }, [leads, tab]);

  const gefilterd = useMemo(() => {
    if (!zoek.trim()) return tabLeads;
    const q = zoek.toLowerCase();
    return tabLeads.filter((l) =>
      [l.name, l.website, l.location]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [tabLeads, zoek]);

  function toggleSelect(id: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectFirstN(n: number) {
    const ids = gefilterd.slice(0, n).map((l) => l.id);
    setSelectedIds(new Set(ids));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function triggerEnrichment() {
    if (selectedIds.size === 0) {
      addToast("Geen leads geselecteerd", "fout");
      return;
    }
    setIsEnriching(true);
    try {
      const res = await fetch("/api/leads/edge-function/trigger-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(
        `Enrichment in wachtrij — ${selectedIds.size} leads in batches van 30`,
        "succes"
      );
      clearSelection();
      setTimeout(load, 2000); // verse status na 2 sec
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Enrichment mislukt", "fout");
    } finally {
      setIsEnriching(false);
    }
  }

  async function cleanEmails() {
    if (selectedIds.size === 0) {
      addToast("Geen leads geselecteerd", "fout");
      return;
    }
    setIsCleaning(true);
    try {
      const res = await fetch("/api/leads/edge-function/clean-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast("Emails opgeschoond", "succes");
      clearSelection();
      setTimeout(load, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Clean mislukt", "fout");
    } finally {
      setIsCleaning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-autronis-accent" />
            Enrichment
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            <span className="text-autronis-text-primary font-medium">Data verrijken.</span> Leads zonder email of telefoon? Deze tab zoekt de ontbrekende gegevens automatisch op via externe bronnen.
            Gebruik dit vóór <span className="text-autronis-accent">Contacten</span> — eerst de gaten dichten, dan pas segmenteren en exporteren.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
        >
          <Loader2 className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Vernieuwen
        </button>
      </div>

      <TabInfo
        tips={[
          {
            icon: Play,
            title: "Enrich kandidaten",
            description: "Start de enrichment flow voor geselecteerde leads — zoekt email, telefoon en website via externe bronnen.",
          },
          {
            icon: Eraser,
            title: "Clean emails",
            description: "Verwijdert ongeldige of generic emails (info@, contact@, no-reply@) uit de emails array van een lead.",
          },
          {
            icon: Sparkles,
            title: "Status tabs",
            description: "Filter op kandidaten (pending), gevonden (email/phone/website), of mislukte enrichments om per batch te werken.",
          },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Sparkles}
          label="Kandidaten"
          waarde={stats.candidates}
          hint={`${stats.totalCompleted} voltooid`}
        />
        <StatCard
          icon={Mail}
          label="Email gevonden"
          waarde={stats.emailFound}
          hint={`${stats.emailHitRate}% hit rate`}
          accent
        />
        <StatCard
          icon={Phone}
          label="Telefoon gevonden"
          waarde={stats.phoneFound}
          hint={`${stats.phoneHitRate}% hit rate`}
        />
        <StatCard
          icon={AlertCircle}
          label="Gefaald"
          waarde={stats.failed}
          hint={`${stats.pending} pending`}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          const count =
            t.key === "candidates"
              ? stats.candidates
              : t.key === "email_found"
              ? stats.emailFound
              : t.key === "phone_found"
              ? stats.phoneFound
              : t.key === "website_found"
              ? stats.websiteFound
              : t.key === "failed"
              ? stats.failed
              : t.key === "pending"
              ? stats.pending
              : 0;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                clearSelection();
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                active
                  ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
              <Icon className="w-3 h-3" />
              {t.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Actiebalk */}
      <div className="rounded-xl border border-autronis-border bg-autronis-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-autronis-text-secondary">Selecteer eerste</label>
          <select
            value={maxLeads}
            onChange={(e) => setMaxLeads(Number(e.target.value))}
            className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
          >
            {MAX_LEADS_OPTIES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectFirstN(maxLeads)}
            className="px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 transition-colors"
          >
            Selecteer
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-autronis-text-secondary/60 hover:text-autronis-text-primary transition-colors"
            >
              Wis ({selectedIds.size})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            onClick={cleanEmails}
            disabled={isCleaning || selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 transition-colors disabled:opacity-40"
          >
            {isCleaning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eraser className="w-3 h-3" />}
            Clean emails
          </button>
          <button
            onClick={triggerEnrichment}
            disabled={isEnriching || selectedIds.size === 0}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
          >
            {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Enrich {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>
        </div>
      </div>

      {/* Zoek */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
        <input
          type="text"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam, website, locatie..."
          className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
        />
      </div>

      {/* Body */}
      {loading && leads.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Leads laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon leads niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          Geen leads in deze tab
        </div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-autronis-bg/40 text-xs uppercase text-autronis-text-secondary/70 tracking-wider">
              <tr>
                <th className="w-10 px-3 py-2.5"></th>
                <th className="text-left px-3 py-2.5 font-medium">Bedrijf</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Source</th>
                <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Enrichment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border/50">
              {gefilterd.slice(0, 200).map((lead) => {
                const selected = selectedIds.has(lead.id);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => toggleSelect(lead.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selected
                        ? "bg-autronis-accent/10"
                        : "hover:bg-autronis-accent/[0.03]"
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center",
                          selected
                            ? "bg-autronis-accent border-autronis-accent"
                            : "border-autronis-border"
                        )}
                      >
                        {selected && <CheckCircle className="w-3 h-3 text-autronis-bg" />}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-autronis-text-primary truncate max-w-xs">
                        {lead.name || "(geen naam)"}
                      </div>
                      {lead.location && (
                        <div className="text-[10px] text-autronis-text-secondary/60 truncate max-w-xs">
                          {lead.location}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <SourceBadge source={lead.source} />
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        {lead.email_found && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                            <Mail className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {lead.phone_found && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                            <Phone className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {lead.website_found && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                            <Globe className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {lead.enrichment_status === "failed" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                            <AlertCircle className="w-2.5 h-2.5" />
                            failed
                          </span>
                        )}
                        {lead.enrichment_status === "pending" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            pending
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {gefilterd.length > 200 && (
            <div className="px-4 py-2 text-xs text-autronis-text-secondary bg-autronis-bg/40 border-t border-autronis-border text-center">
              {gefilterd.length} leads totaal — eerste 200 getoond
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  waarde,
  hint,
  accent,
}: {
  icon: typeof Mail;
  label: string;
  waarde: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-autronis-border bg-autronis-card p-4">
      <div className="flex items-center gap-2 text-autronis-text-secondary text-xs mb-1.5">
        <Icon className={cn("w-3.5 h-3.5", accent && "text-autronis-accent")} />
        {label}
      </div>
      <div className="text-2xl font-bold text-autronis-text-primary tabular-nums">
        {waarde.toLocaleString("nl-NL")}
      </div>
      {hint && (
        <div className="text-[10px] text-autronis-text-secondary/60 mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  const isGmaps = source === "google maps" || source === "google_maps";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
        isGmaps
          ? "bg-autronis-accent/10 text-autronis-accent"
          : "bg-purple-500/10 text-purple-300"
      )}
    >
      {isGmaps ? <MapPin className="w-2.5 h-2.5" /> : <Linkedin className="w-2.5 h-2.5" />}
      {isGmaps ? "Google Maps" : "LinkedIn"}
    </span>
  );
}
