"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentBase, DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import { useImproveDocument } from "@/hooks/queries/use-documenten";
import { IMPROVE_MODE_LABELS, type ImproveMode } from "@/lib/ai/documenten-types";
import { X, ExternalLink, Copy, Calendar, User, Archive, FileDown, Sparkles, Loader2, Check, RotateCcw, ChevronDown, FileText, Maximize2, Minimize2, Send, Bot } from "lucide-react";

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
  const [fullscreen, setFullscreen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
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
    if (!open || !doc) { setContentHtml(null); setShowContent(false); setFullscreen(false); setAiChatMessages([]); setAiChatInput(""); return; }
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
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className={`fixed right-0 top-0 z-50 h-full bg-autronis-card border-l border-autronis-border shadow-2xl overflow-y-auto transition-all duration-300 ${fullscreen ? "w-full max-w-full" : "w-[400px] max-w-[90vw]"}`}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-autronis-card border-b border-autronis-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                <span className={`text-xs font-medium ${config.textClass}`}>{config.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {fullscreen && (
                  <button onClick={() => setFullscreen(false)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors">
                    <Minimize2 className="w-3.5 h-3.5" />
                    Verkleinen
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`py-5 space-y-6 ${fullscreen ? "px-8 max-w-4xl mx-auto" : "px-6"}`}>
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

              {/* Document inhoud */}
              <div>
                <button
                  onClick={() => setShowContent(!showContent)}
                  className="flex items-center gap-1.5 text-xs font-medium text-autronis-accent hover:text-autronis-accent-hover transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Inhoud {showContent || fullscreen ? "verbergen" : "bekijken"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showContent || fullscreen ? "" : "-rotate-90"}`} />
                </button>

                {(showContent || fullscreen) && (
                  <div className={`mt-3 rounded-xl bg-autronis-bg border border-autronis-border p-4 overflow-y-auto ${fullscreen ? "max-h-none" : "max-h-[50vh]"}`}>
                    {contentLoading ? (
                      <div className="flex items-center gap-2 text-xs text-autronis-text-secondary py-4 justify-center">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Inhoud laden...
                      </div>
                    ) : contentHtml ? (
                      <div
                        className="prose prose-sm max-w-none
                          [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-autronis-text-primary [&_h1]:mt-4 [&_h1]:mb-2
                          [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-autronis-text-primary [&_h2]:mt-3 [&_h2]:mb-1.5
                          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-autronis-text-primary [&_h3]:mt-2.5 [&_h3]:mb-1
                          [&_p]:text-xs [&_p]:text-autronis-text-secondary [&_p]:leading-relaxed [&_p]:mb-1.5
                          [&_ul]:text-xs [&_ul]:text-autronis-text-secondary [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:mb-2
                          [&_ol]:text-xs [&_ol]:text-autronis-text-secondary [&_ol]:pl-4 [&_ol]:list-decimal [&_ol]:mb-2
                          [&_li]:mb-0.5 [&_li]:leading-relaxed
                          [&_pre]:bg-autronis-card [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:mb-2
                          [&_code]:text-autronis-accent [&_code]:text-xs
                          [&_blockquote]:border-l-2 [&_blockquote]:border-autronis-accent/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-autronis-text-secondary
                          [&_strong]:text-autronis-text-primary [&_strong]:font-semibold
                          [&_hr]:border-autronis-border [&_hr]:my-3
                          [&_a]:text-autronis-accent [&_a]:underline
                          [&_.todo-list]:list-none [&_.todo-list]:pl-0
                          [&_.callout]:bg-autronis-accent/5 [&_.callout]:border-l-2 [&_.callout]:border-autronis-accent/30 [&_.callout]:pl-3 [&_.callout]:py-1 [&_.callout]:rounded [&_.callout]:text-xs [&_.callout]:mb-2"
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                      />
                    ) : (
                      <p className="text-xs text-autronis-text-secondary text-center py-4">Geen inhoud beschikbaar</p>
                    )}
                  </div>
                )}
              </div>

              {/* AI Chat */}
              <div className="rounded-xl border border-autronis-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border-b border-autronis-border">
                  <Bot className="w-4 h-4 text-autronis-accent" />
                  <span className="text-xs font-semibold text-autronis-text-primary">AI Assistent</span>
                  <span className="text-[10px] text-autronis-text-secondary">— stel vragen of geef instructies</span>
                </div>

                {aiChatMessages.length > 0 && (
                  <div className="px-4 py-3 space-y-2.5 max-h-[300px] overflow-y-auto">
                    {aiChatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-autronis-accent text-white rounded-br-sm"
                            : "bg-autronis-bg border border-autronis-border text-autronis-text-primary rounded-bl-sm"
                        }`}>
                          {msg.role === "ai" && <Bot className="w-3 h-3 text-autronis-accent inline mr-1 -mt-0.5" />}
                          <span className="whitespace-pre-wrap">{msg.text}</span>
                        </div>
                      </div>
                    ))}
                    {aiChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-autronis-bg border border-autronis-border rounded-xl rounded-bl-sm px-3 py-2">
                          <Loader2 className="w-3.5 h-3.5 text-autronis-accent animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 p-2.5 border-t border-autronis-border">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && aiChatInput.trim() && !aiChatLoading) {
                        e.preventDefault();
                        const input = aiChatInput.trim();
                        setAiChatInput("");
                        setAiChatMessages((prev) => [...prev, { role: "user", text: input }]);
                        setAiChatLoading(true);
                        fetch(`/api/documenten/${doc.notionId}/ai-edit`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ instructie: input, titel: doc.titel }),
                        })
                          .then((r) => r.json())
                          .then((data) => {
                            setAiChatMessages((prev) => [...prev, { role: "ai", text: data.antwoord || data.fout || "Geen antwoord" }]);
                          })
                          .catch(() => {
                            setAiChatMessages((prev) => [...prev, { role: "ai", text: "Er ging iets mis. Probeer het opnieuw." }]);
                          })
                          .finally(() => setAiChatLoading(false));
                      }
                    }}
                    placeholder="Vraag iets of geef een instructie..."
                    disabled={aiChatLoading}
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-autronis-accent/50 disabled:opacity-50"
                  />
                  <button
                    onClick={() => {
                      if (!aiChatInput.trim() || aiChatLoading) return;
                      const input = aiChatInput.trim();
                      setAiChatInput("");
                      setAiChatMessages((prev) => [...prev, { role: "user", text: input }]);
                      setAiChatLoading(true);
                      fetch(`/api/documenten/${doc.notionId}/ai-edit`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ instructie: input, titel: doc.titel }),
                      })
                        .then((r) => r.json())
                        .then((data) => {
                          setAiChatMessages((prev) => [...prev, { role: "ai", text: data.antwoord || data.fout || "Geen antwoord" }]);
                        })
                        .catch(() => {
                          setAiChatMessages((prev) => [...prev, { role: "ai", text: "Er ging iets mis. Probeer het opnieuw." }]);
                        })
                        .finally(() => setAiChatLoading(false));
                    }}
                    disabled={aiChatLoading || !aiChatInput.trim()}
                    className="p-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => { if (fullscreen) { setFullscreen(false); } else { setFullscreen(true); setShowContent(true); } }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg bg-autronis-accent text-white text-sm font-medium hover:bg-autronis-accent-hover transition-colors"
                >
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  {fullscreen ? "Verkleinen" : "Volledig scherm lezen"}
                </button>

                <a
                  href={doc.notionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
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
