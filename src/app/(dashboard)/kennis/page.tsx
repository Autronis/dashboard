"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  Radar,
  Video,
  Lightbulb,
  FileText,
  ArrowRight,
  Search,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

interface KennisKpis {
  wikiArtikelen: number;
  secondBrainItems: number;
  radarOngelezen: number;
  radarMustReads: number;
  ideeen: number;
  documenten: number;
  laatsteWikiUpdate: string | null;
}

async function fetchKpis(): Promise<KennisKpis> {
  const [wiki, sb, radar, ideeen, documenten] = await Promise.allSettled([
    fetch("/api/wiki").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/second-brain").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/radar/items").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/ideeen").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/documenten").then((r) => (r.ok ? r.json() : null)),
  ]);

  const wikiData = wiki.status === "fulfilled" ? wiki.value : null;
  const sbData = sb.status === "fulfilled" ? sb.value : null;
  const radarData = radar.status === "fulfilled" ? radar.value : null;
  const ideeenData = ideeen.status === "fulfilled" ? ideeen.value : null;
  const docData = documenten.status === "fulfilled" ? documenten.value : null;

  const wikiList = wikiData?.artikelen ?? [];
  const sbList = sbData?.items ?? [];
  const radarList = radarData?.items ?? [];
  const ideeenList = ideeenData?.ideeen ?? [];
  const docList = docData?.documenten ?? [];

  const laatsteWiki = wikiList
    .map((a: { bijgewerktOp?: string }) => a.bijgewerktOp)
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? null;

  return {
    wikiArtikelen: wikiList.length,
    secondBrainItems: sbList.length,
    radarOngelezen: radarList.filter((r: { gelezen?: number }) => !r.gelezen).length,
    radarMustReads: radarList.filter((r: { score?: number }) => (r.score ?? 0) >= 8).length,
    ideeen: ideeenList.length,
    documenten: docList.length,
    laatsteWikiUpdate: laatsteWiki,
  };
}

function formatRelatief(iso: string | null): string {
  if (!iso) return "nooit";
  const dagen = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (dagen === 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 7) return `${dagen} dagen geleden`;
  if (dagen < 30) return `${Math.floor(dagen / 7)} weken geleden`;
  return `${Math.floor(dagen / 30)} maanden geleden`;
}

export default function KennisPage() {
  const { data, isLoading } = useQuery<KennisKpis>({
    queryKey: ["kennis-dashboard"],
    queryFn: fetchKpis,
    staleTime: 60_000,
  });

  const kpis = data;

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <PageHeader
          title="Kennis"
          description="Alles wat je weet, hebt opgeslagen of wilt onthouden"
        />

        {/* Global search */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-autronis-accent" />
            <div className="flex-1">
              <p className="text-sm font-medium text-autronis-text-primary">Zoek in alle kennis</p>
              <p className="text-xs text-autronis-text-secondary mt-0.5">
                Druk <kbd className="px-1.5 py-0.5 rounded bg-autronis-bg text-[10px] font-mono">⌘K</kbd> voor snelzoeken door Wiki, Second Brain, ideeën en meer
              </p>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Wiki artikelen"
            value={isLoading ? "..." : String(kpis?.wikiArtikelen ?? 0)}
            hint={kpis?.laatsteWikiUpdate ? `Laatste: ${formatRelatief(kpis.laatsteWikiUpdate)}` : undefined}
            icon={BookOpen}
          />
          <KpiCard
            label="Second Brain"
            value={isLoading ? "..." : String(kpis?.secondBrainItems ?? 0)}
            hint="Quick notes + clips"
            icon={Brain}
          />
          <KpiCard
            label="Radar ongelezen"
            value={isLoading ? "..." : String(kpis?.radarOngelezen ?? 0)}
            hint={kpis ? `${kpis.radarMustReads} must-reads` : undefined}
            icon={Radar}
            tone={(kpis?.radarMustReads ?? 0) > 0 ? "warning" : "default"}
          />
          <KpiCard
            label="Ideeën"
            value={isLoading ? "..." : String(kpis?.ideeen ?? 0)}
            icon={Lightbulb}
          />
        </div>

        {/* Quick link cards */}
        <div>
          <h2 className="text-lg font-semibold text-autronis-text-primary mb-4">Modules</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard
              href="/wiki"
              icon={BookOpen}
              title="Wiki"
              description="Gestructureerde kennisbank — processen, templates, strategie, geleerde lessen"
              accent="blue"
            />
            <ModuleCard
              href="/second-brain"
              icon={Brain}
              title="Second Brain"
              description="Quick notes, URL clips, snippets, dingen die je later wilt opzoeken"
              accent="purple"
            />
            <ModuleCard
              href="/radar"
              icon={Radar}
              title="Learning Radar"
              description="RSS feeds, must-reads, kennis bijhouden"
              accent="orange"
              badge={kpis && kpis.radarMustReads > 0 ? `${kpis.radarMustReads} must-reads` : undefined}
            />
            <ModuleCard
              href="/yt-knowledge"
              icon={Video}
              title="YT Knowledge"
              description="YouTube video samenvattingen en transcripten"
              accent="red"
            />
            <ModuleCard
              href="/ideeen"
              icon={Lightbulb}
              title="Ideeën"
              description="Backlog met AI scoring en pipeline"
              accent="yellow"
            />
            <ModuleCard
              href="/documenten"
              icon={FileText}
              title="Documenten"
              description="Bestanden, contracten, Notion sync"
              accent="teal"
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
  icon: typeof BookOpen;
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
  icon: typeof BookOpen;
  title: string;
  description: string;
  accent: "teal" | "purple" | "blue" | "orange" | "red" | "yellow";
  badge?: string;
}) {
  const accentClasses = {
    teal: "text-autronis-accent group-hover:bg-autronis-accent/10",
    purple: "text-purple-400 group-hover:bg-purple-500/10",
    blue: "text-blue-400 group-hover:bg-blue-500/10",
    orange: "text-orange-400 group-hover:bg-orange-500/10",
    red: "text-red-400 group-hover:bg-red-500/10",
    yellow: "text-yellow-400 group-hover:bg-yellow-500/10",
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
