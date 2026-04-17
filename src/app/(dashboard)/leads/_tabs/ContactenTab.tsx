"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Mail,
  Phone,
  Globe,
  Loader2,
  ExternalLink,
  MapPin,
  Linkedin,
  CheckCircle,
  AlertCircle,
  Download,
  Sparkles,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePoll } from "@/lib/use-poll";

interface Lead {
  id: string;
  name: string | null;
  website: string | null;
  phone: string | null;
  emails: string | null;
  location: string | null;
  description: string | null;
  folder: string | null;
  source: string | null;
  email_found: boolean | null;
  phone_found: boolean | null;
  website_found: boolean | null;
  linkedin_url: string | null;
  enrichment_status: string | null;
  outreach_status: string | null;
  generated_email: string | null;
  google_maps_url: string | null;
}

interface EmailRecord {
  id: string;
  lead_id: string | null;
  email_status: string | null;
}

interface AdvancedFilters {
  hasEmail: boolean | null;
  hasPhone: boolean | null;
  hasWebsite: boolean | null;
  hasLinkedin: boolean | null;
  emailGenerated: boolean | null;
}

const DEFAULT_FILTERS: AdvancedFilters = {
  hasEmail: null,
  hasPhone: null,
  hasWebsite: null,
  hasLinkedin: null,
  emailGenerated: null,
};

function isLinkedin(source: string | null): boolean {
  return source !== "google maps" && source !== "google_maps" && !!source;
}
function isGoogleMaps(source: string | null): boolean {
  return source === "google maps" || source === "google_maps";
}

