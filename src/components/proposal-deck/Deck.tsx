// src/components/proposal-deck/Deck.tsx
"use client";

import { Slide } from "./types";
import { CoverSlide } from "./slides/CoverSlide";
import { MarkdownSlide } from "./slides/MarkdownSlide";
import { DeliverablesSlide } from "./slides/DeliverablesSlide";
import { TijdlijnSlide } from "./slides/TijdlijnSlide";
import { InvesteringSlide } from "./slides/InvesteringSlide";

export type ProposalMeta = {
  titel: string;
  klantNaam: string;
  datum: string | null;
  geldigTot: string | null;
  totaalBedrag: number | null;
};

export type ProposalRegel = {
  id: number;
  omschrijving: string;
  aantal: number | null;
  eenheidsprijs: number | null;
  totaal: number | null;
};

export type DeckContext = {
  meta: ProposalMeta;
  regels: ProposalRegel[];
};

export function renderSlide(slide: Slide, ctx: DeckContext) {
  switch (slide.type) {
    case "cover":
      return <CoverSlide slide={slide} meta={ctx.meta} />;
    case "investering":
      return <InvesteringSlide slide={slide} meta={ctx.meta} regels={ctx.regels} />;
    case "situatie":
    case "aanpak":
    case "waarom":
    case "volgende_stap":
    case "vrij":
      return <MarkdownSlide slide={slide} />;
    case "deliverables":
      return <DeliverablesSlide slide={slide} />;
    case "tijdlijn":
      return <TijdlijnSlide slide={slide} />;
  }
}
