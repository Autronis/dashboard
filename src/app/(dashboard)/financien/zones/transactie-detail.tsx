"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Receipt, Calendar, Building2, Tag, CheckCircle2, Circle, AlertCircle, FileText, Paperclip, ExternalLink, Upload, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { FinancienTransactie } from "@/hooks/queries/use-financien-transacties";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FISCAAL_STYLES, TYPE_STYLES, type FiscaalType } from "./fiscaal-colors";

function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function statusKleur(status: string | null): { text: string; classes: string; icon: typeof CheckCircle2 } {
  if (status === "gematcht") return { text: "Gematcht", classes: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 };
  if (status === "gecategoriseerd") return { text: "Gecategoriseerd", classes: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Circle };
  return { text: "Onbekend", classes: "text-orange-400 bg-orange-500/10 border-orange-500/20", icon: AlertCircle };
}

interface Props {
  transactie: FinancienTransactie | null;
  onClose: () => void;
  onUpdate?: (patch: Partial<FinancienTransactie>) => void;
}

export function TransactieDetail({ transactie, onClose, onUpdate }: Props) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState<FiscaalType | "clear" | null>(null);
  const [openingBon, setOpeningBon] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function openBon(pad: string) {
    setOpeningBon(true);
    try {
      const res = await fetch(`/api/administratie/signed-url?path=${encodeURIComponent(pad)}`);
      if (!res.ok) throw new Error("Kon link niet ophalen");
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Kon bon niet openen", "fout");
    } finally {
      setOpeningBon(false);
    }
  }

  async function handleUploadBon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !transactie) return;

    if (file.type !== "application/pdf") {
      addToast("Alleen PDF-bestanden", "fout");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("bestand", file);
      // Force-link aan deze specifieke transactie — skip de scoring matcher
      formData.append("transactieId", String(transactie.id));

      const res = await fetch("/api/administratie/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const { fout } = (await res.json().catch(() => ({ fout: "Upload mislukt" }))) as { fout?: string };
        throw new Error(fout ?? "Upload mislukt");
      }
      const data = (await res.json()) as { factuur?: { storageUrl?: string | null } };
      addToast("Factuur gekoppeld aan transactie", "succes");
      // Optimistic update zodat het detail-paneel direct de bon-link toont
      // zonder dat de gebruiker hoeft te sluiten/heropen.
      if (data.factuur?.storageUrl) {
        onUpdate?.({ storageUrl: data.factuur.storageUrl, status: "gematcht" });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["financien-transacties"] }),
        queryClient.invalidateQueries({ queryKey: ["financien-categorieen"] }),
        queryClient.invalidateQueries({ queryKey: ["financien-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["btw-kwartaal"] }),
      ]);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Upload mislukt", "fout");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function setFiscaalType(id: number, fiscaalType: FiscaalType | null) {
    setSaving(fiscaalType ?? "clear");
    try {
      const res = await fetch(`/api/financien/transacties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscaalType }),
      });
      if (!res.ok) {
        const { fout } = (await res.json().catch(() => ({ fout: "Fout" }))) as { fout?: string };
        throw new Error(fout ?? "Kon transactie niet bijwerken");
      }
      await queryClient.invalidateQueries({ queryKey: ["financien-transacties"] });
      await queryClient.invalidateQueries({ queryKey: ["financien-categorieen"] });
      addToast(
        fiscaalType ? `Gemarkeerd als ${FISCAAL_STYLES[fiscaalType].label.toLowerCase()}` : "Fiscaal type gewist",
        "succes"
      );
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Fout bij opslaan", "fout");
    } finally {
      setSaving(null);
    }
  }

  return (
    <AnimatePresence>
      {transactie && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] bg-autronis-card border-l border-autronis-border z-50 overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-autronis-text-primary">Transactie details</h3>
                <button onClick={onClose} className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Amount */}
              <div className="text-center py-6 bg-autronis-bg rounded-xl">
                <p className={cn("text-4xl font-bold tabular-nums", transactie.type === "bij" ? "text-emerald-400" : "text-autronis-text-primary")}>
                  {transactie.type === "bij" ? "+" : "−"}{formatEuro(Math.abs(transactie.bedrag))}
                </p>
                {transactie.btwBedrag != null && transactie.btwBedrag > 0 && (
                  <p className="text-xs text-autronis-text-secondary mt-2">
                    BTW: {formatEuro(transactie.btwBedrag)}
                  </p>
                )}
              </div>

              {/* Main info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Omschrijving</p>
                    <p className="text-sm text-autronis-text-primary">{transactie.merchantNaam ?? transactie.omschrijving}</p>
                    {transactie.merchantNaam && transactie.omschrijving && transactie.merchantNaam !== transactie.omschrijving && (
                      <p className="text-xs text-autronis-text-secondary mt-0.5">{transactie.omschrijving}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Datum</p>
                    <p className="text-sm text-autronis-text-primary">{formatDatum(transactie.datum)}</p>
                  </div>
                </div>

                {transactie.categorie && (
                  <div className="flex items-start gap-3">
                    <Tag className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Categorie</p>
                      <p className="text-sm text-autronis-text-primary capitalize">{transactie.categorie}</p>
                    </div>
                  </div>
                )}

                {transactie.bank && (
                  <div className="flex items-start gap-3">
                    <Receipt className="w-4 h-4 text-autronis-text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide">Bank</p>
                      <p className="text-sm text-autronis-text-primary capitalize">{transactie.bank}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bon / factuur koppeling */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUploadBon}
              />
              {(transactie.storageUrl || transactie.bonPad) ? (
                <div className="space-y-2">
                  <button
                    onClick={() => openBon((transactie.storageUrl ?? transactie.bonPad)!)}
                    disabled={openingBon}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-autronis-accent/10 border border-autronis-accent/25 hover:bg-autronis-accent/15 hover:border-autronis-accent/40 transition-colors disabled:opacity-50 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-autronis-accent/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-autronis-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-autronis-text-primary">
                        {openingBon ? "Openen..." : "Bekijk bon / factuur"}
                      </p>
                      <p className="text-[11px] text-autronis-text-secondary truncate">
                        {(transactie.storageUrl ?? transactie.bonPad)?.split("/").pop()}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-autronis-bg border border-autronis-border text-xs text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/30 transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {uploading ? "Uploaden..." : "Vervang met andere factuur"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/25 hover:bg-amber-500/10 hover:border-amber-500/40 transition-colors disabled:opacity-50 text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    {uploading ? (
                      <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-300">
                      {uploading ? "Uploaden..." : "Upload factuur / bon"}
                    </p>
                    <p className="text-[11px] text-amber-300/70">
                      PDF selecteren. Wordt direct gekoppeld aan deze transactie, Claude extract leest bedrag + BTW automatisch.
                    </p>
                  </div>
                  <Paperclip className="w-4 h-4 text-amber-400/60 flex-shrink-0" />
                </button>
              )}

              {/* AI description */}
              {transactie.aiBeschrijving && (
                <div className="bg-autronis-bg rounded-xl p-4">
                  <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-1">AI analyse</p>
                  <p className="text-sm text-autronis-text-primary">{transactie.aiBeschrijving}</p>
                </div>
              )}

              {/* Status + type tags */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-lg border text-xs font-medium",
                    TYPE_STYLES[transactie.type].pill
                  )}
                >
                  {TYPE_STYLES[transactie.type].label}
                </span>
                {(() => {
                  const s = statusKleur(transactie.status);
                  const Icon = s.icon;
                  return (
                    <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium", s.classes)}>
                      <Icon className="w-3 h-3" />
                      {s.text}
                    </span>
                  );
                })()}
                {transactie.isAbonnement === 1 && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                    Abonnement
                  </span>
                )}
              </div>

              {/* Fiscaal type picker */}
              <div>
                <p className="text-[10px] uppercase text-autronis-text-secondary tracking-wide mb-2">
                  Fiscaal type
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FISCAAL_STYLES) as FiscaalType[]).map((ft) => {
                    const style = FISCAAL_STYLES[ft];
                    const isActive = transactie.fiscaalType === ft;
                    return (
                      <button
                        key={ft}
                        disabled={saving !== null}
                        onClick={() => setFiscaalType(transactie.id, isActive ? null : ft)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-xs font-medium transition",
                          isActive
                            ? style.pill
                            : "bg-autronis-bg border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary",
                          saving !== null && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {style.label}
                      </button>
                    );
                  })}
                </div>
                {transactie.fiscaalType === "investering" && (
                  <p className="text-[11px] text-sky-400/80 mt-2">
                    Wordt meegenomen als investering — fiscaal via KIA / afschrijving.
                  </p>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
