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
import { motion } from "framer-motion";
import { usePoll } from "@/lib/use-poll";
import { PageHeader } from "@/components/ui/page-header";
import { LeadsKpiTile } from "@/components/leads/kpi-tile";
import { SectionCard } from "@/components/leads/section-card";

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

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 15000);

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

    const emailTotal = emails.length;
    const emailGenerated = emails.filter((e) => e.email_status === "generated").length;
    const emailApproved = emails.filter((e) => e.email_status === "approved").length;
    const emailSent = emails.filter((e) => e.email_status === "sent").length;
    const emailReplied = emails.filter((e) => e.email_status === "replied").length;

    const folderCounts = new Map<string, number>();
    for (const l of leads) {
      if (l.folder) folderCounts.set(l.folder, (folderCounts.get(l.folder) || 0) + 1);
    }
    const topFolders = Array.from(folderCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

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
      replyRate,
      topFolders,
    };
  }, [leads, emails]);

  const recentActivity = useMemo<ActivityEvent[]>(() => {
    const events: ActivityEvent[] = [];
    for (const e of emails) {
      const naam = e.lead_name || e.recipient_email || "(onbekend)";
      if (e.reply_received_at && e.email_status === "replied") {
        events.push({
          id: `${e.id}:reply`,
          kind: "replied",
          label: `Reply ontvangen — ${naam}`,
          timestamp: e.reply_received_at,
        });
      }
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

  if (loading && leads.length === 0 && emails.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Statistieken laden...
      </div>
    );
  }

  if (error && leads.length === 0) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-400">
        <p className="font-medium">Kon statistieken niet laden</p>
        <p className="mt-1 text-red-400/80">{error}</p>
      </div>
    );
  }

  const bezig = stats.emailGenerated + stats.emailApproved;
  const replyRateNegative = stats.replyRate === 0 && stats.emailSent > 0;
  const formatReplyRate = (n: number) => (stats.emailSent > 0 ? `${n}%` : "0%");

  return (
    <div className="space-y-7">
      <PageHeader
        title="Dashboard"
        description="Overzicht van je outreach statistieken en recente activiteit"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LeadsKpiTile
          icon={Users}
          label="Totaal leads"
          value={stats.total}
          accent="cyan"
          sub={`${stats.linkedin} bedrijf · ${stats.gmaps} locatie`}
          index={0}
        />
        <LeadsKpiTile
          icon={Send}
          label="Emails verzonden"
          value={stats.emailSent}
          accent="blue"
          sub={`${stats.emailApproved} klaar om te versturen`}
          index={1}
        />
        <LeadsKpiTile
          icon={MessageSquare}
          label="Replies"
          value={stats.emailReplied}
          accent="green"
          sub={stats.emailReplied === 0 ? "Nog geen replies" : `${stats.emailReplied} ontvangen`}
          index={2}
        />
        <LeadsKpiTile
          icon={AlertCircle}
          label="Mislukt"
          value={stats.enrichmentFailed}
          accent="red"
          sub={stats.enrichmentFailed === 0 ? "Geen fouten" : "Enrichment failures"}
          index={3}
        />
        <LeadsKpiTile
          icon={Mail}
          label="Totaal emails"
          value={stats.emailTotal}
          accent="cyan"
          index={4}
        />
        <LeadsKpiTile
          icon={Sparkles}
          label="Gegenereerd"
          value={stats.emailGenerated}
          accent="purple"
          sub="Klaar om te versturen"
          index={5}
        />
        <LeadsKpiTile
          icon={Loader2}
          label="Bezig"
          value={bezig}
          accent="amber"
          sub="Wordt gegenereerd"
          index={6}
        />
        <LeadsKpiTile
          icon={TrendingUp}
          label="Reply rate"
          value={stats.replyRate}
          accent={replyRateNegative ? "red" : "cyan"}
          format={formatReplyRate}
          sub={`${stats.emailReplied} van ${stats.emailSent} verzonden`}
          index={7}
        />
      </div>

      <SectionCard title="Recente activiteit" icon={Activity}>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-autronis-text-secondary/70 py-2">
            Nog geen activiteit. Verstuur eerst een paar emails.
          </p>
        ) : (
          <div className="space-y-1">
            {recentActivity.map((event, i) => {
              const cfg = ACTIVITY_ICONS[event.kind];
              const Icon = cfg.icon;
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.22 }}
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
                </motion.div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {stats.topFolders.length > 0 && (
        <SectionCard
          title="Top folders"
          icon={FolderOpen}
          aside={
            <span className="text-xs text-autronis-text-secondary/70 tabular-nums">
              {stats.topFolders.length} actief
            </span>
          }
        >
          <div className="space-y-2.5">
            {stats.topFolders.map(([name, count], i) => {
              const pct = Math.round((count / Math.max(1, stats.total)) * 100);
              return (
                <motion.div
                  key={name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-autronis-text-primary min-w-[120px] truncate font-medium">
                    {name}
                  </span>
                  <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2 + i * 0.04, duration: 0.6, ease: "easeOut" }}
                      className="h-full bg-autronis-accent rounded-full"
                    />
                  </div>
                  <span className="text-xs tabular-nums text-autronis-text-secondary min-w-[70px] text-right">
                    {count} <span className="text-autronis-text-secondary/60">({pct}%)</span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {stats.enrichmentPending > 0 && (
        <div className="flex items-center gap-2 text-xs text-autronis-text-secondary/70 px-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {stats.enrichmentPending} enrichment jobs actief
        </div>
      )}
    </div>
  );
}
