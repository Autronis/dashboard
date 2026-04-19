"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Mail,
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
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePoll } from "@/lib/use-poll";
import { TabInfo } from "../_components/TabInfo";
import { useBulkScan } from "../_components/use-bulk-scan";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadsKpiTile, type LeadsKpiAccent } from "@/components/leads/kpi-tile";
import { SectionCard } from "@/components/leads/section-card";
import { SourceBadge } from "@/components/leads/source-badge";
import { FolderChip } from "@/components/leads/folder-chip";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { BulkActionBar, type BulkAction } from "@/components/leads/bulk-action-bar";

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
      "",
      "",
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

type SourceKey = "all" | "linkedin" | "google_maps" | "enrichment_success" | "enrichment_failed";

const SOURCE_FILTERS: Array<{
  key: SourceKey;
  label: string;
  icon: typeof Users;
  accent: LeadsKpiAccent;
}> = [
  { key: "all", label: "Alle", icon: Users, accent: "cyan" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, accent: "purple" },
  { key: "google_maps", label: "Google Maps", icon: MapPin, accent: "green" },
  { key: "enrichment_success", label: "Enrichment OK", icon: CheckCircle, accent: "blue" },
  { key: "enrichment_failed", label: "Enrichment gefaald", icon: AlertCircle, accent: "red" },
];

const STATUS_PRIORITY = [
  "error",
  "generation_failed",
  "failed",
  "ready_for_generation",
  "generating",
  "generated",
  "approved",
  "sent",
  "replied",
];

