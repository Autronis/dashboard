"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Zap,
  Rocket,
  UserCheck,
  Activity,
  HeartPulse,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

interface SalesKpis {
  klantenTotaal: number;
  klantenActief: number;
  klantenKritiek: number;
  salesEngineScans: number;
  salesEngineKansen: number;
  followupDanger: number;
  followupWarning: number;
  followupOk: number;
  clientStatusFouten: number;
  gezondheidGem: number;
}

async function fetchKpis(): Promise<SalesKpis> {
  // Parallel fetches — tolerant of failures
  const [klanten, salesEngine, followup, clientStatus, gezondheid] = await Promise.allSettled([
    fetch("/api/klanten").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/sales-engine/scans").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/followup/check").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/client-status").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/klant-gezondheid").then((r) => (r.ok ? r.json() : null)),
  ]);

  const klantenData = klanten.status === "fulfilled" ? klanten.value : null;
  const salesData = salesEngine.status === "fulfilled" ? salesEngine.value : null;
  const followupData = followup.status === "fulfilled" ? followup.value : null;
  const statusData = clientStatus.status === "fulfilled" ? clientStatus.value : null;
  const gezondheidData = gezondheid.status === "fulfilled" ? gezondheid.value : null;

  const klantenList = klantenData?.klanten ?? [];
  const scans = salesData?.scans ?? [];
  const automaties = statusData?.automaties ?? [];
  const gezondheidList = gezondheidData?.klanten ?? [];

  const gemScore = gezondheidList.length > 0
    ? Math.round(
        gezondheidList.reduce(
          (s: number, k: { totaalScore?: number }) => s + (k.totaalScore ?? 0),
          0
        ) / gezondheidList.length
      )
    : 0;

  return {
    klantenTotaal: klantenList.length,
    klantenActief: klantenList.filter((k: { status?: string }) => k.status === "actief").length,
    klantenKritiek: gezondheidList.filter((k: { totaalScore?: number }) => (k.totaalScore ?? 100) < 40).length,
    salesEngineScans: scans.length,
    salesEngineKansen: scans.reduce(
      (sum: number, s: { kansen?: unknown[] }) => sum + (s.kansen?.length ?? 0),
      0
    ),
    followupDanger: followupData?.danger ?? 0,
    followupWarning: followupData?.warning ?? 0,
    followupOk: followupData?.ok ?? 0,
    clientStatusFouten: automaties.filter((a: { status?: string }) => a.status === "fout").length,
    gezondheidGem: gemScore,
  };
}

