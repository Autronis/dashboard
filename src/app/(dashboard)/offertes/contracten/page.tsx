"use client";

import { useState, useCallback, useEffect } from "react";
import {
  FileText,
  Plus,
  Loader2,
  Shield,
  Handshake,
  Clock,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import Link from "next/link";

interface Contract {
  id: number;
  klantId: number;
  klantNaam: string | null;
  titel: string;
  type: string;
  status: string;
  aangemaaktOp: string;
}

interface Klant {
  id: number;
  bedrijfsnaam: string;
}

const TYPE_CONFIG: Record<string, { label: string; shortLabel: string; icon: typeof FileText; kleur: string; beschrijving: string }> = {
  samenwerkingsovereenkomst: {
    label: "Samenwerkingsovereenkomst",
    shortLabel: "Samenwerking",
    icon: Handshake,
    kleur: "#17B8A5",
    beschrijving: "Standaard freelance/agency samenwerkingsovereenkomst",
  },
  sla: {
    label: "SLA",
    shortLabel: "SLA",
    icon: Clock,
    kleur: "#3B82F6",
    beschrijving: "Service Level Agreement voor maandelijks onderhoud",
  },
  nda: {
    label: "NDA",
    shortLabel: "NDA",
    icon: Shield,
    kleur: "#A855F7",
    beschrijving: "Geheimhoudingsovereenkomst",
  },
};

const STATUS_LABELS: Record<string, { label: string; kleur: string }> = {
  concept: { label: "Concept", kleur: "bg-zinc-600 text-zinc-300" },
  verstuurd: { label: "Verstuurd", kleur: "bg-blue-500/20 text-blue-400" },
  ondertekend: { label: "Ondertekend", kleur: "bg-green-500/20 text-green-400" },
  verlopen: { label: "Verlopen", kleur: "bg-red-500/20 text-red-400" },
};

export default function ContractenPage() {
  const { addToast } = useToast();
  const [contracten, setContracten] = useState<Contract[]>([]);
  const [klanten, setKlanten] = useState<Klant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [type, setType] = useState("samenwerkingsovereenkomst");
  const [klantId, setKlantId] = useState("");
  const [titel, setTitel] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [cRes, kRes] = await Promise.all([
        fetch("/api/contracten"),
        fetch("/api/klanten"),
      ]);
      if (cRes.ok) {
        const d = await cRes.json();
        setContracten(d.contracten ?? []);
      }
      if (kRes.ok) {
        const d = await kRes.json();
        setKlanten(d.klanten ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleCreate() {
    if (!klantId || !titel) {
      addToast("Selecteer een klant en voer een titel in", "info");
      return;
    }
    setGenerating(true);
    try {
      // First generate contract content via AI
      const genRes = await fetch(`/api/contracten/genereer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klantId: Number(klantId), type, titel }),
      });

      let inhoud = "";
      if (genRes.ok) {
        const genData = await genRes.json();
        inhoud = genData.inhoud ?? "";
      }

      // Create contract
      const res = await fetch("/api/contracten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klantId: Number(klantId), type, titel, inhoud }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.fout || "Aanmaken mislukt");
      }

      addToast("Contract aangemaakt", "succes");
      setModalOpen(false);
      setTitel("");
      setKlantId("");
      fetchData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout bij aanmaken", "fout");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-autronis-text-primary">Contracten</h1>
            <p className="text-autronis-text-secondary mt-1">{contracten.length} contracten</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nieuw contract
          </button>
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(TYPE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const count = contracten.filter(c => c.type === key).length;
            return (
              <button
                key={key}
                onClick={() => { setType(key); setModalOpen(true); }}
                className="bg-autronis-card border border-autronis-border rounded-xl p-5 text-left hover:border-autronis-accent/40 transition-colors card-glow group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${config.kleur}15` }}>
                    <Icon className="w-5 h-5" style={{ color: config.kleur }} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-autronis-text-primary">{config.label}</span>
                    {count > 0 && <span className="ml-2 text-xs text-autronis-text-secondary">({count})</span>}
                  </div>
                </div>
                <p className="text-xs text-autronis-text-secondary">{config.beschrijving}</p>
              </button>
            );
          })}
        </div>

        {/* Contract list */}
        {loading ? (
          <div className="flex items-center gap-2 text-autronis-text-secondary py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Laden...
          </div>
        ) : contracten.length === 0 ? (
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
            <FileText className="w-10 h-10 text-autronis-text-secondary/30 mx-auto mb-3" />
            <p className="text-autronis-text-secondary text-sm">Nog geen contracten. Kies een template hierboven om te beginnen.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracten.map((c) => {
              const config = TYPE_CONFIG[c.type] || TYPE_CONFIG.samenwerkingsovereenkomst;
              const Icon = config.icon;
              const status = STATUS_LABELS[c.status] || STATUS_LABELS.concept;
              return (
                <Link
                  key={c.id}
                  href={`/offertes/contracten/${c.id}`}
                  className="flex items-center gap-4 bg-autronis-card border border-autronis-border rounded-xl p-4 hover:border-autronis-accent/40 transition-colors card-glow"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${config.kleur}15` }}>
                    <Icon className="w-5 h-5" style={{ color: config.kleur }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-autronis-text-primary truncate">{c.titel}</p>
                    <p className="text-xs text-autronis-text-secondary">{c.klantNaam || "Geen klant"} · {config.label}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.kleur}`}>{status.label}</span>
                  <span className="text-xs text-autronis-text-secondary">{new Date(c.aangemaaktOp).toLocaleDateString("nl-NL")}</span>
                  <ChevronRight className="w-4 h-4 text-autronis-text-secondary" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
            <div className="bg-autronis-card border border-autronis-border rounded-2xl p-7 w-full max-w-md mx-4 space-y-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-autronis-text-primary">Nieuw contract</h2>
                <button onClick={() => setModalOpen(false)} className="p-1 text-autronis-text-secondary hover:text-autronis-text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type */}
              <div>
                <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Type</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    const selected = type === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setType(key)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                          selected
                            ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                            : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: selected ? `${config.kleur}20` : "rgba(255,255,255,0.05)" }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-medium leading-tight text-center">
                          {config.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Klant */}
              <div>
                <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Klant</label>
                <select
                  value={klantId}
                  onChange={e => setKlantId(e.target.value)}
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary"
                >
                  <option value="">Selecteer klant...</option>
                  {klanten.map(k => <option key={k.id} value={k.id}>{k.bedrijfsnaam}</option>)}
                </select>
              </div>

              {/* Titel */}
              <div>
                <label className="text-sm font-medium text-autronis-text-secondary mb-2 block">Titel</label>
                <input
                  value={titel}
                  onChange={e => setTitel(e.target.value)}
                  placeholder={`${TYPE_CONFIG[type]?.label || "Contract"} — ${klanten.find(k => String(k.id) === klantId)?.bedrijfsnaam || "Klant"}`}
                  className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-2.5 text-sm text-autronis-text-primary placeholder-autronis-text-secondary/50"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={generating || !klantId || !titel}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-autronis-accent text-autronis-bg font-semibold rounded-xl hover:bg-autronis-accent/90 transition-colors disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "AI genereert contract..." : "Genereer & maak aan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
