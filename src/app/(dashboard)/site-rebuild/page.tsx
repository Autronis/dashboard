"use client";

import { useState, useRef } from "react";
import { Sparkles, Loader2, Download, Link as LinkIcon, Image as ImageIcon, X } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/hooks/use-toast";

type Result = {
  html: string;
  jsxBody: string;
  brandName: string;
  accent: string;
  source: { kind: "url" | "logo"; url?: string; title?: string | null };
};

export default function SiteRebuildPage() {
  const { addToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"url" | "logo">("url");
  const [url, setUrl] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [accent, setAccent] = useState("#17B8A5");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const onLogoPick = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      addToast("Logo te groot (max 5 MB)", "fout");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setLogoBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!brandName.trim()) {
      addToast("Brand naam is verplicht", "fout");
      return;
    }
    if (mode === "url" && !url.trim()) {
      addToast("Plak een URL", "fout");
      return;
    }
    if (mode === "logo" && !logoBase64) {
      addToast("Upload een logo", "fout");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/site-rebuild/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          url: url.trim() || undefined,
          logoBase64: logoBase64 || undefined,
          brandName: brandName.trim(),
          accent,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.fout || "Generatie mislukt");
      setResult(data);
      addToast("Site gegenereerd", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Mislukt", "fout");
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/site-rebuild/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: result.brandName,
          accent: result.accent,
          jsxBody: result.jsxBody,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ fout: "download mislukt" }));
        throw new Error(d.fout || "download mislukt");
      }
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const slug = result.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      a.download = `${slug}-site.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      addToast("ZIP gedownload", "succes");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Download mislukt", "fout");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-autronis-accent/10 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-autronis-accent" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-autronis-accent">
              Site Rebuild
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-autronis-text-primary">
            Upgrade een <span className="text-autronis-text-secondary">klantwebsite</span>
          </h1>
          <p className="text-sm text-autronis-text-secondary mt-2">
            Plak een URL of upload een logo — krijg een dark-premium landing page inclusief
            downloadable Next.js project.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-5">
            {/* Mode */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
                Input
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("url")}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    mode === "url"
                      ? "bg-autronis-accent text-autronis-bg"
                      : "border border-autronis-border bg-autronis-bg text-autronis-text-primary hover:border-autronis-accent/40"
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                  Bestaande URL
                </button>
                <button
                  type="button"
                  onClick={() => setMode("logo")}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                    mode === "logo"
                      ? "bg-autronis-accent text-autronis-bg"
                      : "border border-autronis-border bg-autronis-bg text-autronis-text-primary hover:border-autronis-accent/40"
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  Alleen logo
                </button>
              </div>
            </div>

            {mode === "url" ? (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
                  URL
                </label>
                <input
                  type="url"
                  placeholder="https://klant.nl"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-primary"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
                  Logo (PNG/JPG/WebP, max 5 MB)
                </label>
                {logoBase64 ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-autronis-border bg-autronis-bg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoBase64} alt="logo" className="w-16 h-16 object-contain rounded" />
                    <span className="text-sm text-autronis-text-primary flex-1">
                      Logo geladen
                    </span>
                    <button
                      type="button"
                      onClick={() => setLogoBase64(null)}
                      className="p-2 text-autronis-text-secondary hover:text-red-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full px-4 py-6 rounded-xl border-2 border-dashed border-autronis-border hover:border-autronis-accent/40 text-sm text-autronis-text-secondary"
                  >
                    Klik om logo te uploaden
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onLogoPick(f);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
                Brand naam *
              </label>
              <input
                type="text"
                placeholder="Bosch Bouw"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
                Accent kleur
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-12 h-11 rounded-xl border border-autronis-border bg-autronis-bg cursor-pointer"
                />
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-primary font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-2">
                Extra instructies (optioneel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Focus op duurzaamheid, doelgroep is 40+, hero video al aanwezig..."
                className="w-full px-3 py-2.5 rounded-xl border border-autronis-border bg-autronis-bg text-autronis-text-primary resize-none"
              />
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-autronis-accent text-autronis-bg font-semibold disabled:opacity-50 hover:bg-autronis-accent-hover transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Genereren... (kan ~30s duren)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Genereer site
                </>
              )}
            </button>
          </div>

          {/* Preview */}
          <div className="bg-autronis-card border border-autronis-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary">
                Preview
              </div>
              {result && (
                <button
                  type="button"
                  onClick={downloadZip}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-autronis-accent text-autronis-bg text-sm font-semibold disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {downloading ? "Inpakken..." : "Download ZIP"}
                </button>
              )}
            </div>

            {result ? (
              <iframe
                title="Site preview"
                srcDoc={result.html}
                sandbox="allow-scripts"
                className="w-full h-[680px] rounded-xl border border-autronis-border bg-black"
              />
            ) : (
              <div className="h-[680px] rounded-xl border-2 border-dashed border-autronis-border flex items-center justify-center text-sm text-autronis-text-secondary">
                {loading ? "Claude is aan het bouwen..." : "Preview verschijnt hier na genereren"}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
