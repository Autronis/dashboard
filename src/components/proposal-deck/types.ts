// src/components/proposal-deck/types.ts

export type SlideBase = {
  id: string;
  actief: boolean;
  bgImageUrl?: string;
};

export type CoverSlide = SlideBase & {
  type: "cover";
  actief: true;
};

export type InvesteringSlide = SlideBase & {
  type: "investering";
  actief: true;
};

export type MarkdownSlideType = "situatie" | "aanpak" | "waarom" | "volgende_stap" | "vrij";

export type MarkdownSlide = SlideBase & {
  type: MarkdownSlideType;
  titel: string;
  body: string;
};

export type DeliverablesSlide = SlideBase & {
  type: "deliverables";
  titel: string;
  items: string[];
};

export type TijdlijnFase = {
  naam: string;
  duur: string;
  omschrijving: string;
};

export type TijdlijnSlide = SlideBase & {
  type: "tijdlijn";
  titel: string;
  fases: TijdlijnFase[];
};

export type Slide =
  | CoverSlide
  | InvesteringSlide
  | MarkdownSlide
  | DeliverablesSlide
  | TijdlijnSlide;

export type SlideType = Slide["type"];

export const SYSTEM_SLIDE_TYPES: SlideType[] = ["cover", "investering"];

export function isSystemSlide(slide: Slide): boolean {
  return SYSTEM_SLIDE_TYPES.includes(slide.type);
}
