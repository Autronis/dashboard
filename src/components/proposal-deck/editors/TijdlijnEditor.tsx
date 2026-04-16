// src/components/proposal-deck/editors/TijdlijnEditor.tsx
"use client";

import { Plus, X } from "lucide-react";
import { TijdlijnSlide } from "../types";
import { BackgroundImageUploader } from "../BackgroundImageUploader";

export function TijdlijnEditor({
  slide,
  onChange,
}: {
  slide: TijdlijnSlide;
  onChange: (next: TijdlijnSlide) => void;
}) {
  const setFase = (idx: number, field: "naam" | "duur" | "omschrijving", val: string) => {
    const fases = [...slide.fases];
    fases[idx] = { ...fases[idx], [field]: val };
    onChange({ ...slide, fases });
  };
  const removeFase = (idx: number) =>
    onChange({ ...slide, fases: slide.fases.filter((_, i) => i !== idx) });
  const addFase = () =>
    onChange({
      ...slide,
      fases: [...slide.fases, { naam: "", duur: "", omschrijving: "" }],
    });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Titel
        </label>
        <input
          type="text"
          value={slide.titel}
          onChange={(e) => onChange({ ...slide, titel: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-autronis-text-secondary mb-1.5">
          Fases
        </label>
        <div className="space-y-3">
          {slide.fases.map((fase, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-autronis-border bg-autronis-bg space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-autronis-text-secondary">
                  Fase {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeFase(idx)}
                  className="p-1 text-autronis-text-secondary hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Naam (bv. Kickoff)"
                  value={fase.naam}
                  onChange={(e) => setFase(idx, "naam", e.target.value)}
                  className="px-2 py-1.5 rounded border border-autronis-border bg-autronis-card text-autronis-text-primary text-sm"
                />
                <input
                  type="text"
                  placeholder="Duur (bv. 2 weken)"
                  value={fase.duur}
                  onChange={(e) => setFase(idx, "duur", e.target.value)}
                  className="px-2 py-1.5 rounded border border-autronis-border bg-autronis-card text-autronis-text-primary text-sm"
                />
              </div>
              <input
                type="text"
                placeholder="Omschrijving"
                value={fase.omschrijving}
                onChange={(e) => setFase(idx, "omschrijving", e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-autronis-border bg-autronis-card text-autronis-text-primary text-sm"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addFase}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-autronis-accent hover:bg-autronis-accent/10"
        >
          <Plus className="w-4 h-4" />
          Fase toevoegen
        </button>
      </div>
      <BackgroundImageUploader
        value={slide.bgImageUrl}
        onChange={(url) => onChange({ ...slide, bgImageUrl: url })}
      />
    </div>
  );
}
