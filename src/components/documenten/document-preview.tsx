"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentBase, DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import { X, ExternalLink, Copy, Calendar, User } from "lucide-react";

interface DocumentPreviewProps {
  document: DocumentBase | null;
  open: boolean;
  onClose: () => void;
  onDuplicate?: (doc: DocumentBase) => void;
}

export function DocumentPreview({ document: doc, open, onClose, onDuplicate }: DocumentPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    globalThis.document.addEventListener("keydown", handleEsc);
    return () => globalThis.document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

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
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
