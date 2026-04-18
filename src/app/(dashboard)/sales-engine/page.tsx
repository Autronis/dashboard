"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSalesEngineScans, useSalesEngineBatch } from "@/hooks/queries/use-sales-engine";
import { useScanQueue } from "./_components/use-scan-queue";
import { QueueList } from "./_components/QueueList";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDatum } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, TrendingUp, CheckCircle, AlertCircle, Clock, ExternalLink,
  Search, ChevronDown, ChevronUp, Target, BarChart3, Loader2, Upload, X,
  FileSpreadsheet, Euro, Plus, ArrowUpDown, Zap, ChevronRight, Send,
} from "lucide-react";
import Link from "next/link";

const statusConfig: Record<string, { label: string; kleur: string; icon: typeof Clock }> = {
  pending: { label: "Bezig", kleur: "text-yellow-400 bg-yellow-400/10", icon: Clock },
  completed: { label: "Voltooid", kleur: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  failed: { label: "Mislukt", kleur: "text-red-400 bg-red-400/10", icon: AlertCircle },
};

const impactGlow: Record<string, string> = {
  hoog: "shadow-[0_0_10px_rgba(52,211,153,0.25)]",
  midden: "shadow-[0_0_8px_rgba(251,191,36,0.2)]",
  laag: "",
};

const impactConfig: Record<string, string> = {
  hoog: "text-emerald-400 bg-emerald-400/10",
  midden: "text-yellow-400 bg-yellow-400/10",
  laag: "text-[var(--text-tertiary)] bg-[var(--border)]/30",
};

const impactOrder: Record<string, number> = { hoog: 0, midden: 1, laag: 2 };

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start: number | null = null;
    let rafId: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return value;
}

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

