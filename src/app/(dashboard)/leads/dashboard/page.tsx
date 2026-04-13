"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart3,
  Loader2,
  Users,
  Mail,
  Phone,
  Globe,
  Sparkles,
  Send,
  CheckCircle,
  Linkedin,
  MapPin,
  FolderOpen,
  TrendingUp,
  Activity,
  MessageSquare,
  XCircle,
  Sparkle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  source: string | null;
  folder: string | null;
  emails: string | null;
  phone: string | null;
  website: string | null;
  email_found: boolean | null;
  phone_found: boolean | null;
  website_found: boolean | null;
  enrichment_status: string | null;
  outreach_status: string | null;
}

interface EmailRecord {
  id: string;
  email_status: string | null;
  lead_name: string | null;
  recipient_email: string | null;
  created_at: string;
  updated_at: string;
  reply_received_at: string | null;
}

type ActivityKind = "generated" | "sent" | "replied" | "failed";

interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  label: string;
  timestamp: string;
}

function hasEmail(l: Lead): boolean {
  const e = l.emails;
  return !!(e && e.trim() && e.trim() !== "[]");
}

function tijdGeleden(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin}m geleden`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}u geleden`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d geleden`;
}

const ACTIVITY_ICONS = {
  generated: { icon: Sparkle, color: "text-amber-400" },
  sent: { icon: Send, color: "text-emerald-400" },
  replied: { icon: MessageSquare, color: "text-blue-400" },
  failed: { icon: XCircle, color: "text-red-400" },
} as const;

export default function LeadsDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, emailsRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/leads/emails"),
      ]);
      if (!leadsRes.ok || !emailsRes.ok) {
        throw new Error(`HTTP ${leadsRes.status}/${emailsRes.status}`);
      }
      const leadsData = await leadsRes.json();
      const emailsData = await emailsRes.json();
      setLeads(leadsData.leads ?? []);
      setEmails(emailsData.emails ?? []);
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
    const total = leads.length;
    const withEmail = leads.filter(hasEmail).length;
    const withPhone = leads.filter((l) => !!l.phone?.trim()).length;
    const withWebsite = leads.filter((l) => !!l.website?.trim()).length;

    const linkedin = leads.filter((l) => l.source !== "google maps" && l.source !== "google_maps").length;
    const gmaps = leads.filter((l) => l.source === "google maps" || l.source === "google_maps").length;

    const enrichmentDone = leads.filter(
      (l) => l.email_found || l.phone_found || l.website_found || l.enrichment_status === "failed"
    ).length;
    const enrichmentPending = leads.filter((l) => l.enrichment_status === "pending").length;
    const enrichmentFailed = leads.filter((l) => l.enrichment_status === "failed").length;

    // Email funnel
    const emailTotal = emails.length;
    const emailGenerated = emails.filter((e) => e.email_status === "generated").length;
    const emailApproved = emails.filter((e) => e.email_status === "approved").length;
    const emailSent = emails.filter((e) => e.email_status === "sent").length;
    const emailReplied = emails.filter((e) => e.email_status === "replied").length;

    // Folders
    const folderCounts = new Map<string, number>();
    for (const l of leads) {
      if (l.folder) folderCounts.set(l.folder, (folderCounts.get(l.folder) || 0) + 1);
    }
    const topFolders = Array.from(folderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Conversion rates
    const enrichmentHitRate = enrichmentDone > 0
      ? Math.round(((enrichmentDone - enrichmentFailed) / enrichmentDone) * 100)
      : 0;
    const emailApprovalRate = emailGenerated + emailApproved + emailSent > 0
      ? Math.round(((emailApproved + emailSent) / (emailGenerated + emailApproved + emailSent)) * 100)
      : 0;
    const replyRate = emailSent > 0 ? Math.round((emailReplied / emailSent) * 100) : 0;

    return {
      total,
      withEmail,
      withPhone,
      withWebsite,
      linkedin,
      gmaps,
      enrichmentDone,
      enrichmentPending,
      enrichmentFailed,
      emailTotal,
      emailGenerated,
      emailApproved,
      emailSent,
      emailReplied,
      enrichmentHitRate,
      emailApprovalRate,
      replyRate,
      topFolders,
    };
  }, [leads, emails]);

  // Recent Activity feed — laatste 10 events uit emails table
  const recentActivity = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];
    for (const e of emails) {
      const naam = e.lead_name || e.recipient_email || "(onbekend)";
      // Reply ontvangen
      if (e.reply_received_at && e.email_status === "replied") {
        events.push({
          id: `${e.id}:reply`,
          kind: "replied",
          label: `Reply ontvangen — ${naam}`,
          timestamp: e.reply_received_at,
        });
      }
      // Sent of failed → updated_at als signaal
      if (e.email_status === "sent") {
        events.push({
          id: `${e.id}:sent`,
          kind: "sent",
          label: `Email verstuurd — ${naam}`,
          timestamp: e.updated_at,
        });
      } else if (e.email_status === "failed" || e.email_status === "error") {
        events.push({
          id: `${e.id}:failed`,
          kind: "failed",
          label: `Email gefaald — ${naam}`,
          timestamp: e.updated_at,
        });
      }
      // Generated → created_at
      if (e.email_status === "generated" || e.email_status === "approved") {
        events.push({
          id: `${e.id}:gen`,
          kind: "generated",
          label: `Email gegenereerd — ${naam}`,
          timestamp: e.created_at,
        });
      }
    }
    return events
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
      .slice(0, 10);
  }, [emails]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Statistieken laden...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        <p className="font-medium">Kon statistieken niet laden</p>
        <p className="mt-1 text-red-400/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-autronis-text-primary flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-autronis-accent" />
          Lead Dashboard
        </h1>
        <p className="text-sm text-autronis-text-secondary mt-1">
          Statistieken over de volledige outreach funnel.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BigStat icon={Users} label="Totaal leads" value={stats.total} />
        <BigStat icon={Mail} label="Met email" value={stats.withEmail} sub={`${Math.round((stats.withEmail / Math.max(1, stats.total)) * 100)}%`} accent />
        <BigStat icon={Phone} label="Met telefoon" value={stats.withPhone} sub={`${Math.round((stats.withPhone / Math.max(1, stats.total)) * 100)}%`} />
        <BigStat icon={Globe} label="Met website" value={stats.withWebsite} sub={`${Math.round((stats.withWebsite / Math.max(1, stats.total)) * 100)}%`} />
      </div>

      {/* Source split */}
      <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
        <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-autronis-accent" />
          Lead bron
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SourceBar label="LinkedIn" value={stats.linkedin} total={stats.total} icon={Linkedin} color="#a855f7" />
          <SourceBar label="Google Maps" value={stats.gmaps} total={stats.total} icon={MapPin} color="#17B8A5" />
        </div>
      </div>

      {/* Enrichment funnel */}
      <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
        <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-autronis-accent" />
          Enrichment pipeline
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SmallStat label="Voltooid" value={stats.enrichmentDone} />
          <SmallStat label="Pending" value={stats.enrichmentPending} />
          <SmallStat label="Gefaald" value={stats.enrichmentFailed} />
          <SmallStat label="Hit rate" value={`${stats.enrichmentHitRate}%`} accent />
        </div>
      </div>

      {/* Email funnel */}
      <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
        <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-autronis-accent" />
          Email pipeline ({stats.emailTotal} totaal)
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <SmallStat label="Te reviewen" value={stats.emailGenerated} />
          <SmallStat label="Goedgekeurd" value={stats.emailApproved} />
          <SmallStat label="Verstuurd" value={stats.emailSent} />
          <SmallStat label="Beantwoord" value={stats.emailReplied} />
          <SmallStat label="Reply rate" value={`${stats.replyRate}%`} accent />
        </div>
      </div>

      {/* Recent Activity feed */}
      {recentActivity.length > 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
          <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-autronis-accent" />
            Recent Activity
          </h2>
          <div className="space-y-1.5">
            {recentActivity.map((event) => {
              const cfg = ACTIVITY_ICONS[event.kind];
              const Icon = cfg.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-autronis-accent/[0.04] transition-colors"
                >
                  <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", cfg.color)} />
                  <span className="text-xs text-autronis-text-primary truncate flex-1">
                    {event.label}
                  </span>
                  <span className="text-[10px] text-autronis-text-secondary/60 tabular-nums flex-shrink-0">
                    {tijdGeleden(event.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top folders */}
      {stats.topFolders.length > 0 && (
        <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
          <h2 className="text-sm font-semibold text-autronis-text-primary mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-autronis-accent" />
            Top folders
          </h2>
          <div className="space-y-2">
            {stats.topFolders.map(([name, count]) => {
              const pct = Math.round((count / Math.max(1, stats.total)) * 100);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-autronis-text-primary min-w-[120px] truncate">
                    {name}
                  </span>
                  <div className="flex-1 h-2 bg-autronis-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-autronis-accent rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-autronis-text-secondary min-w-[60px] text-right">
                    {count} <span className="text-autronis-text-secondary/60">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BigStat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-autronis-border bg-autronis-card p-5">
      <div className="flex items-center gap-2 text-autronis-text-secondary text-xs mb-2">
        <Icon className={cn("w-4 h-4", accent && "text-autronis-accent")} />
        {label}
      </div>
      <div className="text-3xl font-bold text-autronis-text-primary tabular-nums">
        {typeof value === "number" ? value.toLocaleString("nl-NL") : value}
      </div>
      {sub && <div className="text-[11px] text-autronis-text-secondary/60 mt-1">{sub}</div>}
    </div>
  );
}

function SmallStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-autronis-bg/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-autronis-text-secondary/70 mb-1">
        {label}
      </div>
      <div
        className={cn(
          "text-xl font-bold tabular-nums",
          accent ? "text-autronis-accent" : "text-autronis-text-primary"
        )}
      >
        {typeof value === "number" ? value.toLocaleString("nl-NL") : value}
      </div>
    </div>
  );
}

function SourceBar({
  label,
  value,
  total,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  total: number;
  icon: typeof Linkedin;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-autronis-text-primary flex items-center gap-1.5">
          <Icon className="w-3 h-3" style={{ color }} />
          {label}
        </span>
        <span className="text-xs tabular-nums text-autronis-text-secondary">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-autronis-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