export function ContactenTab() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [sourceTab, setSourceTab] = useState<SourceKey>("all");
  const [filters, setFilters] = useState<AdvancedFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [maxLeads, setMaxLeads] = useState(10);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isPrepping, setIsPrepping] = useState(false);
  const { runScan } = useBulkScan();

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

  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 12000);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.folder) set.add(l.folder);
    }
    return Array.from(set).sort();
  }, [leads]);

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

  const filtered = useMemo(() => {
    let result = leads;

    if (sourceTab === "linkedin") result = result.filter((l) => isLinkedin(l.source));
    else if (sourceTab === "google_maps") result = result.filter((l) => isGoogleMaps(l.source));
    else if (sourceTab === "enrichment_success")
      result = result.filter((l) => l.enrichment_status === "success");
    else if (sourceTab === "enrichment_failed")
      result = result.filter((l) => l.enrichment_status === "failed");

    if (folderFilter !== "all") result = result.filter((l) => l.folder === folderFilter);

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

  function clearSelection() {
    setSelectedIds(new Set());
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
      setTimeout(() => load(), 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Email generatie mislukt", "fout");
    } finally {
      setIsGenerating(false);
    }
  }

  function scanSelected() {
    const selected = leads
      .filter((l) => selectedIds.has(l.id))
      .map((l) => ({
        id: l.id,
        name: l.name,
        website: l.website,
        email: parseEmails(l.emails)[0] ?? null,
        supabaseLeadId: l.id,
      }));
    runScan(selected);
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
      setTimeout(() => load(), 2000);
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
      setTimeout(() => load(), 1000);
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

  const bulkActions: BulkAction[] = [
    {
      key: "scan",
      label: "Scan",
      icon: Zap,
      onClick: scanSelected,
      tone: "cyan",
      title: "Open de Sales Engine scan-flow met deze leads voorgeladen",
    },
    {
      key: "enrich",
      label: "Enrich",
      icon: Sparkles,
      onClick: enrichLeads,
      tone: "blue",
      busy: isEnriching,
    },
    {
      key: "prep",
      label: "Klaarzetten",
      icon: Sparkles,
      onClick: prepForGeneration,
      tone: "purple",
      busy: isPrepping,
    },
    {
      key: "generate",
      label: "Genereer",
      icon: Mail,
      onClick: generateEmails,
      tone: "emerald",
      busy: isGenerating,
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        title="Contacten"
        description="Segmenteren. Bouw een gerichte lijst met geavanceerde filters, exporteer naar CSV of start bulk email-generatie. Scherp filteren hier, overzicht blijft in Overzicht."
      />

      <TabInfo
        tips={[
          {
            icon: Filter,
            title: "Geavanceerde filters",
            description: "Tri-state toggles (ja/nee/reset) voor email, telefoon, website, LinkedIn en of er al een mail is gegenereerd.",
          },
          {
            icon: Download,
            title: "CSV exporteren",
            description: "Hunter.io-compatible export van de gefilterde leads — klaar om te uploaden.",
          },
          {
            icon: Mail,
            title: "Bulk email genereren",
            description: "Markeer leads als 'ready_for_generation', daarna pakt Syb's n8n flow ze op.",
          },
        ]}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {SOURCE_FILTERS.map((f, i) => (
          <LeadsKpiTile
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={tabCounts[f.key]}
            accent={f.accent}
            active={sourceTab === f.key}
            onClick={() => setSourceTab(f.key)}
            index={i}
          />
        ))}
      </div>

      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Zoek op naam, email, locatie, beschrijving, website...",
        }}
        filters={
          <>
            {folders.length > 0 && (
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
              >
                <option value="all">Alle folders</option>
                {folders.map((fld) => (
                  <option key={fld} value={fld}>
                    {fld}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
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
          </>
        }
        activeCount={activeFilterCount}
        onClear={clearFilters}
        actions={
          <>
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={Math.max(1, filtered.length)}
                value={maxLeads}
                onChange={(e) => setMaxLeads(parseInt(e.target.value) || 1)}
                className="w-16 bg-autronis-card border border-autronis-border rounded-xl px-2 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
              />
              <button
                type="button"
                onClick={selectTop}
                className="px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/30 transition-colors"
              >
                Top {Math.min(maxLeads, filtered.length)}
              </button>
            </div>
          </>
        }
      />

      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-autronis-border bg-autronis-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-autronis-text-primary uppercase tracking-wide">
              Geavanceerde filters
            </h3>
            {activeFilterCount > 0 && (
              <button
                type="button"
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
                    type="button"
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
                    type="button"
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
        </motion.div>
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        actions={bulkActions}
        onClear={clearSelection}
      />

      {loading && leads.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Contacten laden...
        </div>
      )}

      {error && leads.length === 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon contacten niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && leads.length > 0 && (
        <SectionCard padding="none">
          <EmptyState
            titel="Geen contacten"
            beschrijving="Geen contacten matchen deze filters. Pas source, folder of geavanceerde filters aan."
          />
        </SectionCard>
      )}

      {filtered.length > 0 && (
        <SectionCard
          title="Contacten"
          icon={Users}
          padding="none"
          aside={
            <div className="flex items-center gap-3 text-xs text-autronis-text-secondary tabular-nums">
              {selectedIds.size > 0 && (
                <span className="text-autronis-accent font-medium">
                  {selectedIds.size} geselecteerd
                </span>
              )}
              <span>{filtered.length} resultaten</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
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
                  const leadEmails = parseEmails(lead.emails);
                  const emailStatus = leadEmailStatusMap.get(lead.id);
                  const sourceKind = isGoogleMaps(lead.source) ? "google_maps" : "linkedin";
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
                        <SourceBadge source={sourceKind} />
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
                        {leadEmails.length > 0 ? (
                          <a
                            href={`mailto:${leadEmails[0]}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-xs text-autronis-text-primary hover:text-autronis-accent truncate max-w-xs"
                          >
                            <Mail className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            {leadEmails[0]}
                            {leadEmails.length > 1 && (
                              <span className="text-autronis-text-secondary/50">+{leadEmails.length - 1}</span>
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
                        <FolderChip folder={lead.folder} />
                      </td>
                      <td className="px-4 py-4">
                        {emailStatus && <LeadStatusBadge status={emailStatus} compact />}
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
        </SectionCard>
      )}
    </div>
  );
}