export default function SalesPage() {
  const { data, isLoading } = useQuery<SalesKpis>({
    queryKey: ["sales-dashboard"],
    queryFn: fetchKpis,
    staleTime: 60_000,
  });

  const kpis = data;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <PageHeader
          title="Sales"
          description="Overzicht van klanten, leads, pipeline en opvolging"
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Klanten"
            value={isLoading ? "..." : String(kpis?.klantenTotaal ?? 0)}
            hint={kpis ? `${kpis.klantenActief} actief` : undefined}
            icon={Users}
            tone="default"
          />
          <KpiCard
            label="Sales Engine"
            value={isLoading ? "..." : String(kpis?.salesEngineScans ?? 0)}
            hint={kpis ? `${kpis.salesEngineKansen} kansen` : undefined}
            icon={Rocket}
            tone="info"
          />
          <KpiCard
            label="Follow-up urgent"
            value={isLoading ? "..." : String(kpis?.followupDanger ?? 0)}
            hint={kpis ? `${kpis.followupWarning} warnings` : undefined}
            icon={AlertTriangle}
            tone={(kpis?.followupDanger ?? 0) > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Status errors"
            value={isLoading ? "..." : String(kpis?.clientStatusFouten ?? 0)}
            icon={Activity}
            tone={(kpis?.clientStatusFouten ?? 0) > 0 ? "negative" : "positive"}
          />
          <KpiCard
            label="Gezondheid"
            value={isLoading ? "..." : `${kpis?.gezondheidGem ?? 0}/100`}
            hint={kpis ? `${kpis.klantenKritiek} kritiek` : undefined}
            icon={HeartPulse}
            tone={(kpis?.gezondheidGem ?? 0) >= 70 ? "positive" : (kpis?.gezondheidGem ?? 0) >= 40 ? "warning" : "negative"}
          />
        </div>

        {/* Quick link cards */}
        <div>
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard
              href="/klanten"
              icon={Users}
              title="Klanten"
              description="Klant database met gezondheid, omzet en projecten"
              accent="teal"
            />
            <ModuleCard
              href="/sales-engine"
              icon={Rocket}
              title="Sales Engine"
              description="AI website scans + opportunity finder"
              accent="purple"
            />
            <ModuleCard
              href="/leads"
              icon={Zap}
              title="Leads"
              description="Prospects en inbound contacten"
              accent="blue"
            />
            <ModuleCard
              href="/followup"
              icon={UserCheck}
              title="Follow-up"
              description="Automatische opvolging van klanten en offertes"
              accent="orange"
              badge={kpis && kpis.followupDanger > 0 ? `${kpis.followupDanger} urgent` : undefined}
            />
            <ModuleCard
              href="/client-status"
              icon={Activity}
              title="Client Status"
              description="Automations, webhooks, cron jobs monitoring"
              accent="red"
              badge={kpis && kpis.clientStatusFouten > 0 ? `${kpis.clientStatusFouten} fouten` : undefined}
            />
            <ModuleCard
              href="/klant-gezondheid"
              icon={HeartPulse}
              title="Klant gezondheid"
              description="Health scores per klant met trends"
              accent="emerald"
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

// ─── Subcomponents ─────────────────────────────────────────────

type Tone = "default" | "positive" | "negative" | "warning" | "info";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Users;
  tone?: Tone;
}) {
  const toneClasses = {
    default: "bg-autronis-card border-autronis-border",
    positive: "bg-emerald-500/5 border-emerald-500/20",
    negative: "bg-red-500/5 border-red-500/20",
    warning: "bg-orange-500/5 border-orange-500/20",
    info: "bg-autronis-card border-autronis-border",
  }[tone];

  const iconTone = {
    default: "text-autronis-text-secondary",
    positive: "text-emerald-400",
    negative: "text-red-400",
    warning: "text-orange-400",
    info: "text-autronis-accent",
  }[tone];

  return (
    <div className={cn("border rounded-2xl p-5 card-glow", toneClasses)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", iconTone)} />
        <span className="text-xs text-autronis-text-secondary uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold text-autronis-text-primary tabular-nums">{value}</p>
      {hint && <p className="text-xs text-autronis-text-secondary mt-1">{hint}</p>}
    </div>
  );
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
  badge,
}: {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
  accent: "teal" | "purple" | "blue" | "orange" | "red" | "emerald";
  badge?: string;
}) {
  const accentClasses = {
    teal: "text-autronis-accent group-hover:bg-autronis-accent/10",
    purple: "text-purple-400 group-hover:bg-purple-500/10",
    blue: "text-blue-400 group-hover:bg-blue-500/10",
    orange: "text-orange-400 group-hover:bg-orange-500/10",
    red: "text-red-400 group-hover:bg-red-500/10",
    emerald: "text-emerald-400 group-hover:bg-emerald-500/10",
  }[accent];

  return (
    <Link
      href={href}
      className="group bg-autronis-card border border-autronis-border rounded-2xl p-5 hover:border-autronis-accent/40 transition-all card-glow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn("p-2.5 rounded-xl bg-autronis-bg transition-colors", accentClasses)}>
          <Icon className="w-5 h-5" />
        </div>
        {badge && (
          <span className="text-xs font-medium px-2 py-1 rounded-md bg-orange-500/10 text-orange-400">
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-autronis-text-primary">{title}</h3>
          <p className="text-xs text-autronis-text-secondary mt-0.5 line-clamp-2">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-autronis-text-secondary/40 group-hover:text-autronis-accent transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}
