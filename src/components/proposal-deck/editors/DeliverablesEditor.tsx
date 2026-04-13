// src/components/proposal-deck/editors/DeliverablesEditor.tsx
"use client";

import { Plus, X } from "lucide-react";
import { DeliverablesSlide } from "../types";
import { BackgroundImageUploader } from "../BackgroundImageUploader";

export function DeliverablesEditor({
  slide,
  onChange,
}: {
  slide: DeliverablesSlide;
  onChange: (next: DeliverablesSlide) => void;
}) {
  const setItem = (idx: number, val: string) => {
    const items = [...slide.items];
    items[idx] = val;
    onChange({ ...slide, items });
  };
  const removeItem = (idx: number) => {
    onChange({ ...slide, items: slide.items.filter((_, i) => i !== idx) });
  };
  const addItem = () => onChange({ ...slide, items: [...slide.items, ""] });

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
          Bullets
        </label>
        <div className="space-y-2">
          {slide.items.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <span className="text-autronis-text-secondary text-sm font-semibold self-center tabular-nums">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => setItem(idx, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-2 text-autronis-text-secondary hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-autronis-accent hover:bg-autronis-accent/10"
        >
          <Plus className="w-4 h-4" />
          Bullet toevoegen
        </button>
      </div>
      <BackgroundImageUploader
        value={slide.bgImageUrl}
        onChange={(url) => onChange({ ...slide, bgImageUrl: url })}
      />
    </div>
  );
}
