"use client";

import { useEffect, useState, useMemo, useCallback, use } from "react";
import Link from "next/link";
import {
  FolderOpen,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Sparkles,
  Mail,
  Download,
  ExternalLink,
  Zap,
  Users,
  Linkedin,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBulkScan } from "../../_components/use-bulk-scan";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadsKpiTile, type LeadsKpiAccent } from "@/components/leads/kpi-tile";
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
  folder: string | null;
  source: string | null;
  email_found: boolean | null;
  enrichment_status: string | null;
  linkedin_url: string | null;
  generated_email: string | null;
}

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

function exportLeadsAsCSV(leads: Lead[], filename: string) {
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
    ];
  });
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type TabKey = "all" | "linkedin" | "google_maps" | "enriched" | "failed";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Users; accent: LeadsKpiAccent }> = [
  { key: "all", label: "Alle", icon: Users, accent: "cyan" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, accent: "purple" },
  { key: "google_maps", label: "Google Maps", icon: MapPin, accent: "green" },
  { key: "enriched", label: "Enriched", icon: CheckCircle, accent: "blue" },
  { key: "failed", label: "Failed", icon: Sparkles, accent: "red" },
];

export default function FolderDetailPage({
  params,
}: {
  params: Promise<{ naam: string }>;
}) {
  const { naam } = use(params);
  const folderName = decodeURIComponent(naam);
  const { addToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [zoek, setZoek] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { runScan } = useBulkScan();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const folderLeads = (data.leads ?? []).filter(
        (l: Lead) => l.folder === folderName
      );
      setLeads(folderLeads);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, [folderName]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      linkedin: leads.filter((l) => isLinkedin(l.source)).length,
      google_maps: leads.filter((l) => isGoogleMaps(l.source)).length,
      enriched: leads.filter(
        (l) => l.email_found || l.enrichment_status === "success"
      ).length,
      failed: leads.filter((l) => l.enrichment_status === "failed").length,
    }),
    [leads]
  );

  const filtered = useMemo(() => {
    let result = leads;
    if (tab === "linkedin") result = result.filter((l) => isLinkedin(l.source));
    else if (tab === "google_maps") result = result.filter((l) => isGoogleMaps(l.source));
    else if (tab === "enriched")
      result = result.filter((l) => l.email_found || l.enrichment_status === "success");
    else if (tab === "failed") result = result.filter((l) => l.enrichment_status === "failed");

    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.website, l.location].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
      );
    }
    return result;
  }, [leads, tab, zoek]);

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

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function enrichSelected() {
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
      addToast(`Enrichment gestart voor ${selectedIds.size} leads`, "succes");
      setSelectedIds(new Set());
      setTimeout(load, 2000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Enrichment mislukt", "fout");
    } finally {
      setIsEnriching(false);
    }
  }

  async function generateSelected() {
    const valid = Array.from(selectedIds).filter((id) =>
      leads.find((l) => l.id === id && l.website)
    );
    if (valid.length === 0) {
      addToast("Geen geldige leads (moeten website hebben)", "fout");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/leads/edge-function/trigger-email-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: valid }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || data.data?.error || `HTTP ${res.status}`);
      }
      addToast(`Email generatie gestart voor ${valid.length} leads`, "succes");
      setSelectedIds(new Set());
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Generatie mislukt", "fout");
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

  function exportSelected() {
    const toExport =
      selectedIds.size > 0 ? filtered.filter((l) => selectedIds.has(l.id)) : filtered;
    if (toExport.length === 0) {
      addToast("Geen leads om te exporteren", "fout");
      return;
    }
    exportLeadsAsCSV(
      toExport,
      `folder-${folderName}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    addToast(`${toExport.length} leads geëxporteerd`, "succes");
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
      onClick: enrichSelected,
      tone: "blue",
      busy: isEnriching,
    },
    {
      key: "generate",
      label: "Genereer",
      icon: Mail,
      onClick: generateSelected,
      tone: "emerald",
      busy: isGenerating,
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <Link
          href="/leads/folders"
          className="inline-flex items-center gap-1 text-xs text-autronis-text-secondary hover:text-autronis-accent mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Terug naar folders
        </Link>
        <PageHeader
          title={folderName}
          description={`${leads.length} leads in deze folder`}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {TABS.map((t, i) => (
          <LeadsKpiTile
            key={t.key}
            icon={t.icon}
            label={t.label}
            value={counts[t.key]}
            accent={t.accent}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
            index={i}
          />
        ))}
      </div>

      <FilterBar
        search={{
          value: zoek,
          onChange: setZoek,
          placeholder: "Zoek binnen folder...",
        }}
        actions={
          <button
            type="button"
            onClick={exportSelected}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        }
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        actions={bulkActions}
        onClear={clearSelection}
      />

      {loading && leads.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Folder leads laden...
        </div>
      )}

      {error && leads.length === 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon folder niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <SectionCard padding="none">
          <EmptyState
            titel={
              leads.length === 0
                ? `Geen leads in folder "${folderName}"`
                : "Geen resultaten"
            }
            beschrijving={
              leads.length === 0
                ? "Koppel leads aan deze folder via Contacten of de overzicht-tab."
                : "Pas het filter of de zoekterm aan."
            }
            icoon={<FolderOpen className="h-7 w-7 text-autronis-accent" />}
          />
        </SectionCard>
      )}

      {filtered.length > 0 && (
        <SectionCard
          title="Leads"
          icon={FolderOpen}
          padding="none"
          aside={
            <div className="flex items-center gap-3 text-xs text-autronis-text-secondary tabular-nums">
              {selectedIds.size > 0 && (
                <span className="text-autronis-accent font-medium">
                  {selectedIds.size} geselecteerd
                </span>
              )}
              <span>{filtered.length} leads</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-autronis-bg/40 text-[10px] uppercase text-autronis-text-secondary/70 tracking-wider">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
                      className="rounded border-autronis-border accent-autronis-accent"
                    />
                  </th>
                  <th className="text-left px-3 py-3 font-semibold">Bron</th>
                  <th className="text-left px-3 py-3 font-semibold">Bedrijf</th>
                  <th className="text-left px-3 py-3 font-semibold hidden md:table-cell">Email</th>
                  <th className="text-left px-3 py-3 font-semibold hidden lg:table-cell">Locatie</th>
                  <th className="text-left px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-autronis-border/50">
                {filtered.slice(0, 200).map((lead) => {
                  const selected = selectedIds.has(lead.id);
                  const emails = parseEmails(lead.emails);
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
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-autronis-border accent-autronis-accent"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <SourceBadge source={sourceKind} compact />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-autronis-text-primary truncate max-w-xs">
                            {lead.name || "(geen naam)"}
                          </span>
                          {lead.website && (
                            <a
                              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-autronis-text-secondary hover:text-autronis-accent flex-shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-xs text-autronis-text-secondary truncate max-w-xs">
                        {emails[0] || "—"}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell text-xs text-autronis-text-secondary">
                        {(lead.location || "").split(",")[0] || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {lead.email_found ? (
                          <LeadStatusBadge status="completed" label="Enriched" compact />
                        ) : lead.enrichment_status === "failed" ? (
                          <LeadStatusBadge status="failed" compact />
                        ) : (
                          <span className="text-[10px] text-autronis-text-secondary/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="px-4 py-2 text-xs text-autronis-text-secondary bg-autronis-bg/40 border-t border-autronis-border text-center">
                {filtered.length} totaal — eerste 200 getoond
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
