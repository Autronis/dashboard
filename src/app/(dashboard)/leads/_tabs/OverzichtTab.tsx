"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  Mail,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  Search,
  Users,
  Target,
  Zap,
  Linkedin,
  Trash2,
  X,
  Sparkles,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RedactText } from "@/components/leads/redact-text";
import { usePoll } from "@/lib/use-poll";
import { TabInfo } from "../_components/TabInfo";

interface LinkedinLeadRow {
  id: string;
  name: string | null;
  website: string | null;
  phone: string | null;
  emails: string | null;
  location: string | null;
  folder: string | null;
  linkedin_url: string | null;
  employee_count: string | null;
  search_term: string | null;
  outreach_status: string | null;
  created_at: string;
}

interface GoogleMapsLeadRow {
  id: string;
  name: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  address: string | null;
  folder: string | null;
  google_maps_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  employee_count: string | null;
  search_term: string | null;
  created_at: string;
}

interface UnifiedLead {
  id: string;
  source: "linkedin" | "google_maps";
  name: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  emails: string[];
  location: string | null;
  folder: string | null;
  linkedin_url?: string | null;
  google_maps_url?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  category?: string | null;
  address?: string | null;
  employee_count?: string | null;
  search_term?: string | null;
  outreach_status?: string | null;
  created_at: string;
}

