"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SlimmeTaakTemplate {
  id: string;
  naam: string;
  beschrijving: string;
  cluster: string;
  geschatteDuur: number;
  velden?: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: "text" | "number" | "url";
  }>;
}

const CLUSTER_KLEUR: Record<string, { bg: string; text: string; border: string }> = {
  "backend-infra": { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/30" },
  "frontend": { bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-500/30" },
  "klantcontact": { bg: "bg-pink-500/10", text: "text-pink-300", border: "border-pink-500/30" },
  "content": { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/30" },
  "admin": { bg: "bg-gray-500/10", text: "text-gray-300", border: "border-gray-500/30" },
  "research": { bg: "bg-autronis-accent/10", text: "text-autronis-accent", border: "border-autronis-accent/30" },
};

export function SlimmeTakenModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { addToast } = useToast();
  const [templates, setTemplates] = useState<SlimmeTaakTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SlimmeTaakTemplate | null>(null);
  const [veldWaarden, setVeldWaarden] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/taken/slim")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setVeldWaarden({});
    }
  }, [open]);

  async function handleSubmit() {
    if (!selected) return;
    // Valideer verplichte velden
    if (selected.velden) {
      for (const veld of selected.velden) {
        if (!veldWaarden[veld.key]?.trim()) {
          addToast(`${veld.label} is verplicht`, "fout");
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/taken/slim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          velden: veldWaarden,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Aanmaken mislukt");
      addToast(`Slimme taak "${data.taak.titel}" aangemaakt`, "succes");
      onCreated?.();
      onClose();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Aanmaken mislukt", "fout");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
          >
            <div className="w-full max-w-2xl bg-autronis-card border border-autronis-border rounded-2xl shadow-2xl pointer-events-auto max-h-[85vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-autronis-border">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-autronis-accent/15 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-autronis-accent" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-autronis-text-primary">Slimme taken</h2>
                    <p className="text-xs text-autronis-text-secondary">
                      {selected ? "Vul de velden in om aan te maken" : "Kies een taak die Claude voor je kan doen"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {loading && (
                  <div className="flex items-center justify-center py-12 text-autronis-text-secondary text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Laden...
                  </div>
                )}

                {!loading && !selected && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {templates.map((t) => {
                      const cfg = CLUSTER_KLEUR[t.cluster] ?? CLUSTER_KLEUR.admin;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelected(t)}
                          className="text-left rounded-xl border border-autronis-border bg-autronis-bg/30 p-4 hover:border-autronis-accent/40 hover:bg-autronis-accent/[0.03] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-sm font-semibold text-autronis-text-primary leading-tight">
                              {t.naam}
                            </h3>
                            <span
                              className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0",
                                cfg.bg,
                                cfg.text,
                                cfg.border
                              )}
                            >
                              {t.cluster}
                            </span>
                          </div>
                          <p className="text-xs text-autronis-text-secondary mb-2 line-clamp-2">
                            {t.beschrijving}
                          </p>
                          <div className="text-[10px] text-autronis-text-secondary/60">
                            {t.geschatteDuur} min · {t.velden?.length ?? 0} veld(en)
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!loading && selected && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-autronis-border bg-autronis-bg/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-autronis-text-primary">
                          {selected.naam}
                        </h3>
                        <span className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                          CLUSTER_KLEUR[selected.cluster]?.bg,
                          CLUSTER_KLEUR[selected.cluster]?.text,
                          CLUSTER_KLEUR[selected.cluster]?.border
                        )}>
                          {selected.cluster}
                        </span>
                      </div>
                      <p className="text-xs text-autronis-text-secondary">
                        {selected.beschrijving}
                      </p>
                    </div>

                    {selected.velden && selected.velden.length > 0 && (
                      <div className="space-y-3">
                        {selected.velden.map((veld) => (
                          <div key={veld.key}>
                            <label className="block text-xs font-medium text-autronis-text-secondary mb-1.5">
                              {veld.label}
                            </label>
                            <input
                              type={veld.type ?? "text"}
                              value={veldWaarden[veld.key] ?? ""}
                              onChange={(e) =>
                                setVeldWaarden({ ...veldWaarden, [veld.key]: e.target.value })
                              }
                              placeholder={veld.placeholder}
                              className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/40 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-[11px] text-autronis-text-secondary/60 italic">
                      De taak wordt als &apos;vrij&apos; aangemaakt zodat jij of Syb &apos;m kan oppakken. Cluster cascade zorgt dat de juiste persoon historisch context houdt.
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {selected && (
                <div className="px-6 py-4 border-t border-autronis-border flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
                  >
                    ← Terug naar overzicht
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold hover:bg-autronis-accent-hover transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Aanmaken
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
