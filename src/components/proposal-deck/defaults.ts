// src/components/proposal-deck/defaults.ts
import { Slide } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function defaultSlides(): Slide[] {
  return [
    { id: newId(), type: "cover", actief: true },
    { id: newId(), type: "situatie", titel: "De situatie", body: "", actief: true },
    { id: newId(), type: "aanpak", titel: "Onze aanpak", body: "", actief: true },
    { id: newId(), type: "deliverables", titel: "Wat je krijgt", items: [], actief: true },
    { id: newId(), type: "tijdlijn", titel: "Tijdlijn", fases: [], actief: true },
    { id: newId(), type: "investering", actief: true },
    { id: newId(), type: "waarom", titel: "Waarom Autronis", body: "", actief: true },
    { id: newId(), type: "volgende_stap", titel: "Volgende stap", body: "", actief: true },
  ];
}

export const ADDABLE_SLIDE_TYPES: Array<{
  type: Exclude<Slide["type"], "cover" | "investering">;
  label: string;
}> = [
  { type: "situatie", label: "Situatie" },
  { type: "aanpak", label: "Aanpak" },
  { type: "deliverables", label: "Deliverables" },
  { type: "tijdlijn", label: "Tijdlijn" },
  { type: "waarom", label: "Waarom Autronis" },
  { type: "volgende_stap", label: "Volgende stap" },
  { type: "vrij", label: "Vrije slide (markdown)" },
];

export function emptySlideOfType(type: Exclude<Slide["type"], "cover" | "investering">): Slide {
  switch (type) {
    case "situatie":
    case "aanpak":
    case "waarom":
    case "volgende_stap":
    case "vrij":
      return { id: newId(), type, titel: "", body: "", actief: true };
    case "deliverables":
      return { id: newId(), type, titel: "", items: [], actief: true };
    case "tijdlijn":
      return { id: newId(), type, titel: "", fases: [], actief: true };
  }
}
