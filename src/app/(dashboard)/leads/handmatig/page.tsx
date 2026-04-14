"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  PhoneCall,
  Search,
  MapPin,
  Loader2,
  Check,
  Plus,
  Globe,
  Trash2,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePoll } from "@/lib/use-poll";

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  emails: string | null;
  website: string | null;
  location: string | null;
  source: string | null;
  google_maps_url: string | null;
  enrichment_status: string | null;
  email_found: boolean | null;
  website_found: boolean | null;
}

// Leads waar automatische enrichment geen email vond — handmatig oppakken
// door te bellen of direct een email/website toe te voegen.
const FAILED_STATUSES = new Set(["failed", "no_email_found", "no_contact_found"]);

function hasEmailValue(l: Lead): boolean {
  const e = l.emails;
  return !!(e && e.trim() && e.trim() !== "[]");
}

export default function LeadsHandmatigPage() {
  const { addToast } = useToast();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoek, setZoek] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<"email" | "website">("email");
  const [inputValue, setInputValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/leads");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAllLeads(data.leads ?? []);
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

  // Realtime-ish: silent refetch elke 15s — geen loading flicker
  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 15000);

  // Filter: alleen leads waar enrichment faalde EN die geen email hebben
  const failedLeads = useMemo(() => {
    return allLeads.filter(
      (l) =>
        FAILED_STATUSES.has(l.enrichment_status || "") && !hasEmailValue(l)
    );
  }, [allLeads]);

  const gefilterd = useMemo(() => {
    if (!zoek.trim()) return failedLeads;
    const q = zoek.toLowerCase();
    return failedLeads.filter((l) =>
      [l.name, l.location, l.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    );
  }, [failedLeads, zoek]);

  function startEdit(lead: Lead, type: "email" | "website") {
    setEditingId(lead.id);
    setEditingType(type);
    setInputValue("");
  }

  function cancelEdit() {
    setEditingId(null);
    setInputValue("");
  }

  async function saveEdit(leadId: string) {
    if (!inputValue.trim()) {
      addToast("Voer een waarde in", "fout");
      return;
    }
    setBusyId(leadId);
    try {
      const updates: Record<string, unknown> = {
        id: leadId,
        enrichment_status: "manual",
      };
      if (editingType === "email") {
        if (!inputValue.includes("@")) {
          addToast("Ongeldig emailadres", "fout");
          setBusyId(null);
          return;
        }
        updates.emails = inputValue.trim();
        updates.email_found = true;
      } else {
        let url = inputValue.trim();
        if (!url.startsWith("http")) url = "https://" + url;
        updates.website = url;
        updates.website_found = true;
      }

      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }

      // Optimistic: remove lead from list (it's no longer "failed without email")
      setAllLeads((curr) =>
        curr.map((l) =>
          l.id === leadId
            ? {
                ...l,
                ...(editingType === "email"
                  ? { emails: inputValue.trim(), email_found: true }
                  : { website: inputValue.trim(), website_found: true }),
                enrichment_status: "manual",
              }
            : l
        )
      );

      addToast(
        editingType === "email"
          ? `Email toegevoegd: ${inputValue.trim()}`
          : `Website toegevoegd`,
        "succes"
      );
      cancelEdit();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Opslaan mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(leadId: string) {
    setBusyId(leadId);
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [leadId] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setAllLeads((curr) => curr.filter((l) => l.id !== leadId));
      addToast("Lead verwijderd", "succes");
      setDeletingId(null);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Verwijderen mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary flex items-center gap-3">
            <PhoneCall className="w-7 h-7 text-autronis-accent" />
            Handmatig Opvolgen
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1.5 max-w-2xl">
            Leads waar automatische enrichment geen email kon vinden — bel ze
            of voeg handmatig een email of website toe
          </p>
        </div>
        <span className="text-sm text-autronis-text-secondary tabular-nums">
          {gefilterd.length} leads
        </span>
      </div>

      {/* Zoek */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
        <input
          type="text"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam, locatie, telefoon..."
          className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
        />
      </div>

      {/* Body */}
      {loading && allLeads.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Leads laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon leads niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          {zoek
            ? "Geen resultaten voor deze zoekopdracht"
            : "Geen leads om handmatig op te volgen — alle enrichments hebben een email gevonden"}
        </div>
      )}

      {!loading && !error && gefilterd.length > 0 && (
        <div className="rounded-2xl border border-autronis-border bg-autronis-card overflow-hidden">
          <div className="px-6 py-4 border-b border-autronis-border flex items-center justify-between">
            <h2 className="text-base font-semibold text-autronis-text-primary">Te bellen</h2>
            <span className="text-xs text-autronis-text-secondary tabular-nums">
              {gefilterd.length} leads
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-autronis-bg/40 text-[10px] uppercase text-autronis-text-secondary/70 tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Bedrijf</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Telefoon</th>
                <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Locatie</th>
                <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autronis-border/50">
              {gefilterd.slice(0, 200).map((lead) => {
                const isEditing = editingId === lead.id;
                const isDeleting = deletingId === lead.id;
                const busy = busyId === lead.id;
                return (
                  <tr key={lead.id} className="hover:bg-autronis-accent/[0.03] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-autronis-text-primary truncate">
                          {lead.name || "(geen naam)"}
                        </span>
                        {lead.google_maps_url && (
                          <a
                            href={lead.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-autronis-text-secondary hover:text-autronis-accent flex-shrink-0"
                            title="Google Maps"
                          >
                            <MapPin className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-xs text-autronis-accent hover:underline inline-flex items-center gap-1"
                        >
                          <PhoneCall className="w-3 h-3" />
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-autronis-text-secondary/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-autronis-text-secondary hidden md:table-cell">
                      {(lead.location || "").split(",")[0] || "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
                        {lead.enrichment_status || "failed"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(lead.id);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              autoFocus
                              placeholder={editingType === "email" ? "info@bedrijf.nl" : "bedrijf.nl"}
                              className="w-48 bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                            />
                            <button
                              onClick={() => saveEdit(lead.id)}
                              disabled={busy}
                              className="p-1.5 rounded-md bg-autronis-accent/15 text-autronis-accent hover:bg-autronis-accent/25 transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-md text-autronis-text-secondary/60 hover:text-autronis-text-primary transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        ) : isDeleting ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-autronis-text-secondary">
                              Verwijderen?
                            </span>
                            <button
                              onClick={() => handleDelete(lead.id)}
                              disabled={busy}
                              className="px-2 py-1 rounded-md bg-red-500/15 text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ja"}
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="px-2 py-1 rounded-md text-[11px] font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                            >
                              Nee
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(lead, "email")}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors"
                              title="Voeg handmatig email toe"
                            >
                              <Mail className="w-3 h-3" />
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => startEdit(lead, "website")}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-border/50 transition-colors"
                              title="Voeg website toe"
                            >
                              <Globe className="w-3 h-3" />
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => setDeletingId(lead.id)}
                              className="p-1 rounded-md text-autronis-text-secondary/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Verwijder"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
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
      )}
    </div>
  );
}
