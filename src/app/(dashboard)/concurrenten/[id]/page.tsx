"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  useConcurrentDetail,
  useStartScan,
  type ConcurrentScan,
} from "@/hooks/queries/use-concurrenten";

const tabs = [
  { key: "historie", label: "Scan historie" },
  { key: "website", label: "Website changes" },
  { key: "vacatures", label: "Vacatures" },
  { key: "social", label: "Social" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function ScanTimeline({ scans }: { scans: ConcurrentScan[] }) {
  if (scans.length === 0) {
    return <p className="py-8 text-center text-sm text-autronis-text-secondary">Nog geen scans uitgevoerd</p>;
  }

  return (
    <div className="relative space-y-6 pl-6">
      <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-autronis-border" />
      {scans.map((scan, i) => {
        const highlights: string[] = scan.aiHighlights ? JSON.parse(scan.aiHighlights) : [];
        return (
          <div key={scan.id} className="relative">
            <div className={cn("absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-autronis-bg",
              i === 0 ? "bg-autronis-accent" : "bg-autronis-border")} />
            <div className="flex items-center gap-2 text-xs text-autronis-text-secondary/60">
              <Calendar className="h-3 w-3" />
              {formatDatum(scan.scanDatum)}
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                scan.status === "voltooid" && "bg-emerald-500/15 text-emerald-400",
                scan.status === "mislukt" && "bg-red-500/15 text-red-400",
                scan.status === "bezig" && "bg-yellow-500/15 text-yellow-400")}>
                {scan.status}
              </span>
            </div>
            {scan.aiSamenvatting && (
              <p className="mt-2 text-sm leading-relaxed text-autronis-text-secondary">{scan.aiSamenvatting}</p>
            )}
            {highlights.length > 0 && (
              <div className="mt-2 space-y-1">
                {highlights.map((h, j) => (
                  <div key={j} className="rounded-lg border-l-2 border-autronis-accent bg-autronis-bg px-3 py-1.5 text-xs">⚡ {h}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WebsiteChangesTab({ scans }: { scans: ConcurrentScan[] }) {
  const latestWithData = scans.find((s) => s.websiteChanges);
  if (!latestWithData?.websiteChanges) {
    return <p className="py-8 text-center text-sm text-autronis-text-secondary">Geen website data beschikbaar</p>;
  }
  const changes: Array<{ url: string; veranderd: boolean; samenvatting?: string }> = JSON.parse(latestWithData.websiteChanges);
  return (
    <div className="space-y-3">
      <p className="text-xs text-autronis-text-secondary">Laatste scan: {formatDatum(latestWithData.scanDatum)}</p>
      {changes.map((c, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-autronis-border bg-autronis-bg p-4">
          <div>
            <a href={c.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium hover:text-autronis-accent transition-colors">
              {c.url.replace(/^https?:\/\/[^/]+/, "") || "/"} <ExternalLink className="h-3 w-3" />
            </a>
            <p className="mt-1 text-xs text-autronis-text-secondary">{c.samenvatting}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
            c.veranderd ? "bg-autronis-accent/15 text-autronis-accent" : "bg-autronis-border/50 text-autronis-text-secondary/60")}>
            {c.veranderd ? "Gewijzigd" : "Ongewijzigd"}
          </span>
        </div>
      ))}
    </div>
  );
}

function VacaturesTab({ scans }: { scans: ConcurrentScan[] }) {
  const latestWithData = scans.find((s) => s.vacatures);
  if (!latestWithData?.vacatures) {
    return <p className="py-8 text-center text-sm text-autronis-text-secondary">Geen vacature data beschikbaar</p>;
  }
  const vacatures: Array<{ titel: string; url: string; bron: string }> = JSON.parse(latestWithData.vacatures);
  if (vacatures.length === 0) {
    return <p className="py-8 text-center text-sm text-autronis-text-secondary">Geen vacatures gevonden</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-autronis-text-secondary">Laatste scan: {formatDatum(latestWithData.scanDatum)}</p>
      {vacatures.map((v, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-autronis-border bg-autronis-bg p-4">
          <a href={v.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-medium hover:text-autronis-accent transition-colors">
            {v.titel} <ExternalLink className="h-3 w-3" />
          </a>
          <span className="rounded-full bg-autronis-border/50 px-2.5 py-0.5 text-xs text-autronis-text-secondary">{v.bron}</span>
        </div>
      ))}
    </div>
  );
}

function SocialTab({ scans }: { scans: ConcurrentScan[] }) {
  const latestWithData = scans.find((s) => s.socialActivity);
  if (!latestWithData?.socialActivity) {
    return <p className="py-8 text-center text-sm text-autronis-text-secondary">Geen social data beschikbaar</p>;
  }
  const social: Array<{ platform: string; beschikbaar: boolean; data?: Record<string, unknown>; fout?: string }> =
    JSON.parse(latestWithData.socialActivity);
  return (
    <div className="space-y-3">
      <p className="text-xs text-autronis-text-secondary">Laatste scan: {formatDatum(latestWithData.scanDatum)}</p>
      {social.map((s, i) => (
        <div key={i} className="rounded-xl border border-autronis-border bg-autronis-bg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium capitalize">{s.platform}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
              s.beschikbaar ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
              {s.beschikbaar ? "Beschikbaar" : "Niet beschikbaar"}
            </span>
          </div>
          {s.fout && <p className="mt-1 text-xs text-red-400">{s.fout}</p>}
          {s.data && (
            <pre className="mt-2 rounded-lg bg-autronis-bg p-2 text-xs text-autronis-text-secondary overflow-x-auto">
              {JSON.stringify(s.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ConcurrentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const { data, isLoading } = useConcurrentDetail(id ? parseInt(id, 10) : null);
  const startScan = useStartScan();
  const [activeTab, setActiveTab] = useState<TabKey>("historie");

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-autronis-border border-t-autronis-accent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-autronis-text-secondary">Concurrent niet gevonden</p>
        <Link href="/concurrenten" className="text-sm text-autronis-accent hover:underline">← Terug naar overzicht</Link>
      </div>
    );
  }

  const { concurrent, scans } = data;

  function handleScan() {
    startScan.mutate(concurrent.id, {
      onSuccess: () => addToast("Scan gestart", "succes"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/concurrenten"
            className="mb-2 inline-flex items-center gap-1 text-sm text-autronis-text-secondary hover:text-autronis-accent transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Terug
          </Link>
          <h1 className="text-2xl font-bold">{concurrent.naam}</h1>
          <div className="mt-1 flex items-center gap-4 text-sm text-autronis-text-secondary">
            <a href={concurrent.websiteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-autronis-accent transition-colors">
              {concurrent.websiteUrl.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
            </a>
            {concurrent.linkedinUrl && (
              <a href={concurrent.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="hover:text-autronis-accent transition-colors">LinkedIn</a>
            )}
            {concurrent.instagramHandle && (
              <a href={`https://instagram.com/${concurrent.instagramHandle}`} target="_blank" rel="noopener noreferrer"
                className="hover:text-autronis-accent transition-colors">@{concurrent.instagramHandle}</a>
            )}
          </div>
        </div>
        <button onClick={handleScan} disabled={startScan.isPending}
          className="flex items-center gap-2 rounded-xl border border-autronis-accent/30 bg-autronis-accent/10 px-4 py-2.5 text-sm font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", startScan.isPending && "animate-spin")} />
          Scan nu
        </button>
      </div>

      <div className="flex gap-0 border-b border-autronis-border">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn("border-b-2 px-5 py-3 text-sm font-medium transition-colors",
              activeTab === tab.key ? "border-autronis-accent text-autronis-accent" : "border-transparent text-autronis-text-secondary hover:text-autronis-text-primary")}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-autronis-border bg-autronis-card p-6">
        {activeTab === "historie" && <ScanTimeline scans={scans} />}
        {activeTab === "website" && <WebsiteChangesTab scans={scans} />}
        {activeTab === "vacatures" && <VacaturesTab scans={scans} />}
        {activeTab === "social" && <SocialTab scans={scans} />}
      </div>
    </div>
  );
}
