"use client";

import { useEffect, useState, useMemo, useCallback, use } from "react";
import Link from "next/link";
import {
  FolderOpen,
  ArrowLeft,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Mail,
  Download,
  Linkedin,
  MapPin,
  ExternalLink,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBulkScan } from "../../_components/use-bulk-scan";

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
  } catch {}
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

const TABS = [
  { key: "all", label: "Alle" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "google_maps", label: "Google Maps" },
  { key: "enriched", label: "Enriched" },
  { key: "failed", label: "Failed" },
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
  const [tab, setTab] = useState("all");
  const [zoek, setZoek] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEnriching, setIsEnriching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { isScanning, runScan } = useBulkScan();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // Filter direct op folder naam — server-side filtering zou efficiënter zijn,
      // maar /api/leads heeft geen folder query param dus dit is acceptabel
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

  async function scanSelected() {
    const selected = leads
      .filter((l) => selectedIds.has(l.id))
      .map((l) => ({
        id: l.id,
        name: l.name,
        website: l.website,
        email: parseEmails(l.emails)[0] ?? null,
        supabaseLeadId: l.id,
      }));
    await runScan(selected);
    setSelectedIds(new Set());
  }

  function exportSelected() {
    const toExport =
      selectedIds.size > 0 ? filtered.filter((l) => selectedIds.has(l.id)) : filtered;
    if (toExport.length === 0) {
      addToast("Geen leads om te exporteren", "fout");
      return;
    }
    exportLeadsAsCSV(toExport, `folder-${folderName}-${new Date().toISOString().slice(0, 10)}.csv`);
    addToast(`${toExport.length} leads geëxporteerd`, "succes");
  }

  return (
    <div className="space-y-6">
      {/* Header met breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href="/leads/folders"
            className="inline-flex items-center gap-1 text-xs text-autronis-text-secondary hover:text-autronis-accent mb-2"
          >
            <ArrowLeft className="w-3 h-3" />
            Terug naar folders
          </Link>
          <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-autronis-accent" />
            {folderName}
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            {leads.length} leads in deze folder
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportSelected}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={scanSelected}
                disabled={isScanning}
                title="Start een Sales Engine scan voor elke geselecteerde lead (vereist website URL)"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-accent/10 border border-autronis-accent/30 text-xs font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors disabled:opacity-40"
              >
                {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Scan ({selectedIds.size})
              </button>
              <button
                onClick={enrichSelected}
                disabled={isEnriching}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-semibold text-autronis-text-primary hover:border-autronis-accent/40 transition-colors disabled:opacity-40"
              >
                {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Enrich ({selectedIds.size})
              </button>
              <button
                onClick={generateSelected}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                Genereer ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key as keyof typeof counts];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                active
                  ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
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
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek binnen folder..."
          className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
        />
      </div>

      {/* Body */}
      {loading && leads.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Folder leads laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon folder niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          {leads.length === 0
            ? `Geen leads in folder "${folderName}"`
            : "Geen resultaten in deze tab"}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-autronis-bg/40 text-xs uppercase text-autronis-text-secondary/70 tracking-wider">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-autronis-border accent-autronis-accent"
                  />
                </th>
                <th className="text-left px-3 py-2.5 font-medium">Bedrijf</th>
                <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Email</th>
                <th className="text-left px-3 py-2.5 font-medium hidden lg:table-cell">Locatie</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border/50">
              {filtered.slice(0, 200).map((lead) => {
                const selected = selectedIds.has(lead.id);
                const emails = parseEmails(lead.emails);
                return (
                  <tr
                    key={lead.id}
                    onClick={() => toggleSelect(lead.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selected ? "bg-autronis-accent/10" : "hover:bg-autronis-accent/[0.03]"
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-autronis-border accent-autronis-accent"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-autronis-text-primary truncate max-w-xs">
                          {lead.name || "(geen naam)"}
                        </span>
                        {isGoogleMaps(lead.source) ? (
                          <MapPin className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                        ) : (
                          <Linkedin className="w-3 h-3 text-purple-300 flex-shrink-0" />
                        )}
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
                    <td className="px-3 py-2.5 hidden md:table-cell text-xs text-autronis-text-secondary truncate max-w-xs">
                      {emails[0] || "—"}
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-xs text-autronis-text-secondary">
                      {(lead.location || "").split(",")[0] || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {lead.email_found ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Enriched
                        </span>
                      ) : lead.enrichment_status === "failed" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Failed
                        </span>
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
      )}
    </div>
  );
}