function parseEmails(raw: string | null | undefined): string[] {
  if (!raw?.trim() || raw.trim() === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((e: string) => e?.trim());
  } catch {}
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

function unifyLinkedinLead(lead: LinkedinLeadRow): UnifiedLead {
  const emails = parseEmails(lead.emails);
  return {
    id: lead.id,
    source: "linkedin",
    name: lead.name,
    website: lead.website,
    phone: lead.phone,
    email: emails[0] || null,
    emails,
    location: lead.location,
    folder: lead.folder,
    linkedin_url: lead.linkedin_url,
    employee_count: lead.employee_count,
    search_term: lead.search_term,
    outreach_status: lead.outreach_status,
    created_at: lead.created_at,
  };
}

function unifyGmapsLead(lead: GoogleMapsLeadRow): UnifiedLead {
  return {
    id: lead.id,
    source: "google_maps",
    name: lead.name,
    website: lead.website,
    phone: lead.phone,
    email: lead.email,
    emails: lead.email?.trim() ? [lead.email] : [],
    location: lead.location || lead.address,
    folder: lead.folder,
    google_maps_url: lead.google_maps_url,
    rating: lead.rating,
    reviews_count: lead.reviews_count,
    category: lead.category,
    address: lead.address,
    employee_count: lead.employee_count,
    search_term: lead.search_term,
    created_at: lead.created_at,
  };
}

const SOURCE_FILTERS = [
  { key: "alle", label: "Alle" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin },
  { key: "google_maps", label: "Google Maps", icon: MapPin },
];

type StatToggle = "all" | "with_email" | "with_phone" | "with_website";

export function OverzichtTab() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<UnifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("alle");
  const [folderFilter, setFolderFilter] = useState<string>("alle");
  const [statToggle, setStatToggle] = useState<StatToggle>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<Record<string, "pending" | "completed" | "failed">>({});
  const [scanIds, setScanIds] = useState<Record<string, number>>({});
  const [isGeneratingEmails, setIsGeneratingEmails] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [linkedinRes, gmapsRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/leads/google-maps"),
      ]);

      if (!linkedinRes.ok) {
        const body = await linkedinRes.json().catch(() => ({}));
        throw new Error(body.fout || `LinkedIn leads HTTP ${linkedinRes.status}`);
      }
      if (!gmapsRes.ok) {
        const body = await gmapsRes.json().catch(() => ({}));
        throw new Error(body.fout || `Google Maps leads HTTP ${gmapsRes.status}`);
      }

      const linkedinData = await linkedinRes.json();
      const gmapsData = await gmapsRes.json();

      const linkedinLeads: UnifiedLead[] = (linkedinData.leads ?? []).map(
        (l: LinkedinLeadRow) => unifyLinkedinLead(l)
      );
      const gmapsLeads: UnifiedLead[] = (gmapsData.leads ?? []).map(
        (l: GoogleMapsLeadRow) => unifyGmapsLead(l)
      );

      // Merge en sorteer op created_at desc
      const merged = [...linkedinLeads, ...gmapsLeads].sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      setLeads(merged);
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

  // Realtime-ish: silent refetch elke 12s zolang tab actief is — geen loading flicker
  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 12000);

  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      if (l.folder) set.add(l.folder);
    }
    return Array.from(set).sort();
  }, [leads]);

  const stats = useMemo(() => {
    const total = leads.length;
    const metEmail = leads.filter((l) => l.emails.length > 0).length;
    const metTel = leads.filter((l) => !!l.phone?.trim()).length;
    const metWebsite = leads.filter((l) => !!l.website?.trim()).length;
    return { total, metEmail, metTel, metWebsite };
  }, [leads]);

  const gefilterd = useMemo(() => {
    let result = leads;

    // Source filter
    if (sourceFilter === "linkedin") result = result.filter((l) => l.source === "linkedin");
    else if (sourceFilter === "google_maps") result = result.filter((l) => l.source === "google_maps");

    // Folder filter
    if (folderFilter !== "alle") result = result.filter((l) => l.folder === folderFilter);

    // Stat toggle filter (klikbare KPI cards)
    if (statToggle === "with_email") result = result.filter((l) => l.emails.length > 0);
    else if (statToggle === "with_phone") result = result.filter((l) => !!l.phone?.trim());
    else if (statToggle === "with_website") result = result.filter((l) => !!l.website?.trim());

    // Search
    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.website, l.location, l.search_term]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }

    return result;
  }, [leads, sourceFilter, folderFilter, statToggle, zoek]);

  function toggleSelect(id: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === gefilterd.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(gefilterd.slice(0, 200).map((l) => l.id)));
    }
  }

  function clearFilters() {
    setSourceFilter("alle");
    setFolderFilter("alle");
    setStatToggle("all");
    setZoek("");
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      // Splits ids op source — beide tabellen hebben aparte DELETE endpoints
      const linkedinIds: string[] = [];
      const gmapsIds: string[] = [];
      for (const id of selectedIds) {
        const lead = leads.find((l) => l.id === id);
        if (!lead) continue;
        if (lead.source === "google_maps") gmapsIds.push(id);
        else linkedinIds.push(id);
      }

      const requests: Promise<Response>[] = [];
      if (linkedinIds.length > 0) {
        requests.push(
          fetch("/api/leads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: linkedinIds }),
          })
        );
      }
      if (gmapsIds.length > 0) {
        requests.push(
          fetch("/api/leads/google-maps", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: gmapsIds }),
          })
        );
      }

      const responses = await Promise.all(requests);
      for (const res of responses) {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.fout || `HTTP ${res.status}`);
        }
      }

      setLeads((curr) => curr.filter((l) => !selectedIds.has(l.id)));
      addToast(`${selectedIds.size} leads verwijderd`, "succes");
      setSelectedIds(new Set());
      setConfirmDelete(false);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Verwijderen mislukt", "fout");
    } finally {
      setIsDeleting(false);
    }
  }

  async function bulkScan() {
    const selected = leads.filter((l) => selectedIds.has(l.id) && l.website?.trim());
    if (selected.length === 0) {
      addToast("Geen leads met website geselecteerd", "fout");
      return;
    }
    setIsScanning(true);
    let ok = 0;
    let fail = 0;
    for (const lead of selected) {
      try {
        setScanResults((prev) => ({ ...prev, [lead.id]: "pending" }));
        const res = await fetch("/api/sales-engine/handmatig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bedrijfsnaam: lead.name || "Onbekend",
            websiteUrl: lead.website,
            contactpersoon: lead.name,
            email: lead.email,
            supabaseLeadId: lead.id,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setScanResults((prev) => ({ ...prev, [lead.id]: "completed" }));
        setScanIds((prev) => ({ ...prev, [lead.id]: data.scanId }));
        ok++;
      } catch {
        setScanResults((prev) => ({ ...prev, [lead.id]: "failed" }));
        fail++;
      }
    }
    setIsScanning(false);
    setSelectedIds(new Set());
    addToast(`${ok} scans gestart${fail > 0 ? `, ${fail} mislukt` : ""}`, ok > 0 ? "succes" : "fout");
  }

  async function bulkGenerateEmails() {
    const selected = leads.filter((l) => selectedIds.has(l.id) && l.website?.trim());
    if (selected.length === 0) {
      addToast("Geen leads met website geselecteerd", "fout");
      return;
    }
    setIsGeneratingEmails(true);
    try {
      const ids = selected.map((l) => l.id);
      const res = await fetch("/api/leads/edge-function/trigger-email-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: ids }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || body.error || `HTTP ${res.status}`);
      }
      addToast(`Email generatie gestart voor ${ids.length} leads — check Lead Emails`, "succes");
      setSelectedIds(new Set());
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Email generatie mislukt", "fout");
    } finally {
      setIsGeneratingEmails(false);
    }
  }

  const activeFilters = [
    sourceFilter !== "alle",
    folderFilter !== "alle",
    statToggle !== "all",
    !!zoek.trim(),
  ].filter(Boolean).length;

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary flex items-center gap-3">
            <Target className="w-7 h-7 text-autronis-accent" />
            Alle Leads
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1.5">
            Alle leads uit LinkedIn + Google Maps op één plek. Filter, scan of mail ze in bulk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads/emails"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Naar Lead Emails
          </Link>
        </div>
      </div>

      <TabInfo
        tips={[
          {
            icon: Target,
            title: "Scan websites",
            description: "Sales Engine analyseert geselecteerde websites op pijnpunten + intent signals.",
          },
          {
            icon: Mail,
            title: "Email genereren",
            description: "Syb's edge function maakt per lead een cold mail. Vereist een website URL.",
          },
          {
            icon: Trash2,
            title: "Verwijderen",
            description: "Verwijdert leads per bron (LinkedIn of Maps) — dubbelcheck je filter.",
          },
        ]}
      />

      {/* Klikbare stats — Lovable look met grote tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ClickableStat
          label="Totaal leads"
          waarde={stats.total}
          icon={Users}
          accent="cyan"
          active={statToggle === "all"}
          onClick={() => setStatToggle("all")}
          sub={`${stats.total} leads`}
        />
        <ClickableStat
          label="Met email"
          waarde={stats.metEmail}
          icon={Mail}
          accent="blue"
          active={statToggle === "with_email"}
          onClick={() => setStatToggle(statToggle === "with_email" ? "all" : "with_email")}
          sub={`${stats.metEmail} met email`}
        />
        <ClickableStat
          label="Met website"
          waarde={stats.metWebsite}
          icon={Globe}
          accent="green"
          active={statToggle === "with_website"}
          onClick={() => setStatToggle(statToggle === "with_website" ? "all" : "with_website")}
          sub={`${stats.metWebsite} met website`}
        />
        <ClickableStat
          label="Met telefoon"
          waarde={stats.metTel}
          icon={Phone}
          accent="purple"
          active={statToggle === "with_phone"}
          onClick={() => setStatToggle(statToggle === "with_phone" ? "all" : "with_phone")}
          sub={`${stats.metTel} met telefoon`}
        />
      </div>

      {/* Filters: source + folder */}
      <div className="flex flex-wrap items-center gap-2">
        {SOURCE_FILTERS.map((f) => {
          const active = sourceFilter === f.key;
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => setSourceFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                active
                  ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {f.label}
            </button>
          );
        })}
        {folders.length > 0 && (
          <select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
          >
            <option value="alle">Alle folders ({folders.length})</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <X className="w-3 h-3" />
            Wis filters ({activeFilters})
          </button>
        )}
      </div>

      {/* Zoek + bulk delete */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, website, locatie..."
            className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
          />
        </div>
        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-autronis-text-secondary">
              {selectedIds.size} geselecteerd
            </span>
            <button
              onClick={bulkScan}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-accent/10 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/20 transition-colors disabled:opacity-50"
            >
              {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Scan ({selectedIds.size})
            </button>
            <button
              onClick={bulkGenerateEmails}
              disabled={isGeneratingEmails}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              {isGeneratingEmails ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Email ({selectedIds.size})
            </button>
            {confirmDelete ? (
              <>
                <button
                  onClick={bulkDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Bevestig delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-text-primary"
                >
                  Annuleer
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Verwijder ({selectedIds.size})
              </button>
            )}
          </>
        )}
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
          <p className="mt-2 text-xs text-red-400/60">
            Check of <code className="text-red-300">SUPABASE_LEADS_URL</code> en{" "}
            <code className="text-red-300">SUPABASE_LEADS_SERVICE_KEY</code> gezet zijn in
            .env.local én Vercel environment variables.
          </p>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          {leads.length === 0 ? "Nog geen leads" : "Geen resultaten voor deze filters"}
        </div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="rounded-2xl border border-autronis-border bg-autronis-card overflow-hidden">
          <div className="px-6 py-4 border-b border-autronis-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-autronis-text-primary">Leads</h2>
            <span className="text-xs text-autronis-text-secondary tabular-nums">
              {gefilterd.length} resultaten
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-autronis-bg/40 text-[10px] uppercase text-autronis-text-secondary/70 tracking-wider">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === gefilterd.slice(0, 200).length && gefilterd.length > 0}
                    onChange={toggleAll}
                    className="rounded border-autronis-border accent-autronis-accent"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold">Bron</th>
                <th className="text-left px-4 py-3 font-semibold">Naam</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Locatie</th>
                <th className="text-left px-4 py-3 font-semibold">Contact</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Folder</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Scan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border/50">
              {gefilterd.slice(0, 200).map((lead) => {
                const emails = lead.emails;
                const selected = selectedIds.has(lead.id);
                return (
                  <tr
                    key={`${lead.source}:${lead.id}`}
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
                          lead.source === "google_maps"
                            ? "bg-autronis-accent/15 text-autronis-accent"
                            : "bg-purple-500/15 text-purple-300"
                        )}
                      >
                        {lead.source === "google_maps" ? (
                          <MapPin className="w-3 h-3" />
                        ) : (
                          <Linkedin className="w-3 h-3" />
                        )}
                        {lead.source === "google_maps" ? "Locatie" : "Bedrijf"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-autronis-text-primary truncate">
                          <RedactText>{lead.name || "(geen naam)"}</RedactText>
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
                      {lead.search_term && (
                        <span className="text-[10px] text-autronis-text-secondary/50 block mt-0.5">
                          {lead.search_term}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-autronis-text-secondary hidden md:table-cell">
                      {lead.location && (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <MapPin className="w-3 h-3 text-autronis-text-secondary/50" />
                          <RedactText>{(lead.location || "").split(",")[0]}</RedactText>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3 text-xs text-autronis-text-secondary">
                        {emails.length > 0 ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-autronis-text-primary"
                            title={emails.join(", ")}
                          >
                            <Mail className="w-3 h-3 text-blue-400" />
                            <RedactText>{emails[0]}</RedactText>
                            {emails.length > 1 && (
                              <span className="text-[10px] text-autronis-text-secondary/60">
                                +{emails.length - 1}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-autronis-text-secondary/40">—</span>
                        )}
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1 text-autronis-text-secondary/70">
                            <Phone className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {lead.folder ? (
                        <Link
                          href={`/leads/folders/${encodeURIComponent(lead.folder)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent hover:bg-autronis-accent/20 max-w-[180px] truncate"
                          title={lead.folder}
                        >
                          <FolderOpen className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{lead.folder}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-autronis-border/30 text-autronis-text-secondary/60">
                          <FolderOpen className="w-3 h-3" />
                          geen
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {lead.outreach_status && (
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            lead.outreach_status === "pending" && "bg-gray-500/10 text-gray-400",
                            lead.outreach_status === "sent" && "bg-emerald-500/10 text-emerald-400",
                            lead.outreach_status === "failed" && "bg-red-500/10 text-red-400"
                          )}
                        >
                          {lead.outreach_status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {scanResults[lead.id] === "pending" && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Bezig
                        </span>
                      )}
                      {scanResults[lead.id] === "completed" && (
                        <Link
                          href={`/sales-engine/${scanIds[lead.id]}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          <Sparkles className="w-3 h-3" />
                          Bekijk
                        </Link>
                      )}
                      {scanResults[lead.id] === "failed" && (
                        <span className="text-xs text-red-400">Mislukt</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {gefilterd.length > 200 && (
            <div className="px-4 py-2 text-xs text-autronis-text-secondary bg-autronis-bg/40 border-t border-autronis-border">
              {gefilterd.length} leads totaal — eerste 200 getoond
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type StatAccent = "cyan" | "blue" | "green" | "purple";

const STAT_ACCENT: Record<
  StatAccent,
  { iconBg: string; iconColor: string; valueColor: string; activeBorder: string }
> = {
  cyan: {
    iconBg: "bg-autronis-accent/15",
    iconColor: "text-autronis-accent",
    valueColor: "text-autronis-accent",
    activeBorder: "border-autronis-accent/60",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    valueColor: "text-blue-400",
    activeBorder: "border-blue-500/60",
  },
  green: {
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    valueColor: "text-emerald-400",
    activeBorder: "border-emerald-500/60",
  },
  purple: {
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    valueColor: "text-purple-400",
    activeBorder: "border-purple-500/60",
  },
};

function ClickableStat({
  label,
  waarde,
  icon: Icon,
  accent,
  sub,
  active,
  onClick,
}: {
  label: string;
  waarde: number;
  icon: typeof Users;
  accent: StatAccent;
  sub?: string;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = STAT_ACCENT[accent];
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-autronis-card p-6 text-left transition-all hover:border-autronis-accent/30",
        active ? cfg.activeBorder : "border-autronis-border"
      )}
    >
      <div
        className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center mb-4",
          cfg.iconBg
        )}
      >
        <Icon className={cn("w-5 h-5", cfg.iconColor)} />
      </div>
      <div className={cn("text-4xl font-bold tabular-nums leading-none", cfg.valueColor)}>
        {waarde.toLocaleString("nl-NL")}
      </div>
      <div className="text-xs uppercase tracking-wider text-autronis-text-secondary mt-2.5 font-medium">
        {label}
      </div>
      {sub && (
        <div className="text-[11px] text-autronis-text-secondary/60 mt-1">{sub}</div>
      )}
    </button>
  );
}
