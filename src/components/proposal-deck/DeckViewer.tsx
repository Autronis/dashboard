// src/components/proposal-deck/DeckViewer.tsx
"use client";

import { useState } from "react";
import { Presentation, Download } from "lucide-react";
import { Slide } from "./types";
import { renderSlide, DeckContext } from "./Deck";
import { DemoMode } from "./DemoMode";

export function DeckViewer({
  slides,
  context,
  pdfUrl,
}: {
  slides: Slide[];
  context: DeckContext;
  pdfUrl?: string;
}) {
  const [demo, setDemo] = useState(false);
  const activeSlides = slides.filter((s) => s.actief);

  if (demo) {
    return (
      <DemoMode
        slides={activeSlides.map((s) => (
          <div key={s.id} className="w-full h-full">
            {renderSlide(s, context)}
          </div>
        ))}
        onExit={() => setDemo(false)}
      />
    );
  }

  return (
    <div className="bg-[#0E1719] snap-y snap-mandatory overflow-y-scroll h-screen">
      {activeSlides.map((slide) => (
        <div key={slide.id} className="snap-start">
          {renderSlide(slide, context)}
        </div>
      ))}

      {/* Floating action buttons (hidden on mobile for Presenteren) */}
      <div className="fixed bottom-6 right-6 flex gap-3 z-50">
        {pdfUrl && (
          <a
            href={pdfUrl}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 backdrop-blur text-white text-sm font-semibold hover:bg-white/20 transition"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </a>
        )}
        <button
          onClick={() => setDemo(true)}
          className="hidden md:inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#17B8A5] text-[#0E1719] text-sm font-semibold hover:bg-[#4DC9B4] transition"
        >
          <Presentation className="w-4 h-4" />
          Presenteren
        </button>
      </div>
    </div>
  );
}
