// src/components/proposal-deck/editors/MarkdownEditor.tsx
"use client";

import { MarkdownSlide } from "../types";
import { BackgroundImageUploader } from "../BackgroundImageUploader";

export function MarkdownEditor({
  slide,
  onChange,
}: {
  slide: MarkdownSlide;
  onChange: (next: MarkdownSlide) => void;
}) {
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
          Body (markdown)
        </label>
        <textarea
          value={slide.body}
          onChange={(e) => onChange({ ...slide, body: e.target.value })}
          rows={6}
          className="w-full px-3 py-2 rounded-lg border border-autronis-border bg-autronis-bg text-autronis-text-primary font-mono text-sm"
        />
      </div>
      <BackgroundImageUploader
        value={slide.bgImageUrl}
        onChange={(url) => onChange({ ...slide, bgImageUrl: url })}
      />
    </div>
  );
}
