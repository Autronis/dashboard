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
  Send,
  Clock,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  outreach_status: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  google_maps_url: string | null;
  created_at: string;
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

const FILTERS = [
  { key: "alle", label: "Alle" },
  { key: "met_email", label: "Met email" },
  { key: "zonder_email", label: "Zonder email" },
  { key: "outreach_sent", label: "Outreach verstuurd" },
];

export default function LeadsContactsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState("met_email");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/leads");
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

  const contacts = useMemo(() => {
    let result = leads;
    if (filter === "met_email") {
      result = result.filter((l) => parseEmails(l.emails).length > 0);
    } else if (filter === "zonder_email") {
      result = result.filter((l) => parseEmails(l.emails).length === 0);
    } else if (filter === "outreach_sent") {
      result = result.filter((l) => l.outreach_status === "sent");
    }
    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter((l) =>
        [l.name, l.website, l.location, ...parseEmails(l.emails)]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return result;
  }, [leads, filter, zoek]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
          <Users className="w-6 h-6 text-autronis-accent" />
          Contacten
        </h1>
        <p className="text-sm text-autronis-text-secondary mt-1">
          Volledige contactgegevens per lead met email status.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "alle"
              ? leads.length
              : f.key === "met_email"
              ? leads.filter((l) => parseEmails(l.emails).length > 0).length
              : f.key === "zonder_email"
              ? leads.filter((l) => parseEmails(l.emails).length === 0).length
              : leads.filter((l) => l.outreach_status === "sent").length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                active
                  ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
              {f.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Zoek */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
        <input
          type="text"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam, email, website, locatie..."
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

      {!loading && !error && contacts.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          Geen contacten voor dit filter
        </div>
      )}

      {!loading && !error && contacts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {contacts.slice(0, 60).map((lead) => {
            const emails = parseEmails(lead.emails);
            const isGmaps = lead.source === "google maps" || lead.source === "google_maps";
            return (
              <div
                key={lead.id}
                className="rounded-xl border border-autronis-border bg-autronis-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-autronis-text-primary truncate">
                      {lead.name || "(geen naam)"}
                    </h3>
                    {lead.folder && (
                      <p className="text-[10px] text-autronis-accent mt-0.5">{lead.folder}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0",
                      isGmaps
                        ? "bg-autronis-accent/10 text-autronis-accent"
                        : "bg-purple-500/10 text-purple-300"
                    )}
                  >
                    {isGmaps ? <MapPin className="w-2.5 h-2.5" /> : <Linkedin className="w-2.5 h-2.5" />}
                  </span>
                </div>

                {/* Contact info */}
                <div className="space-y-1 text-xs">
                  {emails.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-autronis-text-primary">
                      <Mail className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                      <a
                        href={`mailto:${emails[0]}`}
                        className="truncate hover:text-autronis-accent"
                      >
                        {emails[0]}
                        {emails.length > 1 && <span className="text-autronis-text-secondary/50 ml-1">+{emails.length - 1}</span>}
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-autronis-text-secondary/40">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span>geen email</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-1.5 text-autronis-text-primary">
                      <Phone className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                      <a href={`tel:${lead.phone}`} className="hover:text-autronis-accent">
                        {lead.phone}
                      </a>
                    </div>
                  )}
                  {lead.website && (
                    <div className="flex items-center gap-1.5 text-autronis-text-primary min-w-0">
                      <Globe className="w-3 h-3 text-autronis-accent flex-shrink-0" />
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:text-autronis-accent"
                      >
                        {lead.website}
                      </a>
                      <ExternalLink className="w-2.5 h-2.5 text-autronis-text-secondary/40 flex-shrink-0" />
                    </div>
                  )}
                </div>

                {/* Outreach status */}
                {lead.outreach_status && lead.outreach_status !== "pending" && (
                  <div className="pt-2 border-t border-autronis-border/50">
                    <OutreachBadge status={lead.outreach_status} />
                  </div>
                )}
              </div>
            );
          })}
          {contacts.length > 60 && (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-autronis-border bg-autronis-card/40 px-4 py-2 text-xs text-autronis-text-secondary text-center">
              {contacts.length} contacten totaal — eerste 60 getoond
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutreachBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { label: string; color: string; icon: typeof Send }
  > = {
    pending: { label: "Pending", color: "text-autronis-text-secondary", icon: Clock },
    sent: { label: "Verstuurd", color: "text-emerald-400", icon: Send },
    replied: { label: "Beantwoord", color: "text-autronis-accent", icon: CheckCircle },
    failed: { label: "Gefaald", color: "text-red-400", icon: XCircle },
  };
  const c = config[status] || { label: status, color: "text-autronis-text-secondary", icon: Send };
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium", c.color)}>
      <Icon className="w-2.5 h-2.5" />
      {c.label}
    </span>
  );
}
