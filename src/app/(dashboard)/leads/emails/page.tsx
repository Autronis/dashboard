"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  Loader2,
  Search,
  Eye,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  RotateCcw,
  ArrowDownAZ,
  ArrowUpAZ,
  Sparkles,
  CheckSquare,
  Rocket,
  X,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import OutreachSection from "@/components/leads/outreach-section";
import { usePoll } from "@/lib/use-poll";
import { PageHeader } from "@/components/ui/page-header";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { SourceBadge as SharedSourceBadge } from "@/components/leads/source-badge";

interface EmailRecord {
  id: string;
  user_id: string;
  lead_id: string | null;
  google_maps_lead_id: string | null;
  source: string | null;
  recipient_email: string | null;
  generated_subject: string | null;
  generated_email: string | null;
  email_status: string | null;
  painpoint_used: string | null;
  company_summary: string | null;
  reply_subject: string | null;
  reply_body: string | null;
  reply_received_at: string | null;
  created_at: string;
  updated_at: string;
  missing_info: string[] | null;
  lead_name: string | null;
  emailed_at: string | null;
}

// Lokale badges zijn vervangen door shared <LeadStatusBadge> en <SharedSourceBadge>
// uit src/components/leads/. Alle statussen die deze pagina gebruikt zijn gedekt
// in de shared variant; spin-animatie voor generating/sending/verification_pending
// gebeurt daar automatisch.
const StatusBadge = ({ status }: { status: string | null }) => (
  <LeadStatusBadge status={status} compact />
);

