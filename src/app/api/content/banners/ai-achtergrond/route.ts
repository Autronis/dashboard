import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Global style: clean vector icon on Autronis brand dark background
const BASE_PROMPT =
  "Solid dark background color #0E1719. " +
  "One single minimalist icon in the exact center of the image. " +
  "The icon uses only thin teal (#17B8A5) strokes on the dark background, like a single-color SVG icon. " +
  "Absolutely no gradients, no glow, no shadows, no 3D, no textures, no patterns, no decorations. " +
  "The background is completely flat and empty — just the solid dark color. " +
  "The icon takes up about 40% of the image. " +
  "Style reference: Apple SF Symbols, Lucide icons. " +
  "No text, no labels, no watermark.";

// Per-illustration prompts: append to base style
const ILLUSTRATION_PROMPTS: Record<string, string> = {
  gear: "A single simple gear/cog outline with 3 small curved arrows around it suggesting rotation. Minimal, like an app icon.",
  nodes: "Two simple puzzle pieces connecting together. Just outlines, no fill. Like a minimal UI icon.",
  chart: "Three simple vertical bars (bar chart) with a single diagonal line going up across them. Pure line art, no axes, no labels.",
  flow: "Three circles connected by a straight horizontal line, like a simple timeline/roadmap. Minimal dots-and-line style.",
  shield: "A simple shield outline with a small keyhole or lock shape inside. Single stroke, no fill, no decoration.",
  brain: "A simple circle (brain/head) with 5-6 straight lines radiating outward like a minimal neural network. No complexity.",
  lightbulb: "A simple lightbulb outline. Single continuous line, no fill, no rays, just the bulb shape. Like a UI icon.",
  target: "A simple magnifying glass outline. Circle with a diagonal line handle. Nothing else. Minimal icon style.",
  puzzle: "A simple wrench outline crossed with a screwdriver. Just two tools in an X shape. Basic line art.",
  circuit: "A simple open toolbox outline seen from the side. Rectangular box with an open lid. Minimal line drawing.",
  rocket: "A simple rectangle (screen) with a triangle play button in the center. Like a minimal video player icon.",
  cloud: "A simple cloud outline. Single continuous stroke, no fill, no details. Like a weather app icon.",
  calendar: "A simple calendar outline with a grid of small squares inside. Single stroke, like a UI icon.",
  magnet: "A simple U-shaped magnet outline. Just the horseshoe shape, no effects. Minimal line art.",
  handshake: "Two simple hand outlines meeting in a handshake. Just the outlines, like a minimal icon.",
  globe: "A simple circle with two curved lines inside forming a globe wireframe. Minimal, like a browser icon.",
  infinity: "A simple infinity symbol (figure-8 on its side). Single continuous line, nothing else.",
  dna: "A simple double helix — two intertwining curved lines with small horizontal bridges. Minimal line art.",
  matrix: "A simple 3x3 grid of dots connected by thin lines. Like a minimal pattern lock icon.",
  wave: "Three simple wavy horizontal lines stacked. Pure line art, like a sound/signal icon.",
  radar: "A simple quarter-circle with two concentric arcs and a diagonal line. Like a minimal radar/wifi icon.",
  funnel: "A simple funnel/triangle outline, wide at top, narrow at bottom. Single stroke, like a filter icon.",
  server: "Two simple stacked rectangles with a small circle on each. Like a minimal server rack icon.",
  chatbot: "A simple speech bubble outline with three dots inside. Like a minimal chat icon.",
  lock: "A simple padlock outline — rectangle body with a curved top loop. Like a security icon.",
  speedometer: "A simple semicircle with a diagonal needle line. Like a minimal gauge/dashboard icon.",
  hierarchy: "A simple tree: one circle on top, lines branching down to three circles below. Like an org chart icon.",
  pipeline: "Three simple circles connected by arrows pointing right. Like a minimal flow/pipeline icon.",
  antenna: "A simple vertical line with three curved arcs radiating from the top. Like a broadcast/signal icon.",
  microscope: "A simple microscope outline in profile. Single continuous line, like a science icon.",
  diamond: "A simple diamond shape outline (rotated square). Single stroke, no fill, like a minimal gem icon.",
  hourglass: "A simple hourglass outline — two triangles meeting at a point. Single stroke, like a timer icon.",
  compass: "A simple circle with a diamond/arrow shape inside pointing up. Like a minimal compass icon.",
  fingerprint: "A few simple concentric curved lines forming a fingerprint pattern. Minimal, like a biometric icon.",
  telescope: "A simple telescope outline on a small tripod. Single continuous line, like a minimal icon.",
};

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = (await req.json()) as {
      onderwerp?: string;
      illustration?: string;
      formaat?: string;
    };

    const { onderwerp, illustration, formaat } = body;

    if (!onderwerp || typeof onderwerp !== "string") {
      return NextResponse.json({ fout: "Onderwerp is verplicht" }, { status: 400 });
    }

    // Build the prompt
    const illustrationDetail = ILLUSTRATION_PROMPTS[illustration ?? "gear"] ?? ILLUSTRATION_PROMPTS.gear;
    const prompt = `${BASE_PROMPT} ${illustrationDetail}. The theme is "${onderwerp}".`;

    // Determine size based on format
    let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
    if (formaat === "instagram_story") {
      size = "1024x1792";
    } else if (formaat === "linkedin") {
      size = "1792x1024";
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ fout: "Geen afbeelding ontvangen van DALL-E" }, { status: 500 });
    }

    // Save to disk
    const buffer = Buffer.from(b64, "base64");
    const fileName = `ai-bg-${Date.now()}.png`;
    const bgDir = join(process.cwd(), "public", "banners", "backgrounds");
    await mkdir(bgDir, { recursive: true });
    await writeFile(join(bgDir, fileName), buffer);

    const imagePath = `/banners/backgrounds/${fileName}`;

    return NextResponse.json({
      ok: true,
      imagePath,
      prompt: prompt.substring(0, 200) + "...",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI achtergrond genereren mislukt";
    return NextResponse.json({ fout: message }, { status: 500 });
  }
}