function BatchScanModal({ onClose, initialCsv = "" }: { onClose: () => void; initialCsv?: string }) {
  const [csvText, setCsvText] = useState(initialCsv);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
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
    setIsDragOver(false);
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
  const progress = batchStatus ? Math.round(((batchStatus.completed + batchStatus.failed) / batchStatus.totaal) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="bg-[var(--card)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
      >
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
              <motion.div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                animate={isDragOver ? { scale: 1.02, borderColor: "var(--accent)" } : { scale: 1 }}
                transition={{ duration: 0.15 }}
                className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDragOver ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                <p className="text-sm text-[var(--text-secondary)]">Sleep een CSV-bestand hierheen of klik om te uploaden</p>
                <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </motion.div>
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
                    <motion.div
                      className="h-full bg-[var(--accent)] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-400">{batchStatus.completed} voltooid</span>
                    <span className="text-yellow-400">{batchStatus.pending} wachtend</span>
                    {batchStatus.failed > 0 && <span className="text-red-400">{batchStatus.failed} mislukt</span>}
                    <span className="text-[var(--text-secondary)]">{batchStatus.totaal} totaal</span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {batchStatus.scans.map((scan, i) => {
                      const cfg = statusConfig[scan.status] ?? statusConfig.pending;
                      const Icon = cfg.icon;
                      return (
                        <motion.div
                          key={scan.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.25 }}
                          className="flex items-center justify-between bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.kleur.split(" ")[0]}`} />
                            <span className="font-medium text-sm truncate">{scan.bedrijfsnaam}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.kleur}`}>{cfg.label}</span>
                        </motion.div>
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
      </motion.div>
    </div>
  );
}

// ─── Compact Scan Form (inline at top when scans exist) ───
function CompactScanForm({ onStarted }: { onStarted: (scanId: number) => void }) {
  const { addToast } = useToast();
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bedrijfsnaam.trim() || !websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
    setIsScanning(true);
    try {
      const res = await fetch("/api/sales-engine/handmatig", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedrijfsnaam: bedrijfsnaam.trim(), websiteUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) { addToast(data.fout || "Scan starten mislukt", "fout"); return; }
      onStarted(data.scanId);
    } catch {
      addToast("Er ging iets mis bij het starten van de scan", "fout");
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={bedrijfsnaam}
        onChange={(e) => setBedrijfsnaam(e.target.value)}
        placeholder="Bedrijfsnaam"
        disabled={isScanning}
        className="flex-1 min-w-36 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/60 transition-colors disabled:opacity-50"
      />
      <input
        type="text"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        placeholder="https://website.nl"
        disabled={isScanning}
        className="flex-1 min-w-44 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent/60 transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isScanning || !bedrijfsnaam.trim() || !websiteUrl.trim()}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg text-sm font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {isScanning ? "Scannen..." : "Scan"}
      </button>
    </form>
  );
}

// ─── Full Scan Form (empty state) ───
function ScanFormulier({ prominent = false }: { prominent?: boolean }) {
  const router = useRouter();
  const { addToast } = useToast();
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactpersoon, setContactpersoon] = useState("");
  const [email, setEmail] = useState("");
  const [meerInfoOpen, setMeerInfoOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bedrijfsnaam.trim() || !websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
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
      if (!res.ok) { addToast(data.fout || "Scan starten mislukt", "fout"); setIsScanning(false); return; }
      router.push(`/sales-engine/${data.scanId}`);
    } catch {
      addToast("Er ging iets mis bij het starten van de scan", "fout");
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
            <input type="text" value={bedrijfsnaam} onChange={(e) => setBedrijfsnaam(e.target.value)} placeholder="Bijv. Bakkerij van Dam" disabled={isScanning} autoFocus={prominent}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Website URL *</label>
            <input type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://voorbeeld.nl" disabled={isScanning}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50" />
          </div>
        </div>

        <button type="button" onClick={() => setMeerInfoOpen(!meerInfoOpen)}
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mt-1">
          {meerInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Meer info (optioneel)
        </button>

        <AnimatePresence initial={false}>
          {meerInfoOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1.5">Contactpersoon</label>
                  <input type="text" value={contactpersoon} onChange={(e) => setContactpersoon(e.target.value)} placeholder="Naam contactpersoon" disabled={isScanning}
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50" />
                </div>
                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1.5">E-mailadres</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@voorbeeld.nl" disabled={isScanning}
                    className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={isScanning || !bedrijfsnaam.trim() || !websiteUrl.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
          {isScanning ? <><Loader2 className="w-4 h-4 animate-spin" />Scan starten...</> : <><Rocket className="w-4 h-4" />Start scan</>}
        </button>
      </form>
    </div>
  );
}

// ─── KPI Card ───
function KpiCard({ icon: Icon, iconKleur, label, value, sub, suffix = "", delay = 0 }: {
  icon: typeof TrendingUp; iconKleur: string; label: string; value: number; sub: string; suffix?: string; delay?: number;
}) {
  const animated = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
    >
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${iconKleur}`} />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums">{animated}{suffix}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</p>
    </motion.div>
  );
}

type SortOption = "nieuwst" | "kansen" | "impact";

export default function SalesEnginePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    items: queueItems,
    remove: removeFromQueue,
    clear: clearQueue,
    resetDismissed: resetQueueDismissed,
    autoFillLoading,
  } = useScanQueue();

  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [zoekFilter, setZoekFilter] = useState("");
  const [sorteer, setSorteer] = useState<SortOption>("nieuwst");
  const [sorteerOpen, setSorteerOpen] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [scanFormOpen, setScanFormOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useSalesEngineScans(statusFilter);

  // Auto-close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSorteerOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-refresh when pending scans exist
  const allScans = data?.scans ?? [];
  const hasPending = allScans.some((s) => s.status === "pending");
  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ["sales-engine-scans"] });
    }, 5000);
    return () => clearInterval(interval);
  }, [hasPending, queryClient]);

  // useMemo MUST be before any early return to satisfy React hooks rules
  const gefilterd = useMemo(() => {
    let result = statusFilter === "alle" ? allScans : allScans.filter((s) => s.status === statusFilter);
    if (zoekFilter.trim()) result = result.filter((s) => s.bedrijfsnaam?.toLowerCase().includes(zoekFilter.toLowerCase()));
    if (sorteer === "kansen") return [...result].sort((a, b) => b.aantalKansen - a.aantalKansen);
    if (sorteer === "impact") return [...result].sort((a, b) => (impactOrder[a.hoogsteImpact ?? ""] ?? 3) - (impactOrder[b.hoogsteImpact ?? ""] ?? 3));
    return result;
  }, [allScans, statusFilter, zoekFilter, sorteer]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const completedScans = allScans.filter((s) => s.status === "completed");

  const dezeMaand = allScans.filter((s) => {
    if (!s.aangemaaktOp) return false;
    const maandStart = new Date();
    maandStart.setDate(1);
    maandStart.setHours(0, 0, 0, 0);
    return s.aangemaaktOp >= maandStart.toISOString();
  }).length;

  const totaalKansen = allScans.reduce((sum, s) => sum + s.aantalKansen, 0);
  const gemiddeldeKansen = completedScans.length > 0 ? Math.round((totaalKansen / completedScans.length) * 10) / 10 : 0;
  const pipelineWaarde = completedScans.reduce((sum, s) => {
    if (s.hoogsteImpact === "hoog") return sum + 4000;
    if (s.hoogsteImpact === "midden") return sum + 1500;
    return sum + 500;
  }, 0);

  // Filter counts for badge
  const filterCounts: Record<string, number> = {
    alle: allScans.length,
    completed: allScans.filter((s) => s.status === "completed").length,
    pending: allScans.filter((s) => s.status === "pending").length,
    failed: allScans.filter((s) => s.status === "failed").length,
  };

  const sortLabels: Record<SortOption, string> = { nieuwst: "Nieuwst", kansen: "Meeste kansen", impact: "Hoogste impact" };

  const hasScans = allScans.length > 0;

  return (
    <PageTransition>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="w-7 h-7 text-[var(--accent)]" />
            <div>
              <h1 className="text-2xl font-bold">Sales Engine</h1>
              {hasScans && (
                <p className="text-xs text-[var(--text-secondary)]">
                  {allScans.length} scans &middot; {completedScans.length} voltooid
                  {hasPending && <span className="ml-1.5 inline-flex items-center gap-1 text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />{filterCounts.pending} bezig</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasScans && (
              <button
                onClick={() => setScanFormOpen((o) => !o)}
                className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
                  scanFormOpen ? "border-autronis-accent/50 bg-autronis-accent/10 text-autronis-accent" : "border-autronis-border text-autronis-text-secondary hover:border-autronis-border/80"
                )}
              >
                <Plus className="w-4 h-4" />
                Nieuwe scan
              </button>
            )}
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Batch scan
            </button>
          </div>
        </div>

        {/* Compact scan form when scans exist */}
        <AnimatePresence initial={false}>
          {hasScans && scanFormOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="bg-autronis-card border border-autronis-accent/20 rounded-xl p-4">
                <CompactScanForm
                  onStarted={(id) => { setScanFormOpen(false); router.push(`/sales-engine/${id}`); }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full form for empty state */}
        {!hasScans && queueItems.length === 0 && <ScanFormulier prominent />}

        {/* Queue list — leads aangedragen vanuit /leads, /contacts, /website-leads, /klanten (+ auto-fill van alle niet-gescand) */}
        <QueueList
          items={queueItems}
          onRemove={removeFromQueue}
          onClear={clearQueue}
          onResetDismissed={resetQueueDismissed}
          autoFillLoading={autoFillLoading}
        />

        {/* KPI Cards */}
        {hasScans && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={TrendingUp} iconKleur="text-[var(--accent)]" label="Deze week" value={kpis?.dezeWeek ?? 0} sub={`${dezeMaand} deze maand`} delay={0} />
            <KpiCard icon={CheckCircle} iconKleur="text-emerald-400" label="Succesratio" value={kpis?.succesRatio ?? 0} suffix="%" sub={`${completedScans.length} van ${kpis?.totaal ?? 0} scans voltooid`} delay={0.06} />
            <KpiCard icon={Target} iconKleur="text-purple-400" label="Totaal kansen" value={totaalKansen} sub={`gem. ${gemiddeldeKansen} per scan`} delay={0.12} />
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"
            >
              <div className="flex items-center gap-3 mb-2">
                <Euro className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-[var(--text-secondary)]">Pipeline waarde</span>
              </div>
              <p className="text-3xl font-bold tabular-nums">€{pipelineWaarde.toLocaleString("nl-NL")}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">schatting op basis van kansen</p>
            </motion.div>
          </div>
        )}

        {/* Scan List */}
        {hasScans && (
          <>
            {/* Filter + search + sort bar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status filter pills */}
              <div className="flex items-center gap-0.5 bg-autronis-card border border-autronis-border rounded-lg p-0.5">
                {(["alle", "completed", "pending", "failed"] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                      statusFilter === s ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    )}>
                    {s === "alle" ? "Alle" : statusConfig[s]?.label ?? s}
                    {filterCounts[s] > 0 && (
                      <span className={cn("text-[10px] font-bold tabular-nums px-1 py-0.5 rounded-full",
                        statusFilter === s ? "bg-white/20 text-white" : "bg-autronis-bg text-autronis-text-secondary"
                      )}>
                        {filterCounts[s]}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-36 max-w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-autronis-text-secondary/50" />
                <input
                  type="text"
                  value={zoekFilter}
                  onChange={(e) => setZoekFilter(e.target.value)}
                  placeholder="Zoek bedrijf..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-autronis-card border border-autronis-border text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-autronis-accent/50"
                />
                {zoekFilter && (
                  <button onClick={() => setZoekFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-autronis-text-secondary/50 hover:text-autronis-text-secondary transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative ml-auto" ref={sortRef}>
                <button
                  onClick={() => setSorteerOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs text-autronis-text-secondary hover:text-autronis-text-primary px-3 py-1.5 rounded-lg border border-autronis-border/50 hover:border-autronis-border transition-colors"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortLabels[sorteer]}
                  <ChevronDown className="h-3 w-3" />
                </button>
                <AnimatePresence>
                  {sorteerOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 bg-autronis-card border border-autronis-border rounded-xl shadow-xl z-10 overflow-hidden min-w-[140px]"
                    >
                      {(["nieuwst", "kansen", "impact"] as SortOption[]).map((opt) => (
                        <button key={opt} onClick={() => { setSorteer(opt); setSorteerOpen(false); }}
                          className={cn("w-full text-left px-3 py-2 text-xs transition-colors",
                            sorteer === opt ? "text-autronis-accent bg-autronis-accent/10" : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                          )}>
                          {sortLabels[opt]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {gefilterd.length === 0 ? (
              <div className="bg-[var(--card)] rounded-xl p-8 text-center border border-[var(--border)]">
                <Search className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-3" />
                <p className="text-sm text-[var(--text-secondary)]">Geen scans gevonden voor deze filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {gefilterd.map((scan, i) => {
                    const status = statusConfig[scan.status] ?? statusConfig.pending;
                    const StatusIcon = status.icon;
                    const isPending = scan.status === "pending";

                    return (
                      <motion.div
                        key={scan.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="group relative"
                      >
                        <Link
                          href={`/sales-engine/${scan.id}`}
                          className={cn(
                            "block bg-[var(--card)] rounded-xl px-5 py-4 border transition-all card-glow",
                            isPending
                              ? "border-yellow-400/20 hover:border-yellow-400/40"
                              : "border-[var(--border)] hover:border-[var(--accent)]/30"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                                <h3 className="font-semibold text-base truncate">
                                  {scan.bedrijfsnaam ?? "Onbekend bedrijf"}
                                </h3>
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", status.kleur)}>
                                  <StatusIcon className={cn("w-3 h-3", isPending && "animate-spin")} />
                                  {status.label}
                                </span>
                                {scan.hoogsteImpact && (
                                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0", impactConfig[scan.hoogsteImpact] ?? "", impactGlow[scan.hoogsteImpact] ?? "")}>
                                    {scan.hoogsteImpact} impact
                                  </span>
                                )}
                                {isPending && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400/60">
                                    <span className="w-1 h-1 rounded-full bg-yellow-400 animate-pulse" />scanning...
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] flex-wrap">
                                <span className="flex items-center gap-1">
                                  <ExternalLink className="w-3 h-3" />
                                  {(() => { try { return new URL(scan.websiteUrl).hostname; } catch { return scan.websiteUrl; } })()}
                                </span>
                                {scan.contactpersoon && <span>{scan.contactpersoon}</span>}
                                {scan.aantalKansen > 0 && (
                                  <span className="flex items-center gap-1 text-[var(--accent)] font-medium">
                                    <Zap className="w-3 h-3" />{scan.aantalKansen} kansen
                                  </span>
                                )}
                                {scan.aangemaaktOp && <span>{formatDatum(scan.aangemaaktOp)}</span>}
                              </div>
                            </div>

                            {/* Quick actions — hover reveal */}
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {scan.status === "completed" && scan.aantalKansen > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    router.push(`/outreach?scanId=${scan.id}`);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-autronis-accent/15 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/25 transition-colors"
                                  title="Start outreach"
                                >
                                  <Send className="w-3 h-3" />
                                  Outreach
                                </button>
                              )}
                              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-autronis-bg text-autronis-text-secondary text-xs hover:bg-autronis-border/50 transition-colors">
                                Details <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>

                          {/* Pending progress bar */}
                          {isPending && (
                            <div className="mt-3 h-0.5 bg-autronis-bg rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-yellow-400/50 rounded-full"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                                style={{ width: "40%" }}
                              />
                            </div>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!hasScans && (
          <div className="bg-[var(--card)] rounded-xl p-12 text-center border border-[var(--border)]">
            <Rocket className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Nog geen scans</p>
            <p className="text-[var(--text-secondary)] text-sm">
              Gebruik het formulier hierboven om je eerste bedrijfsscan te starten, of scans worden automatisch aangemaakt via Cal.com.
            </p>
          </div>
        )}

        {/* Batch Modal */}
        <AnimatePresence>
          {showBatchModal && (
            <BatchScanModal onClose={() => setShowBatchModal(false)} />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
