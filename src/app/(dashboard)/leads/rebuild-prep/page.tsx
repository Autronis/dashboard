"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  Search,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  MapPin,
  ChevronLeft,
  Globe,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { PrepLeadResult } from "@/lib/lead-rebuild-prep";

interface GoogleMapsLeadRow {
  id: string;
  name: string | null;
  website: string | null;
  location: string | null;
  address: string | null;
  category: string | null;
  folder: string | null;
  google_maps_url: string | null;
  created_at: string;
}

const BATCH_LIMIT = 20;

type SiteFilter = "alle" | "met_site" | "zonder_site";

export default function LeadsRebuildPrepPage() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<GoogleMapsLeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [siteFilter, setSiteFilter] = useState<SiteFilter>("alle");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preppingLoader, setPreppingLoader] = useState(false);
  const [results, setResults] = useState<PrepLeadResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads/google-maps");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const rows: GoogleMapsLeadRow[] = data.leads ?? [];
      setLeads(rows);
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

  const counts = useMemo(() => {
    const withSite = leads.filter((l) => !!l.website?.trim()).length;
    return { total: leads.length, withSite, withoutSite: leads.length - withSite };
  }, [leads]);

  const gefilterd = useMemo(() => {
    let list = leads;
    if (siteFilter === "met_site") list = list.filter((l) => !!l.website?.trim());
    else if (siteFilter === "zonder_site") list = list.filter((l) => !l.website?.trim());
    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      list = list.filter((l) =>
        [l.name, l.location, l.address, l.category, l.website]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return list;
  }, [leads, siteFilter, zoek]);

  const resultById = useMemo(() => {
    const m = new Map<string, PrepLeadResult>();
    for (const r of results) m.set(r.lead.id, r);
    return m;
  }, [results]);

  function toggleSelect(id: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else if (next.size >= BATCH_LIMIT) {
        addToast(`Max ${BATCH_LIMIT} per batch`, "fout");
        return curr;
      } else next.add(id);
      return next;
    });
  }

  function selectFirstVisible() {
    const pick = gefilterd.slice(0, BATCH_LIMIT).map((l) => l.id);
    setSelectedIds(new Set(pick));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runPrep() {
    if (selectedIds.size === 0) return;
    setPreppingLoader(true);
    try {
      const res = await fetch("/api/leads/prep-rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || `HTTP ${res.status}`);
      setResults(data.resultaten ?? []);
      addToast(`${data.totaal ?? 0} leads geprepareerd`, "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Prep mislukt", "fout");
    } finally {
      setPreppingLoader(false);
    }
  }

  async function copyPrompt(r: PrepLeadResult) {
    try {
      await navigator.clipboard.writeText(r.prompt);
      setCopiedId(r.lead.id);
      setTimeout(() => setCopiedId((c) => (c === r.lead.id ? null : c)), 1500);
    } catch {
      addToast("Kopiëren mislukt", "fout");
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-autronis-text-muted hover:text-autronis-text mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Terug naar Leads
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-autronis-text flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-autronis-accent" />
              Lead Rebuild Prep
            </h1>
            <p className="text-autronis-text-muted mt-1 max-w-2xl">
              Batch-tool voor Google Maps leads. Leads <b>zonder</b> website
              krijgen een SERP-check + "from scratch" prompt. Leads <b>mét</b>{" "}
              website worden gescraped zodat je een upgrade-pitch kan geven.
              Beide kanten krijgen sector-fit voor scroll-stop animatie. Max{" "}
              {BATCH_LIMIT} per batch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectFirstVisible}
              disabled={gefilterd.length === 0}
              className="px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-sm text-autronis-text hover:border-autronis-accent transition disabled:opacity-50"
            >
              Selecteer eerste {Math.min(BATCH_LIMIT, gefilterd.length)}
            </button>
            <button
              onClick={runPrep}
              disabled={selectedIds.size === 0 || preppingLoader}
              className="px-4 py-2 rounded-lg bg-autronis-accent text-black text-sm font-semibold hover:bg-autronis-accent-hover transition disabled:opacity-50 inline-flex items-center gap-2"
            >
              {preppingLoader ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Bezig...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Prep {selectedIds.size || ""} leads
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-autronis-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, locatie of categorie..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-sm text-autronis-text placeholder:text-autronis-text-muted focus:border-autronis-accent outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-autronis-card border border-autronis-border">
          {(
            [
              { key: "alle", label: `Alle (${counts.total})` },
              { key: "zonder_site", label: `Zonder site (${counts.withoutSite})` },
              { key: "met_site", label: `Met site (${counts.withSite})` },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setSiteFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition",
                siteFilter === f.key
                  ? "bg-autronis-accent text-black"
                  : "text-autronis-text-muted hover:text-autronis-text"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="text-sm text-autronis-text-muted">
          {gefilterd.length} zichtbaar · {selectedIds.size} geselecteerd
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={clearSelection}
            className="text-sm text-autronis-text-muted hover:text-autronis-text"
          >
            Wissen
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-autronis-accent" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-autronis-card border border-autronis-border overflow-hidden mb-8">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-autronis-card border-b border-autronis-border">
                  <tr className="text-left text-autronis-text-muted">
                    <th className="py-3 px-4 w-10"></th>
                    <th className="py-3 px-4">Naam</th>
                    <th className="py-3 px-4 w-28">Mode</th>
                    <th className="py-3 px-4">Categorie</th>
                    <th className="py-3 px-4">Locatie</th>
                    <th className="py-3 px-4 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {gefilterd.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-12 text-center text-autronis-text-muted"
                      >
                        Geen leads gevonden.
                      </td>
                    </tr>
                  ) : (
                    gefilterd.map((lead) => {
                      const checked = selectedIds.has(lead.id);
                      const hasSite = !!lead.website?.trim();
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => toggleSelect(lead.id)}
                          className={cn(
                            "border-b border-autronis-border/40 cursor-pointer transition",
                            checked
                              ? "bg-autronis-accent/10"
                              : "hover:bg-autronis-border/20"
                          )}
                        >
                          <td className="py-2.5 px-4">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelect(lead.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="accent-autronis-accent"
                            />
                          </td>
                          <td className="py-2.5 px-4 text-autronis-text font-medium">
                            <div>{lead.name || "(geen naam)"}</div>
                            {hasSite && lead.website && (
                              <a
                                href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-autronis-text-muted hover:text-autronis-accent inline-flex items-center gap-1 mt-0.5"
                              >
                                <Globe className="w-3 h-3" />
                                {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                              </a>
                            )}
                          </td>
                          <td className="py-2.5 px-4">
                            {hasSite ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                <Wrench className="w-3 h-3" />
                                Upgrade
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                <Sparkles className="w-3 h-3" />
                                Fresh
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-autronis-text-muted">
                            {lead.category || "—"}
                          </td>
                          <td className="py-2.5 px-4 text-autronis-text-muted">
                            {lead.location || lead.address || "—"}
                          </td>
                          <td className="py-2.5 px-4">
                            {lead.google_maps_url && (
                              <a
                                href={lead.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-autronis-text-muted hover:text-autronis-accent text-xs"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                Maps
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {results.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-autronis-text mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-autronis-accent" />
                Prep resultaten ({results.length})
              </h2>
              <div className="space-y-3">
                {results.map((r) => (
                  <ResultCard
                    key={r.lead.id}
                    result={r}
                    onCopy={copyPrompt}
                    copied={copiedId === r.lead.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultCard({
  result,
  onCopy,
  copied,
}: {
  result: PrepLeadResult;
  onCopy: (r: PrepLeadResult) => void;
  copied: boolean;
}) {
  const { lead, mode, serp, scrape, fit } = result;

  const fitStyles =
    fit.verdict === "scroll_stop_good"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : fit.verdict === "static_upgrade"
        ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
        : "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";

  const modeStyles =
    mode === "upgrade"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
      : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";

  const modeLabel = mode === "upgrade" ? "Upgrade bestaande site" : "Fresh build";

  // Secondary status: scrape success for upgrade mode, SERP verdict for fresh mode.
  let statusLabel: string | null = null;
  let statusStyles = "bg-zinc-500/10 text-zinc-300 border-zinc-500/30";

  if (mode === "upgrade") {
    if (scrape.error) {
      statusLabel = "Scrape faalde";
      statusStyles = "bg-red-500/10 text-red-300 border-red-500/30";
    } else if (scrape.markdown) {
      statusLabel = `Gescraped (${scrape.markdown.length.toLocaleString("nl-NL")} chars)`;
      statusStyles = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    }
  } else {
    if (serp.verdict === "site_found") {
      statusLabel = "SERP: site gevonden";
      statusStyles = "bg-amber-500/10 text-amber-300 border-amber-500/30";
    } else if (serp.verdict === "no_site") {
      statusLabel = "SERP: geen site";
      statusStyles = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
    } else if (serp.verdict === "error") {
      statusLabel = "SERP error";
      statusStyles = "bg-red-500/10 text-red-300 border-red-500/30";
    }
  }

  const linkUrl = mode === "upgrade" ? scrape.url : serp.foundUrl;
  const footerNote = mode === "upgrade" ? scrape.error || null : serp.note;

  return (
    <div className="rounded-xl bg-autronis-card border border-autronis-border p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-autronis-text font-semibold">
              {lead.name || "(geen naam)"}
            </span>
            <span
              className={cn("px-2 py-0.5 rounded-md text-xs border", modeStyles)}
            >
              {modeLabel}
            </span>
            <span
              className={cn("px-2 py-0.5 rounded-md text-xs border", fitStyles)}
            >
              {fit.label}
            </span>
            {statusLabel && (
              <span
                className={cn("px-2 py-0.5 rounded-md text-xs border", statusStyles)}
              >
                {statusLabel}
              </span>
            )}
          </div>
          <div className="text-xs text-autronis-text-muted mt-1">
            {[lead.category, lead.location || lead.address].filter(Boolean).join(" · ") || "—"}
          </div>
          {linkUrl && (
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-autronis-accent hover:underline mt-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              {linkUrl}
            </a>
          )}
          {footerNote && (
            <div className="text-xs text-autronis-text-muted mt-1 italic">
              {footerNote}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onCopy(result)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-medium transition inline-flex items-center gap-1.5",
              copied
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-autronis-bg border-autronis-border text-autronis-text hover:border-autronis-accent"
            )}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Gekopieerd
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy prompt
              </>
            )}
          </button>
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg bg-autronis-accent text-black text-xs font-semibold hover:bg-autronis-accent-hover transition inline-flex items-center gap-1.5"
          >
            claude.ai
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
