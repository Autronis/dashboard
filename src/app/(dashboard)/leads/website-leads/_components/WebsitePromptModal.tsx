"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X, Copy, Check, Sparkles, RefreshCw, Mail, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface WebsitePromptModalProps {
  leadId: string;
  bedrijfsnaam: string;
  onClose: () => void;
}

interface PitchMail {
  subject: string;
  body: string;
  recipientEmail: string | null;
}

export function WebsitePromptModal({ leadId, bedrijfsnaam, onClose }: WebsitePromptModalProps) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [extraContext, setExtraContext] = useState("");

  // Pitch-mail state
  const [mailLoading, setMailLoading] = useState(false);
  const [mailError, setMailError] = useState<string | null>(null);
  const [pitchMail, setPitchMail] = useState<PitchMail | null>(null);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function generate(extra?: string) {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/leads/website-leads/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, extraContext: extra ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || `HTTP ${res.status}`);
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  function copyToClipboard() {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt).then(
      () => {
        setCopied(true);
        addToast("Prompt gekopieerd", "succes");
        setTimeout(() => setCopied(false), 2000);
      },
      () => addToast("Kopiëren mislukt", "fout"),
    );
  }

  async function generatePitchMail() {
    setMailLoading(true);
    setMailError(null);
    setSent(false);
    try {
      const res = await fetch("/api/leads/website-leads/pitch-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          websitePrompt: prompt ?? undefined,
          extraContext: extraContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || `HTTP ${res.status}`);
      setPitchMail({
        subject: data.subject,
        body: data.body,
        recipientEmail: data.recipientEmail,
      });
      setEditedSubject(data.subject);
      setEditedBody(data.body);
    } catch (err) {
      setMailError(err instanceof Error ? err.message : "Mail genereren mislukt");
    } finally {
      setMailLoading(false);
    }
  }

  async function sendPitchMail() {
    if (!pitchMail?.recipientEmail || !editedSubject.trim() || !editedBody.trim()) {
      addToast("Onderwerp, body en email-adres zijn verplicht", "fout");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/leads/website-leads/pitch-mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          recipientEmail: pitchMail.recipientEmail,
          subject: editedSubject,
          body: editedBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || `HTTP ${res.status}`);
      setSent(true);
      addToast("Pitch-mail verstuurd (signature volgt via Syb's flow)", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Versturen mislukt", "fout");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="bg-autronis-card rounded-2xl border border-autronis-border w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-autronis-border">
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles className="w-5 h-5 text-autronis-accent flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-autronis-text-primary truncate">
                Website-prompt voor {bedrijfsnaam}
              </h2>
              <p className="text-xs text-autronis-text-secondary">
                Plak het resultaat in Lovable of v0 om een complete website te genereren.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-autronis-border/40 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-autronis-text-secondary" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-3 py-16 text-autronis-text-secondary">
              <Loader2 className="w-5 h-5 animate-spin text-autronis-accent" />
              <span className="text-sm">Claude genereert de website-prompt &hellip;</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
              <p className="font-medium mb-1">Er ging iets mis</p>
              <p className="text-red-400/80">{error}</p>
              <button
                onClick={() => void generate(extraContext || undefined)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Opnieuw proberen
              </button>
            </div>
          )}

          {prompt && !loading && (
            <>
              <div className="relative bg-autronis-bg border border-autronis-border rounded-xl p-4 font-mono text-xs text-autronis-text-primary leading-relaxed whitespace-pre-wrap max-h-[40vh] overflow-y-auto">
                {prompt}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-autronis-text-secondary">
                  Extra context (optioneel) — bijv. doelgroep, gewenste tone, specifieke features
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={extraContext}
                    onChange={(e) => setExtraContext(e.target.value)}
                    placeholder="Bijv. 'focus op B2B automotive, strakke Bauhaus uitstraling'"
                    className="flex-1 bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50"
                  />
                  <button
                    onClick={() => void generate(extraContext)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border text-xs font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Regenereer
                  </button>
                </div>
              </div>

              {/* Pitch-mail sectie */}
              <div className="border-t border-autronis-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-autronis-text-primary">
                      Pitch-mail naar {bedrijfsnaam}
                    </h3>
                  </div>
                  {!pitchMail && (
                    <button
                      onClick={() => void generatePitchMail()}
                      disabled={mailLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    >
                      {mailLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {mailLoading ? "Genereren..." : "Genereer pitch-mail"}
                    </button>
                  )}
                </div>

                {mailError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                    {mailError}
                  </div>
                )}

                {pitchMail && (
                  <div className="space-y-3 bg-autronis-bg rounded-xl p-4 border border-autronis-border">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-autronis-text-secondary/70 mb-1">
                        Naar
                      </label>
                      <div className="text-xs text-autronis-text-primary px-3 py-2 rounded-lg bg-autronis-card border border-autronis-border/60">
                        {pitchMail.recipientEmail || (
                          <span className="text-red-400">Geen email-adres bekend — kan niet versturen</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-autronis-text-secondary/70 mb-1">
                        Onderwerp
                      </label>
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="w-full bg-autronis-card border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wide text-autronis-text-secondary/70 mb-1">
                        Body (signature komt automatisch van Syb&apos;s n8n)
                      </label>
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        rows={10}
                        className="w-full bg-autronis-card border border-autronis-border rounded-lg px-3 py-2 text-xs text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => void generatePitchMail()}
                        disabled={mailLoading || sending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-autronis-card border border-autronis-border text-[11px] font-medium text-autronis-text-secondary hover:border-autronis-accent/40 hover:text-autronis-text-primary transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Regenereer
                      </button>
                      <button
                        onClick={() => void sendPitchMail()}
                        disabled={sending || sent || !pitchMail.recipientEmail}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                          sent
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                            : "bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50",
                        )}
                      >
                        {sending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : sent ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        {sending ? "Versturen..." : sent ? "Verstuurd" : "Verstuur via Syb's flow"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-autronis-border bg-autronis-bg/30">
          <p className="text-[11px] text-autronis-text-tertiary">
            Tip: begin in Lovable met &quot;Build this:&quot; gevolgd door de prompt.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
            >
              Sluiten
            </button>
            <button
              onClick={copyToClipboard}
              disabled={!prompt || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Gekopieerd" : "Kopieer prompt"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
