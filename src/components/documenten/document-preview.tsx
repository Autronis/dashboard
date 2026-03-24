"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DocumentBase, DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import { useImproveDocument } from "@/hooks/queries/use-documenten";
import { X, ExternalLink, Copy, Calendar, User, Archive, FileDown, Loader2, ChevronDown, FileText, Maximize2, Minimize2, Send, Bot } from "lucide-react";

interface DocumentPreviewProps {
  document: DocumentBase | null;
  open: boolean;
  onClose: () => void;
  onDuplicate?: (doc: DocumentBase) => void;
  onArchive?: (doc: DocumentBase) => void;
}

const CHAT_HISTORY_KEY = (id: string) => `autronis-dochat-${id}`;

const AI_SHORTCUTS = [
  { label: "Samenvatten", prompt: "Geef een korte samenvatting van dit document in 3-4 zinnen" },
  { label: "Verbeterpunten", prompt: "Wat zijn de belangrijkste verbeterpunten voor dit document?" },
  { label: "Korter maken", prompt: "Hoe kan ik dit document korter en bondiger maken?" },
  { label: "Actiepunten", prompt: "Haal alle actiepunten en to-do items uit dit document" },
  { label: "LinkedIn post", prompt: "Schrijf een LinkedIn post gebaseerd op dit document, geschikt voor Autronis (AI-automatiseringsbureau)" },
  { label: "Taken aanmaken", prompt: "Maak een gestructureerde takenlijst van concrete acties die voortvloeien uit dit document" },
  { label: "Aanvullen", prompt: "Welke belangrijke onderdelen ontbreken nog in dit document?" },
];

