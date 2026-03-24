"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Send, Loader2, FileText, ExternalLink, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DOCUMENT_TYPE_CONFIG } from "@/types/documenten";
import type { DocumentType } from "@/types/documenten";

interface AiCreatedDocument {
  notionId: string;
  notionUrl: string;
  type: DocumentType;
  titel: string;
  samenvatting: string;
  klantNaam?: string;
  projectNaam?: string;
  content: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  document?: AiCreatedDocument;
}

export function AiDocumentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-autronis-accent text-white text-sm font-semibold hover:from-violet-500 hover:to-autronis-accent-hover transition-all shadow-lg shadow-violet-600/20 btn-press overflow-hidden"
    >
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "linear", repeatDelay: 2.5 }}
      />
      <Sparkles className="w-4 h-4 relative z-10" />
      <span className="relative z-10">AI Document</span>
    </button>
  );
}

export function AiDocumentPanel({ onClose }: { onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setLoading(true);

    try {
      const res = await fetch("/api/documenten/ai-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.fout ?? "Fout bij genereren");

      const doc = data.document as AiCreatedDocument;
      const config = DOCUMENT_TYPE_CONFIG[doc.type];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `${config.emoji} ${doc.titel} aangemaakt als ${config.label}${doc.klantNaam ? ` voor ${doc.klantNaam}` : ""}.\n\n${doc.samenvatting}`,
          document: doc,
        },
      ]);

      addToast(`Document "${doc.titel}" aangemaakt in Notion`, "succes");
      queryClient.invalidateQueries({ queryKey: ["documenten"] });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Fout: ${err instanceof Error ? err.message : "Kon document niet genereren"}` },
      ]);
      addToast("Document aanmaken mislukt", "fout");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="rounded-2xl bg-autronis-card border border-autronis-border overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-autronis-border bg-gradient-to-r from-violet-600/10 to-autronis-accent/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-autronis-text-primary">AI Document Creator</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-autronis-border transition-colors">
          <X className="w-4 h-4 text-autronis-text-secondary" />
        </button>
      </div>

      {/* Messages */}
      <div className="max-h-96 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-violet-400 opacity-50" />
            <p className="text-sm text-autronis-text-secondary">
              Beschrijf welk document je wilt maken.
            </p>
            <p className="text-xs text-autronis-text-secondary mt-1 opacity-70">
              Bijv: &quot;Maak een offerte voor klant X voor een dashboard project van 3 weken&quot;
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-autronis-accent/20 text-autronis-text-primary"
                  : "bg-autronis-border/50 text-autronis-text-primary"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.document && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <a
                      href={msg.document.notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-accent/20 text-autronis-accent text-xs font-medium hover:bg-autronis-accent/30 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Openen in Notion
                    </a>
                    <button
                      onClick={() => setExpandedContent(expandedContent === msg.document!.notionId ? null : msg.document!.notionId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-border text-autronis-text-secondary text-xs font-medium hover:text-autronis-text-primary transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Inhoud
                      {expandedContent === msg.document.notionId ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                  {expandedContent === msg.document.notionId && (
                    <div className="rounded-lg bg-autronis-bg/50 border border-autronis-border p-3 text-xs text-autronis-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {msg.document.content}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl px-4 py-2.5 bg-autronis-border/50">
              <div className="flex items-center gap-2 text-sm text-autronis-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                Document wordt gegenereerd...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-autronis-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Beschrijf het document dat je wilt maken..."
            rows={1}
            className="flex-1 resize-none rounded-xl bg-autronis-bg border border-autronis-border px-4 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:border-autronis-accent"
          />
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim() || loading}
            className="p-2.5 rounded-xl bg-autronis-accent text-autronis-bg hover:bg-autronis-accent-hover transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
