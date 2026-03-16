"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Eye,
  TrendingUp,
  Minus,
  TrendingDown,
  ExternalLink,
  Trash2,
  Edit2,
  X,
  Loader2,
} from "lucide-react";
import { cn, formatDatum } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useConcurrenten,
  useCreateConcurrent,
  useUpdateConcurrent,
  useDeleteConcurrent,
  useStartScan,
  useScanStatus,
  type Concurrent,
} from "@/hooks/queries/use-concurrenten";

// ============ TREND BADGE ============

function TrendBadge({ trend }: { trend: string | null }) {
  if (!trend) return null;
  const config = {
    groeiend: { icon: TrendingUp, label: "Groeiend", cls: "bg-green-500/15 text-green-400" },
    stabiel: { icon: Minus, label: "Stabiel", cls: "bg-yellow-500/15 text-yellow-400" },
    krimpend: { icon: TrendingDown, label: "Krimpend", cls: "bg-red-500/15 text-red-400" },
  }[trend];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", config.cls)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ============ SCAN PROGRESS ============

function ScanProgress() {
  const { data: status } = useScanStatus(true);
  if (!status?.actief) return null;

  return (
    <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5">
      <h3 className="mb-3 text-sm font-semibold">Scan bezig...</h3>
      <div className="space-y-2">
        {status.concurrenten.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-sm">
            {c.status === "voltooid" && <span className="text-green-400">✓</span>}
            {c.status === "bezig" && <Loader2 className="h-3.5 w-3.5 animate-spin text-autronis-accent" />}
            {c.status === "wachtend" && <span className="text-autronis-text-secondary">○</span>}
            {c.status === "mislukt" && <span className="text-red-400">✗</span>}
            <span className={cn(
              c.status === "bezig" && "text-autronis-accent",
              c.status === "mislukt" && "text-red-400",
              c.status === "wachtend" && "text-autronis-text-secondary",
            )}>
              {c.naam}
              {c.stap && <span className="ml-1 text-autronis-text-secondary">— {c.stap}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ CONCURRENT FORM MODAL ============

function ConcurrentFormModal({
  open,
  onClose,
  concurrent,
}: {
  open: boolean;
  onClose: () => void;
  concurrent?: Concurrent;
}) {
  const { addToast } = useToast();
  const createMutation = useCreateConcurrent();
  const updateMutation = useUpdateConcurrent();

  const [naam, setNaam] = useState(concurrent?.naam ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(concurrent?.websiteUrl ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(concurrent?.linkedinUrl ?? "");
  const [instagramHandle, setInstagramHandle] = useState(concurrent?.instagramHandle ?? "");
  const [notities, setNotities] = useState(concurrent?.notities ?? "");

  if (!open) return null;

  const isEdit = !!concurrent;
  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: concurrent!.id,
          naam,
          websiteUrl,
          linkedinUrl: linkedinUrl || undefined,
          instagramHandle: instagramHandle || undefined,
          notities: notities || undefined,
        });
        addToast("Concurrent bijgewerkt", "succes");
      } else {
        await createMutation.mutateAsync({
          naam,
          websiteUrl,
          linkedinUrl: linkedinUrl || undefined,
          instagramHandle: instagramHandle || undefined,
          notities: notities || undefined,
        });
        addToast("Concurrent toegevoegd", "succes");
      }
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout bij opslaan", "fout");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-autronis-border bg-autronis-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Concurrent bewerken" : "Concurrent toevoegen"}
          </h2>
          <button onClick={onClose} className="text-autronis-text-secondary hover:text-autronis-text-primary transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-autronis-text-secondary">Naam *</label>
            <input value={naam} onChange={(e) => setNaam(e.target.value)} required
              className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm" placeholder="Bedrijfsnaam" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-autronis-text-secondary">Website URL *</label>
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} required
              className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm" placeholder="https://example.nl" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-autronis-text-secondary">LinkedIn URL</label>
            <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
              className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm" placeholder="https://linkedin.com/company/..." />
          </div>
          <div>
            <label className="mb-1 block text-sm text-autronis-text-secondary">Instagram handle</label>
            <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)}
              className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm" placeholder="@handle" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-autronis-text-secondary">Notities</label>
            <textarea value={notities} onChange={(e) => setNotities(e.target.value)} rows={3}
              className="w-full rounded-lg border border-autronis-border bg-autronis-bg px-3 py-2 text-sm" placeholder="Optionele context over deze concurrent..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-autronis-border px-4 py-2 text-sm">Annuleren</button>
            <button type="submit" disabled={isPending}
              className="rounded-lg bg-autronis-accent px-4 py-2 text-sm font-semibold text-autronis-bg disabled:opacity-50">
              {isPending ? "Opslaan..." : isEdit ? "Bijwerken" : "Toevoegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ CONCURRENT CARD ============

function ConcurrentCard({ concurrent, onEdit, onDelete, onScan }: {
  concurrent: Concurrent; onEdit: () => void; onDelete: () => void; onScan: () => void;
}) {
  const scan = concurrent.laatsteScan;
  const highlights: string[] = scan?.aiHighlights ? JSON.parse(scan.aiHighlights) : [];

  return (
    <div className="card-glow rounded-2xl border border-autronis-border bg-autronis-card p-6 transition-colors">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">{concurrent.naam}</h3>
          <a href={concurrent.websiteUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-autronis-text-secondary hover:text-autronis-accent transition-colors">
            {concurrent.websiteUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <TrendBadge trend={scan?.trendIndicator ?? null} />
      </div>

      {scan?.aiSamenvatting && (
        <p className="mb-4 text-sm leading-relaxed text-autronis-text-secondary">{scan.aiSamenvatting}</p>
      )}

      {scan && (
        <div className="mb-4 flex flex-wrap gap-2">
          {scan.websiteChanges && (() => {
            const changes: Array<{ veranderd: boolean }> = JSON.parse(scan.websiteChanges);
            const count = changes.filter((c) => c.veranderd).length;
            return (
              <span className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
                count > 0 ? "bg-autronis-accent/15 text-autronis-accent" : "bg-autronis-border/50 text-autronis-text-secondary/60")}>
                🌐 {count > 0 ? `${count} wijzigingen` : "Geen wijzigingen"}
              </span>
            );
          })()}
          {scan.vacatures && (() => {
            const vacs: Array<{ titel: string }> = JSON.parse(scan.vacatures);
            return (
              <span className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
                vacs.length > 0 ? "bg-autronis-accent/15 text-autronis-accent" : "bg-autronis-border/50 text-autronis-text-secondary/60")}>
                💼 {vacs.length > 0 ? `${vacs.length} vacatures` : "0 vacatures"}
              </span>
            );
          })()}
          {scan.socialActivity && (
            <span className="rounded-md bg-autronis-border/50 px-2.5 py-1 text-xs font-medium text-autronis-text-secondary/60">📱 Social data</span>
          )}
        </div>
      )}

      {highlights.length > 0 && (
        <div className="mb-4 space-y-2">
          {highlights.slice(0, 2).map((h, i) => (
            <div key={i} className="rounded-lg border-l-2 border-autronis-accent bg-autronis-bg px-3 py-2 text-xs leading-relaxed">⚡ {h}</div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-autronis-text-secondary/60">
          {scan ? `Gescand: ${formatDatum(scan.aangemaaktOp ?? "")}` : "Nog niet gescand"}
        </span>
        <div className="flex gap-1.5">
          <Link href={`/concurrenten/${concurrent.id}`}
            className="rounded-lg bg-autronis-border/50 px-3 py-1.5 text-xs text-autronis-text-secondary hover:bg-white/5 transition-colors">
            Details →
          </Link>
          <button onClick={onScan} className="rounded-lg bg-autronis-border/50 px-3 py-1.5 text-xs text-autronis-text-secondary hover:bg-white/5 transition-colors">⟳ Scan</button>
          <button onClick={onEdit} className="rounded-lg bg-autronis-border/50 px-2 py-1.5 text-xs text-autronis-text-secondary hover:bg-white/5 transition-colors"><Edit2 className="h-3 w-3" /></button>
          <button onClick={onDelete} className="rounded-lg bg-autronis-border/50 px-2 py-1.5 text-xs text-red-400/60 hover:bg-red-500/10 transition-colors"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============

export default function ConcurrentenPage() {
  const { data, isLoading } = useConcurrenten();
  const [scanActive, setScanActive] = useState(false);
  const { data: scanStatus } = useScanStatus(scanActive);
  const startScan = useStartScan();
  const deleteMutation = useDeleteConcurrent();
  const { addToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editConcurrent, setEditConcurrent] = useState<Concurrent | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Stop polling when scan completes
  useEffect(() => {
    if (scanActive && scanStatus && !scanStatus.actief) {
      setScanActive(false);
    }
  }, [scanActive, scanStatus]);

  function handleScanAll() {
    startScan.mutate(undefined, {
      onSuccess: () => { addToast("Scan gestart", "succes"); setScanActive(true); },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  function handleScanOne(id: number) {
    startScan.mutate(id, {
      onSuccess: () => addToast("Scan gestart", "succes"),
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  function handleDelete(id: number) {
    deleteMutation.mutate(id, {
      onSuccess: () => { addToast("Concurrent verwijderd", "succes"); setConfirmDelete(null); },
      onError: (err) => addToast(err.message, "fout"),
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-autronis-border border-t-autronis-accent" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const concurrenten = data?.concurrenten ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Concurrenten</h1>
          <p className="text-sm text-autronis-text-secondary">AI-gestuurde competitor monitoring</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleScanAll} disabled={startScan.isPending || scanStatus?.actief}
            className="flex items-center gap-2 rounded-xl border border-autronis-accent/30 bg-autronis-accent/10 px-4 py-2.5 text-sm font-semibold text-autronis-accent hover:bg-autronis-accent/20 transition-colors disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", scanStatus?.actief && "animate-spin")} />
            Scan alles
          </button>
          <button onClick={() => { setEditConcurrent(undefined); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-autronis-accent px-4 py-2.5 text-sm font-semibold text-autronis-bg hover:bg-autronis-accent-hover transition-colors">
            <Plus className="h-4 w-4" />
            Concurrent
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5">
          <p className="text-xs text-autronis-text-secondary">Actieve concurrenten</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{kpis?.totaal ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5">
          <p className="text-xs text-autronis-text-secondary">Wijzigingen deze week</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-autronis-accent">{kpis?.wijzigingenDezeWeek ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5">
          <p className="text-xs text-autronis-text-secondary">Groeiend</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-green-400">{kpis?.groeiend ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-autronis-border bg-autronis-card p-5">
          <p className="text-xs text-autronis-text-secondary">Laatste scan</p>
          <p className="mt-1 text-base font-bold tabular-nums">{kpis?.laatsteScan ? formatDatum(kpis.laatsteScan) : "—"}</p>
        </div>
      </div>

      {scanStatus?.actief && <ScanProgress />}

      {concurrenten.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-autronis-border bg-autronis-card/50 py-16">
          <Eye className="mb-4 h-12 w-12 text-autronis-text-secondary/30" />
          <p className="text-autronis-text-secondary">Nog geen concurrenten toegevoegd</p>
          <button onClick={() => { setEditConcurrent(undefined); setModalOpen(true); }}
            className="mt-4 rounded-lg bg-autronis-accent px-4 py-2 text-sm font-semibold text-autronis-bg">
            Eerste concurrent toevoegen
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {concurrenten.map((c) => (
            <ConcurrentCard key={c.id} concurrent={c}
              onEdit={() => { setEditConcurrent(c); setModalOpen(true); }}
              onDelete={() => setConfirmDelete(c.id)}
              onScan={() => handleScanOne(c.id)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ConcurrentFormModal key={editConcurrent?.id ?? "new"} open={modalOpen}
          onClose={() => { setModalOpen(false); setEditConcurrent(undefined); }}
          concurrent={editConcurrent} />
      )}

      <ConfirmDialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}
        onBevestig={() => confirmDelete && handleDelete(confirmDelete)}
        titel="Concurrent verwijderen?" bericht="Deze concurrent wordt gedeactiveerd. Scan-historie blijft bewaard." />
    </div>
  );
}
