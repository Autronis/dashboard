"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Globe,
  Search,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Loader2,
  Play,
  Star,
  Check,
  Zap,
  Sparkles,
  RefreshCw,
  Filter,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBulkScan } from "../_components/use-bulk-scan";
import { WebsitePromptModal } from "./_components/WebsitePromptModal";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/leads/section-card";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";

interface WebsiteLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  category: string | null;
  google_maps_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  description: string | null;
  status: string;
  call_notes: string | null;
  call_date: string | null;
  search_query: string | null;
  created_at: string;
  has_website: boolean | null;
  website_url: string | null;
  website_confidence: "HIGH" | "MEDIUM" | "LIKELY_UNVERIFIED" | "NONE" | null;
}

type WebsiteFilter = "alle" | "verified_geen" | "heeft_website" | "niet_gecheckt";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400",
  contacted: "bg-amber-500/15 text-amber-400",
  interested: "bg-emerald-500/15 text-emerald-400",
  not_interested: "bg-red-500/10 text-red-400",
  no_answer: "bg-autronis-border text-autronis-text-secondary",
  converted: "bg-autronis-accent/15 text-autronis-accent",
};

const STATUS_OPTIONS = [
  { value: "new", label: "Nieuw" },
  { value: "contacted", label: "Gebeld" },
  { value: "interested", label: "Interesse" },
  { value: "not_interested", label: "Geen interesse" },
  { value: "no_answer", label: "Geen gehoor" },
  { value: "converted", label: "Klant" },
];

