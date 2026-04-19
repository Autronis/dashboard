"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AlertOctagon,
  Flame,
  CheckCircle2,
  Loader2,
  Activity,
  ChevronDown,
  XCircle,
  Info,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePoll } from "@/lib/use-poll";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadsKpiTile } from "@/components/leads/kpi-tile";
import { SectionCard } from "@/components/leads/section-card";
import { RedactText } from "@/components/leads/redact-text";

type Severity = "info" | "warn" | "error" | "critical";

interface WorkflowError {
  id: string;
  created_at: string;
  severity: string;
  workflow_name: string | null;
  workflow_id: string;
  node_name: string;
  node_type: string | null;
  error_message: string;
  error_type: string | null;
  http_status: number | null;
  lead_id: string | null;
  execution_id: string | null;
  retry_count: number | null;
  resolved_at: string | null;
  context: unknown;
}

interface Hotspot {
  node_name: string;
  total: number;
}

interface ErrorsResponse {
  errors: WorkflowError[];
  hotspots: Hotspot[];
  totals: { last24h: number; critical24h: number; unresolved: number };
}

const SEVERITY_STYLES: Record<
  Severity,
  { label: string; icon: typeof AlertTriangle; cls: string }
> = {
  info: { label: "Info", icon: Info, cls: "bg-blue-500/15 text-blue-300 ring-blue-500/25" },
  warn: { label: "Warn", icon: AlertCircle, cls: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/25" },
  error: { label: "Error", icon: XCircle, cls: "bg-orange-500/15 text-orange-300 ring-orange-500/25" },
  critical: { label: "Critical", icon: AlertOctagon, cls: "bg-red-500/15 text-red-300 ring-red-500/25" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const style =
    (SEVERITY_STYLES as Record<string, (typeof SEVERITY_STYLES)[Severity] | undefined>)[
      severity
    ] ?? {
      label: severity || "onbekend",
      icon: AlertCircle,
      cls: "bg-autronis-border/40 text-autronis-text-secondary ring-autronis-border",
    };
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full ring-1 ring-inset px-2 py-0.5",
        style.cls
      )}
    >
      <Icon className="w-3 h-3" />
      {style.label}
    </span>
  );
}