function parseEmails(raw: string | null | undefined): string[] {
  if (!raw?.trim() || raw.trim() === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((e: string) => e?.trim());
  } catch {
    //
  }
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

function hasEmailValue(l: Lead): boolean {
  return parseEmails(l.emails).length > 0;
}

// CSV export — Hunter.io compatible kolommen
function exportLeadsAsCSV(leads: Lead[]) {
  const headers = [
    "first_name",
    "last_name",
    "email",
    "company",
    "website",
    "phone",
    "location",
    "linkedin_url",
    "source",
    "folder",
  ];
  const rows = leads.map((l) => {
    const emails = parseEmails(l.emails);
    return [
      "", // first_name (niet beschikbaar)
      "", // last_name
      emails[0] || "",
      l.name || "",
      l.website || "",
      l.phone || "",
      l.location || "",
      l.linkedin_url || "",
      l.source || "",
      l.folder || "",
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SOURCE_TABS = [
  { key: "all", label: "Alle", icon: Users },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "google_maps", label: "Google Maps", icon: MapPin },
  { key: "enrichment_success", label: "Enrichment OK", icon: CheckCircle },
  { key: "enrichment_failed", label: "Enrichment gefaald", icon: AlertCircle },
];

const STATUS_PRIORITY = ["error", "generation_failed", "failed", "ready_for_generation", "generating", "generated", "approved", "sent", "replied"];

const EMAIL_STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  ready_for_generation: { label: "Klaar voor generatie", bg: "bg-purple-500/15", text: "text-purple-400" },
  generating: { label: "Bezig", bg: "bg-blue-500/15", text: "text-blue-400" },
  generation_failed: { label: "Generatie mislukt", bg: "bg-red-500/15", text: "text-red-400" },
  generated: { label: "Te reviewen", bg: "bg-yellow-500/15", text: "text-yellow-400" },
  approved: { label: "Goedgekeurd", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  sent: { label: "Verstuurd", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  failed: { label: "Gefaald", bg: "bg-red-500/15", text: "text-red-400" },
  error: { label: "Error", bg: "bg-red-500/15", text: "text-red-400" },
  replied: { label: "Reply", bg: "bg-autronis-accent/15", text: "text-autronis-accent" },
};

export function ContactenTab() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [sourceTab, setSourceTab] = useState<string>("all");
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [maxLeads, setMaxLeads] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Action busy state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isPrepping, setIsPrepping] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [leadsRes, emailsRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/leads/emails"),
      ]);
      if (!leadsRes.ok) {
        const body = await leadsRes.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${leadsRes.status}`);
      }
      const leadsData = await leadsRes.json();
      setLeads(leadsData.leads ?? []);
      if (emailsRes.ok) {
        const emailsData = await emailsRes.json();
        setEmails(emailsData.emails ?? []);
      }
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

  // Realtime-ish: silent refetch elke 12s — geen loading flicker
  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 12000);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.folder) set.add(l.folder);
    }
    return Array.from(set).sort();
  }, [leads]);

  // lead_id → highest-priority email status
  const leadEmailStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of emails) {
      if (e.lead_id && e.email_status) {
        const existing = map.get(e.lead_id);
        if (
          !existing ||
          STATUS_PRIORITY.indexOf(e.email_status) > STATUS_PRIORITY.indexOf(existing)
        ) {
          map.set(e.lead_id, e.email_status);
        }
      }
    }
    return map;
  }, [emails]);

  const filtered = useMemo(() => {
    let result = leads;

    // Source tab
    if (sourceTab === "linkedin") result = result.filter((l) => isLinkedin(l.source));
    else if (sourceTab === "google_maps") result = result.filter((l) => isGoogleMaps(l.source));
    else if (sourceTab === "enrichment_success")
      result = result.filter((l) => l.enrichment_status === "success");
    else if (sourceTab === "enrichment_failed")
      result = result.filter((l) => l.enrichment_status === "failed");

    // Folder
    if (folderFilter !== "all") result = result.filter((l) => l.folder === folderFilter);

    // Advanced filters
    if (filters.hasEmail === true) result = result.filter((l) => hasEmailValue(l));
    if (filters.hasEmail === false) result = result.filter((l) => !hasEmailValue(l));
    if (filters.hasPhone === true) result = result.filter((l) => !!l.phone);
    if (filters.hasPhone === false) result = result.filter((l) => !l.phone);
    if (filters.hasWebsite === true) result = result.filter((l) => !!l.website);
    if (filters.hasWebsite === false) result = result.filter((l) => !l.website);
    if (filters.hasLinkedin === true) result = result.filter((l) => !!l.linkedin_url);
    if (filters.hasLinkedin === false) result = result.filter((l) => !l.linkedin_url);
    if (filters.emailGenerated === true) result = result.filter((l) => !!l.generated_email);
    if (filters.emailGenerated === false) result = result.filter((l) => !l.generated_email);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.emails?.toLowerCase().includes(q) ||
          l.location?.toLowerCase().includes(q) ||
          l.website?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [leads, sourceTab, folderFilter, filters, search]);

  function toggleSelect(id: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  function selectTop() {
    const ids = filtered.slice(0, maxLeads).map((l) => l.id);
    setSelectedIds(new Set(ids));
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS);
    setFolderFilter("all");
    setSourceTab("all");
    setSearch("");
  }

  const activeFilterCount =
    Object.values(filters).filter((v) => v !== null).length +
    (folderFilter !== "all" ? 1 : 0) +
    (sourceTab !== "all" ? 1 : 0) +
    (search.trim() ? 1 : 0);

  async function generateEmails() {
    const validIds = Array.from(selectedIds).filter((id) =>
      leads.find((l) => l.id === id && l.website)
    );
    if (validIds.length === 0) {
      addToast("Geen geldige leads (moeten website hebben)", "fout");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/leads/edge-function/trigger-email-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: validIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(`Email generatie gestart voor ${validIds.length} leads`, "succes");
      setSelectedIds(new Set());
      setTimeout(load, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Email generatie mislukt", "fout");
    } finally {
      setIsGenerating(false);
    }
  }

  async function enrichLeads() {
    const validIds = Array.from(selectedIds);
    if (validIds.length === 0) {
      addToast("Geen leads geselecteerd", "fout");
      return;
    }
    setIsEnriching(true);
    try {
      const res = await fetch("/api/leads/edge-function/trigger-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: validIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(`Enrichment gestart voor ${validIds.length} leads`, "succes");
      setSelectedIds(new Set());
      setTimeout(load, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Enrichment mislukt", "fout");
    } finally {
      setIsEnriching(false);
    }
  }

  async function prepForGeneration() {
    const validIds = Array.from(selectedIds);
    if (validIds.length === 0) {
      addToast("Geen leads geselecteerd", "fout");
      return;
    }
    setIsPrepping(true);
    try {
      const res = await fetch("/api/leads/edge-function/bulk-update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: validIds, outreach_status: "ready_for_generation" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(`${validIds.length} leads klaargezet voor generatie`, "succes");
      setSelectedIds(new Set());
      setTimeout(load, 1000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Klaarzetten mislukt", "fout");
    } finally {
      setIsPrepping(false);
    }
  }

  function handleExportCSV() {
    const toExport =
      selectedIds.size > 0
        ? filtered.filter((l) => selectedIds.has(l.id))
        : filtered;
    if (toExport.length === 0) {
      addToast("Geen leads om te exporteren", "fout");
      return;
    }
    exportLeadsAsCSV(toExport);
    addToast(`${toExport.length} leads geëxporteerd (Hunter.io compatibel)`, "succes");
  }

  // Counts per tab
  const tabCounts = useMemo(
    () => ({
      all: leads.length,
      linkedin: leads.filter((l) => isLinkedin(l.source)).length,
      google_maps: leads.filter((l) => isGoogleMaps(l.source)).length,
      enrichment_success: leads.filter((l) => l.enrichment_status === "success").length,
      enrichment_failed: leads.filter((l) => l.enrichment_status === "failed").length,
    }),
    [leads]
  );

  return (
    <div className="space-y-7">
      {/* Header + actiebalk */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary flex items-center gap-3">
            <Users className="w-7 h-7 text-autronis-accent" />
            Contacten
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1.5">
            Beheer al je contacten en run enrichment of email generatie
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {folders.length > 0 && (
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="bg-autronis-card border border-autronis-border rounded-lg px-2 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            >
              <option value="all">Alle folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
              showAdvanced || activeFilterCount > 0
                ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
            )}
          >
            <Filter className="w-3 h-3" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-autronis-accent text-autronis-bg text-[9px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={filtered.length}
              value={maxLeads}
              onChange={(e) => setMaxLeads(parseInt(e.target.value) || 1)}
              className="w-16 bg-autronis-card border border-autronis-border rounded-lg px-2 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            />
            <button
              onClick={selectTop}
              className="px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/30 transition-colors"
            >
              Top {Math.min(maxLeads, filtered.length)}
            </button>
          </div>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={enrichLeads}
                disabled={isEnriching}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-xs font-semibold text-autronis-text-primary hover:border-autronis-accent/40 transition-colors disabled:opacity-40"
              >
                {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Enrich ({selectedIds.size})
              </button>
              <button
                onClick={prepForGeneration}
                disabled={isPrepping}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-xs font-semibold text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-40"
              >
                {isPrepping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Klaarzetten ({selectedIds.size})
              </button>
              <button
                onClick={generateEmails}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                Genereer ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Advanced filters paneel */}
      {showAdvanced && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-autronis-text-primary uppercase tracking-wide">
              Geavanceerde filters
            </h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300"
              >
                <X className="w-3 h-3" /> Wis filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(
              [
                { key: "hasEmail", label: "Heeft email" },
                { key: "hasPhone", label: "Heeft telefoon" },
                { key: "hasWebsite", label: "Heeft website" },
                { key: "hasLinkedin", label: "Heeft LinkedIn" },
                { key: "emailGenerated", label: "Email gegenereerd" },
              ] as const
            ).map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="text-xs text-autronis-text-secondary flex-1">{f.label}</span>
                <div className="inline-flex items-center bg-autronis-bg border border-autronis-border rounded-lg p-0.5 text-[10px]">
                  <button
                    onClick={() =>
                      setFilters({ ...filters, [f.key]: filters[f.key] === true ? null : true })
                    }
                    className={cn(
                      "px-2 py-0.5 rounded font-medium transition-colors",
                      filters[f.key] === true
                        ? "bg-autronis-accent/15 text-autronis-accent"
                        : "text-autronis-text-secondary"
                    )}
                  >
                    Ja
                  </button>
                  <button
                    onClick={() =>
                      setFilters({ ...filters, [f.key]: filters[f.key] === false ? null : false })
                    }
                    className={cn(
                      "px-2 py-0.5 rounded font-medium transition-colors",
                      filters[f.key] === false ? "bg-red-500/15 text-red-400" : "text-autronis-text-secondary"
                    )}
                  >
                    Nee
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {SOURCE_TABS.map((t) => {
          const Icon = t.icon;
          const active = sourceTab === t.key;
          const count = tabCounts[t.key as keyof typeof tabCounts];
          return (
            <button
              key={t.key}
              onClick={() => setSourceTab(t.key)}
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek op naam, email, locatie, beschrijving, website..."
          className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
        />
      </div>

      {/* Body */}
      {loading && leads.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Contacten laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon contacten niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          Geen contacten voor deze filters
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-2xl border border-autronis-border bg-autronis-card overflow-hidden">
          <div className="px-6 py-4 border-b border-autronis-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-autronis-text-primary">Contacten</h2>
            <div className="flex items-center gap-3 text-xs text-autronis-text-secondary tabular-nums">
              {selectedIds.size > 0 && (
                <span className="text-autronis-accent font-medium">
                  {selectedIds.size} geselecteerd
                </span>
              )}
              <span>{filtered.length} resultaten</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-autronis-bg/40 text-[10px] uppercase text-autronis-text-secondary/70 tracking-wider">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-autronis-border accent-autronis-accent"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold">Bron</th>
                <th className="text-left px-4 py-3 font-semibold">Naam</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Locatie</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Folder</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border/50">
              {filtered.slice(0, 200).map((lead) => {
                const selected = selectedIds.has(lead.id);
                const emails = parseEmails(lead.emails);
                const emailStatus = leadEmailStatusMap.get(lead.id);
                const badge = emailStatus ? EMAIL_STATUS_BADGE[emailStatus] : null;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => toggleSelect(lead.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selected ? "bg-autronis-accent/10" : "hover:bg-autronis-accent/[0.03]"
                    )}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-autronis-border accent-autronis-accent"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full",
                          isGoogleMaps(lead.source)
                            ? "bg-autronis-accent/15 text-autronis-accent"
                            : "bg-purple-500/15 text-purple-300"
                        )}
                      >
                        {isGoogleMaps(lead.source) ? (
                          <MapPin className="w-3 h-3" />
                        ) : (
                          <Linkedin className="w-3 h-3" />
                        )}
                        {isGoogleMaps(lead.source) ? "Locatie" : "Bedrijf"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-autronis-text-primary truncate max-w-xs">
                          {lead.name || "(geen naam)"}
                        </span>
                        {lead.website && (
                          <a
                            href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-autronis-text-secondary/60 hover:text-autronis-accent flex-shrink-0"
                            title={lead.website}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {emails.length > 0 ? (
                        <a
                          href={`mailto:${emails[0]}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs text-autronis-text-primary hover:text-autronis-accent truncate max-w-xs"
                        >
                          <Mail className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          {emails[0]}
                          {emails.length > 1 && (
                            <span className="text-autronis-text-secondary/50">+{emails.length - 1}</span>
                          )}
                        </a>
                      ) : (
                        <span className="text-xs text-autronis-text-secondary/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {lead.location ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-autronis-text-secondary">
                          <MapPin className="w-3 h-3 text-autronis-text-secondary/50" />
                          {(lead.location || "").split(",")[0]}
                        </span>
                      ) : (
                        <span className="text-xs text-autronis-text-secondary/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      {lead.folder ? (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent">
                          {lead.folder}
                        </span>
                      ) : (
                        <span className="text-xs text-autronis-text-secondary/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {badge && (
                        <span
                          className={cn(
                            "inline-flex items-center text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider",
                            badge.bg,
                            badge.text
                          )}
                        >
                          {badge.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="px-6 py-3 text-xs text-autronis-text-secondary bg-autronis-bg/40 border-t border-autronis-border text-center">
              {filtered.length} contacten totaal — eerste 200 getoond
            </div>
          )}
        </div>
      )}
    </div>
  );
}