const SourceBadge = ({ source }: { source: string | null }) =>
  source ? <SharedSourceBadge source={source} compact /> : null;

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "alle", label: "Alle" },
  { key: "generated", label: "Te reviewen" },
  { key: "approved", label: "Goedgekeurd" },
  { key: "sent", label: "Verstuurd" },
  { key: "replied", label: "Beantwoord" },
  { key: "verification_risky", label: "Risky" },
  { key: "verification_failed", label: "Verificatie mislukt" },
  { key: "verification_pending", label: "Verificatie pending" },
  { key: "failed", label: "Gefaald" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

interface ScanContext {
  scanId: number;
  bedrijfsnaam: string | null;
  supabaseLeadId: string | null;
}

export default function LeadsEmailsPage() {
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanIdParam = searchParams.get("scanId");
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoek, setZoek] = useState("");
  const [scanContext, setScanContext] = useState<ScanContext | null>(null);
  const [scanContextError, setScanContextError] = useState<string | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(true); // true = newest first
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);

  // Paginering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  // Inline edit recipient_email
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [editRecipient, setEditRecipient] = useState("");

  // Bedrijfsanalyse collapsible (per email id)
  const [showSummaryIds, setShowSummaryIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/leads/emails");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const fetched = (data.emails ?? []) as EmailRecord[];
      setEmails(fetched);
      // Standaard alle emails uitgeklapt — gebruiker ziet meteen de content.
      // Klik op header sluit weer. Bij silent refetch nieuwe ids toevoegen,
      // bestaande expand-state behouden.
      setExpandedIds((curr) => {
        if (curr.size === 0) return new Set(fetched.map((e) => e.id));
        const next = new Set(curr);
        for (const e of fetched) next.add(e.id);
        return next;
      });
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

  // Realtime-ish: silent refetch elke 10s — emails veranderen vaak
  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 10000);

  // Wanneer ?scanId aanwezig is: haal scan-details op (bedrijfsnaam + supabaseLeadId)
  // zodat we de email-lijst kunnen filteren op de bij deze scan horende lead.
  useEffect(() => {
    if (!scanIdParam) {
      setScanContext(null);
      setScanContextError(null);
      return;
    }
    const scanId = Number(scanIdParam);
    if (!Number.isFinite(scanId)) {
      setScanContextError("Ongeldig scanId");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sales-engine/${scanId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.fout || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setScanContext({
          scanId,
          bedrijfsnaam: data.scan?.bedrijfsnaam ?? null,
          supabaseLeadId: data.scan?.supabaseLeadId ?? null,
        });
        setScanContextError(null);
      } catch (e) {
        if (cancelled) return;
        setScanContextError(e instanceof Error ? e.message : "Kon scan niet laden");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanIdParam]);

  function clearScanFilter() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("scanId");
    const qs = sp.toString();
    router.replace(qs ? `/leads/emails?${qs}` : "/leads/emails");
  }

  async function generateCustomMailForScan() {
    if (!scanContext?.supabaseLeadId) return;
    setGeneratingEmail(true);
    try {
      const res = await fetch("/api/leads/edge-function/trigger-email-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds: [scanContext.supabaseLeadId] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || body.error || `HTTP ${res.status}`);
      }
      addToast("Email generatie gestart — refresh over een minuut", "succes");
      // Geef de edge function even tijd en haal dan opnieuw op
      setTimeout(() => void load(true), 4000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Generatie mislukt", "fout");
    } finally {
      setGeneratingEmail(false);
    }
  }

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of emails) {
      const s = e.email_status || "unknown";
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [emails]);

  const sorted = useMemo(() => {
    return [...emails].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortDesc ? tb - ta : ta - tb;
    });
  }, [emails, sortDesc]);

  const gefilterd = useMemo(() => {
    let result = sorted;
    if (scanContext?.supabaseLeadId) {
      const lid = scanContext.supabaseLeadId;
      result = result.filter((e) => e.lead_id === lid || e.google_maps_lead_id === lid);
    }
    if (statusFilter !== "alle") {
      result = result.filter((e) => e.email_status === statusFilter);
    }
    if (zoek.trim()) {
      const q = zoek.toLowerCase();
      result = result.filter((e) =>
        [e.lead_name, e.recipient_email, e.generated_subject, e.generated_email]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return result;
  }, [sorted, statusFilter, zoek, scanContext]);

  // Reset naar pagina 1 wanneer filter/zoek/sort verandert
  useEffect(() => {
    setPage(1);
  }, [statusFilter, zoek, sortDesc, pageSize]);

  const totalPages = Math.max(1, Math.ceil(gefilterd.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => gefilterd.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [gefilterd, currentPage, pageSize]
  );

  async function handleStatusChange(id: string, newStatus: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email_status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      // Optimistic update
      setEmails((curr) =>
        curr.map((e) => (e.id === id ? { ...e, email_status: newStatus } : e))
      );
      addToast(`Status → ${newStatus}`, "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Update mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Email definitief verwijderen?")) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setEmails((curr) => curr.filter((e) => e.id !== id));
      addToast("Email verwijderd", "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Verwijderen mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    addToast("Email gekopieerd", "succes");
    setTimeout(() => setCopiedId(null), 1500);
  }

  function toggleSelect(id: string) {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(email: EmailRecord) {
    setEditingId(email.id);
    setEditSubject(email.generated_subject || "");
    setEditBody(email.generated_email || "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditSubject("");
    setEditBody("");
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          generated_subject: editSubject,
          generated_email: editBody,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setEmails((curr) =>
        curr.map((e) =>
          e.id === id
            ? { ...e, generated_subject: editSubject, generated_email: editBody }
            : e
        )
      );
      addToast("Email opgeslagen", "succes");
      cancelEdit();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Opslaan mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  function startEditRecipient(email: EmailRecord) {
    setEditingRecipientId(email.id);
    setEditRecipient(email.recipient_email || "");
  }

  function cancelEditRecipient() {
    setEditingRecipientId(null);
    setEditRecipient("");
  }

  async function saveRecipient(id: string) {
    const trimmed = editRecipient.trim();
    if (!trimmed) {
      addToast("Email mag niet leeg zijn", "fout");
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch("/api/leads/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, recipient_email: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setEmails((curr) =>
        curr.map((e) => (e.id === id ? { ...e, recipient_email: trimmed } : e))
      );
      addToast("Email adres bijgewerkt", "succes");
      cancelEditRecipient();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Opslaan mislukt", "fout");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSummary(id: string) {
    setShowSummaryIds((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkStatus(ids: string[], newStatus: string, label: string) {
    if (ids.length === 0) {
      addToast("Geen emails geselecteerd", "fout");
      return;
    }
    setBulkBusy(label);
    try {
      const res = await fetch("/api/leads/emails", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, email_status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      setEmails((curr) =>
        curr.map((e) => (ids.includes(e.id) ? { ...e, email_status: newStatus } : e))
      );
      addToast(`${ids.length} emails → ${label}`, "succes");
      setSelectedIds(new Set());
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Bulk update mislukt", "fout");
    } finally {
      setBulkBusy(null);
    }
  }

  async function bulkSend(ids: string[]) {
    if (ids.length === 0) {
      addToast("Geen emails geselecteerd", "fout");
      return;
    }
    setBulkBusy("send");
    try {
      const res = await fetch("/api/leads/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.fout || `HTTP ${res.status}`);
      }
      addToast(`${data.verstuurd} emails verstuurd via n8n`, "succes");
      setEmails((curr) =>
        curr.map((e) => (ids.includes(e.id) ? { ...e, email_status: "sending" } : e))
      );
      setSelectedIds(new Set());
      setTimeout(load, 5000);

      // Stuck email recovery: na 10s checken of er nog steeds emails in 'sending'
      // staan voor deze ids. Als ja, terugzetten naar 'approved' (n8n hook is
      // vermoedelijk niet gevuurd of de webhook is stuk).
      setTimeout(async () => {
        try {
          const refresh = await fetch("/api/leads/emails");
          if (!refresh.ok) return;
          const refreshed = await refresh.json();
          const refreshedEmails = (refreshed.emails ?? []) as EmailRecord[];
          const stuckIds = ids.filter((id) => {
            const found = refreshedEmails.find((e) => e.id === id);
            return found?.email_status === "sending";
          });
          if (stuckIds.length === 0) return;

          // Reset stuck emails terug naar approved
          await fetch("/api/leads/emails", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: stuckIds, email_status: "approved" }),
          });
          setEmails((curr) =>
            curr.map((e) =>
              stuckIds.includes(e.id) ? { ...e, email_status: "approved" } : e
            )
          );
          addToast(
            `${stuckIds.length} email(s) bleven hangen op 'sending' — teruggezet naar approved`,
            "fout"
          );
        } catch {
          // niet kritisch — gebruiker kan zelf reload doen
        }
      }, 10000);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Verzenden mislukt", "fout");
    } finally {
      setBulkBusy(null);
    }
  }

  // Helpers voor "approve all generated" / "reject all generated"
  const allGeneratedIds = useMemo(
    () => gefilterd.filter((e) => e.email_status === "generated").map((e) => e.id),
    [gefilterd]
  );
  const allApprovedIds = useMemo(
    () => gefilterd.filter((e) => e.email_status === "approved").map((e) => e.id),
    [gefilterd]
  );

  const scanHasEmails = scanContext ? gefilterd.length > 0 : false;
  const canGenerateForScan = !!scanContext?.supabaseLeadId && !scanHasEmails;

  return (
    <div className="space-y-6">
      {/* Scan-context banner (wanneer we vanuit /sales-engine komen met ?scanId=X) */}
      {scanIdParam && (
        <div className="rounded-2xl border border-autronis-accent/30 bg-autronis-accent/[0.06] p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Rocket className="w-4 h-4 text-autronis-accent flex-shrink-0" />
            <span className="text-sm text-autronis-text-primary">
              Outreach voor{" "}
              <span className="font-semibold text-autronis-accent">
                {scanContext?.bedrijfsnaam || "scan"}
              </span>
              <span className="text-autronis-text-secondary"> — scan #{scanIdParam}</span>
            </span>
            {scanContextError && (
              <span className="text-xs text-red-400 ml-2">({scanContextError})</span>
            )}
            {!scanContext && !scanContextError && (
              <Loader2 className="w-3 h-3 animate-spin text-autronis-text-secondary" />
            )}
          </div>
          <Link
            href={`/sales-engine/${scanIdParam}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
            Naar scan
          </Link>
          {canGenerateForScan && (
            <button
              onClick={generateCustomMailForScan}
              disabled={generatingEmail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
            >
              {generatingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              Genereer cold mail
            </button>
          )}
          <button
            onClick={clearScanFilter}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-autronis-text-secondary/80 hover:text-autronis-text-primary hover:bg-autronis-card transition-colors"
            title="Toon alle emails"
          >
            <X className="w-3 h-3" />
            Wis filter
          </button>
        </div>
      )}

      <PageHeader
        title="Lead Emails"
        description="Cold emails review, goedkeuren en versturen."
        actions={
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          >
            <Loader2 className={cn("w-3.5 h-3.5", loading && emails.length === 0 && "animate-spin")} />
            Vernieuwen
          </button>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "alle" ? emails.length : stats[tab.key] || 0;
          const active = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                active
                  ? "bg-autronis-accent/15 text-autronis-accent border border-autronis-accent/40"
                  : "bg-autronis-card border border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/30"
              )}
            >
              {tab.label}
              <span className="tabular-nums font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + sort + bulk acties */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-autronis-text-secondary/50" />
          <input
            type="text"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, email, onderwerp..."
            className="w-full bg-autronis-card border border-autronis-border rounded-xl pl-10 pr-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
          />
        </div>
        <button
          onClick={() => setSortDesc((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
          title={sortDesc ? "Nieuwste eerst" : "Oudste eerst"}
        >
          {sortDesc ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpAZ className="w-3.5 h-3.5" />}
          {sortDesc ? "Nieuwste" : "Oudste"}
        </button>
      </div>

      {/* Bulk action bar — toon altijd, knoppen disabled als selectie leeg */}
      <div className="rounded-xl border border-autronis-border bg-autronis-card p-3 flex flex-wrap items-center gap-2">
        {/* Select pagina / alle — altijd zichtbaar */}
        <button
          onClick={() => {
            const allSelected = paged.length > 0 && paged.every((e) => selectedIds.has(e.id));
            setSelectedIds((curr) => {
              const next = new Set(curr);
              if (allSelected) {
                for (const e of paged) next.delete(e.id);
              } else {
                for (const e of paged) next.add(e.id);
              }
              return next;
            });
          }}
          disabled={paged.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-bg border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors disabled:opacity-40"
        >
          <CheckSquare className="w-3 h-3" />
          {paged.length > 0 && paged.every((e) => selectedIds.has(e.id))
            ? `Deselecteer pagina (${paged.length})`
            : `Selecteer pagina (${paged.length})`}
        </button>
        <button
          onClick={() => {
            const allSelected = gefilterd.length > 0 && gefilterd.every((e) => selectedIds.has(e.id));
            if (allSelected) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(gefilterd.map((e) => e.id)));
            }
          }}
          disabled={gefilterd.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent/10 border border-autronis-accent/40 text-autronis-accent text-xs font-semibold hover:bg-autronis-accent/20 transition-colors disabled:opacity-40"
        >
          <CheckSquare className="w-3 h-3" />
          {gefilterd.length > 0 && gefilterd.every((e) => selectedIds.has(e.id))
            ? `Deselecteer alles (${gefilterd.length})`
            : `Selecteer alles (${gefilterd.length})`}
        </button>
        <span className="text-xs text-autronis-text-secondary mr-2 ml-1">
          {selectedIds.size > 0 ? `· ${selectedIds.size} geselecteerd` : ""}
        </span>
        {selectedIds.size > 0 ? (
          <>
            <button
              onClick={() => bulkStatus(Array.from(selectedIds), "approved", "approve-sel")}
              disabled={!!bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
            >
              {bulkBusy === "approve-sel" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Goedkeuren
            </button>
            <button
              onClick={() => bulkStatus(Array.from(selectedIds), "generated", "reset-sel")}
              disabled={!!bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 text-xs font-semibold hover:bg-yellow-500/25 transition-colors disabled:opacity-40"
              title="Reset geselecteerde emails naar 'Te reviewen'"
            >
              {bulkBusy === "reset-sel" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Reset naar review
            </button>
            <button
              onClick={() => bulkStatus(Array.from(selectedIds), "failed", "reject-sel")}
              disabled={!!bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors disabled:opacity-40"
            >
              {bulkBusy === "reject-sel" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Afwijzen
            </button>
            <button
              onClick={() => bulkSend(Array.from(selectedIds))}
              disabled={!!bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-40"
            >
              {bulkBusy === "send" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Verzend ({selectedIds.size})
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-autronis-text-secondary/60 hover:text-autronis-text-primary px-2"
            >
              Wis selectie
            </button>
          </>
        ) : (
          <>
            {allGeneratedIds.length > 0 && (
              <>
                <button
                  onClick={() => bulkStatus(allGeneratedIds, "approved", "approve-all-gen")}
                  disabled={!!bulkBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                >
                  {bulkBusy === "approve-all-gen" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Goedkeur alle te-reviewen ({allGeneratedIds.length})
                </button>
                <button
                  onClick={() => bulkStatus(allGeneratedIds, "failed", "reject-all-gen")}
                  disabled={!!bulkBusy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40"
                >
                  {bulkBusy === "reject-all-gen" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                  Wijs alle af ({allGeneratedIds.length})
                </button>
              </>
            )}
            {allApprovedIds.length > 0 && (
              <button
                onClick={() => bulkSend(allApprovedIds)}
                disabled={!!bulkBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent/10 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/20 transition-colors disabled:opacity-40"
              >
                {bulkBusy === "send" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Verzend alle goedgekeurde ({allApprovedIds.length})
              </button>
            )}
            {allGeneratedIds.length === 0 && allApprovedIds.length === 0 && (
              <span className="text-xs text-autronis-text-secondary/60">
                Selecteer emails of filter op een status om bulk acties te tonen
              </span>
            )}
          </>
        )}
      </div>

      {/* Body */}
      {loading && emails.length === 0 && (
        <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Emails laden...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          <p className="font-medium">Kon emails niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      )}

      {!loading && !error && gefilterd.length === 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card/50 p-8 text-center text-autronis-text-secondary text-sm">
          {emails.length === 0 ? "Nog geen emails" : "Geen resultaten voor dit filter"}
        </div>
      )}

      {/* Email lijst */}
      {!loading && !error && gefilterd.length > 0 && (
        <div className="space-y-2">
          {paged.map((email) => {
            const expanded = expandedIds.has(email.id);
            const busy = busyId === email.id;
            return (
              <div
                key={email.id}
                className={cn(
                  "rounded-xl border border-autronis-border bg-autronis-card overflow-hidden transition-colors",
                  expanded && "border-autronis-accent/40"
                )}
              >
                {/* Header rij — checkbox + clickable area */}
                <div className="w-full flex items-start gap-3 p-3 hover:bg-autronis-accent/[0.03] transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(email.id)}
                    onChange={() => toggleSelect(email.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 rounded border-autronis-border accent-autronis-accent cursor-pointer"
                  />
                  <button
                    onClick={() =>
                      setExpandedIds((curr) => {
                        const next = new Set(curr);
                        if (next.has(email.id)) next.delete(email.id);
                        else next.add(email.id);
                        return next;
                      })
                    }
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                  <div className="mt-0.5 text-autronis-text-secondary">
                    {expanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-autronis-text-primary truncate">
                        {email.lead_name || "(geen naam)"}
                      </span>
                      <SourceBadge source={email.source} />
                      <StatusBadge status={email.email_status} />
                      {email.painpoint_used && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300"
                          title={`Painpoint: ${email.painpoint_used}`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {email.painpoint_used}
                        </span>
                      )}
                      {Array.isArray(email.missing_info) && email.missing_info.length > 0 && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400"
                          title={email.missing_info.join(", ")}
                        >
                          <AlertTriangle className="w-2.5 h-2.5" />
                          missing info
                        </span>
                      )}
                    </div>
                    {email.generated_subject && (
                      <p className="text-xs text-autronis-text-secondary mt-1 truncate">
                        {email.generated_subject}
                      </p>
                    )}
                  </div>
                  </button>
                </div>

                {/* Recipient email row — clickable inline edit, ALTIJD zichtbaar (ook ingeklapt) */}
                <div className="px-3 pb-2 pl-10 -mt-1">
                  {editingRecipientId === email.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-autronis-text-secondary/60">→</span>
                      <input
                        type="email"
                        value={editRecipient}
                        onChange={(e) => setEditRecipient(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRecipient(email.id);
                          if (e.key === "Escape") cancelEditRecipient();
                        }}
                        autoFocus
                        placeholder="email@bedrijf.nl"
                        className="flex-1 max-w-xs bg-autronis-bg border border-autronis-accent/40 rounded px-2 py-0.5 text-[10px] text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50"
                      />
                      <button
                        onClick={() => saveRecipient(email.id)}
                        disabled={busyId === email.id}
                        className="p-0.5 text-autronis-accent hover:bg-autronis-accent/10 rounded disabled:opacity-50"
                        title="Opslaan (Enter)"
                      >
                        {busyId === email.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={cancelEditRecipient}
                        className="p-0.5 text-autronis-text-secondary hover:bg-autronis-card rounded"
                        title="Annuleer (Esc)"
                      >
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditRecipient(email);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] text-autronis-text-secondary/60 hover:text-autronis-accent transition-colors group/recipient"
                      title="Klik om te wijzigen"
                    >
                      <span>→ {email.recipient_email || <em className="text-amber-400">geen email</em>}</span>
                      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/recipient:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                {/* Expanded content */}
                {expanded && (
                  <div className="border-t border-autronis-border bg-autronis-bg/40 p-4 space-y-3">
                    {/* Bedrijfsanalyse collapsible */}
                    {email.company_summary && (
                      <div className="rounded-lg border border-autronis-border bg-autronis-card overflow-hidden">
                        <button
                          onClick={() => toggleSummary(email.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-autronis-accent/[0.04] transition-colors"
                        >
                          {showSummaryIds.has(email.id) ? (
                            <ChevronDown className="w-3 h-3 text-autronis-text-secondary" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-autronis-text-secondary" />
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-autronis-text-secondary">
                            Bedrijfsanalyse
                          </span>
                          <span className="text-[10px] text-autronis-text-secondary/50 ml-auto">
                            {showSummaryIds.has(email.id) ? "verbergen" : "tonen"}
                          </span>
                        </button>
                        {showSummaryIds.has(email.id) && (
                          <div className="px-3 pb-3 pt-1 border-t border-autronis-border/50">
                            <p className="text-xs text-autronis-text-secondary leading-relaxed whitespace-pre-wrap">
                              {email.company_summary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {editingId === email.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          placeholder="Onderwerp"
                          className="w-full bg-autronis-card border border-autronis-accent/40 rounded-lg px-3 py-2 text-xs font-medium text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                        />
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={12}
                          placeholder="Email tekst"
                          className="w-full bg-autronis-card border border-autronis-accent/40 rounded-lg px-3 py-2 text-xs text-autronis-text-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 font-mono resize-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveEdit(email.id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Opslaan
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 rounded-lg text-xs text-autronis-text-secondary hover:text-autronis-text-primary"
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    ) : email.generated_email ? (
                      <pre className="whitespace-pre-wrap text-xs text-autronis-text-primary font-sans leading-relaxed bg-autronis-card border border-autronis-border rounded-lg p-3 max-h-96 overflow-y-auto">
                        {email.generated_email}
                      </pre>
                    ) : (
                      <p className="text-xs text-autronis-text-secondary italic">
                        Geen email content
                      </p>
                    )}

                    {/* Reply (als beantwoord) */}
                    {email.reply_body && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400 mb-1.5">
                          Reply ontvangen{email.reply_received_at && ` · ${new Date(email.reply_received_at).toLocaleDateString("nl-NL")}`}
                        </p>
                        {email.reply_subject && (
                          <p className="text-xs font-medium text-autronis-text-primary mb-1">
                            {email.reply_subject}
                          </p>
                        )}
                        <pre className="whitespace-pre-wrap text-xs text-autronis-text-secondary font-sans leading-relaxed">
                          {email.reply_body}
                        </pre>
                      </div>
                    )}

                    {/* Acties */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {email.generated_email && editingId !== email.id && (
                        <>
                          <button
                            onClick={() => handleCopy(email.id, email.generated_email!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
                          >
                            {copiedId === email.id ? (
                              <Check className="w-3 h-3 text-autronis-accent" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            Kopieer
                          </button>
                          <button
                            onClick={() => startEdit(email)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Bewerken
                          </button>
                        </>
                      )}

                      {email.email_status === "generated" && editingId !== email.id && (
                        <>
                          <button
                            onClick={() => handleStatusChange(email.id, "approved")}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Goedkeuren
                          </button>
                          <button
                            onClick={() => handleStatusChange(email.id, "failed")}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Afwijzen
                          </button>
                        </>
                      )}

                      {email.email_status === "approved" && editingId !== email.id && (
                        <button
                          onClick={() => bulkSend([email.id])}
                          disabled={!!bulkBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent text-autronis-bg text-xs font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
                        >
                          {bulkBusy === "send" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Verzend nu
                        </button>
                      )}

                      {email.email_status === "verification_risky" && editingId !== email.id && (
                        <button
                          onClick={() => handleStatusChange(email.id, "approved")}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-semibold hover:bg-orange-500/25 transition-colors disabled:opacity-50"
                          title="Reacher vond dit adres risky — override en versturen"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                          Toch versturen
                        </button>
                      )}

                      {(email.email_status === "failed" || email.email_status === "error") && editingId !== email.id && (
                        <button
                          onClick={() => handleStatusChange(email.id, "generating")}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Opnieuw genereren
                        </button>
                      )}

                      {editingId !== email.id && (
                        <button
                          onClick={() => handleDelete(email.id)}
                          disabled={busy}
                          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          Verwijder
                        </button>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-autronis-text-secondary/50 pt-1">
                      <span>Aangemaakt: {new Date(email.created_at).toLocaleString("nl-NL")}</span>
                      {email.emailed_at && (
                        <span className="text-emerald-400/70">
                          Verstuurd: {new Date(email.emailed_at).toLocaleString("nl-NL")}
                        </span>
                      )}
                      {!email.emailed_at &&
                        (email.email_status === "sent" || email.email_status === "replied") && (
                          <span className="text-amber-400/70">
                            Verstuurd (geen timestamp)
                          </span>
                        )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-autronis-border bg-autronis-card/40 px-4 py-2 text-xs text-autronis-text-secondary">
            <div className="flex items-center gap-2">
              <span>Per pagina:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="bg-autronis-card border border-autronis-border rounded-md px-2 py-1 text-xs text-autronis-text-primary focus:outline-none focus:ring-1 focus:ring-autronis-accent/50"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-autronis-text-secondary/60">
                · {gefilterd.length} emails totaal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2 py-1 rounded-md bg-autronis-card border border-autronis-border text-xs hover:border-autronis-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Vorige
              </button>
              <span className="tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 rounded-md bg-autronis-card border border-autronis-border text-xs hover:border-autronis-accent/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Volgende
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outreach pipeline status onderaan */}
      <OutreachSection />
    </div>
  );
}
