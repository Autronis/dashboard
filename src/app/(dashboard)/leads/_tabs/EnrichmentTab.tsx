"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Play,
  Eraser,
  Filter,
  Download,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePoll } from "@/lib/use-poll";
import { TabInfo } from "../_components/TabInfo";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadsKpiTile } from "@/components/leads/kpi-tile";
import { SectionCard } from "@/components/leads/section-card";
import { SourceBadge } from "@/components/leads/source-badge";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { BulkActionBar, type BulkAction } from "@/components/leads/bulk-action-bar";

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

type TriState = "any" | "with" | "without";

interface FieldFilters {
  email: TriState;
  phone: TriState;
  website: TriState;
  linkedin: TriState;
}

const EMPTY_FILTERS: FieldFilters = {
  email: "any",
  phone: "any",
  website: "any",
  linkedin: "any",
};

function hasLinkedin(l: Lead): boolean {
  return !!l.linkedin_url?.trim();
}
function hasPhone(l: Lead): boolean {
  return !!l.phone?.trim() || !!l.phone_found;
}
function hasWebsite(l: Lead): boolean {
  return !!l.website?.trim() || !!l.website_found;
}

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
  const [filters, setFilters] = useState<FieldFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/leads");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLeads(data.leads ?? []);
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
    let result = tabLeads;

    if (filters.email !== "any") {
      const want = filters.email === "with";
      result = result.filter((l) => (hasEmailValue(l) || !!l.email_found) === want);
    }
    if (filters.phone !== "any") {
      const want = filters.phone === "with";
      result = result.filter((l) => hasPhone(l) === want);
    }
    if (filters.website !== "any") {
      const want = filters.website === "with";
      result = result.filter((l) => hasWebsite(l) === want);
    }
    if (filters.linkedin !== "any") {
      const want = filters.linkedin === "with";
      result = result.filter((l) => hasLinkedin(l) === want);
    }

    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.website, l.location]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tabLeads, zoek, filters]);

  const filterCounts = useMemo(() => {
    const base = tabLeads;
    return {
      withEmail: base.filter((l) => hasEmailValue(l) || !!l.email_found).length,
      withoutEmail: base.filter((l) => !hasEmailValue(l) && !l.email_found).length,
      withPhone: base.filter((l) => hasPhone(l)).length,
      withoutPhone: base.filter((l) => !hasPhone(l)).length,
      withWebsite: base.filter((l) => hasWebsite(l)).length,
      withoutWebsite: base.filter((l) => !hasWebsite(l)).length,
      withLinkedin: base.filter((l) => hasLinkedin(l)).length,
      withoutLinkedin: base.filter((l) => !hasLinkedin(l)).length,
    };
  }, [tabLeads]);

  const activeFilterCount =
    (filters.email !== "any" ? 1 : 0) +
    (filters.phone !== "any" ? 1 : 0) +
    (filters.website !== "any" ? 1 : 0) +
    (filters.linkedin !== "any" ? 1 : 0);

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

  function selectNextN(n: number) {
    const next = new Set(selectedIds);
    let added = 0;
    for (const l of gefilterd) {
      if (added >= n) break;
      if (!next.has(l.id)) {
        next.add(l.id);
        added += 1;
      }
    }
    setSelectedIds(next);
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleAll() {
    if (gefilterd.every((l) => selectedIds.has(l.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(gefilterd.map((l) => l.id)));
    }
  }

  function exportCSV() {
    if (gefilterd.length === 0) {
      addToast("Geen leads om te exporteren", "fout");
      return;
    }
    const header = [
      "name",
      "website",
      "phone",
      "emails",
      "location",
      "source",
      "linkedin_url",
      "enrichment_status",
    ];
    const escape = (v: string | null | undefined) => {
      if (v == null) return "";
      const s = String(v);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const rows = gefilterd.map((l) =>
      [
        l.name,
        l.website,
        l.phone,
        l.emails,
        l.location,
        l.source,
        l.linkedin_url,
        l.enrichment_status,
      ]
        .map(escape)
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrichment-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`${gefilterd.length} leads geëxporteerd`, "succes");
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
      setTimeout(() => load(), 2000);
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
      setTimeout(() => load(), 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Clean mislukt", "fout");
    } finally {
      setIsCleaning(false);
    }
  }

  const bulkActions: BulkAction[] = [
    {
      key: "clean",
      label: "Clean emails",
      icon: Eraser,
      onClick: cleanEmails,
      tone: "neutral",
      busy: isCleaning,
    },
    {
      key: "enrich",
      label: "Enrich",
      icon: Play,
      onClick: triggerEnrichment,
      tone: "cyan",
      busy: isEnriching,
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        title="Enrichment"
        description="Data verrijken. Vind ontbrekende email/telefoon/website via externe bronnen. Dit vóór Contacten — eerst gaten dichten, dan segmenteren."
        actions={
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Vernieuwen
          </button>
        }
      />

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LeadsKpiTile
          icon={Sparkles}
          label="Kandidaten"
          value={stats.candidates}
          accent="purple"
          sub={`${stats.totalCompleted} voltooid`}
          index={0}
        />
        <LeadsKpiTile
          icon={Mail}
          label="Email gevonden"
          value={stats.emailFound}
          accent="cyan"
          sub={`${stats.emailHitRate}% hit rate`}
          index={1}
        />
        <LeadsKpiTile
          icon={Phone}
          label="Telefoon gevonden"
          value={stats.phoneFound}
          accent="green"
          sub={`${stats.phoneHitRate}% hit rate`}
          index={2}
        />
        <LeadsKpiTile
          icon={AlertCircle}
          label="Gefaald"
          value={stats.failed}
          accent="red"
          sub={`${stats.pending} pending`}
          index={3}
        />
      </div>

      {/* Status tabs — filter pills */}
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
              type="button"
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
              <Icon className={cn("w-3 h-3", t.key === "pending" && "animate-spin")} />
              {t.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      <FilterBar
        search={{
          value: zoek,
          onChange: setZoek,
          placeholder: "Zoek op naam, website, locatie...",
        }}
        filters={
          <>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                activeFilterCount > 0 || showFilters
                  ? "bg-autronis-accent/10 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
              )}
            >
              <Filter className="w-3 h-3" />
              Filters
              {activeFilterCount > 0 && (
                <span className="tabular-nums font-semibold">({activeFilterCount})</span>
              )}
            </button>
          </>
        }
        activeCount={activeFilterCount}
        onClear={() => setFilters(EMPTY_FILTERS)}
        actions={
          <>
            <button
              type="button"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 transition-colors"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={5000}
                value={maxLeads}
                onChange={(e) => setMaxLeads(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 bg-autronis-card border border-autronis-border rounded-xl px-2 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
              />
              <button
                type="button"
                onClick={() => selectNextN(maxLeads)}
                title="Voeg de volgende N toe aan selectie"
                className="px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 transition-colors"
              >
                + volgende {maxLeads}
              </button>
              <button
                type="button"
                onClick={() => selectFirstN(maxLeads)}
                title="Vervang selectie met top N"
                className="px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 transition-colors"
              >
                Top {maxLeads}
              </button>
              <button
                type="button"
                onClick={toggleAll}
                title="Selecteer alle gefilterde leads"
                className="px-3 py-2 rounded-xl bg-autronis-accent/10 border border-autronis-accent/30 text-xs font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors"
              >
                Alles ({gefilterd.length})
              </button>
            </div>
          </>
        }
      />

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-autronis-accent/30 bg-autronis-bg/40 p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-autronis-text-primary flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-autronis-accent" /> Filters
            </h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="text-[11px] text-autronis-text-secondary hover:text-red-400 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary"
              >
                Sluit
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FilterRow
              label="Email"
              icon={Mail}
              value={filters.email}
              onChange={(v) => setFilters((f) => ({ ...f, email: v }))}
              withCount={filterCounts.withEmail}
              withoutCount={filterCounts.withoutEmail}
            />
            <FilterRow
              label="Telefoon"
              icon={Phone}
              value={filters.phone}
              onChange={(v) => setFilters((f) => ({ ...f, phone: v }))}
              withCount={filterCounts.withPhone}
              withoutCount={filterCounts.withoutPhone}
            />
            <FilterRow
              label="Website"
              icon={Globe}
              value={filters.website}
              onChange={(v) => setFilters((f) => ({ ...f, website: v }))}
              withCount={filterCounts.withWebsite}
              withoutCount={filterCounts.withoutWebsite}
            />
            <FilterRow
              label="LinkedIn"
              icon={Linkedin}
              value={filters.linkedin}
              onChange={(v) => setFilters((f) => ({ ...f, linkedin: v }))}
              withCount={filterCounts.withLinkedin}
              withoutCount={filterCounts.withoutLinkedin}
            />
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
          Leads laden...
        </div>
      )}

      {error && leads.length === 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon leads niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && leads.length > 0 && (
        <SectionCard padding="none">
          <EmptyState
            titel="Geen leads in deze tab"
            beschrijving="Schakel van tab of pas filters aan om meer leads te zien."
          />
        </SectionCard>
      )}

      {gefilterd.length > 0 && (
        <SectionCard
          title="Leads"
          icon={Sparkles}
          padding="none"
          aside={
            <div className="flex items-center gap-3 text-xs text-autronis-text-secondary tabular-nums">
              {selectedIds.size > 0 && (
                <span className="text-autronis-accent font-medium">
                  {selectedIds.size} geselecteerd
                </span>
              )}
              <span>{gefilterd.length} leads</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-autronis-bg/40 text-xs uppercase text-autronis-text-secondary/70 tracking-wider">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={
                        gefilterd.length > 0 &&
                        gefilterd.every((l) => selectedIds.has(l.id))
                      }
                      onChange={toggleAll}
                      title="Selecteer alle gefilterde leads"
                      className="rounded border-autronis-border accent-autronis-accent"
                    />
                  </th>
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
                        <SourceBadge source={lead.source} compact />
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 flex-wrap">
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
                            <LeadStatusBadge status="failed" compact />
                          )}
                          {lead.enrichment_status === "pending" && (
                            <LeadStatusBadge status="pending" compact />
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
        </SectionCard>
      )}
    </div>
  );
}

function FilterRow({
  label,
  icon: Icon,
  value,
  onChange,
  withCount,
  withoutCount,
}: {
  label: string;
  icon: typeof Mail;
  value: TriState;
  onChange: (v: TriState) => void;
  withCount: number;
  withoutCount: number;
}) {
  const options: Array<{ key: TriState; label: string; count?: number }> = [
    { key: "any", label: "Alle" },
    { key: "with", label: `Heeft ${label.toLowerCase()}`, count: withCount },
    { key: "without", label: `Geen ${label.toLowerCase()}`, count: withoutCount },
  ];
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-autronis-text-secondary mb-2">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border",
                active
                  ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                  : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
              {opt.label}
              {typeof opt.count === "number" && (
                <span className="tabular-nums text-autronis-text-secondary/60">
                  ({opt.count})
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
