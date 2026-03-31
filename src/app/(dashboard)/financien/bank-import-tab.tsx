"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  Building2,
  User,
  Globe,
  Paperclip,
  Brain,
} from "lucide-react";
import { cn, formatBedrag, formatDatumKort } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ParsedTransactie {
  datum: string;
  omschrijving: string;
  bedrag: number;
  type: "bij" | "af";
  categorie: string;
  tegenrekening: string;
  bank: string;
}

interface BankTransactie {
  id: number;
  datum: string;
  omschrijving: string;
  bedrag: number;
  type: "bij" | "af";
  categorie: string | null;
  status: string;
  bank: string | null;
  tegenrekening: string | null;
  merchantNaam: string | null;
  aiBeschrijving: string | null;
  fiscaalType: string | null;
  btwBedrag: number | null;
  isAbonnement: number | null;
  overdodigheidScore: string | null;
  bonPad: string | null;
}

interface Stats {
  totaal: number;
  onbekend: number;
  gecategoriseerd: number;
  gematcht: number;
}

const CATEGORIE_OPTIES = [
  "kantoor", "hardware", "software", "reiskosten", "marketing",
  "onderwijs", "telefoon", "verzekeringen", "accountant", "overig",
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  onbekend: { bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Onbekend" },
  gecategoriseerd: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Gecategoriseerd" },
  gematcht: { bg: "bg-green-500/15", text: "text-green-400", label: "Gematcht" },
};

export function BankImportTab() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [parsedTransacties, setParsedTransacties] = useState<ParsedTransactie[]>([]);
  const [detectedBank, setDetectedBank] = useState("");
  const [importing, setImporting] = useState(false);

  // Existing transactions
  const [transacties, setTransacties] = useState<BankTransactie[]>([]);
  const [stats, setStats] = useState<Stats>({ totaal: 0, onbekend: 0, gecategoriseerd: 0, gematcht: 0 });
  const [loadingTransacties, setLoadingTransacties] = useState(true);
  const [statusFilter, setStatusFilter] = useState("alle");
  const [fiscaalFilter, setFiscaalFilter] = useState("alle");
  const [zoekTerm, setZoekTerm] = useState("");

  const fetchTransacties = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "alle") params.set("status", statusFilter);
      if (fiscaalFilter !== "alle") params.set("fiscaalType", fiscaalFilter);
      if (zoekTerm.trim()) params.set("zoek", zoekTerm.trim());
      const res = await fetch(`/api/bank/transacties?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setTransacties(json.transacties);
      setStats(json.stats);
    } catch {
      addToast("Kon transacties niet laden", "fout");
    } finally {
      setLoadingTransacties(false);
    }
  }, [statusFilter, fiscaalFilter, zoekTerm, addToast]);

  useEffect(() => {
    fetchTransacties();
  }, [fetchTransacties]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("bestand", file);

      const res = await fetch("/api/bank/import", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.fout || "Upload mislukt");

      setParsedTransacties(json.transacties);
      setDetectedBank(json.bank);
      addToast(`${json.aantal} transacties gevonden (${json.bank})`, "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon bestand niet verwerken", "fout");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const updateParsedCategorie = (index: number, categorie: string) => {
    setParsedTransacties((prev) =>
      prev.map((t, i) => (i === index ? { ...t, categorie } : t))
    );
  };

  const handleImport = async () => {
    if (parsedTransacties.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/bank/transacties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transacties: parsedTransacties }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.fout || "Import mislukt");

      addToast(`${json.aantalGeimporteerd} transacties geïmporteerd`, "succes");
      setParsedTransacties([]);
      setDetectedBank("");
      await fetchTransacties();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon transacties niet importeren", "fout");
    } finally {
      setImporting(false);
    }
  };

  const handleCategorieUpdate = async (id: number, categorie: string) => {
    try {
      const res = await fetch(`/api/bank/transacties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorie }),
      });
      if (!res.ok) throw new Error();
      addToast("Categorie bijgewerkt", "succes");
      await fetchTransacties();
    } catch {
      addToast("Kon categorie niet bijwerken", "fout");
    }
  };

  const handleFiscaalToggle = async (id: number, fiscaalType: string) => {
    try {
      await fetch(`/api/bank/transacties/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscaalType }),
      });
      setTransacties(prev => prev.map(t => t.id === id ? { ...t, fiscaalType } : t));
    } catch {
      addToast("Kon type niet bijwerken", "fout");
    }
  };

  // Detect verleggingsregeling — foreign companies
  const BUITENLANDSE_MERCHANTS = ["anthropic", "github", "aws", "vercel", "stripe", "google cloud", "microsoft azure", "openai", "digitalocean", "cloudflare", "hetzner", "fal.ai", "kie.ai", "resend", "netlify"];
  const isVerlegging = (t: BankTransactie) => {
    const naam = (t.merchantNaam || t.omschrijving || "").toLowerCase();
    return t.type === "af" && BUITENLANDSE_MERCHANTS.some(m => naam.includes(m));
  };

  const bonInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBonId, setUploadingBonId] = useState<number | null>(null);

  const handleBonUpload = async (transactieId: number, file: File) => {
    setUploadingBonId(transactieId);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const b64 = dataUrl.split(",")[1];

        // Upload via bonnetje API
        const formData = new FormData();
        formData.append("bonnetje", file);
        const res = await fetch("/api/bank/bonnetje", {
          method: "POST",
          body: formData,
        });
        const data = await res.json() as { bonPad?: string; succes?: boolean };

        if (data.bonPad) {
          // Link to specific transaction
          await fetch(`/api/bank/transacties/${transactieId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bonPad: data.bonPad }),
          });
          addToast("Factuur gekoppeld", "succes");
          fetchTransacties();
        }
        setUploadingBonId(null);
      };
      reader.readAsDataURL(file);
    } catch {
      addToast("Upload mislukt", "fout");
      setUploadingBonId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upload area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
          dragOver
            ? "border-autronis-accent bg-autronis-accent/5"
            : "border-autronis-border hover:border-autronis-accent/50 hover:bg-autronis-card/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <div className="w-12 h-12 border-4 border-autronis-border border-t-autronis-accent rounded-full animate-spin" />
              <p className="text-autronis-text-primary font-medium">Bestand verwerken...</p>
            </>
          ) : (
            <>
              <div className="p-4 bg-autronis-accent/10 rounded-2xl">
                <Upload className="w-8 h-8 text-autronis-accent" />
              </div>
              <div>
                <p className="text-lg font-semibold text-autronis-text-primary">
                  Sleep je CSV-bestand hierheen
                </p>
                <p className="text-sm text-autronis-text-secondary mt-1">
                  Of klik om een bestand te selecteren. Ondersteunt ING, Rabobank en ABN AMRO.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Parsed transactions review */}
      {parsedTransacties.length > 0 && (
        <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-autronis-text-primary">
                Transacties controleren
              </h3>
              <p className="text-sm text-autronis-text-secondary mt-1">
                {parsedTransacties.length} transacties gevonden via {detectedBank}. Pas categorieën aan voor import.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setParsedTransacties([]);
                  setDetectedBank("");
                }}
                className="px-4 py-2.5 text-sm font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-autronis-accent/20"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Bevestig & importeer
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-autronis-card">
                <tr className="border-b border-autronis-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Datum</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Omschrijving</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Bij/Af</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-autronis-text-secondary uppercase tracking-wide">Categorie</th>
                </tr>
              </thead>
              <tbody>
                {parsedTransacties.map((t, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-autronis-text-secondary whitespace-nowrap">
                      {formatDatumKort(t.datum)}
                    </td>
                    <td className="py-3 px-4 text-sm text-autronis-text-primary max-w-[300px] truncate">
                      {t.omschrijving}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-sm font-semibold text-right tabular-nums whitespace-nowrap",
                      t.type === "bij" ? "text-green-400" : "text-red-400"
                    )}>
                      {t.type === "af" ? "-" : "+"}{formatBedrag(t.bedrag)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-semibold",
                        t.type === "bij" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                      )}>
                        {t.type === "bij" ? "Bij" : "Af"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={t.categorie}
                        onChange={(e) => updateParsedCategorie(idx, e.target.value)}
                        className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1.5 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 cursor-pointer"
                      >
                        {CATEGORIE_OPTIES.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing transactions */}
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-autronis-text-primary">
              Bank transacties
            </h3>
            <p className="text-sm text-autronis-text-secondary mt-1">
              {stats.totaal} transacties totaal &middot; {stats.onbekend} onbekend &middot; {stats.gecategoriseerd} gecategoriseerd &middot; {stats.gematcht} gematcht
            </p>
          </div>
        </div>

        {/* Zoekbalk + filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Zoeken */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-autronis-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={zoekTerm}
              onChange={e => setZoekTerm(e.target.value)}
              placeholder="Zoek op omschrijving..."
              className="pl-9 pr-3 py-1.5 bg-autronis-bg border border-autronis-border rounded-lg text-xs text-autronis-text-primary placeholder:text-autronis-text-tertiary focus:outline-none focus:border-autronis-accent/50 w-48"
            />
          </div>
          {/* Status filter */}
          {[
            { key: "alle", label: "Alle" },
            { key: "onbekend", label: "Onbekend" },
            { key: "gecategoriseerd", label: "Gecategoriseerd" },
            { key: "gematcht", label: "Gematcht" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                statusFilter === f.key
                  ? "bg-autronis-accent text-autronis-bg"
                  : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
              )}
            >
              {f.label}
            </button>
          ))}
          <div className="w-px h-5 bg-autronis-border/30 mx-1" />
          {/* Fiscaal type filter */}
          {[
            { key: "alle", label: "Alles", icon: null },
            { key: "kosten", label: "Zakelijk", icon: Building2 },
            { key: "prive", label: "Privé", icon: User },
            { key: "investering", label: "Investering", icon: null },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFiscaalFilter(f.key)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                  fiscaalFilter === f.key
                    ? f.key === "prive" ? "bg-red-500/20 text-red-400" : f.key === "kosten" ? "bg-blue-500/20 text-blue-400" : f.key === "investering" ? "bg-purple-500/20 text-purple-400" : "bg-autronis-accent text-autronis-bg"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                )}
              >
                {Icon && <Icon className="w-3 h-3" />}
                {f.label}
              </button>
            );
          })}
        </div>

        {loadingTransacties ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : transacties.length === 0 ? (
          <EmptyState
            titel="Nog geen transacties"
            beschrijving="Importeer een CSV-bestand van je bank om te beginnen."
            icoon={<FileSpreadsheet className="h-7 w-7 text-autronis-text-secondary" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-autronis-border">
                  <th className="text-left py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Datum</th>
                  <th className="text-left py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Omschrijving</th>
                  <th className="text-right py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Bedrag</th>
                  <th className="text-left py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Categorie</th>
                  <th className="text-center py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Type</th>
                  <th className="text-center py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Bon</th>
                  <th className="text-center py-3 px-3 text-[10px] font-semibold text-autronis-text-secondary uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {transacties.map((t) => {
                  const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.onbekend;
                  const verlegd = isVerlegging(t);
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-autronis-border/50 hover:bg-autronis-bg/30 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-xs text-autronis-text-secondary whitespace-nowrap tabular-nums">
                        {formatDatumKort(t.datum)}
                      </td>
                      <td className="py-2.5 px-3 max-w-[280px]">
                        <p className="text-sm text-autronis-text-primary truncate">{t.merchantNaam || t.omschrijving}</p>
                        {t.aiBeschrijving && (
                          <p className="text-[10px] text-autronis-text-tertiary truncate mt-0.5">{t.aiBeschrijving}</p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          {verlegd && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium flex items-center gap-0.5">
                              <Globe className="w-2.5 h-2.5" /> Verlegging
                            </span>
                          )}
                          {t.isAbonnement === 1 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">Abonnement</span>
                          )}
                          {t.btwBedrag && t.btwBedrag > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-autronis-accent/10 text-autronis-accent font-medium">BTW {formatBedrag(t.btwBedrag)}</span>
                          )}
                        </div>
                      </td>
                      <td className={cn(
                        "py-2.5 px-3 text-sm font-semibold text-right tabular-nums whitespace-nowrap",
                        t.type === "bij" ? "text-green-400" : "text-red-400"
                      )}>
                        {t.type === "af" ? "-" : "+"}{formatBedrag(t.bedrag)}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={t.categorie || "overig"}
                          onChange={(e) => handleCategorieUpdate(t.id, e.target.value)}
                          className="bg-autronis-bg border border-autronis-border rounded-lg px-2 py-1 text-[11px] text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 cursor-pointer"
                        >
                          {CATEGORIE_OPTIES.map((c) => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {/* Zakelijk/Privé/Investering toggle */}
                        <div className="flex items-center justify-center gap-0.5">
                          {(["kosten", "prive", "investering"] as const).map(ft => (
                            <button
                              key={ft}
                              onClick={() => handleFiscaalToggle(t.id, ft)}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-all",
                                t.fiscaalType === ft
                                  ? ft === "kosten" ? "bg-blue-500/20 text-blue-400" : ft === "prive" ? "bg-red-500/20 text-red-400" : "bg-purple-500/20 text-purple-400"
                                  : "text-autronis-text-tertiary hover:text-autronis-text-secondary"
                              )}
                            >
                              {ft === "kosten" ? "ZAK" : ft === "prive" ? "PRV" : "INV"}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {t.type === "af" && (
                          t.bonPad ? (
                            <a href={`/api/assets/file?path=${encodeURIComponent(t.bonPad)}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-green-400 hover:underline" title="Bon bekijken">
                              <Paperclip className="w-3 h-3" /> ✓
                            </a>
                          ) : (
                            <label className="inline-flex items-center gap-1 text-[10px] text-red-400/60 hover:text-red-400 cursor-pointer transition-all" title="Upload bon/factuur">
                              <Paperclip className="w-3 h-3" />
                              {uploadingBonId === t.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : "mist"}
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleBonUpload(t.id, f); }} />
                            </label>
                          )
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.bg, sc.text)}>
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
