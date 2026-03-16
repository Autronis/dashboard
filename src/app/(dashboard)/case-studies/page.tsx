"use client";

import { ExternalLink, Video, FileText, Image, Loader2 } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { useState } from "react";

const GENERATOR_URL = "http://localhost:3456";

interface CaseStudyResult {
  success: boolean;
  slug: string;
  titel: string;
  voiceoverDuur: number;
  urls: {
    page: string;
    markdown: string;
    caseStudy: string;
    banners: string[];
  };
  error?: string;
}

export default function CaseStudiesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaseStudyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const stapTitels = formData.getAll("stapTitel") as string[];
    const stapBeschrijvingen = formData.getAll("stapBeschrijving") as string[];
    const stappen = stapTitels
      .map((titel, i) => ({ titel, beschrijving: stapBeschrijvingen[i] || "" }))
      .filter(s => s.titel.trim());

    const body = {
      klantnaam: formData.get("klantnaam"),
      klantBeschrijving: formData.get("klantBeschrijving"),
      klantBranche: formData.get("klantBranche"),
      probleem: formData.get("probleem"),
      probleemMetric: {
        waarde: formData.get("probleemMetricWaarde"),
        label: formData.get("probleemMetricLabel"),
      },
      oplossing: formData.get("oplossing"),
      stappen,
      resultaatMetric: {
        van: formData.get("resultaatVan"),
        naar: formData.get("resultaatNaar"),
        label: "Resultaat",
      },
      extraContext: formData.get("extraContext") || undefined,
    };

    try {
      const res = await fetch(`${GENERATOR_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: CaseStudyResult = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Er is iets misgegaan");
      }
    } catch {
      setError("Kan geen verbinding maken met de Case Study Generator. Draai eerst: npm run web");
    }

    setLoading(false);
  }

  return (
    <PageTransition>
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Case Study Generator</h1>
        <p className="text-muted-foreground mt-1">
          Genereer automatisch een case study, voiceover script, banners en pagina.
        </p>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm text-muted-foreground">
          Generator draait op <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{GENERATOR_URL}</code>
        </span>
        <a
          href={GENERATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm text-primary hover:underline flex items-center gap-1"
        >
          Open standalone <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Formulier */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary uppercase tracking-wider">Klantnaam</label>
            <input name="klantnaam" required placeholder="Bijv. Jobby"
              className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary uppercase tracking-wider">Branche</label>
            <input name="klantBranche" placeholder="Bijv. HR-tech"
              className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-primary uppercase tracking-wider">Klant beschrijving</label>
          <textarea name="klantBeschrijving" rows={2} placeholder="Wie is de klant?"
            className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-primary uppercase tracking-wider">Probleem</label>
          <textarea name="probleem" rows={2} placeholder="Wat was het probleem?"
            className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary uppercase tracking-wider">Probleem metric</label>
            <input name="probleemMetricWaarde" placeholder="Bijv. 25 minuten per lead"
              className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary uppercase tracking-wider">Metric label</label>
            <input name="probleemMetricLabel" placeholder="Bijv. Tijd per lead"
              className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-primary uppercase tracking-wider">Oplossing</label>
          <textarea name="oplossing" rows={2} placeholder="Wat heeft Autronis gebouwd?"
            className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        {/* Stappen */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-primary uppercase tracking-wider">Stappen</label>
          {[1, 2, 3].map(i => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <input name="stapTitel" placeholder={`Stap ${i} titel`}
                className="rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input name="stapBeschrijving" placeholder="Beschrijving"
                className="rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary uppercase tracking-wider">Resultaat: van</label>
            <input name="resultaatVan" placeholder="Bijv. 25 minuten per lead"
              className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-primary uppercase tracking-wider">Resultaat: naar</label>
            <input name="resultaatNaar" placeholder="Bijv. 5 minuten"
              className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-primary uppercase tracking-wider">Extra context (optioneel)</label>
          <textarea name="extraContext" rows={2} placeholder="Eventuele extra informatie..."
            className="w-full rounded-xl border border-border/50 bg-card/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-primary py-4 text-primary-foreground font-bold text-base hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed btn-press">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Genereren... (±30 seconden)
            </span>
          ) : (
            "Genereer Case Study"
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Resultaat */}
      {result && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4">
          <h3 className="text-lg font-bold text-primary">{result.titel}</h3>
          <p className="text-sm text-muted-foreground">Voiceover: {result.voiceoverDuur}s</p>
          <div className="flex flex-wrap gap-2">
            <a href={`${GENERATOR_URL}${result.urls.page}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
              <FileText className="h-4 w-4" /> Case Study Pagina
            </a>
            <a href={`${GENERATOR_URL}${result.urls.markdown}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
              <FileText className="h-4 w-4" /> Markdown
            </a>
            {result.urls.banners.map((url, i) => (
              <a key={i} href={`${GENERATOR_URL}${url}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
                <Image className="h-4 w-4" /> Banner {i + 1}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
