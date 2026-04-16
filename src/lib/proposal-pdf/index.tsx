// src/lib/proposal-pdf/index.tsx
import { Document } from "@react-pdf/renderer";
import "./fonts"; // side-effect import triggers Font.register
import { Slide } from "@/components/proposal-deck/types";
import { CoverPage } from "./pages/CoverPage";
import { MarkdownPage } from "./pages/MarkdownPage";
import { DeliverablesPage } from "./pages/DeliverablesPage";
import { TijdlijnPage } from "./pages/TijdlijnPage";
import { InvesteringPage } from "./pages/InvesteringPage";

export type ProposalPDFProps = {
  proposal: {
    titel: string;
    klantNaam: string;
    klantContactpersoon: string | null;
    klantAdres: string | null;
    datum: string | null;
    geldigTot: string | null;
    totaalBedrag: number;
  };
  secties: Slide[];
  regels: Array<{
    id: number;
    omschrijving: string;
    aantal: number | null;
    eenheidsprijs: number | null;
    totaal: number | null;
  }>;
};

export function ProposalPDF({ proposal, secties, regels }: ProposalPDFProps) {
  const active = secties.filter((s) => s.actief);
  return (
    <Document>
      {active.map((slide) => {
        switch (slide.type) {
          case "cover":
            return (
              <CoverPage
                key={slide.id}
                slide={slide}
                klantNaam={proposal.klantNaam}
                titel={proposal.titel}
                datum={proposal.datum}
              />
            );
          case "investering":
            return (
              <InvesteringPage
                key={slide.id}
                slide={slide}
                regels={regels}
                totaalBedrag={proposal.totaalBedrag}
                geldigTot={proposal.geldigTot}
              />
            );
          case "deliverables":
            return <DeliverablesPage key={slide.id} slide={slide} />;
          case "tijdlijn":
            return <TijdlijnPage key={slide.id} slide={slide} />;
          case "situatie":
          case "aanpak":
          case "waarom":
          case "volgende_stap":
          case "vrij":
            return <MarkdownPage key={slide.id} slide={slide} />;
        }
      })}
    </Document>
  );
}
