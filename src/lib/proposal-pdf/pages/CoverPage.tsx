// src/lib/proposal-pdf/pages/CoverPage.tsx
import { Page, View, Text, Image } from "@react-pdf/renderer";
import path from "path";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { CoverSlide } from "@/components/proposal-deck/types";

const LOGO_PATH = path.join(process.cwd(), "public", "icon.png");

export function CoverPage({
  slide,
  klantNaam,
  titel,
  datum,
}: {
  slide: CoverSlide;
  klantNaam: string;
  titel: string;
  datum: string | null;
}) {
  const datumStr = datum
    ? new Date(datum).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={{ position: "absolute", top: 40, left: 40 }}>
        <Image src={LOGO_PATH} style={{ width: 36, height: 36 }} />
      </View>
      <View style={pdfStyles.content}>
        <Text style={pdfStyles.typeLabel}>Voor</Text>
        <Text style={pdfStyles.headingXL}>{klantNaam}</Text>
        <Text style={pdfStyles.subheading}>{titel}</Text>
        {datumStr && <Text style={[pdfStyles.body, { marginTop: 20 }]}>{datumStr}</Text>}
      </View>
    </Page>
  );
}
