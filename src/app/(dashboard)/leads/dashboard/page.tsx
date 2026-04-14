"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart3,
  Loader2,
  Users,
  Mail,
  Sparkles,
  Send,
  FolderOpen,
  TrendingUp,
  Activity,
  MessageSquare,
  XCircle,
  Sparkle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";

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
  generated: { icon: Sparkle, color: "text-amber-400", bg: "bg-amber-500/15" },
  sent: { icon: Send, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  replied: { icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/15" },
  failed: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15" },
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

  // Realtime-ish: refetch elke 15s
  usePoll(load, 15000);

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
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-400">
        <p className="font-medium">Kon statistieken niet laden</p>
        <p className="mt-1 text-red-400/80">{error}</p>
      </div>
    );
  }

  // Berekening voor "Bezig" tile: emails in generating/sending/approved (in pipeline)
  const bezig = stats.emailGenerated + stats.emailApproved;
  const replyRateDisplay = stats.emailSent > 0 ? `${stats.replyRate}%` : "0%";
  const replyRateNegative = stats.replyRate === 0 && stats.emailSent > 0;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-autronis-text-primary flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-autronis-accent" />
          Dashboard
        </h1>
        <p className="text-sm text-autronis-text-secondary mt-1.5">
          Overzicht van je outreach statistieken en recente activiteit
        </p>
      </div>

      {/* 8 KPI tiles in 2x4 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          icon={Users}
          label="Totaal leads"
          value={stats.total}
          accent="cyan"
          sub={`${stats.linkedin} bedrijf · ${stats.gmaps} locatie`}
        />
        <KpiTile
          icon={Send}
          label="Emails verzonden"
          value={stats.emailSent}
          accent="blue"
          sub={`${stats.emailApproved} klaar om te versturen`}
        />
        <KpiTile
          icon={MessageSquare}
          label="Replies"
          value={stats.emailReplied}
          accent="green"
          sub={stats.emailReplied === 0 ? "Nog geen replies" : `${stats.emailReplied} ontvangen`}
        />
        <KpiTile
          icon={AlertCircle}
          label="Mislukt"
          value={stats.enrichmentFailed}
          accent="red"
          sub={stats.enrichmentFailed === 0 ? "Geen fouten" : "Enrichment failures"}
        />
        <KpiTile
          icon={Mail}
          label="Totaal emails"
          value={stats.emailTotal}
          accent="cyan"
        />
        <KpiTile
          icon={Sparkles}
          label="Gegenereerd"
          value={stats.emailGenerated}
          accent="purple"
          sub="Klaar om te versturen"
        />
        <KpiTile
          icon={Loader2}
          label="Bezig"
          value={bezig}
          accent="yellow"
          sub="Wordt gegenereerd"
        />
        <KpiTile
          icon={TrendingUp}
          label="Reply rate"
          value={replyRateDisplay}
          accent={replyRateNegative ? "red" : "cyan"}
          sub={`${stats.emailReplied} van ${stats.emailSent} verzonden`}
        />
      </div>

      {/* Recent Activity feed */}
      <div className="rounded-2xl border border-autronis-border bg-autronis-card p-6">
        <h2 className="text-base font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-autronis-accent" />
          Recente Activiteit
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-autronis-text-secondary/60 py-2">
            Nog geen activiteit. Verstuur eerst een paar emails.
          </p>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((event) => {
              const cfg = ACTIVITY_ICONS[event.kind];
              const Icon = cfg.icon;
              return (
                <div
                  key={event.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-autronis-accent/[0.04] transition-colors"
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0",
                      cfg.bg
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                  </div>
                  <span className="text-sm text-autronis-text-primary truncate flex-1">
                    {event.label}
                  </span>
                  <span className="text-xs text-autronis-text-secondary/60 tabular-nums flex-shrink-0">
                    {tijdGeleden(event.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top folders — compact card */}
      {stats.topFolders.length > 0 && (
        <div className="rounded-2xl border border-autronis-border bg-autronis-card p-6">
          <h2 className="text-base font-semibold text-autronis-text-primary mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-autronis-accent" />
            Top folders
          </h2>
          <div className="space-y-2.5">
            {stats.topFolders.map(([name, count]) => {
              const pct = Math.round((count / Math.max(1, stats.total)) * 100);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs text-autronis-text-primary min-w-[120px] truncate font-medium">
                    {name}
                  </span>
                  <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
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

type KpiAccent = "cyan" | "blue" | "green" | "red" | "purple" | "yellow";

const KPI_ACCENT: Record<
  KpiAccent,
  { iconBg: string; iconColor: string; valueColor: string; border: string }
> = {
  cyan: {
    iconBg: "bg-autronis-accent/15",
    iconColor: "text-autronis-accent",
    valueColor: "text-autronis-accent",
    border: "border-autronis-border",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    valueColor: "text-blue-400",
    border: "border-autronis-border",
  },
  green: {
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    valueColor: "text-emerald-400",
    border: "border-autronis-border",
  },
  red: {
    iconBg: "bg-red-500/15",
    iconColor: "text-red-400",
    valueColor: "text-red-400",
    border: "border-red-500/20",
  },
  purple: {
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    valueColor: "text-purple-400",
    border: "border-autronis-border",
  },
  yellow: {
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    valueColor: "text-amber-400",
    border: "border-autronis-border",
  },
};

function KpiTile({
  icon: Icon,
  label,
  value,
  accent,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  accent: KpiAccent;
  sub?: string;
}) {
  const cfg = KPI_ACCENT[accent];
  return (
    <div
      className={cn(
        "rounded-2xl border bg-autronis-card p-6 transition-colors hover:border-autronis-accent/30",
        cfg.border
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
        {typeof value === "number" ? value.toLocaleString("nl-NL") : value}
      </div>
      <div className="text-xs uppercase tracking-wider text-autronis-text-secondary mt-2.5 font-medium">
        {label}
      </div>
      {sub && (
        <div className="text-[11px] text-autronis-text-secondary/60 mt-1">{sub}</div>
      )}
    </div>
  );
}

