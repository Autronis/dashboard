// src/lib/proposal-pdf/pages/MarkdownPage.tsx
import { Page, View, Text } from "@react-pdf/renderer";
import { pdfStyles } from "../styles";
import { BgImageLayer } from "../primitives";
import { MarkdownSlide } from "@/components/proposal-deck/types";

const TYPE_LABELS: Record<MarkdownSlide["type"], string> = {
  situatie: "Situatie",
  aanpak: "Aanpak",
  waarom: "Waarom Autronis",
  volgende_stap: "Volgende stap",
  vrij: "",
};

function renderBodyBlocks(body: string) {
  const blocks = body.split(/\n\n+/).filter(Boolean);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    const allBullets = lines.every((l) => /^[-*]\s/.test(l));
    if (allBullets) {
      return (
        <View key={i} style={{ marginBottom: 12 }}>
          {lines.map((l, j) => (
            <View key={j} style={{ flexDirection: "row", marginBottom: 4 }}>
              <Text style={[pdfStyles.body, { marginRight: 8 }]}>•</Text>
              <Text style={[pdfStyles.body, { flex: 1 }]}>{l.replace(/^[-*]\s/, "")}</Text>
            </View>
          ))}
        </View>
      );
    }
    return (
      <Text key={i} style={[pdfStyles.body, { marginBottom: 12 }]}>
        {block}
      </Text>
    );
  });
}

export function MarkdownPage({ slide }: { slide: MarkdownSlide }) {
  const label = TYPE_LABELS[slide.type];
  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <BgImageLayer url={slide.bgImageUrl} />
      <View style={pdfStyles.content}>
        {label ? <Text style={pdfStyles.typeLabel}>{label}</Text> : null}
        <Text style={[pdfStyles.headingLG, { marginBottom: 28 }]}>{slide.titel}</Text>
        <View style={{ maxWidth: 620 }}>{renderBodyBlocks(slide.body || "")}</View>
      </View>
    </Page>
  );
}
