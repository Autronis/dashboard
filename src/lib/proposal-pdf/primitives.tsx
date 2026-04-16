// src/lib/proposal-pdf/primitives.tsx
import { Image, View } from "@react-pdf/renderer";
import { pdfStyles } from "./styles";

export function BgImageLayer({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <>
      <Image src={url} style={pdfStyles.absoluteFill} />
      <View style={pdfStyles.overlay} />
    </>
  );
}
