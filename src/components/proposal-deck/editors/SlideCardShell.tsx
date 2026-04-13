// src/components/proposal-deck/editors/SlideCardShell.tsx
"use client";

import { ReactNode } from "react";
import { GripVertical, Lock, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover",
  investering: "Investering",
  situatie: "Situatie",
  aanpak: "Aanpak",
  deliverables: "Deliverables",
  tijdlijn: "Tijdlijn",
  waarom: "Waarom Autronis",
  volgende_stap: "Volgende stap",
  vrij: "Vrije slide",
};

export function SlideCardShell({
  id,
  type,
  system,
  onDelete,
  children,
}: {
  id: string;
  type: string;
  system: boolean;
  onDelete?: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: system });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-autronis-border rounded-2xl p-6 bg-autronis-card"
    >
      <div className="flex items-center gap-3 mb-5">
        {system ? (
          <Lock className="w-4 h-4 text-autronis-text-secondary" />
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="p-1 text-autronis-text-secondary hover:text-autronis-accent cursor-grab"
            aria-label="Verplaats"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="text-xs font-bold uppercase tracking-widest text-autronis-accent">
          {SLIDE_TYPE_LABELS[type] ?? type}
        </div>
        {system && (
          <div className="text-xs text-autronis-text-secondary ml-auto">
            system slide
          </div>
        )}
        {!system && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto p-1.5 text-autronis-text-secondary hover:text-red-400 rounded"
            aria-label="Verwijderen"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
