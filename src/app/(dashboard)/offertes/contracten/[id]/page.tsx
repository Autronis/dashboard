"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Send,
  Copy,
  Trash2,
  Shield,
  Handshake,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  ChevronRight,
  RotateCcw,
  Pencil,
  X,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { marked } from "marked";

interface Contract {
  id: number;
  klantId: number;
  klantNaam: string | null;
  klantContactpersoon: string | null;
  klantEmail: string | null;
  offerteId: number | null;
  offerteNummer: string | null;
  titel: string;
  type: string;
  inhoud: string;
  status: string;
  verloopdatum: string | null;
  ondertekendOp: string | null;
  aangemaaktOp: string;
}

interface Risico {
  alinea: string;
  probleem: string;
  ernst: "hoog" | "midden" | "laag";
  suggestie: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Handshake; kleur: string }> = {
  samenwerkingsovereenkomst: { label: "Samenwerkingsovereenkomst", icon: Handshake, kleur: "#17B8A5" },
  sla: { label: "SLA", icon: Clock, kleur: "#3B82F6" },
  nda: { label: "NDA", icon: Shield, kleur: "#A855F7" },
};

const STATUS_FLOW: { key: string; label: string; kleur: string; bg: string }[] = [
  { key: "concept", label: "Concept", kleur: "text-zinc-400", bg: "bg-zinc-500/20" },
  { key: "verzonden", label: "Verstuurd", kleur: "text-blue-400", bg: "bg-blue-500/20" },
  { key: "ondertekend", label: "Ondertekend", kleur: "text-green-400", bg: "bg-green-500/20" },
];

