// src/lib/proposal-schema.ts
import { z } from "zod";
import { Slide } from "@/components/proposal-deck/types";
import { defaultSlides, newId } from "@/components/proposal-deck/defaults";

const baseFields = {
  id: z.string(),
  bgImageUrl: z.string().url().optional(),
};

const coverSchema = z.object({
  ...baseFields,
  type: z.literal("cover"),
  actief: z.literal(true),
});

const investeringSchema = z.object({
  ...baseFields,
  type: z.literal("investering"),
  actief: z.literal(true),
});

const markdownSchema = z.object({
  ...baseFields,
  type: z.enum(["situatie", "aanpak", "waarom", "volgende_stap", "vrij"]),
  titel: z.string(),
  body: z.string(),
  actief: z.boolean(),
});

const deliverablesSchema = z.object({
  ...baseFields,
  type: z.literal("deliverables"),
  titel: z.string(),
  items: z.array(z.string()),
  actief: z.boolean(),
});

const tijdlijnSchema = z.object({
  ...baseFields,
  type: z.literal("tijdlijn"),
  titel: z.string(),
  fases: z.array(
    z.object({
      naam: z.string(),
      duur: z.string(),
      omschrijving: z.string(),
    })
  ),
  actief: z.boolean(),
});

export const slideSchema = z.discriminatedUnion("type", [
  coverSchema,
  investeringSchema,
  markdownSchema,
  deliverablesSchema,
  tijdlijnSchema,
]);

export const slidesSchema = z.array(slideSchema);

// Old shape detection
const oldShapeItem = z.object({
  id: z.string().optional(),
  titel: z.string(),
  inhoud: z.string(),
  actief: z.boolean().optional(),
});
const oldShapeSchema = z.array(oldShapeItem);

export function parseSlides(raw: string | null): Slide[] {
  if (!raw) return defaultSlides();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (Array.isArray(parsed) && parsed.length === 0) {
    return defaultSlides();
  }
  const newShape = slidesSchema.safeParse(parsed);
  if (newShape.success) {
    return newShape.data as Slide[];
  }
  const old = oldShapeSchema.safeParse(parsed);
  if (old.success) {
    return old.data.map((s) => ({
      id: s.id ?? newId(),
      type: "vrij" as const,
      titel: s.titel ?? "",
      body: s.inhoud ?? "",
      actief: s.actief ?? true,
    }));
  }
  console.error("parseSlides: onbekende shape", newShape.error);
  return [];
}
