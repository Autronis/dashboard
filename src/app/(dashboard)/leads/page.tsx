"use client";

import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

// Minimale lead type — matcht wat /api/leads GET teruggeeft.
// Volledige typing komt later via @/types/supabase-leads.
interface Lead {
  id: string;
  name: string | null;
  website: string | null;
  phone: string | null;
  emails: string | null; // JSON string of comma-separated
  location: string | null;
  folder: string | null;
  linkedin_url: string | null;
  employee_count: string | null;
  search_term: string | null;
  outreach_status: string | null;
  created_at: string;
}

function parseEmails(raw: string | null | undefined): string[] {
  if (!raw?.trim() || raw.trim() === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((e: string) => e?.trim());
  } catch {
    // niet JSON
  }
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

export default function LeadsOverzichtPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/leads");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.fout || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setLeads(data.leads ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Onbekende fout");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const gefilterd = useMemo(() => {
    if (!zoek.trim()) return leads;
    const q = zoek.toLowerCase();
    return leads.filter((l) =>
      [l.name, l.website, l.location, l.search_term]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [leads, zoek]);

  const stats = useMemo(() => {
    const total = leads.length;
    const metEmail = leads.filter((l) => parseEmails(l.emails).length > 0).length;
    const metTel = leads.filter((l) => !!l.phone?.trim()).length;
    const metWebsite = leads.filter((l) => !!l.website?.trim()).length;
    return { total, metEmail, metTel, metWebsite };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
            <Target className="w-6 h-6 text-autronis-accent" />
            Leads
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            Alle outreach leads uit de Autronis lead-generation pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leads/enrichment"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <Zap className="w-3.5 h-3.5" /> Enrichment
          </Link>
          <Link
            href="/leads/emails"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Emails
          </Link>
        </div>
      </div>

      {/* Stats kaarten */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Totaal leads" waarde={stats.total} icon={Users} />
        <StatCard label="Met email" waarde={stats.metEmail} icon={Mail} />
        <StatCard label="Met telefoon" waarde={stats.metTel} icon={Phone} />
        <StatCard label="Met website" waarde={stats.metWebsite} icon={Globe} />
      </div>

      {/* Zoekbar */}
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
      {loading && (
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
          {leads.length === 0 ? "Nog geen leads" : "Geen resultaten voor deze zoekopdracht"}
        </div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-autronis-bg/40 text-xs uppercase text-autronis-text-secondary/70 tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Bedrijf</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Locatie</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Folder</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border/50">
              {gefilterd.slice(0, 200).map((lead) => {
                const emails = parseEmails(lead.emails);
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-autronis-accent/[0.03] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-autronis-text-primary truncate">
                          {lead.name || "(geen naam)"}
                        </span>
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-autronis-text-secondary hover:text-autronis-accent flex-shrink-0"
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
                    <td className="px-4 py-3 text-autronis-text-secondary hidden md:table-cell">
                      {lead.location && (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <MapPin className="w-3 h-3" />
                          {lead.location}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {lead.folder && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-autronis-accent/10 text-autronis-accent">
                          {lead.folder}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-autronis-text-secondary">
                        {emails.length > 0 && (
                          <span className="inline-flex items-center gap-1" title={emails.join(", ")}>
                            <Mail className="w-3 h-3" /> {emails.length}
                          </span>
                        )}
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {lead.outreach_status && (
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            lead.outreach_status === "pending" &&
                              "bg-gray-500/10 text-gray-400",
                            lead.outreach_status === "sent" &&
                              "bg-emerald-500/10 text-emerald-400",
                            lead.outreach_status === "failed" &&
                              "bg-red-500/10 text-red-400"
                          )}
                        >
                          {lead.outreach_status}
                        </span>
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

function StatCard({
  label,
  waarde,
  icon: Icon,
}: {
  label: string;
  waarde: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-autronis-border bg-autronis-card p-4">
      <div className="flex items-center gap-2 text-autronis-text-secondary text-xs mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="text-2xl font-bold text-autronis-text-primary tabular-nums">
        {waarde.toLocaleString("nl-NL")}
      </div>
    </div>
  );
}
