"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSalesEngineScans, useSalesEngineBatch } from "@/hooks/queries/use-sales-engine";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDatum } from "@/lib/utils";
import {
  Rocket,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Zap,
  Search,
  ChevronDown,
  ChevronUp,
  Target,
  BarChart3,
  Loader2,
  Upload,
  X,
  FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  pending: { label: "Bezig", kleur: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  completed: { label: "Voltooid", kleur: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  failed: { label: "Mislukt", kleur: "text-red-400 bg-red-400/10", icon: AlertCircle },
};

const impactConfig: Record<string, string> = {
  hoog: "text-emerald-400 bg-emerald-400/10",
  midden: "text-yellow-400 bg-yellow-400/10",
  laag: "text-[var(--text-tertiary)] bg-[var(--border)]/30",
};

function parseCsvInput(text: string): Array<{ bedrijfsnaam: string; websiteUrl: string }> {
  const lines = text.trim().split("\n").filter((l) => l.trim());
  const results: Array<{ bedrijfsnaam: string; websiteUrl: string }> = [];
  for (const line of lines) {
    const parts = line.includes(";") ? line.split(";") : line.split(",");
    if (parts.length >= 2) {
      const bedrijfsnaam = parts[0].trim();
      let websiteUrl = parts[1].trim();
      if (bedrijfsnaam && websiteUrl) {
        if (!websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
          websiteUrl = `https://${websiteUrl}`;
        }
        results.push({ bedrijfsnaam, websiteUrl });
      }
    }
  }
  return results;
}

function BatchScanModal({ onClose }: { onClose: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: batchStatus } = useSalesEngineBatch(activeBatchId);
  const parsed = parseCsvInput(csvText);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") setCsvText(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") setCsvText(text);
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = async () => {
    if (parsed.length === 0) { setError("Geen geldige bedrijven gevonden"); return; }
    if (parsed.length > 20) { setError("Maximaal 20 bedrijven per batch"); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sales-engine/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedrijven: parsed }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.fout ?? "Batch starten mislukt");
      }
      const data = await res.json();
      setActiveBatchId(data.batchId);
      void queryClient.invalidateQueries({ queryKey: ["sales-engine-scans"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allDone = batchStatus && batchStatus.pending === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-xl font-bold">Batch scan</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--border)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {!activeBatchId ? (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                Voer bedrijven in als CSV (bedrijfsnaam,website per regel) of sleep een CSV-bestand hierheen.
              </p>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Sleep een CSV-bestand hierheen of klik om te uploaden</p>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"Bedrijf A,https://bedrijfa.nl\nBedrijf B,https://bedrijfb.nl\nBedrijf C,https://bedrijfc.nl"}
                rows={8}
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 text-sm font-mono placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 resize-y"
              />
              {parsed.length > 0 && (
                <div className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)]">
                  <p className="text-sm font-medium mb-2">
                    {parsed.length} bedrijven herkend
                    {parsed.length > 20 && <span className="text-red-400 ml-2">(max 20)</span>}
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {parsed.slice(0, 20).map((b, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-primary)]">{b.bedrijfsnaam}</span>
                        <span className="text-[var(--text-tertiary)]">{b.websiteUrl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--border)] hover:bg-[var(--border)]/80 transition-colors">Annuleren</button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || parsed.length === 0 || parsed.length > 20}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Starten...</>
                  ) : (
                    <><Rocket className="w-4 h-4" />{parsed.length} scans starten</>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                {allDone ? <CheckCircle className="w-6 h-6 text-emerald-400" /> : <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />}
                <h3 className="text-lg font-semibold">{allDone ? "Batch voltooid" : "Batch wordt verwerkt..."}</h3>
              </div>
              {batchStatus && (
                <>
                  <div className="bg-[var(--bg)] rounded-full h-3 overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all duration-500 ease-out rounded-full" style={{ width: `${Math.round(((batchStatus.completed + batchStatus.failed) / batchStatus.totaal) * 100)}%` }} />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-400">{batchStatus.completed} voltooid</span>
                    <span className="text-yellow-400">{batchStatus.pending} wachtend</span>
                    {batchStatus.failed > 0 && <span className="text-red-400">{batchStatus.failed} mislukt</span>}
                    <span className="text-[var(--text-secondary)]">{batchStatus.totaal} totaal</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {batchStatus.scans.map((scan) => {
                      const cfg = statusConfig[scan.status] ?? statusConfig.pending;
                      const Icon = cfg.icon;
                      return (
                        <div key={scan.id} className="flex items-center justify-between bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.kleur.split(" ")[0]}`} />
                            <span className="font-medium text-sm truncate">{scan.bedrijfsnaam}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.kleur}`}>{cfg.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => { void queryClient.invalidateQueries({ queryKey: ["sales-engine-scans"] }); onClose(); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
                >
                  {allDone ? "Sluiten" : "Op achtergrond draaien"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScanFormulier({ prominent = false }: { prominent?: boolean }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactpersoon, setContactpersoon] = useState("");
  const [email, setEmail] = useState("");
  const [meerInfoOpen, setMeerInfoOpen] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bedrijfsnaam.trim() || !websiteUrl.trim()) return;

    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    setIsScanning(true);
    try {
      const res = await fetch("/api/sales-engine/handmatig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedrijfsnaam: bedrijfsnaam.trim(),
          websiteUrl: url,
          ...(contactpersoon.trim() ? { contactpersoon: contactpersoon.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.fout || "Scan mislukt", "fout");
        if (data.scanId) {
          router.push(`/sales-engine/${data.scanId}`);
        }
        return;
      }

      addToast(`Scan voltooid: ${data.aantalKansen} kansen gevonden`, "succes");
      router.push(`/sales-engine/${data.scanId}`);
    } catch {
      addToast("Er ging iets mis bij het starten van de scan", "fout");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className={`bg-[var(--card)] rounded-xl border border-[var(--border)] ${prominent ? "p-8" : "p-5"}`}>
      <div className="flex items-center gap-2 mb-4">
        <Search className={`text-[var(--accent)] ${prominent ? "w-6 h-6" : "w-5 h-5"}`} />
        <h2 className={`font-semibold ${prominent ? "text-xl" : "text-lg"}`}>Scan bedrijf</h2>
      </div>
      {prominent && (
        <p className="text-[var(--text-secondary)] text-sm mb-5">
          Voer een bedrijfsnaam en website in om automatisch automatiseringskansen te identificeren.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Bedrijfsnaam *</label>
            <input
              type="text"
              value={bedrijfsnaam}
              onChange={(e) => setBedrijfsnaam(e.target.value)}
              placeholder="Bijv. Bakkerij van Dam"
              disabled={isScanning}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Website URL *</label>
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://voorbeeld.nl"
              disabled={isScanning}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMeerInfoOpen(!meerInfoOpen)}
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-1"
        >
          {meerInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Meer info (optioneel)
        </button>

        {meerInfoOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Contactpersoon</label>
              <input
                type="text"
                value={contactpersoon}
                onChange={(e) => setContactpersoon(e.target.value)}
                placeholder="Naam contactpersoon"
                disabled={isScanning}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@voorbeeld.nl"
                disabled={isScanning}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isScanning || !bedrijfsnaam.trim() || !websiteUrl.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Bezig met scannen...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              Start scan
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function SalesEnginePage() {
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const { data, isLoading } = useSalesEngineScans(statusFilter);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const scans = data?.scans ?? [];
  const kpis = data?.kpis;

  // Berekende KPIs
  const completedScans = scans.filter((s) => s.status === "completed");
  const dezeMaand = scans.filter((s) => {
    if (!s.aangemaaktOp) return false;
    const maandGeleden = new Date();
    maandGeleden.setDate(1);
    maandGeleden.setHours(0, 0, 0, 0);
    return s.aangemaaktOp >= maandGeleden.toISOString();
  }).length;

  const totaalKansen = scans.reduce((sum, s) => sum + s.aantalKansen, 0);
  const gemiddeldeKansen = completedScans.length > 0
    ? Math.round(totaalKansen / completedScans.length * 10) / 10
    : 0;

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="w-8 h-8 text-[var(--accent)]" />
            <h1 className="text-3xl font-bold">Sales Engine</h1>
          </div>
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Batch scan
          </button>
        </div>

        {/* Scan Formulier */}
        <ScanFormulier prominent={scans.length === 0} />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
              <span className="text-sm text-[var(--text-secondary)]">Deze week</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{kpis?.dezeWeek ?? 0}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {dezeMaand} deze maand
            </p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-[var(--text-secondary)]">Succesratio</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{kpis?.succesRatio ?? 0}%</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              {completedScans.length} van {kpis?.totaal ?? 0} scans voltooid
            </p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-[var(--text-secondary)]">Totaal kansen</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">{totaalKansen}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              gem. {gemiddeldeKansen} per scan
            </p>
          </div>
          <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-[var(--text-secondary)]">Hoge impact</span>
            </div>
            <p className="text-3xl font-bold tabular-nums">
              {scans.filter((s) => s.hoogsteImpact === "hoog").length}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              scans met hoge-impact kansen
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {["alle", "completed", "pending", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--card)] text-[var(--text-secondary)] hover:bg-[var(--card-hover)]"
              }`}
            >
              {s === "alle" ? "Alle" : statusConfig[s]?.label ?? s}
            </button>
          ))}
        </div>

        {/* Scan List */}
        {scans.length === 0 ? (
          <div className="bg-[var(--card)] rounded-xl p-12 text-center border border-[var(--border)]">
            <Rocket className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Nog geen scans</p>
            <p className="text-[var(--text-secondary)] text-sm">
              Gebruik het formulier hierboven om je eerste bedrijfsscan te starten, of scans worden automatisch aangemaakt via Cal.com.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map((scan) => {
              const status = statusConfig[scan.status] ?? statusConfig.pending;
              const StatusIcon = status.icon;

              return (
                <Link
                  key={scan.id}
                  href={`/sales-engine/${scan.id}`}
                  className="block bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all card-glow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-lg truncate">
                          {scan.bedrijfsnaam ?? "Onbekend bedrijf"}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.kleur}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                        {scan.hoogsteImpact && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              impactConfig[scan.hoogsteImpact] ?? ""
                            }`}
                          >
                            {scan.hoogsteImpact} impact
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                          <ExternalLink className="w-3.5 h-3.5" />
                          {(() => {
                            try {
                              return new URL(scan.websiteUrl).hostname;
                            } catch {
                              return scan.websiteUrl;
                            }
                          })()}
                        </span>
                        {scan.contactpersoon && <span>{scan.contactpersoon}</span>}
                        {scan.aantalKansen > 0 && (
                          <span>{scan.aantalKansen} kansen gevonden</span>
                        )}
                        {scan.aangemaaktOp && (
                          <span>{formatDatum(scan.aangemaaktOp)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {/* Batch Modal */}
        {showBatchModal && <BatchScanModal onClose={() => setShowBatchModal(false)} />}
      </div>
    </PageTransition>
  );
}