export function DocumentPreview({ document: doc, open, onClose, onDuplicate, onArchive }: DocumentPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [contentHtml, setContentHtml] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Keep for potential future use
  const _improveDocument = useImproveDocument();

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChatMessages, typingText, aiChatLoading]);

  // Save chat history to localStorage
  useEffect(() => {
    if (!doc || aiChatMessages.length === 0) return;
    try {
      localStorage.setItem(CHAT_HISTORY_KEY(doc.notionId), JSON.stringify(aiChatMessages.slice(-30)));
    } catch { /* localStorage full */ }
  }, [doc, aiChatMessages]);

  const startTypewriter = useCallback((fullText: string) => {
    if (typingRef.current) clearInterval(typingRef.current);
    let i = 0;
    setTypingText("");
    typingRef.current = setInterval(() => {
      i++;
      setTypingText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(typingRef.current!);
        typingRef.current = null;
        setTypingText("");
        setAiChatMessages((prev) => [...prev, { role: "ai", text: fullText }]);
      }
    }, 10);
  }, []);

  const sendAiEdit = useCallback((input: string) => {
    if (!doc || !input.trim()) return;
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
        if (data.jobId) {
          setActiveJobId(data.jobId);
        } else {
          setAiChatMessages((prev) => [...prev, { role: "ai", text: data.fout || "Fout bij starten" }]);
          setAiChatLoading(false);
        }
      })
      .catch(() => {
        setAiChatMessages((prev) => [...prev, { role: "ai", text: "Kon AI niet bereiken" }]);
        setAiChatLoading(false);
      });
  }, [doc]);

  // Poll for job completion
  useEffect(() => {
    if (!activeJobId || !doc) return;

    pollingRef.current = setInterval(() => {
      fetch(`/api/documenten/${doc.notionId}/ai-edit?jobId=${activeJobId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.status === "klaar") {
            if (data.updatedHtml) setContentHtml(data.updatedHtml);
            setAiChatLoading(false);
            setActiveJobId(null);
            if (pollingRef.current) clearInterval(pollingRef.current);
            startTypewriter(data.antwoord || "Document bijgewerkt");
          } else if (data.status === "fout") {
            setAiChatMessages((prev) => [...prev, { role: "ai", text: `Fout: ${data.fout}` }]);
            setAiChatLoading(false);
            setActiveJobId(null);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        })
        .catch(() => {});
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJobId, doc, startTypewriter]);

  // On open: load localStorage history + fetch content + check for running job
  useEffect(() => {
    if (!open || !doc) {
      setContentHtml(null);
      setShowContent(false);
      setFullscreen(false);
      setAiChatMessages([]);
      setAiChatInput("");
      setTypingText("");
      setActiveJobId(null);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (typingRef.current) clearInterval(typingRef.current);
      return;
    }

    // Load chat history from localStorage
    try {
      const stored = localStorage.getItem(CHAT_HISTORY_KEY(doc.notionId));
      if (stored) setAiChatMessages(JSON.parse(stored));
    } catch { /* ignore */ }

    setContentLoading(true);
    fetch(`/api/documenten/${doc.notionId}/content`)
      .then((r) => r.json())
      .then((data) => { if (data.content) setContentHtml(data.content); })
      .catch(() => {})
      .finally(() => setContentLoading(false));

    fetch(`/api/documenten/${doc.notionId}/ai-edit`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "bezig") {
          setAiChatMessages((prev) => [...prev, { role: "user", text: data.instructie }, { role: "ai", text: "Bezig met bewerken..." }]);
          setAiChatLoading(true);
          setActiveJobId(data.jobId);
        }
      })
      .catch(() => {});
  }, [open, doc]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          {/* Panel — softer spring */}
          <motion.div
            ref={panelRef}
            initial={{ x: "100%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className={`fixed right-0 top-0 z-50 h-full bg-autronis-card border-l border-autronis-border shadow-2xl overflow-y-auto ${fullscreen ? "w-full max-w-full" : "w-[420px] max-w-[92vw]"}`}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-autronis-card border-b border-autronis-border px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                <span className={`text-xs font-semibold ${config.textClass}`}>{config.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { if (fullscreen) { setFullscreen(false); } else { setFullscreen(true); setShowContent(true); } }}
                  className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors"
                  title={fullscreen ? "Verkleinen" : "Volledig scherm lezen"}
                >
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-autronis-border text-autronis-text-secondary transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className={`py-6 space-y-6 ${fullscreen ? "px-10 max-w-3xl mx-auto" : "px-5"}`}>

              {/* Title */}
              <h2 className={`font-bold text-autronis-text-primary leading-tight ${fullscreen ? "text-2xl" : "text-lg"}`}>{doc.titel}</h2>

              {/* Summary — italics */}
              {doc.samenvatting && (
                <p className={`italic leading-relaxed text-autronis-text-secondary ${fullscreen ? "text-base" : "text-sm"}`}>
                  {doc.samenvatting}
                </p>
              )}

              {/* Metadata — hidden in fullscreen for clean reading */}
              {!fullscreen && (
                <div className="space-y-2.5">
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
                      <FileText className="w-4 h-4 text-autronis-text-secondary flex-shrink-0" />
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
                        <span className="text-xs text-autronis-text-secondary">Door</span>
                        <p className="text-sm text-autronis-text-primary">{doc.aangemaaktDoor}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Document inhoud */}
              <div>
                {!fullscreen && (
                  <button
                    onClick={() => setShowContent(!showContent)}
                    className="flex items-center gap-1.5 text-xs font-medium text-autronis-accent hover:text-autronis-accent-hover transition-colors mb-3"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Inhoud {showContent ? "verbergen" : "bekijken"}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showContent ? "" : "-rotate-90"}`} />
                  </button>
                )}

                <AnimatePresence>
                  {(showContent || fullscreen) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className={`rounded-xl bg-autronis-bg border border-autronis-border p-5 overflow-y-auto ${fullscreen ? "max-h-none" : "max-h-[50vh]"}`}>
                        {contentLoading ? (
                          <div className="flex items-center gap-2 text-xs text-autronis-text-secondary py-4 justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Inhoud laden...
                          </div>
                        ) : contentHtml ? (
                          <div
                            className={`prose max-w-none
                              [&_h1]:font-bold [&_h1]:text-autronis-text-primary [&_h1]:mt-5 [&_h1]:mb-2
                              [&_h2]:font-bold [&_h2]:text-autronis-text-primary [&_h2]:mt-4 [&_h2]:mb-1.5
                              [&_h3]:font-semibold [&_h3]:text-autronis-text-primary [&_h3]:mt-3 [&_h3]:mb-1
                              [&_p]:text-autronis-text-secondary [&_p]:leading-relaxed [&_p]:mb-2
                              [&_ul]:text-autronis-text-secondary [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:mb-2
                              [&_ol]:text-autronis-text-secondary [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:mb-2
                              [&_li]:mb-1 [&_li]:leading-relaxed
                              [&_pre]:bg-autronis-card [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-2
                              [&_code]:text-autronis-accent
                              [&_blockquote]:border-l-2 [&_blockquote]:border-autronis-accent/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-autronis-text-secondary
                              [&_strong]:text-autronis-text-primary [&_strong]:font-semibold
                              [&_hr]:border-autronis-border [&_hr]:my-4
                              [&_a]:text-autronis-accent [&_a]:underline
                              ${fullscreen
                                ? "[&_h1]:text-xl [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm [&_code]:text-sm"
                                : "[&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-xs [&_li]:text-xs [&_code]:text-xs"
                              }`}
                            dangerouslySetInnerHTML={{ __html: contentHtml }}
                          />
                        ) : (
                          <p className="text-xs text-autronis-text-secondary text-center py-4">Geen inhoud beschikbaar</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* AI Chat */}
              <div className="rounded-xl border border-autronis-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-autronis-bg border-b border-autronis-border">
                  <Bot className="w-4 h-4 text-autronis-accent" />
                  <span className="text-xs font-semibold text-autronis-text-primary">AI Assistent</span>
                  {aiChatMessages.length > 0 && (
                    <button
                      onClick={() => {
                        setAiChatMessages([]);
                        try { localStorage.removeItem(CHAT_HISTORY_KEY(doc.notionId)); } catch { /* ignore */ }
                      }}
                      className="ml-auto text-[10px] text-autronis-text-secondary hover:text-red-400 transition-colors"
                    >
                      Wis geschiedenis
                    </button>
                  )}
                </div>

                {/* Shortcuts */}
                <div className="flex flex-wrap gap-1.5 px-3 py-2.5 border-b border-autronis-border">
                  {AI_SHORTCUTS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setAiChatInput(s.prompt)}
                      disabled={aiChatLoading}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-autronis-bg border border-autronis-border text-autronis-text-secondary hover:text-autronis-accent hover:border-autronis-accent/30 transition-colors disabled:opacity-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Messages */}
                {(aiChatMessages.length > 0 || typingText || aiChatLoading) && (
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

                    {/* Typewriter live bubble */}
                    {typingText && (
                      <div className="flex justify-start">
                        <div className="max-w-[90%] px-3 py-2 rounded-xl rounded-bl-sm text-xs leading-relaxed bg-autronis-bg border border-autronis-border text-autronis-text-primary">
                          <Bot className="w-3 h-3 text-autronis-accent inline mr-1 -mt-0.5" />
                          <span className="whitespace-pre-wrap">{typingText}</span>
                          <span className="animate-pulse text-autronis-accent ml-0.5">▊</span>
                        </div>
                      </div>
                    )}

                    {/* Spinner: only while waiting for job (before typewriter starts) */}
                    {aiChatLoading && !typingText && (
                      <div className="flex justify-start">
                        <div className="bg-autronis-bg border border-autronis-border rounded-xl rounded-bl-sm px-3 py-2">
                          <Loader2 className="w-3.5 h-3.5 text-autronis-accent animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Input */}
                <div className="flex items-center gap-2 p-2.5 border-t border-autronis-border">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && aiChatInput.trim() && !aiChatLoading) {
                        e.preventDefault();
                        sendAiEdit(aiChatInput.trim());
                      }
                    }}
                    placeholder={aiChatLoading ? "AI is bezig..." : "Vraag iets of geef een instructie..."}
                    disabled={aiChatLoading}
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-autronis-accent/50 disabled:opacity-50"
                  />
                  <button
                    onClick={() => sendAiEdit(aiChatInput.trim())}
                    disabled={aiChatLoading || !aiChatInput.trim()}
                    className="p-2 bg-autronis-accent hover:bg-autronis-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Actions — hidden in fullscreen */}
              {!fullscreen && (
                <div className="space-y-2 pb-4">
                  <a
                    href={doc.notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Openen in Notion
                  </a>
                  {onDuplicate && (
                    <button
                      onClick={() => onDuplicate(doc)}
                      className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Dupliceren
                    </button>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-autronis-border text-sm text-autronis-text-secondary hover:text-autronis-text-primary hover:border-autronis-accent/50 transition-colors"
                  >
                    <FileDown className="w-4 h-4" />
                    Exporteer als PDF
                  </button>
                  {onArchive && (
                    <button
                      onClick={() => { onArchive(doc); onClose(); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                      Archiveren
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
