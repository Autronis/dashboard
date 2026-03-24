"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Clock, Calendar, CheckSquare, Sparkles, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgendaTaak } from "@/hooks/queries/use-agenda";
import Link from "next/link";

const DUUR_OPTIES = [
  { label: "15 min", waarde: 15 },
  { label: "30 min", waarde: 30 },
  { label: "45 min", waarde: 45 },
  { label: "1 uur", waarde: 60 },
  { label: "1,5 uur", waarde: 90 },
  { label: "2 uur", waarde: 120 },
  { label: "3 uur", waarde: 180 },
  { label: "4 uur", waarde: 240 },
];

interface AiResult {
  geschatteDuur: number;
  toelichting: string;
  stappen: string[];
}

interface PlanTaakModalProps {
  taak: AgendaTaak;
  onClose: () => void;
  onPlan: (id: number, start: string, eind: string, duur: number) => void;
  isPending: boolean;
  prefillDatum?: string;
  prefillTijd?: string;
}

export function PlanTaakModal({ taak, onClose, onPlan, isPending, prefillDatum, prefillTijd }: PlanTaakModalProps) {
  const vandaag = new Date();
  const defaultDatum = prefillDatum || `${vandaag.getFullYear()}-${String(vandaag.getMonth() + 1).padStart(2, "0")}-${String(vandaag.getDate()).padStart(2, "0")}`;
  const defaultTijd = prefillTijd || "09:00";

  const [datum, setDatum] = useState(defaultDatum);
  const [tijd, setTijd] = useState(defaultTijd);
  const [duur, setDuur] = useState(taak.geschatteDuur || 30);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);

  const prioColor = taak.prioriteit === "hoog" ? "text-red-400" : taak.prioriteit === "normaal" ? "text-orange-400" : "text-gray-400";
  const prioBg = taak.prioriteit === "hoog" ? "bg-red-500/10" : taak.prioriteit === "normaal" ? "bg-orange-500/10" : "bg-gray-500/10";

  const fetchAiSchatting = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/agenda/taken/schat-duur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titel: taak.titel,
          projectNaam: taak.projectNaam,
        }),
      });
      if (res.ok) {
        const data = await res.json() as AiResult;
        if (!taak.geschatteDuur) setDuur(data.geschatteDuur);
        setAiResult(data);
      }
    } catch {
      // Stil falen
    }
    setAiLoading(false);
  }, [taak.titel, taak.projectNaam, taak.geschatteDuur]);

  useEffect(() => {
    fetchAiSchatting();
  }, [fetchAiSchatting]);

  function handlePlan() {
    const startStr = `${datum}T${tijd}:00`;
    const startDate = new Date(startStr);
    const eindDate = new Date(startDate.getTime() + duur * 60000);
    const eindStr = eindDate.toISOString();
    onPlan(taak.id, startStr, eindStr, duur);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="glass-modal border border-autronis-border rounded-2xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <CheckSquare className={cn("w-5 h-5 mt-0.5 flex-shrink-0", prioColor)} />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-autronis-text-primary">{taak.titel}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", prioBg, prioColor)}>
                  {taak.prioriteit}
                </span>
                {taak.projectNaam && (
                  <span className="text-xs text-autronis-text-secondary">{taak.projectNaam}</span>
                )}
                {taak.deadline && (
                  <span className="text-xs text-autronis-text-secondary/60 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(taak.deadline).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
              {/* Link naar taak */}
              <Link
                href="/taken"
                className="inline-flex items-center gap-1 text-[11px] text-autronis-accent hover:text-autronis-accent-hover mt-1.5 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
                Bekijk in taken
              </Link>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* AI Stappenplan */}
          {(aiLoading || (aiResult?.stappen && aiResult.stappen.length > 0)) && (
            <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                {aiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span className="text-xs font-semibold text-purple-300">
                  {aiLoading ? "Analyse bezig..." : "Stappenplan"}
                </span>
                {aiResult?.toelichting && !aiLoading && (
                  <span className="text-[10px] text-purple-400/60 ml-auto">{aiResult.toelichting}</span>
                )}
              </div>
              {aiResult?.stappen && aiResult.stappen.length > 0 && (
                <ol className="space-y-1.5 ml-0.5">
                  {aiResult.stappen.map((stap, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-purple-400 bg-purple-500/15 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-xs text-purple-200/80 leading-relaxed">{stap}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Niet-AI: handmatig triggeren */}
          {!aiLoading && !aiResult && (
            <button
              onClick={fetchAiSchatting}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI analyse + stappenplan ophalen
            </button>
          )}

          {/* Datum + tijd */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-autronis-text-secondary">Datum</label>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-autronis-text-secondary">Starttijd</label>
              <input
                type="time"
                value={tijd}
                onChange={(e) => setTijd(e.target.value)}
                className="w-full bg-autronis-bg border border-autronis-border rounded-xl px-3 py-2.5 text-sm text-autronis-text-primary focus:outline-none focus:ring-2 focus:ring-autronis-accent/50 focus:border-autronis-accent transition-colors"
              />
            </div>
          </div>

          {/* Duur */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-autronis-text-secondary flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Duur
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {DUUR_OPTIES.map((opt) => (
                <button
                  key={opt.waarde}
                  onClick={() => setDuur(opt.waarde)}
                  className={cn(
                    "px-2 py-2 rounded-lg border text-xs font-medium transition-colors",
                    duur === opt.waarde
                      ? "border-autronis-accent bg-autronis-accent/10 text-autronis-accent"
                      : "border-autronis-border text-autronis-text-secondary hover:border-autronis-accent/40"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-autronis-bg/40 border border-autronis-border/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-autronis-accent" />
              <span className="text-autronis-text-primary font-medium">
                {new Date(`${datum}T${tijd}`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1.5">
              <Clock className="w-4 h-4 text-autronis-accent" />
              <span className="text-autronis-text-primary tabular-nums">
                {tijd} – {(() => {
                  const start = new Date(`${datum}T${tijd}:00`);
                  const eind = new Date(start.getTime() + duur * 60000);
                  return eind.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
                })()}
              </span>
              <span className="text-autronis-text-secondary text-xs">({duur} min)</span>
            </div>
          </div>
        </div>

        {/* Acties */}
        <div className="flex items-center justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-autronis-text-secondary hover:text-autronis-text-primary transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handlePlan}
            disabled={isPending || !datum || !tijd}
            className="px-6 py-2.5 bg-autronis-accent hover:bg-autronis-accent-hover text-autronis-bg rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-autronis-accent/20 disabled:opacity-50"
          >
            {isPending ? "Inplannen..." : "Inplannen"}
          </button>
        </div>
      </div>
    </div>
  );
}
