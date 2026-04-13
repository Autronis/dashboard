// src/components/proposal-deck/DeckEditor.tsx
"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Slide, isSystemSlide } from "./types";
import { ADDABLE_SLIDE_TYPES, emptySlideOfType } from "./defaults";
import { SlideCardShell } from "./editors/SlideCardShell";
import { MarkdownEditor } from "./editors/MarkdownEditor";
import { DeliverablesEditor } from "./editors/DeliverablesEditor";
import { TijdlijnEditor } from "./editors/TijdlijnEditor";

export function DeckEditor({
  slides,
  onChange,
}: {
  slides: Slide[];
  onChange: (next: Slide[]) => void;
}) {
  const [adderOpen, setAdderOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateSlide = (id: string, next: Slide) => {
    onChange(slides.map((s) => (s.id === id ? next : s)));
  };
  const deleteSlide = (id: string) => {
    onChange(slides.filter((s) => s.id !== id));
  };
  const addSlide = (type: Exclude<Slide["type"], "cover" | "investering">) => {
    // Insert before the investering system slide
    const investeringIdx = slides.findIndex((s) => s.type === "investering");
    const insertAt = investeringIdx === -1 ? slides.length : investeringIdx;
    const next = [...slides];
    next.splice(insertAt, 0, emptySlideOfType(type));
    onChange(next);
    setAdderOpen(false);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    // Don't let drag move past system slide boundaries (cover at 0, investering somewhere)
    const moved = arrayMove(slides, oldIdx, newIdx);
    // Validate: cover stays at 0
    if (moved[0].type !== "cover") return;
    onChange(moved);
  };

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {slides.map((slide) => (
            <SlideCardShell
              key={slide.id}
              id={slide.id}
              type={slide.type}
              system={isSystemSlide(slide)}
              onDelete={!isSystemSlide(slide) ? () => deleteSlide(slide.id) : undefined}
            >
              <SlideEditorBody slide={slide} onChange={(n) => updateSlide(slide.id, n)} />
            </SlideCardShell>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add slide menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setAdderOpen((o) => !o)}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border-2 border-dashed border-autronis-border hover:border-autronis-accent hover:bg-autronis-accent/5 text-autronis-text-secondary hover:text-autronis-accent font-semibold transition"
        >
          <Plus className="w-5 h-5" />
          Slide toevoegen
          <ChevronDown className="w-4 h-4" />
        </button>
        {adderOpen && (
          <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-autronis-border bg-autronis-card shadow-xl z-10 overflow-hidden">
            {ADDABLE_SLIDE_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => addSlide(t.type)}
                className="block w-full text-left px-5 py-3 text-sm text-autronis-text-primary hover:bg-autronis-bg transition"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlideEditorBody({
  slide,
  onChange,
}: {
  slide: Slide;
  onChange: (next: Slide) => void;
}) {
  switch (slide.type) {
    case "cover":
      return (
        <div className="text-sm text-autronis-text-secondary">
          Klantnaam en projecttitel komen uit de metadata bovenaan. Autronis logo wordt automatisch
          toegevoegd.
        </div>
      );
    case "investering":
      return (
        <div className="text-sm text-autronis-text-secondary">
          Deze slide toont automatisch de prijsregels en het totaalbedrag hieronder.
        </div>
      );
    case "situatie":
    case "aanpak":
    case "waarom":
    case "volgende_stap":
    case "vrij":
      return <MarkdownEditor slide={slide} onChange={onChange} />;
    case "deliverables":
      return <DeliverablesEditor slide={slide} onChange={onChange} />;
    case "tijdlijn":
      return <TijdlijnEditor slide={slide} onChange={onChange} />;
  }
}
