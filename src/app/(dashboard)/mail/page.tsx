"use client";

import { useState, useRef, useCallback } from "react";
import {
  Mail,
  Upload,
  Loader2,
  Copy,
  Check,
  Sparkles,
  ImagePlus,
  RefreshCw,
  User,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";

interface MailReply {
  afzender?: string;
  onderwerp?: string;
  samenvatting?: string;
  reactieNodig?: boolean;
  antwoord?: string;
  suggesties?: string[];
}

type Toon = "professioneel" | "vriendelijk" | "kort" | "formeel";

export default function MailPage() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [toon, setToon] = useState<Toon>("professioneel");
  const [bezig, setBezig] = useState(false);
  const [reply, setReply] = useState<MailReply | null>(null);
  const [antwoord, setAntwoord] = useState("");
  const [gekopieerd, setGekopieerd] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setReply(null);
    setAntwoord("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) handleFile(f);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) handleFile(f);
        break;
      }
    }
  }

  async function handleAnalyseer() {
    if (!file) return;
    setBezig(true);
    setReply(null);

    try {
      const formData = new FormData();
      formData.append("screenshot", file);
      formData.append("toon", toon);
      if (context.trim()) formData.append("context", context.trim());

      const res = await fetch("/api/mail/reply", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.fout || "Analyse mislukt");
      }

      const data = (await res.json()) as MailReply;
      setReply(data);
      setAntwoord(data.antwoord || "");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Er ging iets mis", "fout");
    } finally {
      setBezig(false);
    }
  }

  function handleKopieer() {
    navigator.clipboard.writeText(antwoord);
    setGekopieerd(true);
    addToast("Antwoord gekopieerd", "succes");
    setTimeout(() => setGekopieerd(false), 2000);
  }

  const toonOpties: { value: Toon; label: string }[] = [
    { value: "professioneel", label: "Professioneel" },
    { value: "vriendelijk", label: "Vriendelijk" },
    { value: "kort", label: "Kort & bondig" },
    { value: "formeel", label: "Formeel" },
  ];

  return (
    <PageTransition>
      <div
        className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6"
        onPaste={handlePaste}
      >
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary tracking-tight flex items-center gap-3">
            <Mail className="w-8 h-8 text-autronis-accent" />
            Mail Assistent
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-1">
            Upload een screenshot van een mail en ontvang direct een concept-antwoord.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Upload + Settings */}
          <div className="space-y-4">
            {/* Upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                preview
                  ? "border-autronis-accent/40 bg-autronis-accent/5"
                  : "border-autronis-border hover:border-autronis-accent/40 hover:bg-autronis-card/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />

              {preview ? (
                <div className="space-y-3">
                  <img
                    src={preview}
                    alt="Mail screenshot"
                    className="max-h-64 mx-auto rounded-xl border border-autronis-border shadow-lg"
                  />
                  <p className="text-xs text-autronis-text-secondary">
                    Klik of sleep om te vervangen
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <ImagePlus className="w-10 h-10 text-autronis-text-secondary/40 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-autronis-text-primary">
                      Sleep een screenshot hierheen
                    </p>
                    <p className="text-xs text-autronis-text-secondary mt-1">
                      Of klik om te uploaden · Je kunt ook plakken met Ctrl+V
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Toon selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-autronis-text-secondary">Toon</label>
              <div className="flex gap-2">
                {toonOpties.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setToon(t.value)}
                    className={cn(
                      "flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                      toon === t.value
                        ? "bg-autronis-accent/15 border-autronis-accent/40 text-autronis-accent"
                        : "bg-autronis-card border-autronis-border text-autronis-text-secondary hover:text-autronis-text-primary"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extra context */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-autronis-text-secondary">
                Extra context <span className="opacity-50">(optioneel)</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="bijv. 'We hebben hier geen capaciteit voor' of 'Stuur ze door naar Syb'"
                rows={2}
                className="w-full bg-autronis-bg border border-autronis-border rounded-lg px-3 py-2.5 text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-none"
              />
            </div>

            {/* Analyse button */}
            <button
              onClick={handleAnalyseer}
              disabled={!file || bezig}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bezig ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {bezig ? "Analyseren..." : "Genereer antwoord"}
            </button>
          </div>

          {/* Right: Result */}
          <div className="space-y-4">
            {reply ? (
              <>
                {/* Mail info */}
                <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-autronis-text-secondary">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-medium">{reply.afzender || "Onbekend"}</span>
                  </div>
                  {reply.onderwerp && (
                    <div className="flex items-center gap-2 text-xs text-autronis-text-secondary">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{reply.onderwerp}</span>
                    </div>
                  )}
                  {reply.samenvatting && (
                    <p className="text-sm text-autronis-text-primary bg-autronis-bg/50 rounded-xl p-3">
                      {reply.samenvatting}
                    </p>
                  )}
                  {reply.reactieNodig === false && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-emerald-400 font-medium">
                        Geen reactie nodig — informatief bericht
                      </p>
                    </div>
                  )}
                </div>

                {/* Editable reply */}
                {reply.reactieNodig !== false && (
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-autronis-text-primary">
                        Concept antwoord
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={handleAnalyseer}
                          disabled={bezig}
                          className="p-1.5 rounded-lg text-autronis-text-secondary hover:text-autronis-accent transition-colors"
                          title="Opnieuw genereren"
                        >
                          <RefreshCw className={cn("w-4 h-4", bezig && "animate-spin")} />
                        </button>
                        <button
                          onClick={handleKopieer}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-autronis-accent/10 hover:bg-autronis-accent/20 text-autronis-accent rounded-lg text-xs font-medium transition-colors"
                        >
                          {gekopieerd ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {gekopieerd ? "Gekopieerd" : "Kopieer"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={antwoord}
                      onChange={(e) => setAntwoord(e.target.value)}
                      rows={10}
                      className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-4 py-3 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors resize-y leading-relaxed"
                    />
                  </div>
                )}

                {/* Suggestions */}
                {reply.suggesties && reply.suggesties.length > 0 && (
                  <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-autronis-text-secondary uppercase tracking-wider mb-3">
                      Alternatieve aanpakken
                    </h3>
                    <ul className="space-y-2">
                      {reply.suggesties.map((s, i) => (
                        <li
                          key={i}
                          className="text-sm text-autronis-text-secondary bg-autronis-bg/50 rounded-lg px-3 py-2"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-autronis-card border border-autronis-border rounded-2xl p-12 text-center">
                <Mail className="w-10 h-10 text-autronis-text-secondary/20 mx-auto mb-3" />
                <p className="text-sm text-autronis-text-secondary">
                  {file ? "Klik op 'Genereer antwoord' om te starten" : "Upload een screenshot om te beginnen"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
