"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentBase, DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import { useImproveDocument } from "@/hooks/queries/use-documenten";
import { IMPROVE_MODE_LABELS, type ImproveMode } from "@/lib/ai/documenten-types";
import { X, ExternalLink, Copy, Calendar, User, Archive, FileDown, Sparkles, Loader2, Check, RotateCcw, ChevronDown, FileText } from "lucide-react";

interface DocumentPreviewProps {
  document: DocumentBase | null;
  open: boolean;
  onClose: () => void;
  onDuplicate?: (doc: DocumentBase) => void;
  onArchive?: (doc: DocumentBase) => void;
}

export function DocumentPreview({ document: doc, open, onClose, onDuplicate, onArchive }: DocumentPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showImprove, setShowImprove] = useState(false);
  const [improveResult, setImproveResult] = useState<{ original: string; improved: string } | null>(null);
  const [contentHtml, setContentHtml] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const improveDocument = useImproveDocument();

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.document.addEventListener("keydown", handleEsc);
    return () => globalThis.document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !doc) { setContentHtml(null); setShowContent(false); return; }
    setContentLoading(true);
    fetch(`/api/documenten/${doc.notionId}/content`)
      .then((r) => r.json())
      .then((data) => { if (data.content) setContentHtml(data.content); })
      .catch(() => {})
      .finally(() => setContentLoading(false));
  }, [open, doc]);

  if (!doc) return null;

  const config = DOCUMENT_TYPE_CONFIG[doc.type];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-[400px] max-w-[90vw] bg-autronis-card border-l border-autronis-border shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-autronis-card border-b border-autronis-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                <span className={`text-xs font-medium ${config.textClass}`}>{config.label}</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-6">
              {/* Title */}
              <h2 className="text-lg font-semibold text-autronis-text-primary">{doc.titel}</h2>

              {/* Summary */}
              {doc.samenvatting && (
                <div>
                  <label className="text-xs font-medium text-autronis-text-secondary uppercase tracking-wide">Samenvatting</label>
                  <p className="mt-1 text-sm text-autronis-text-primary leading-relaxed">{doc.samenvatting}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-3">
                {doc.klantNaam && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
                    <div>
                      <span className="text-xs text-autronis-text-secondary">Klant</span>
                      <p className="text-sm text-autronis-text-primary">{doc.klantNaam}</p>
                    </div>
                  </div>
                )}

                {doc.projectNaam && (
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-autronis-text-secondary">Project</span>
                      <p className="text-sm text-autronis-text-primary">{doc.projectNaam}</p>
                    </div>
                  </div>
                )}

                {doc.aangemaaktOp && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
                    <div>
                      <span className="text-xs text-autronis-text-secondary">Aangemaakt op</span>
                      <p className="text-sm text-autronis-text-primary">{new Date(doc.aangemaaktOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                  </div>
                )}

                {doc.aangemaaktDoor && (
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
                    <div>
                      <span className="text-xs text-autronis-text-secondary">Aangemaakt door</span>
                      <p className="text-sm text-autronis-text-primary">{doc.aangemaaktDoor}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Verbeteren */}
              {doc.samenvatting && (
                <div>
                  <button
                    onClick={() => { setShowImprove(!showImprove); setImproveResult(null); }}
                    className="flex items-center gap-1.5 text-xs font-medium text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Verbeteren
                  </button>

                  {showImprove && (
                    <div className="mt-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.entries(IMPROVE_MODE_LABELS) as [ImproveMode, string][]).map(([mode, label]) => (
                          <button
                            key={mode}
                            onClick={async () => {
                              try {
                                const result = await improveDocument.mutateAsync({ content: doc.samenvatting, mode });
                                setImproveResult(result);
                              } catch {
                                // Error handled by mutation
                              }
                            }}
                            disabled={improveDocument.isPending}
                            className="px-2.5 py-1 rounded-lg text-xs bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors disabled:opacity-50"
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {improveDocument.isPending && (
                        <div className="flex items-center gap-2 text-xs text-autronis-text-secondary">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          AI is bezig...
                        </div>
                      )}

                      {improveResult && (
                        <div className="space-y-2 rounded-lg bg-autronis-bg border border-autronis-border p-3">
                          <div>
                            <span className="text-xs font-medium text-red-400">Origineel:</span>
                            <p className="text-xs text-autronis-text-secondary mt-0.5 line-through">{improveResult.original}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-green-400">Verbeterd:</span>
                            <p className="text-xs text-autronis-text-primary mt-0.5">{improveResult.improved}</p>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => setImproveResult(null)}
                              className="flex items-center gap-1 text-xs text-autronis-text-secondary hover:text-autronis-text-primary"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Opnieuw
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <a
                  href={doc.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg bg-autronis-accent text-white text-sm font-medium hover:bg-autronis-accent-hover transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Openen in Notion
                </a>

                {onDuplicate && (
                  <button
                    onClick={() => onDuplicate(doc)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Dupliceren
                  </button>
                )}

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  Exporteer als PDF
                </button>

                {onArchive && (
                  <button
                    onClick={() => { onArchive(doc); onClose(); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    Archiveren
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
