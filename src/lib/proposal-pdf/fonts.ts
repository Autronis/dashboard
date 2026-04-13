// src/lib/proposal-pdf/fonts.ts
import { Font } from "@react-pdf/renderer";
import path from "path";

const fontDir = path.join(process.cwd(), "public", "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(fontDir, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(fontDir, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});

Font.register({
  family: "SpaceGrotesk",
  src: path.join(fontDir, "SpaceGrotesk-Bold.woff"),
  fontWeight: 700,
});

export const FONTS_REGISTERED = true;
