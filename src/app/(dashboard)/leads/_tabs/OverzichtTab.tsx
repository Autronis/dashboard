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
  Users,
  Target,
  Zap,
  Linkedin,
  Trash2,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RedactText } from "@/components/leads/redact-text";
import { usePoll } from "@/lib/use-poll";
import { TabInfo } from "../_components/TabInfo";
import { useBulkScan } from "../_components/use-bulk-scan";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { LeadsKpiTile } from "@/components/leads/kpi-tile";
import { SourceBadge } from "@/components/leads/source-badge";
import { FolderChip } from "@/components/leads/folder-chip";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { BulkActionBar, type BulkAction } from "@/components/leads/bulk-action-bar";
import { SectionCard } from "@/components/leads/section-card";

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

const SOURCE_FILTERS: Array<{ key: string; label: string; icon?: typeof Linkedin }> = [
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
  const [isGeneratingEmails, setIsGeneratingEmails] = useState(false);
  const { runScan } = useBulkScan();

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

    if (sourceFilter === "linkedin") result = result.filter((l) => l.source === "linkedin");
    else if (sourceFilter === "google_maps") result = result.filter((l) => l.source === "google_maps");

    if (folderFilter !== "alle") result = result.filter((l) => l.folder === folderFilter);

    if (statToggle === "with_email") result = result.filter((l) => l.emails.length > 0);
    else if (statToggle === "with_phone") result = result.filter((l) => !!l.phone?.trim());
    else if (statToggle === "with_website") result = result.filter((l) => !!l.website?.trim());

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

  function clearSelection() {
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
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

  function bulkScan() {
    const selected = leads.filter((l) => selectedIds.has(l.id));
    runScan(
      selected.map((l) => ({
        id: l.id,
        name: l.name,
        website: l.website,
        email: l.email,
        supabaseLeadId: l.id,
      })),
    );
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

  const bulkActions: BulkAction[] = [
    {
      key: "scan",
      label: "Scan",
      icon: Zap,
      onClick: bulkScan,
      tone: "cyan",
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      onClick: bulkGenerateEmails,
      tone: "blue",
      busy: isGeneratingEmails,
    },
    {
      key: "rebuild",
      label: "Rebuild Prep",
      icon: Wand2,
      href: `/leads/rebuild-prep?preselect=${encodeURIComponent(Array.from(selectedIds).join(","))}`,
      onClick: () => {},
      tone: "fuchsia",
      title: "Open Rebuild Prep batch-tool met deze selectie",
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        title="Alle Leads"
        description="Startpunt — LinkedIn + Google Maps in één tabel. Selecteer en bulk-scan, -mail of -verwijder."
        actions={
          <Link
            href="/leads/emails"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Naar Lead Emails
          </Link>
        }
      />

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LeadsKpiTile
          label="Totaal leads"
          value={stats.total}
          icon={Users}
          accent="cyan"
          active={statToggle === "all"}
          onClick={() => setStatToggle("all")}
          sub={`${stats.total} leads`}
          index={0}
        />
        <LeadsKpiTile
          label="Met email"
          value={stats.metEmail}
          icon={Mail}
          accent="blue"
          active={statToggle === "with_email"}
          onClick={() => setStatToggle(statToggle === "with_email" ? "all" : "with_email")}
          sub={`${stats.metEmail} met email`}
          index={1}
        />
        <LeadsKpiTile
          label="Met website"
          value={stats.metWebsite}
          icon={Globe}
          accent="green"
          active={statToggle === "with_website"}
          onClick={() => setStatToggle(statToggle === "with_website" ? "all" : "with_website")}
          sub={`${stats.metWebsite} met website`}
          index={2}
        />
        <LeadsKpiTile
          label="Met telefoon"
          value={stats.metTel}
          icon={Phone}
          accent="purple"
          active={statToggle === "with_phone"}
          onClick={() => setStatToggle(statToggle === "with_phone" ? "all" : "with_phone")}
          sub={`${stats.metTel} met telefoon`}
          index={3}
        />
      </div>

      <FilterBar
        search={{
          value: zoek,
          onChange: setZoek,
          placeholder: "Zoek op naam, website, locatie...",
        }}
        filters={
          <>
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
          </>
        }
        activeCount={activeFilters}
        onClear={clearFilters}
      />

      <BulkActionBar
        selectedCount={selectedIds.size}
        actions={bulkActions}
        onDelete={confirmDelete ? bulkDelete : () => setConfirmDelete(true)}
        deleteBusy={isDeleting}
        onClear={clearSelection}
        prefix={
          confirmDelete && (
            <span className="text-xs text-red-300 px-1 animate-pulse">
              Klik nogmaals om te bevestigen
            </span>
          )
        }
      />

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
        <SectionCard
          title="Leads"
          padding="none"
          aside={
            <span className="text-xs text-autronis-text-secondary tabular-nums">
              {gefilterd.length} resultaten
            </span>
          }
        >
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
                      <SourceBadge source={lead.source} />
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
                      <FolderChip
                        folder={lead.folder}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <LeadStatusBadge status={lead.outreach_status} compact />
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
        </SectionCard>
      )}
    </div>
  );
}