const HERSCHRIJF_OPTIES = [
  "Maak strenger",
  "Vereenvoudig de taal",
  "Voeg boeteclausule toe",
  "Maak klantvriendellijker",
  "Voeg meer detail toe",
];

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);

  // AI states
  const [risicos, setRisicos] = useState<Risico[] | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [herschrijfOpen, setHerschrijfOpen] = useState(false);
  const [herschrijfInstructie, setHerschrijfInstructie] = useState("");
  const [herschrijfLoading, setHerschrijfLoading] = useState(false);
  const [herschrijfResult, setHerschrijfResult] = useState("");

  // Status change
  const [statusLoading, setStatusLoading] = useState(false);

  // Sending state
  const [verstuurLoading, setVerstuurLoading] = useState(false);

  // Download state
  const [pdfLoading, setPdfLoading] = useState(false);

  const inhoudRef = useRef<HTMLDivElement>(null);

  const fetchContract = useCallback(async () => {
    try {
      const res = await fetch(`/api/contracten/${id}`);
      if (!res.ok) { router.push("/offertes/contracten"); return; }
      const d = await res.json();
      setContract(d.contract);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchContract(); }, [fetchContract]);

  // Tekst selectie voor herschrijven
  useEffect(() => {
    function handleSelection() {
      const sel = window.getSelection();
      const tekst = sel?.toString().trim() ?? "";
      if (tekst.length > 20 && inhoudRef.current?.contains(sel?.anchorNode ?? null)) {
        setSelectedText(tekst);
      } else if (!tekst) {
        setSelectedText("");
      }
    }
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("touchend", handleSelection);
    return () => { document.removeEventListener("mouseup", handleSelection); document.removeEventListener("touchend", handleSelection); };
  }, []);

  async function handleStatusWijzig(nieuweStatus: string) {
    if (!contract) return;
    setStatusLoading(true);
    try {
      await fetch(`/api/contracten/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nieuweStatus }),
      });
      setContract((c) => c ? { ...c, status: nieuweStatus } : c);
      addToast(`Status gewijzigd naar ${STATUS_FLOW.find(s => s.key === nieuweStatus)?.label}`, "succes");
    } catch {
      addToast("Status wijzigen mislukt", "fout");
    }
    setStatusLoading(false);
  }

  async function handleVerstuur() {
    setVerstuurLoading(true);
    try {
      const res = await fetch(`/api/contracten/${id}/verstuur`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fout);
      setContract((c) => c ? { ...c, status: "verzonden" } : c);
      addToast("Contract verstuurd ter ondertekening", "succes");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Versturen mislukt", "fout");
    }
    setVerstuurLoading(false);
  }

  async function handlePdfDownload() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/contracten/${id}/pdf`);
      if (!res.ok) throw new Error("PDF genereren mislukt");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contract?.titel ?? "contract"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "PDF mislukt", "fout");
    }
    setPdfLoading(false);
  }

  async function handleRisicoscan() {
    setScanLoading(true);
    setRisicos(null);
    try {
      const res = await fetch(`/api/contracten/${id}/risicoscan`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fout);
      setRisicos(d.risicos);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Scan mislukt", "fout");
    }
    setScanLoading(false);
  }

  async function handleHerschrijf() {
    if (!selectedText || !herschrijfInstructie) return;
    setHerschrijfLoading(true);
    try {
      const res = await fetch(`/api/contracten/${id}/herschrijf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst: selectedText, instructie: herschrijfInstructie }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fout);
      setHerschrijfResult(d.tekst);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Herschrijven mislukt", "fout");
    }
    setHerschrijfLoading(false);
  }

  async function handleToepassen() {
    if (!contract || !herschrijfResult) return;
    const nieuweInhoud = contract.inhoud.replace(selectedText, herschrijfResult);
    try {
      await fetch(`/api/contracten/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inhoud: nieuweInhoud }),
      });
      setContract((c) => c ? { ...c, inhoud: nieuweInhoud } : c);
      setHerschrijfOpen(false);
      setHerschrijfResult("");
      setSelectedText("");
      addToast("Tekst bijgewerkt", "succes");
    } catch {
      addToast("Opslaan mislukt", "fout");
    }
  }

  async function handleDupliceer() {
    try {
      const res = await fetch(`/api/contracten/${id}/dupliceer`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.fout);
      addToast("Contract gedupliceerd", "succes");
      router.push(`/offertes/contracten/${d.contract.id}`);
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Dupliceren mislukt", "fout");
    }
  }

  async function handleArchiveer() {
    if (!confirm("Contract archiveren? Het verdwijnt uit de lijst maar blijft bewaard.")) return;
    await fetch(`/api/contracten/${id}`, { method: "DELETE" });
    addToast("Contract gearchiveerd", "succes");
    router.push("/offertes/contracten");
  }

  if (loading) {
    return (
      <PageTransition>
        <div className="p-8 flex items-center gap-3 text-autronis-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin" />
          Laden...
        </div>
      </PageTransition>
    );
  }

  if (!contract) return null;

  const typeCfg = TYPE_CONFIG[contract.type] ?? TYPE_CONFIG.samenwerkingsovereenkomst;
  const Icon = typeCfg.icon;
  const huidigeStatus = STATUS_FLOW.find((s) => s.key === contract.status) ?? STATUS_FLOW[0];
  const verlopen = contract.verloopdatum && new Date(contract.verloopdatum) < new Date();
  const dagenTotVerlopen = contract.verloopdatum
    ? Math.ceil((new Date(contract.verloopdatum).getTime() - Date.now()) / 86400000)
    : null;

  const ernstkleuren: Record<string, string> = {
    hoog: "bg-red-500/10 border-red-500/30 text-red-400",
    midden: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    laag: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  };

  return (
    <PageTransition>
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-autronis-text-secondary">
          <button onClick={() => router.push("/offertes/contracten")} className="hover:text-autronis-text-primary flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            Contracten
          </button>
          <ChevronRight className="w-3 h-3" />
          <span className="text-autronis-text-primary truncate">{contract.titel}</span>
        </div>

        {/* Header kaart */}
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${typeCfg.kleur}15` }}>
              <Icon className="w-6 h-6" style={{ color: typeCfg.kleur }} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-autronis-text-primary">{contract.titel}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-sm text-autronis-text-secondary">{typeCfg.label}</span>
                {contract.klantNaam && (
                  <span className="text-sm text-autronis-text-secondary">· {contract.klantNaam}</span>
                )}
                {contract.offerteNummer && (
                  <span className="text-xs text-autronis-accent flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    {contract.offerteNummer}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={contract.status}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", huidigeStatus.bg, huidigeStatus.kleur)}
                  >
                    {contract.status === "ondertekend" && <CheckCircle2 className="w-3 h-3" />}
                    {huidigeStatus.label}
                  </motion.span>
                </AnimatePresence>
                {verlopen && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                    Verlopen
                  </span>
                )}
                {!verlopen && dagenTotVerlopen !== null && dagenTotVerlopen <= 30 && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                    Verloopt over {dagenTotVerlopen} dagen
                  </span>
                )}
                {contract.ondertekendOp && (
                  <span className="text-xs text-autronis-text-secondary">
                    Ondertekend op {new Date(contract.ondertekendOp).toLocaleDateString("nl-NL")}
                  </span>
                )}
              </div>
            </div>

            {/* Actieknoppen */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={handlePdfDownload}
                disabled={pdfLoading}
                className="flex items-center gap-2 px-3 py-2 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/40 rounded-xl text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </button>
              <button
                onClick={handleDupliceer}
                className="flex items-center gap-2 px-3 py-2 bg-autronis-bg border border-autronis-border hover:border-autronis-accent/40 rounded-xl text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                <Copy className="w-4 h-4" />
                Dupliceer
              </button>
              {(contract.status === "concept" || contract.status === "verzonden") && contract.klantEmail && (
                <button
                  onClick={handleVerstuur}
                  disabled={verstuurLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors"
                >
                  {verstuurLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Verstuur ter ondertekening
                </button>
              )}
              <button
                onClick={handleArchiveer}
                className="p-2 text-autronis-text-secondary hover:text-red-400 transition-colors rounded-xl"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status flow */}
          {contract.status !== "verlopen" && (
            <div className="mt-5 flex items-center gap-2">
              {STATUS_FLOW.map((s, i) => {
                const idx = STATUS_FLOW.findIndex((x) => x.key === contract.status);
                const isHuidige = s.key === contract.status;
                const isDone = i < idx;
                const isVolgende = i === idx + 1;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {i > 0 && <div className={cn("h-px w-8", isDone || isHuidige ? "bg-autronis-accent" : "bg-autronis-border")} />}
                    <button
                      onClick={() => isVolgende && !statusLoading ? handleStatusWijzig(s.key) : undefined}
                      disabled={!isVolgende || statusLoading}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        isHuidige ? `${s.bg} ${s.kleur} ring-1 ring-current` : "",
                        isDone ? "text-autronis-accent opacity-70" : "",
                        isVolgende ? "border border-dashed border-autronis-accent/40 text-autronis-accent hover:bg-autronis-accent/10 cursor-pointer" : "",
                        !isHuidige && !isDone && !isVolgende ? "text-autronis-text-secondary/40 cursor-default" : ""
                      )}
                    >
                      {isDone && <CheckCircle2 className="w-3 h-3" />}
                      {statusLoading && isVolgende ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {s.label}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contract inhoud */}
          <div className="lg:col-span-2 space-y-4">
            {/* Herschrijf tooltip bij selectie */}
            <AnimatePresence>
              {selectedText && !herschrijfOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/25 rounded-xl px-4 py-2.5"
                >
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                  <span className="text-xs text-purple-300 flex-1 truncate">
                    Geselecteerd: "{selectedText.slice(0, 60)}..."
                  </span>
                  <button
                    onClick={() => setHerschrijfOpen(true)}
                    className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1 flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    Herschrijven
                  </button>
                  <button onClick={() => setSelectedText("")} className="text-purple-400/60 hover:text-purple-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Herschrijf panel */}
            <AnimatePresence>
              {herschrijfOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-purple-300">AI Herschrijven</span>
                    </div>
                    <button onClick={() => { setHerschrijfOpen(false); setHerschrijfResult(""); }}>
                      <X className="w-4 h-4 text-purple-400/60 hover:text-purple-400" />
                    </button>
                  </div>

                  <p className="text-xs text-purple-400/70 italic truncate">"{selectedText.slice(0, 100)}..."</p>

                  <div className="flex flex-wrap gap-1.5">
                    {HERSCHRIJF_OPTIES.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setHerschrijfInstructie(opt)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs transition-colors",
                          herschrijfInstructie === opt
                            ? "bg-purple-500/30 text-purple-300"
                            : "bg-purple-500/10 text-purple-400/70 hover:text-purple-300"
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={herschrijfInstructie}
                      onChange={(e) => setHerschrijfInstructie(e.target.value)}
                      placeholder="Of typ een eigen instructie..."
                      className="flex-1 bg-autronis-bg border border-purple-500/20 rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
                      onKeyDown={(e) => e.key === "Enter" && handleHerschrijf()}
                    />
                    <button
                      onClick={handleHerschrijf}
                      disabled={herschrijfLoading || !herschrijfInstructie}
                      className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {herschrijfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Herschrijf"}
                    </button>
                  </div>

                  {herschrijfResult && (
                    <div className="space-y-2">
                      <p className="text-xs text-purple-400 font-medium">Resultaat:</p>
                      <div className="bg-autronis-bg/60 border border-purple-500/15 rounded-lg p-3 text-sm text-autronis-text-primary whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {herschrijfResult}
                      </div>
                      <button
                        onClick={handleToepassen}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-400 hover:text-green-300 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Toepassen in contract
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inhoud */}
            <div
              ref={inhoudRef}
              className="bg-autronis-card border border-autronis-border rounded-2xl p-6 prose prose-invert prose-sm max-w-none select-text"
            >
              {contract.inhoud ? (
                <div dangerouslySetInnerHTML={{ __html: marked(contract.inhoud) as string }} />
              ) : (
                <p className="text-autronis-text-secondary">Geen inhoud beschikbaar.</p>
              )}
            </div>
          </div>

          {/* Zijpaneel */}
          <div className="space-y-4">
            {/* Meta */}
            <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-autronis-text-primary">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-autronis-text-secondary">Klant</span>
                  <span className="text-autronis-text-primary text-right">{contract.klantNaam ?? "—"}</span>
                </div>
                {contract.klantContactpersoon && (
                  <div className="flex justify-between">
                    <span className="text-autronis-text-secondary">Contactpersoon</span>
                    <span className="text-autronis-text-primary">{contract.klantContactpersoon}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-autronis-text-secondary">Aangemaakt</span>
                  <span className="text-autronis-text-primary">{new Date(contract.aangemaaktOp).toLocaleDateString("nl-NL")}</span>
                </div>
                {contract.verloopdatum && (
                  <div className="flex justify-between">
                    <span className="text-autronis-text-secondary">Verloopt</span>
                    <span className={cn("font-medium", verlopen ? "text-red-400" : dagenTotVerlopen !== null && dagenTotVerlopen <= 30 ? "text-amber-400" : "text-autronis-text-primary")}>
                      {new Date(contract.verloopdatum).toLocaleDateString("nl-NL")}
                    </span>
                  </div>
                )}
                {contract.offerteNummer && (
                  <div className="flex justify-between">
                    <span className="text-autronis-text-secondary">Offerte</span>
                    <span className="text-autronis-accent">{contract.offerteNummer}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Risicoscan */}
            <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Risicoscan
                </h3>
                {risicos && (
                  <button onClick={() => setRisicos(null)} className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {!risicos && !scanLoading && (
                <button
                  onClick={handleRisicoscan}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-xl text-sm text-amber-400 font-medium transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Scan op risico&apos;s
                </button>
              )}

              {scanLoading && (
                <div className="flex items-center gap-2 text-sm text-amber-400 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyseren...
                </div>
              )}

              {risicos && (
                <div className="space-y-2">
                  {risicos.map((r, i) => (
                    <div key={i} className={cn("border rounded-lg p-3 space-y-1 text-xs", ernstkleuren[r.ernst])}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{r.ernst}</span>
                      </div>
                      <p className="opacity-80 italic truncate">"{r.alinea}"</p>
                      <p className="text-autronis-text-secondary">{r.probleem}</p>
                      <p className="opacity-90">→ {r.suggestie}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Handige acties */}
            <div className="bg-autronis-card border border-autronis-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold text-autronis-text-primary mb-3">Acties</h3>
              <button
                onClick={handlePdfDownload}
                disabled={pdfLoading}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-autronis-border hover:border-autronis-accent/40 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
              <button
                onClick={handleDupliceer}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-autronis-border hover:border-autronis-accent/40 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                <Copy className="w-4 h-4" />
                Dupliceer contract
              </button>
              <button
                onClick={handleArchiveer}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-500/20 hover:border-red-500/40 text-sm text-red-400/70 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Archiveer
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