function tijdGeleden(iso: string): string {
  if (!iso) return "—";
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "zojuist";
  if (diffMin < 60) return `${diffMin}m geleden`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}u geleden`;
  return `${Math.floor(h / 24)}d geleden`;
}

function truncate(value: string | null, n: number): string {
  if (!value) return "—";
  return value.length > n ? `${value.slice(0, n)}…` : value;
}

export default function LeadsErrorsPage() {
  const { addToast } = useToast();
  const [errors, setErrors] = useState<WorkflowError[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [totals, setTotals] = useState<ErrorsResponse["totals"]>({
    last24h: 0,
    critical24h: 0,
    unresolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<"alle" | Severity>("alle");
  const [onlyUnresolved, setOnlyUnresolved] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const res = await fetch("/api/leads/workflow-errors");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.fout || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as ErrorsResponse;
        setErrors(data.errors ?? []);
        setHotspots(data.hotspots ?? []);
        setTotals(data.totals ?? { last24h: 0, critical24h: 0, unresolved: 0 });
        setError(null);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Onbekende fout");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const pollLoad = useCallback(() => load(true), [load]);
  usePoll(pollLoad, 15000);

  const filtered = useMemo(() => {
    return errors.filter((e) => {
      if (severityFilter !== "alle" && e.severity !== severityFilter) return false;
      if (onlyUnresolved && e.resolved_at) return false;
      return true;
    });
  }, [errors, severityFilter, onlyUnresolved]);

  const activeCount = (severityFilter !== "alle" ? 1 : 0) + (onlyUnresolved ? 0 : 1);

  function toggleExpand(id: string) {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function markResolved(id: string) {
    setResolvingIds((curr) => new Set(curr).add(id));
    try {
      const res = await fetch("/api/leads/workflow-errors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.fout || `HTTP ${res.status}`);
      }
      const now = new Date().toISOString();
      setErrors((curr) =>
        curr.map((e) => (e.id === id ? { ...e, resolved_at: now } : e))
      );
      setTotals((curr) => ({ ...curr, unresolved: Math.max(0, curr.unresolved - 1) }));
      addToast("Gemarkeerd als opgelost", "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Markeren mislukt", "fout");
    } finally {
      setResolvingIds((curr) => {
        const next = new Set(curr);
        next.delete(id);
        return next;
      });
    }
  }

  function resetFilters() {
    setSeverityFilter("alle");
    setOnlyUnresolved(true);
  }

  if (loading && errors.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-autronis-text-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Errors laden...
      </div>
    );
  }

  if (error && errors.length === 0) {
    return (
      <div className="space-y-7">
        <PageHeader title="Errors" description="Workflow errors van n8n — realtime gelogd" />
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-400">
          <p className="font-medium">Kon errors niet laden</p>
          <p className="mt-1 text-red-400/80">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title="Errors"
        description="Workflow errors van n8n — realtime gelogd"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <LeadsKpiTile
          icon={AlertTriangle}
          label="Errors last 24h"
          value={totals.last24h}
          accent="amber"
          index={0}
        />
        <LeadsKpiTile
          icon={AlertOctagon}
          label="Critical last 24h"
          value={totals.critical24h}
          accent="red"
          index={1}
        />
        <LeadsKpiTile
          icon={Flame}
          label="Onopgelost"
          value={totals.unresolved}
          accent="amber"
          sub={totals.unresolved === 0 ? "Geen openstaande errors" : undefined}
          index={2}
        />
        <LeadsKpiTile
          icon={CheckCircle2}
          label="Totaal (laatste 100)"
          value={errors.length}
          accent="cyan"
          sub={`${errors.filter((e) => e.resolved_at).length} opgelost`}
          index={3}
        />
      </div>

      <FilterBar
        filters={
          <>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
              className="bg-autronis-card border border-autronis-border rounded-xl px-3 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
            >
              <option value="alle">Alle severity</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
            <label className="inline-flex items-center gap-2 text-xs text-autronis-text-primary px-3 py-2 rounded-xl bg-autronis-card border border-autronis-border cursor-pointer hover:border-autronis-border-hover transition-colors">
              <input
                type="checkbox"
                checked={onlyUnresolved}
                onChange={(e) => setOnlyUnresolved(e.target.checked)}
                className="accent-autronis-accent"
              />
              Alleen onopgelost
            </label>
          </>
        }
        activeCount={activeCount}
        onClear={resetFilters}
      />

      <SectionCard
        title="Errors"
        icon={AlertTriangle}
        aside={
          <span className="text-xs text-autronis-text-secondary/70 tabular-nums">
            {filtered.length} / {errors.length}
          </span>
        }
        padding="none"
      >
        {filtered.length === 0 ? (
          <EmptyState
            titel="Geen errors"
            beschrijving={
              errors.length === 0
                ? "Geen workflow errors gelogd. Alles draait soepel."
                : "Geen errors matchen je filter. Pas severity of 'onopgelost' aan."
            }
            icoon={<CheckCircle2 className="h-7 w-7 text-emerald-400" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-autronis-border">
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Tijd
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Severity
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Workflow
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Node
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Bericht
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Lead
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-autronis-text-secondary">
                    Actie
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((err, i) => {
                  const isExpanded = expanded.has(err.id);
                  const isResolving = resolvingIds.has(err.id);
                  return (
                    <motion.tr
                      key={err.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 20) * 0.02, duration: 0.2 }}
                      className="border-b border-autronis-border/50 hover:bg-autronis-accent/[0.03] transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-autronis-text-secondary whitespace-nowrap">
                        {tijdGeleden(err.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={err.severity} />
                      </td>
                      <td className="px-4 py-3 text-xs text-autronis-text-primary whitespace-nowrap max-w-[180px] truncate">
                        {err.workflow_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-autronis-text-primary whitespace-nowrap max-w-[180px] truncate">
                        {err.node_name}
                        {err.node_type && (
                          <span className="block text-[10px] text-autronis-text-secondary/70 mt-0.5">
                            {err.node_type}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-autronis-text-secondary max-w-[420px]">
                        <button
                          type="button"
                          onClick={() => toggleExpand(err.id)}
                          className="text-left hover:text-autronis-text-primary transition-colors inline-flex items-start gap-1.5 w-full"
                          title={isExpanded ? "Inklappen" : "Uitklappen"}
                        >
                          <ChevronDown
                            className={cn(
                              "w-3 h-3 flex-shrink-0 mt-0.5 transition-transform",
                              isExpanded ? "rotate-180" : "-rotate-90"
                            )}
                          />
                          <RedactText>
                            {isExpanded ? (
                              <span className="whitespace-pre-wrap break-words">
                                {err.error_message || "—"}
                              </span>
                            ) : (
                              <span>{truncate(err.error_message, 100)}</span>
                            )}
                          </RedactText>
                        </button>
                        {isExpanded && (err.error_type || err.http_status || err.execution_id) && (
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-autronis-text-secondary/80">
                            {err.error_type && (
                              <>
                                <dt className="font-semibold">Type</dt>
                                <dd className="font-mono">{err.error_type}</dd>
                              </>
                            )}
                            {err.http_status !== null && err.http_status !== undefined && (
                              <>
                                <dt className="font-semibold">HTTP</dt>
                                <dd className="font-mono">{err.http_status}</dd>
                              </>
                            )}
                            {err.execution_id && (
                              <>
                                <dt className="font-semibold">Execution</dt>
                                <dd className="font-mono truncate">{err.execution_id}</dd>
                              </>
                            )}
                            {typeof err.retry_count === "number" && err.retry_count > 0 && (
                              <>
                                <dt className="font-semibold">Retries</dt>
                                <dd className="font-mono">{err.retry_count}</dd>
                              </>
                            )}
                          </dl>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-autronis-text-secondary whitespace-nowrap">
                        {err.lead_id ? (
                          <RedactText>
                            <span className="font-mono text-[11px]">{err.lead_id.slice(0, 8)}</span>
                          </RedactText>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {err.resolved_at ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Opgelost
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                            <Flame className="w-3.5 h-3.5" />
                            Open
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!err.resolved_at && (
                          <button
                            type="button"
                            onClick={() => markResolved(err.id)}
                            disabled={isResolving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            {isResolving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Markeer opgelost
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Hotspots"
        icon={Activity}
        subtitle="Top 10 nodes laatste 24 uur"
        aside={
          <span className="text-xs text-autronis-text-secondary/70 tabular-nums">
            {hotspots.length} nodes
          </span>
        }
      >
        {hotspots.length === 0 ? (
          <p className="text-sm text-autronis-text-secondary/70 py-2">
            Geen hotspots — alle nodes draaien clean.
          </p>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {hotspots.map((h, i) => {
                const maxTotal = hotspots[0]?.total || 1;
                const pct = Math.round((h.total / Math.max(1, maxTotal)) * 100);
                return (
                  <motion.div
                    key={h.node_name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-autronis-text-primary min-w-[160px] truncate font-medium">
                      {h.node_name}
                    </span>
                    <div className="flex-1 h-1.5 bg-autronis-bg rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + i * 0.04, duration: 0.6, ease: "easeOut" }}
                        className="h-full bg-amber-500/70 rounded-full"
                      />
                    </div>
                    <span className="text-xs tabular-nums text-autronis-text-secondary min-w-[70px] text-right">
                      {h.total}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
