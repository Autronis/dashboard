import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BASE_PROMPT =
  "Solid dark background color #0E1719. One single white outline icon in the center, very thin lines, like a simple SVG icon. " +
  "Minimal, clean, no fill, no shading, no gradients, no 3D, no text, no labels. " +
  "The icon uses thin teal (#17B8A5) strokes on the dark background. " +
  "Think of a 24x24 pixel SVG icon scaled up to 1080x1080. " +
  "Background is completely flat and solid, no texture, no waves, no patterns. " +
  "Do NOT add extra details, decorations, shadows, or gradients. Even simpler than you think.";

const COVERS: Array<{ name: string; icon: string }> = [
  { name: "cover-process-automation", icon: "A simple gear/cog outline with 3 small curved arrows around it" },
  { name: "cover-systeemintegraties", icon: "Two simple jigsaw puzzle pieces clicking together" },
  { name: "cover-data-reporting", icon: "Three simple vertical bars (bar chart) with a single diagonal line going up" },
  { name: "cover-hoe-wij-werken", icon: "Three circles connected by straight lines in a vertical path, like a simple flowchart" },
  { name: "cover-veiligheid-data", icon: "A simple shield outline with a small keyhole in the center" },
  { name: "cover-ai-agents", icon: "A simple circle with 6 straight lines radiating outward like a sun, representing a neural node" },
  { name: "cover-handmatig-werk", icon: "A simple clipboard rectangle outline with 3 short horizontal lines inside" },
  { name: "cover-probleem-oplossing", icon: "A simple lightbulb outline, just the bulb shape and base" },
  { name: "cover-probleem-herkenning", icon: "A simple magnifying glass circle with a handle line" },
  { name: "cover-intern-oplossen", icon: "A simple wrench outline, single tool, diagonal position" },
  { name: "cover-tools", icon: "A simple open toolbox rectangle with a handle on top" },
  { name: "cover-demo", icon: "A simple rectangle (screen) with a triangle play button in the center" },
];

async function generateCover(cover: { name: string; icon: string }, outDir: string) {
  const prompt = `${BASE_PROMPT} ${cover.icon}`;
  console.log(`⏳ Generating ${cover.name}...`);

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    response_format: "b64_json",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    console.error(`❌ ${cover.name}: no image returned`);
    return;
  }

  const buffer = Buffer.from(b64, "base64");
  const filePath = join(outDir, `${cover.name}.png`);
  await writeFile(filePath, buffer);
  console.log(`✅ ${cover.name} saved`);
}

async function main() {
  const outDir = join(process.cwd(), "public", "banners", "backgrounds");
  await mkdir(outDir, { recursive: true });

  console.log(`Generating ${COVERS.length} covers...\n`);

  // Generate sequentially to avoid rate limits
  let success = 0;
  let failed = 0;

  for (const cover of COVERS) {
    try {
      await generateCover(cover, outDir);
      success++;
    } catch (err) {
      console.error(`❌ ${cover.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      failed++;
    }
  }

  console.log(`\nDone! ${success} generated, ${failed} failed.`);
}

main();