export default function LeadsWebsiteLeadsPage() {
  const { addToast } = useToast();
  const [leads, setLeads] = useState<WebsiteLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [websiteFilter, setWebsiteFilter] = useState<WebsiteFilter>("alle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [promptModalLead, setPromptModalLead] = useState<{
    id: string;
    name: string;
    website: string | null;
    email: string | null;
  } | null>(null);
  const { runScan } = useBulkScan();

  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [isSearching, setIsSearching] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads/website-leads");
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
    const counts: Record<string, number> = {};
    for (const l of leads) {
      counts[l.status] = (counts[l.status] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const websiteCounts = useMemo(() => {
    const verified = leads.filter(
      (l) => l.has_website === false && (l.website_confidence === "NONE" || !l.website_confidence)
    ).length;
    const heeftWebsite = leads.filter((l) => l.has_website === true).length;
    const nietGecheckt = leads.filter((l) => l.has_website == null).length;
    return { verified, heeftWebsite, nietGecheckt };
  }, [leads]);

  const gefilterd = useMemo(() => {
    let result = leads;
    if (statusFilter !== "alle") result = result.filter((l) => l.status === statusFilter);
    if (websiteFilter === "verified_geen") {
      result = result.filter(
        (l) =>
          l.has_website === false &&
          (l.website_confidence === "NONE" || !l.website_confidence)
      );
    } else if (websiteFilter === "heeft_website") {
      result = result.filter((l) => l.has_website === true);
    } else if (websiteFilter === "niet_gecheckt") {
      result = result.filter((l) => l.has_website == null);
    }
    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.city, l.address, l.category, l.search_query, l.website_url]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return result;
  }, [leads, statusFilter, websiteFilter, zoek]);

  const activeFilterCount =
    (statusFilter !== "alle" ? 1 : 0) +
    (websiteFilter !== "alle" ? 1 : 0) +
    (zoek.trim() ? 1 : 0);

  function clearFilters() {
    setStatusFilter("alle");
    setWebsiteFilter("alle");
    setZoek("");
  }

  async function triggerSearch() {
    if (!query.trim() || !city.trim()) {
      addToast("Zoekterm en stad zijn verplicht", "fout");
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch("/api/leads/website-leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, city, maxResults }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || `HTTP ${res.status}`);
      }
      if (data.webhookError) {
        addToast(`Search gestart, maar webhook fout: ${data.webhookError}`, "fout");
      } else {
        addToast(
          `Search "${query}" in ${city} gestart — resultaten komen binnen in 30-60s`,
          "succes"
        );
      }
      setTimeout(load, 10000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Search mislukt", "fout");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleUpdate(id: string, updates: Partial<WebsiteLead>) {
    try {
      const res = await fetch("/api/leads/website-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setLeads((curr) => curr.map((l) => (l.id === id ? { ...l, ...updates } : l)));
      addToast("Opgeslagen", "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Update mislukt", "fout");
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Website Leads"
        description="Bedrijven zonder website — potentiële klanten om te bellen."
        actions={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            Vernieuwen
          </button>
        }
      />

      <SectionCard title="Nieuwe Google Maps zoekopdracht" icon={Search}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoekterm (bv. 'kapper')"
              className="col-span-1 sm:col-span-2 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Stad"
              className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            />
            <select
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
              className="bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            >
              <option value={25}>25 leads</option>
              <option value={50}>50 leads</option>
              <option value={100}>100 leads</option>
              <option value={250}>250 leads</option>
            </select>
          </div>
          <button
            type="button"
            onClick={triggerSearch}
            disabled={isSearching || !query.trim() || !city.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Zoeken...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Start search
              </>
            )}
          </button>
        </div>
      </SectionCard>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("alle")}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
            statusFilter === "alle"
              ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
              : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
          )}
        >
          Alle
          <span className="tabular-nums font-semibold">{leads.length}</span>
        </button>
        {STATUS_OPTIONS.map((opt) => {
          const active = statusFilter === opt.value;
          const count = stats[opt.value] || 0;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                active
                  ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
              {opt.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Website check filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-autronis-text-secondary/60 font-semibold">
          Website check:
        </span>
        {(
          [
            { key: "alle" as const, label: "Alle" },
            { key: "verified_geen" as const, label: `Verified geen website (${websiteCounts.verified})` },
            { key: "heeft_website" as const, label: `Heeft website (${websiteCounts.heeftWebsite})` },
            { key: "niet_gecheckt" as const, label: `Niet gecheckt (${websiteCounts.nietGecheckt})` },
          ]
        ).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setWebsiteFilter(f.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
              websiteFilter === f.key
                ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
            )}
          >
            {f.key === "verified_geen" && <Filter className="w-3 h-3" />}
            {f.label}
          </button>
        ))}
      </div>

      <FilterBar
        search={{
          value: zoek,
          onChange: setZoek,
          placeholder: "Zoek op naam, stad, categorie...",
        }}
        activeCount={activeFilterCount}
        onClear={clearFilters}
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

      {!loading && !error && gefilterd.length === 0 && (
        <SectionCard padding="none">
          <EmptyState
            titel={
              leads.length === 0
                ? "Nog geen website leads"
                : "Geen resultaten voor dit filter"
            }
            beschrijving={
              leads.length === 0
                ? "Start een Google Maps zoekopdracht hierboven om leads binnen te halen."
                : "Pas het status- of website-filter aan, of wis de zoekterm."
            }
            icoon={<Globe className="h-7 w-7 text-autronis-accent" />}
          />
        </SectionCard>
      )}

      {gefilterd.length > 0 && (
        <div className="space-y-2">
          {gefilterd.slice(0, 100).map((lead, idx) => {
            const expanded = expandedId === lead.id;
            return (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx, 15) * 0.02, duration: 0.2 }}
                className={cn(
                  "rounded-2xl border bg-autronis-card overflow-hidden transition-colors",
                  expanded ? "border-autronis-accent/40" : "border-autronis-border"
                )}
              >
                <div className="flex items-stretch gap-2 p-3 hover:bg-autronis-accent/[0.03] transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : lead.id)}
                    className="flex-1 flex items-start gap-3 text-left min-w-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-autronis-text-primary truncate">
                          {lead.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold",
                            STATUS_COLORS[lead.status] ||
                              "bg-autronis-border text-autronis-text-secondary"
                          )}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === lead.status)?.label ||
                            lead.status}
                        </span>
                        {lead.website_confidence && (
                          <LeadStatusBadge status={lead.website_confidence} compact />
                        )}
                        {lead.rating != null && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {lead.rating} ({lead.reviews_count})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-autronis-text-secondary mt-1">
                        {lead.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" />
                            {lead.city}
                          </span>
                        )}
                        {lead.category && <span>{lead.category}</span>}
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5" />
                            {lead.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPromptModalLead({
                        id: lead.id,
                        name: lead.name,
                        website: lead.website_url,
                        email: lead.email,
                      })
                    }
                    title="AI genereert een website-prompt voor Lovable/v0 op basis van deze lead"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-semibold hover:bg-purple-500/20 transition-colors self-center flex-shrink-0"
                  >
                    <Sparkles className="w-3 h-3" />
                    Website-prompt
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      key="expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-autronis-border bg-autronis-bg/40 p-4 space-y-3">
                        {lead.website_url && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-[10px] uppercase tracking-wide text-emerald-400/70 font-medium">
                                Gevonden website
                              </span>
                              <a
                                href={
                                  lead.website_url.startsWith("http")
                                    ? lead.website_url
                                    : `https://${lead.website_url}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-sm text-emerald-300 hover:text-emerald-200 truncate"
                              >
                                {lead.website_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                                <ExternalLink className="w-3 h-3 inline ml-1" />
                              </a>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {lead.phone && (
                            <div>
                              <span className="text-autronis-text-secondary/70 uppercase tracking-wide text-[9px]">
                                Telefoon
                              </span>
                              <p className="text-autronis-text-primary flex items-center gap-1.5 mt-0.5">
                                <Phone className="w-3 h-3 text-autronis-accent" />
                                <a href={`tel:${lead.phone}`} className="hover:text-autronis-accent">
                                  {lead.phone}
                                </a>
                              </p>
                            </div>
                          )}
                          {lead.email && (
                            <div>
                              <span className="text-autronis-text-secondary/70 uppercase tracking-wide text-[9px]">
                                Email
                              </span>
                              <p className="text-autronis-text-primary flex items-center gap-1.5 mt-0.5">
                                <Mail className="w-3 h-3 text-autronis-accent" />
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="hover:text-autronis-accent"
                                >
                                  {lead.email}
                                </a>
                              </p>
                            </div>
                          )}
                          {lead.address && (
                            <div className="sm:col-span-2">
                              <span className="text-autronis-text-secondary/70 uppercase tracking-wide text-[9px]">
                                Adres
                              </span>
                              <p className="text-autronis-text-primary mt-0.5">{lead.address}</p>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[9px] uppercase tracking-wide text-autronis-text-secondary/70">
                            Bel notities
                          </label>
                          <textarea
                            defaultValue={lead.call_notes || ""}
                            onBlur={(e) => {
                              if (e.target.value !== (lead.call_notes || "")) {
                                handleUpdate(lead.id, { call_notes: e.target.value });
                              }
                            }}
                            placeholder="Wat is er besproken tijdens het gesprek..."
                            rows={3}
                            className="w-full mt-1 bg-autronis-card border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 resize-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {STATUS_OPTIONS.map((opt) => {
                            const active = lead.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleUpdate(lead.id, { status: opt.value })}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                                  active
                                    ? STATUS_COLORS[opt.value]
                                    : "bg-autronis-card border border-autronis-border text-autronis-text-secondary/70 hover:text-autronis-text-primary"
                                )}
                              >
                                {active && <Check className="w-2.5 h-2.5" />}
                                {opt.label}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() =>
                              setPromptModalLead({
                                id: lead.id,
                                name: lead.name,
                                website: lead.website_url,
                                email: lead.email,
                              })
                            }
                            title="AI genereert een website-prompt voor Lovable/v0 op basis van deze lead"
                            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-colors"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            Website-prompt
                          </button>
                          {lead.website_url && (
                            <button
                              type="button"
                              onClick={() =>
                                runScan([
                                  {
                                    id: lead.id,
                                    name: lead.name,
                                    website: lead.website_url,
                                    email: lead.email,
                                    supabaseLeadId: lead.id,
                                  },
                                ])
                              }
                              title="Open de Sales Engine scan-flow met deze lead voorgeladen"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-autronis-accent/10 border border-autronis-accent/30 text-autronis-accent hover:bg-autronis-accent/20 transition-colors"
                            >
                              <Zap className="w-2.5 h-2.5" />
                              Scan
                            </button>
                          )}
                          {lead.google_maps_url && (
                            <a
                              href={lead.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-autronis-accent hover:bg-autronis-accent/10 transition-colors",
                                !lead.website_url && "ml-auto"
                              )}
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Google Maps
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {gefilterd.length > 100 && (
            <div className="rounded-2xl border border-autronis-border bg-autronis-card/40 px-4 py-2 text-xs text-autronis-text-secondary text-center">
              {gefilterd.length} leads totaal — eerste 100 getoond. Filter om scope te verkleinen.
            </div>
          )}
        </div>
      )}

      {promptModalLead && (
        <WebsitePromptModal
          leadId={promptModalLead.id}
          bedrijfsnaam={promptModalLead.name}
          website={promptModalLead.website}
          leadEmail={promptModalLead.email}
          onClose={() => setPromptModalLead(null)}
        />
      )}
    </div>
  );
}
