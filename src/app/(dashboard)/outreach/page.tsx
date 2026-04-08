"use client";

import { useState } from "react";
import { useOutreach, type SequentieListItem } from "@/hooks/queries/use-outreach";
import { PageTransition } from "@/components/ui/page-transition";
import { KPICard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Mail,
  Eye,
  MousePointerClick,
  MessageSquare,
  AlertTriangle,
  Building2,
  ChevronRight,
  Filter,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string }> = {
  draft: { label: "Concept", kleur: "text-gray-400 bg-gray-400/10" },
  actief: { label: "Actief", kleur: "text-emerald-400 bg-emerald-400/10" },
  gepauzeerd: { label: "Gepauzeerd", kleur: "text-yellow-400 bg-yellow-400/10" },
  gestopt: { label: "Gestopt", kleur: "text-red-400 bg-red-400/10" },
  voltooid: { label: "Voltooid", kleur: "text-blue-400 bg-blue-400/10" },
};

function ConversionFunnel({ kpis }: { kpis: { verstuurd: number; geopend: number; geklikt: number; beantwoord: number } }) {
  const steps = [
    { label: "Verstuurd", value: kpis.verstuurd, icon: Mail, kleur: "#6366f1" },
    { label: "Geopend", value: kpis.geopend, icon: Eye, kleur: "#8b5cf6" },
    { label: "Geklikt", value: kpis.geklikt, icon: MousePointerClick, kleur: "#a78bfa" },
    { label: "Beantwoord", value: kpis.beantwoord, icon: MessageSquare, kleur: "#34d399" },
  ];

  const maxValue = Math.max(kpis.verstuurd, 1);

  return (
    <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
      <h2 className="font-semibold text-lg mb-4">Conversie Funnel</h2>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const pct = (step.value / maxValue) * 100;
          const convRate = i > 0 && steps[i - 1].value > 0
            ? Math.round((step.value / steps[i - 1].value) * 100)
            : null;
          const Icon = step.icon;

          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="w-4 h-4" style={{ color: step.kleur }} />
                  <span>{step.label}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {convRate !== null && (
                    <span className="text-xs text-[var(--text-tertiary)]">{convRate}%</span>
                  )}
                  <span className="font-medium tabular-nums">{step.value}</span>
                </div>
              </div>
              <div className="h-6 bg-[var(--bg)] rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="h-full rounded-lg"
                  style={{ backgroundColor: step.kleur, minWidth: step.value > 0 ? 8 : 0 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ABComparison({ sequenties }: { sequenties: SequentieListItem[] }) {
  const variants = { a: { verstuurd: 0, geopend: 0, geklikt: 0, beantwoord: 0, count: 0 }, b: { verstuurd: 0, geopend: 0, geklikt: 0, beantwoord: 0, count: 0 } };

  for (const seq of sequenties) {
    const v = seq.abVariant === "b" ? "b" : "a";
    variants[v].verstuurd += seq.verstuurd;
    variants[v].geopend += seq.geopend;
    variants[v].geklikt += seq.geklikt;
    variants[v].beantwoord += seq.beantwoord;
    variants[v].count++;
  }

  const rate = (num: number, denom: number) => denom > 0 ? `${Math.round((num / denom) * 100)}%` : "—";

  const metrics = [
    { label: "Sequenties", a: variants.a.count, b: variants.b.count, isRate: false },
    { label: "Open Rate", a: rate(variants.a.geopend, variants.a.verstuurd), b: rate(variants.b.geopend, variants.b.verstuurd), isRate: true },
    { label: "Click Rate", a: rate(variants.a.geklikt, variants.a.verstuurd), b: rate(variants.b.geklikt, variants.b.verstuurd), isRate: true },
    { label: "Reply Rate", a: rate(variants.a.beantwoord, variants.a.verstuurd), b: rate(variants.b.beantwoord, variants.b.verstuurd), isRate: true },
  ];

  if (variants.a.count === 0 && variants.b.count === 0) return null;

  return (
    <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
      <h2 className="font-semibold text-lg mb-4">A/B Test Vergelijking</h2>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div />
        <div className="text-center font-medium text-[var(--accent)]">Variant A</div>
        <div className="text-center font-medium text-purple-400">Variant B</div>
        {metrics.map((m) => (
          <>
            <div key={m.label} className="text-[var(--text-secondary)] py-2">{m.label}</div>
            <div className="text-center font-medium tabular-nums py-2">{String(m.a)}</div>
            <div className="text-center font-medium tabular-nums py-2">{String(m.b)}</div>
          </>
        ))}
      </div>
    </div>
  );
}

export default function OutreachPage() {
  const [statusFilter, setStatusFilter] = useState("alle");
  const { data, isLoading } = useOutreach(statusFilter);

  if (isLoading) {
    return (
      <PageTransition>
        <div className="p-6 space-y-6 max-w-6xl">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </PageTransition>
    );
  }

  const kpis = data?.kpis;
  const sequenties = data?.sequenties ?? [];

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-6xl">
        <h1 className="text-3xl font-bold">Email Outreach</h1>

        {/* KPIs */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Verstuurd" value={kpis.verstuurd} icon={<Mail className="w-5 h-5" />} color="accent" index={0} />
            <KPICard label="Open Rate" value={Math.round(kpis.openRate * 10) / 10} format={(n) => `${n}%`} icon={<Eye className="w-5 h-5" />} color="purple" index={1} />
            <KPICard label="Click Rate" value={Math.round(kpis.clickRate * 10) / 10} format={(n) => `${n}%`} icon={<MousePointerClick className="w-5 h-5" />} color="blue" index={2} />
            <KPICard label="Reply Rate" value={Math.round(kpis.replyRate * 10) / 10} format={(n) => `${n}%`} icon={<MessageSquare className="w-5 h-5" />} color="emerald" index={3} />
          </div>
        )}

        {/* Funnel + A/B */}
        {kpis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConversionFunnel kpis={kpis} />
            <ABComparison sequenties={sequenties} />
          </div>
        )}

        {/* Filter + Sequenties List */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-4 h-4 text-[var(--text-tertiary)]" />
            {["alle", "actief", "voltooid", "gestopt", "draft"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                }`}
              >
                {s === "alle" ? "Alle" : statusConfig[s]?.label ?? s}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {sequenties.length === 0 && (
              <div className="bg-[var(--card)] rounded-xl p-8 border border-[var(--border)] text-center">
                <AlertTriangle className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-[var(--text-secondary)]">Nog geen outreach sequenties</p>
              </div>
            )}
            {sequenties.map((seq) => {
              const status = statusConfig[seq.status] ?? { label: seq.status, kleur: "text-gray-400 bg-gray-400/10" };
              return (
                <Link
                  key={seq.id}
                  href={`/outreach/${seq.id}`}
                  className="flex items-center gap-4 bg-[var(--card)] rounded-xl p-4 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-4 h-4 text-[var(--text-tertiary)]" />
                      <span className="font-medium truncate">{seq.bedrijfsnaam ?? "Onbekend"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.kleur}`}>
                        {status.label}
                      </span>
                      {seq.abVariant && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--border)]/30 text-[var(--text-tertiary)]">
                          {seq.abVariant.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
                      <span>{seq.email}</span>
                      {seq.aangemaaktOp && <span>{formatDatum(seq.aangemaaktOp)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-[var(--text-secondary)] tabular-nums">
                    <div className="text-center">
                      <p className="font-medium text-sm">{seq.verstuurd}</p>
                      <p>verstuurd</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-sm">{seq.geopend}</p>
                      <p>geopend</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-sm">{seq.beantwoord}</p>
                      <p>replies</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
