import { NextRequest, NextResponse } from "next/server";
import { TrackedAnthropic as Anthropic, type MessageParam } from "@/lib/ai/tracked-anthropic";

const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function scrapeUrl(url: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!res.ok) throw new Error(`Firecrawl error: ${res.status}`);
  const data = await res.json() as { success: boolean; data?: { markdown?: string } };
  if (!data.success || !data.data?.markdown) throw new Error("Geen content gevonden");
  return data.data.markdown.slice(0, 6000);
}

const EIND_EFFECTEN: Record<string, { label: string; promptB: string; promptC: string }> = {
  exploded: {
    label: "Exploded/Deconstructed",
    promptB: `Professional exploded-view product photography of a [OBJECT], dramatically deconstructed into its individual components, all floating dynamically in space against a clean white background (#FFFFFF).
Every component is visible and separated: [USE MANIFEST COMPONENTS].
DRAMATIC EXPLOSION STYLE: Components float outward in ALL directions from the center — NOT neatly stacked in rows. Each piece is tilted 10-30 degrees at different angles, at varying distances from center. Some pieces closer, some further away creating real 3D depth. Glass/transparent pieces catch light at different angles creating colorful refractions. Think freeze-frame mid-explosion — dynamic, energetic, cinematic. Subtle motion blur on the outermost pieces.
Soft studio lighting with individual shadows beneath each floating piece. Components are pristine and detailed, maintaining their exact original materials and colors.
Photorealistic rendering, 16:9 aspect ratio. Shot on Phase One IQ4 150MP, focus-stacked. Same lighting as assembled shot.`,
    promptC: `START FRAME: A fully assembled [OBJECT] sitting centered on a white background, product photography style, soft studio lighting.
END FRAME: The same [OBJECT] elegantly deconstructed into an exploded view — every component floating in space, separated along a vertical axis, maintaining spatial relationships.
TRANSITION: Smooth, satisfying mechanical deconstruction. The object begins whole and still. After a brief pause (0.5s), pieces begin to separate — starting from the outer shell and progressively revealing inner components. Each piece lifts and floats outward along clean, deliberate paths. Movement is eased (slow-in, slow-out) with slight rotations. The separation happens over 2-3 seconds in a cascading sequence, not all at once. Final floating arrangement holds for 1 second.
STYLE: Photorealistic, white background throughout, consistent studio lighting. No camera movement — locked-off tripod shot. Satisfying, ASMR-like mechanical precision.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  buildup: {
    label: "Build-up",
    promptB: `Professional product photography of scattered particles, dust, and micro-fragments floating in space against a clean white background (#FFFFFF).
The particles are the raw materials of a [OBJECT] — [USE MANIFEST COMPONENTS as scattered particles, dust clouds, and micro-fragments].
Particles are dispersed chaotically but artistically across the frame, with varying sizes from dust specks to small recognizable fragments.
Soft studio lighting with subtle shadows on floating particles. Some particles glow faintly with the object's characteristic colors.
Photorealistic rendering, 16:9 aspect ratio. Shot on Phase One IQ4 150MP. Same lighting setup as the assembled shot.`,
    promptC: `START FRAME: Scattered particles, dust, and micro-fragments of a [OBJECT] floating chaotically in space against white background.
END FRAME: The same particles have converged and assembled into a pristine, fully built [OBJECT] centered in frame.
TRANSITION: Magical build-up assembly. Particles begin drifting slowly, then accelerate toward the center. Components form in layers — inner structure first, then outer shell. Each piece snaps into place with satisfying precision. A subtle pulse of light ripples outward as the final piece locks in. The completed object settles with a gentle bounce.
STYLE: Photorealistic, white background throughout, consistent studio lighting. No camera movement. Satisfying, precise, almost magnetic assembly.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  xray: {
    label: "X-ray/Cutaway",
    promptB: `Professional X-ray cutaway product photography of a [OBJECT] against a clean white background (#FFFFFF).
The outer shell is rendered as translucent glass/crystal, revealing the complete internal structure: [USE MANIFEST COMPONENTS visible through transparent shell].
Cross-section view showing internal mechanics, circuits, and hidden components. Internal parts rendered in full color while the outer shell is ghostly translucent with subtle blue-white tint.
Soft studio lighting creating gentle refractions through the transparent shell. Internal components are sharp and detailed.
Photorealistic rendering, 16:9 aspect ratio. Shot on Phase One IQ4 150MP. Same angle as assembled shot.`,
    promptC: `START FRAME: A fully assembled, opaque [OBJECT] centered on white background.
END FRAME: The same [OBJECT] with its outer shell turned translucent/glass-like, revealing all internal components in a stunning X-ray cutaway view.
TRANSITION: Smooth transparency reveal. The object starts solid and opaque. The outer material begins to fade to translucent, starting from one edge and sweeping across. As the shell becomes glass-like, internal components are progressively revealed with subtle illumination. Internal parts glow softly as they become visible. The transparency stabilizes at a perfect see-through level.
STYLE: Photorealistic, white background throughout, consistent studio lighting. No camera movement. Clean, medical/scientific precision aesthetic.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  wireframe: {
    label: "Wireframe Dissolve",
    promptB: `Professional product photography of a [OBJECT] dissolving into a wireframe mesh against a clean white background (#FFFFFF).
The object is partially dissolved — 60% wireframe, 40% solid. The wireframe is a clean geometric mesh showing the 3D structure: [USE MANIFEST COMPONENTS visible as wireframe outlines].
Wireframe lines are thin, glowing teal/cyan (#23C6B7) against the white background. Where solid meets wireframe, there's a dissolve edge with floating triangular fragments.
Photorealistic-to-digital transition rendering, 16:9 aspect ratio. Same angle as assembled shot.`,
    promptC: `START FRAME: A fully assembled, solid [OBJECT] centered on white background.
END FRAME: The same [OBJECT] completely dissolved into a clean geometric wireframe mesh — glowing teal lines showing the 3D structure.
TRANSITION: Digital dissolve effect. The object starts solid. Small triangular fragments begin detaching from the surface, revealing glowing wireframe lines beneath. The dissolution spreads organically across the surface. Each fragment floats briefly before fading. The wireframe pulses gently once fully revealed.
STYLE: Photorealistic to digital, white background throughout. No camera movement. Clean, futuristic, tech aesthetic.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  glowup: {
    label: "Glow Up",
    promptB: `Professional product photography of a [OBJECT] glowing intensely from within against a clean white background (#FFFFFF).
The object is the same shape but illuminated — warm golden/amber light radiates from every seam, joint, and gap between components: [USE MANIFEST COMPONENTS with light bleeding between each].
Surface details are silhouetted against the internal glow. Light rays emanate from gaps between components. The object appears charged with energy.
Dramatic studio lighting combined with internal illumination, 16:9 aspect ratio. Same angle as assembled shot.`,
    promptC: `START FRAME: A [OBJECT] in complete darkness/shadow, only a faint silhouette visible against the white background. The object appears dormant, powered off.
END FRAME: The same [OBJECT] fully illuminated from within, glowing warm golden light radiating from every seam and component gap, surface details dramatically lit.
TRANSITION: Power-up glow sequence. The object starts dark and still. A faint spark of light appears at the core. The glow slowly intensifies, spreading through internal channels. Light bleeds through seams and gaps between components. Each component edge lights up in sequence. The glow builds to full intensity with a subtle pulse at peak brightness.
STYLE: Photorealistic, white background throughout. No camera movement. Dramatic, cinematic lighting transition.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  liquid: {
    label: "Liquid Morph",
    promptB: `Professional product photography of a [OBJECT] in a liquid/melted state against a clean white background (#FFFFFF).
The object has melted into a beautiful liquid puddle that retains the colors and materials of the original: [USE MANIFEST COMPONENTS as colored liquid streams and pools].
Chrome-like liquid reflections, viscous drips and pools. The liquid retains recognizable color zones from the original components. Surface tension creates perfect reflective pools.
Photorealistic rendering, 16:9 aspect ratio. Shot on Phase One IQ4 150MP. Same lighting as assembled shot.`,
    promptC: `START FRAME: A fully assembled [OBJECT] centered on white background.
END FRAME: The same [OBJECT] melted into a beautiful liquid puddle, retaining original colors and material properties as distinct liquid pools.
TRANSITION: Smooth liquid morph. The object starts solid. The top begins to soften and sag. Material flows downward like thick honey, each component melting at different rates based on material. Chrome parts become mirror-like liquid, plastic parts become glossy pools. The melting cascades from top to bottom in a satisfying flow. Final puddle settles with gentle ripples.
STYLE: Photorealistic, white background throughout. No camera movement. Satisfying, ASMR-like fluid dynamics.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  scatter: {
    label: "Scatter",
    promptB: `Professional product photography of a [OBJECT] shattered into hundreds of small pieces against a clean white background (#FFFFFF).
The object has broken apart into tiny fragments: [USE MANIFEST COMPONENTS each shattered into dozens of small pieces].
Fragments range from tiny shards to small recognizable component pieces. They radiate outward from the center in a freeze-frame explosion pattern. Each shard retains the color and material of its origin component.
Photorealistic rendering with freeze-frame dynamics, 16:9 aspect ratio. Shot on Phase One IQ4 150MP at 1/10000s.`,
    promptC: `START FRAME: A fully assembled [OBJECT] centered on white background, perfectly still.
END FRAME: The same [OBJECT] scattered into hundreds of small fragments radiating outward from the center in a dramatic freeze-frame explosion.
TRANSITION: Dramatic shatter-scatter. The object sits still for 0.5 seconds. A subtle crack appears. Then — instant shatter. Pieces fly outward in all directions at varying speeds. Large chunks separate first, then splinter into smaller fragments mid-flight. The scatter decelerates to a freeze-frame hold showing all pieces suspended in space.
STYLE: Photorealistic, white background throughout. No camera movement. High-speed photography aesthetic, freeze-frame impact.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  context: {
    label: "Context Placement",
    promptB: `Professional lifestyle product photography of a [OBJECT] placed in its natural environment/workspace.
The same object from Prompt A is now sitting on a real desk/workbench/counter in a realistic setting: [USE MANIFEST COMPONENTS all visible and assembled].
Environment matches the product category — tech products on a modern desk, food items in a kitchen, tools on a workbench. Warm, natural lighting. Subtle depth of field with background bokeh.
The object is the clear hero/focus, environment supports but doesn't distract. 16:9 aspect ratio. Professional lifestyle photography.`,
    promptC: `START FRAME: A [OBJECT] floating centered against a clean white background (#FFFFFF), studio lighting.
END FRAME: The same [OBJECT] gently placed on a real desk/workspace in a warm, lifestyle photography setting with bokeh background.
TRANSITION: Context materialization. The white background begins to darken and gain texture. A surface appears below the object as it gently descends. The environment builds up around it — desk surface, background elements fade in. Lighting transitions from studio white to warm natural. The object settles onto the surface with a subtle shadow. Final frame holds as a lifestyle shot.
STYLE: Studio to lifestyle transition, clean to warm. No camera movement. Smooth, magical reveal.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
  material: {
    label: "Materiaal Switch",
    promptB: `Professional product photography of a [OBJECT] transformed into a different material against a clean white background (#FFFFFF).
The exact same shape and form as the assembled shot, but every component is now a different material — the final state of a material transformation sequence: [USE MANIFEST COMPONENTS each in final transformed material].
Material sequence: glass → brushed metal → warm wood grain. The final state shows all components in rich, warm wood with visible grain texture. Every component retains its original form but in wood material.
Photorealistic rendering, 16:9 aspect ratio. Shot on Phase One IQ4 150MP. Same angle and lighting.`,
    promptC: `START FRAME: A fully assembled [OBJECT] in clear glass material, transparent and refractive, centered on white background.
END FRAME: The same [OBJECT] in warm wood material with visible grain texture, every component retains its shape but is now wood.
TRANSITION: Smooth material transformation sequence. The glass object sits still, light refracting through it. A wave of material change sweeps across — glass becomes brushed metal with a satisfying shift. Brief hold. Then metal warms and gains organic texture as it transforms to wood. Grain patterns appear and deepen. Each material transition sweeps across the surface like a wave. Final wood state settles with a warm glow.
STYLE: Photorealistic, white background throughout. No camera movement. Satisfying, material-focused transformation.
DURATION: 4-5 seconds total. ASPECT RATIO: 16:9. QUALITY: High fidelity, smooth 24fps or higher.`,
  },
};

function buildSystemPrompt(eindEffect: string, manifest?: string, stylePrompt?: string): string {
  const effect = EIND_EFFECTEN[eindEffect] || EIND_EFFECTEN.exploded;

  return `You generate a coordinated set of 3 prompts that work together to produce scroll-stopping video content: a clean product shot, its ${effect.label} version, and a video transition between them.

${stylePrompt ? `## VISUAL STYLE (VERPLICHT)
Apply this visual style to ALL prompts. All materials, colors, lighting, and atmosphere MUST match this style:
${stylePrompt}

` : ""}${manifest ? `## COMPONENT MANIFEST (VERPLICHT)
You MUST use EXACTLY these components in ALL prompts. Every component listed must appear in both prompt A (assembled) and prompt B (${effect.label}). Do not add, remove, or change any components.

${manifest}

` : ""}## Prompt A — The Assembled Shot

A clean hero product image. Use this template and customize for the specific object:

Professional product photography of a [OBJECT] centered in frame, shot from a 3/4 angle.
Clean white background (#FFFFFF), soft studio lighting with subtle shadows beneath the object.
The [OBJECT] is pristine, brand-new, fully assembled and closed/complete.
${manifest ? "All components from the manifest are visible in their assembled positions." : ""}
Photorealistic rendering, 16:9 aspect ratio, product catalog quality. Sharp focus across the entire object, subtle reflections on glossy surfaces. Minimal, elegant, Apple-style product photography. No text, no logos, no other objects in frame.
Shot on Phase One IQ4 150MP, 120mm macro lens, f/8, studio strobe lighting with large softbox above and white bounce cards on sides. Ultra-sharp detail, 8K quality downsampled to 4K.

Customize: adjust camera angle, add material-specific details (brushed aluminum, matte plastic, leather texture), specify the state. Always keep white background.
${manifest ? "IMPORTANT: Reference EVERY component from the manifest by name, material, and color." : ""}

## Prompt B — ${effect.label}

${effect.promptB}
${manifest ? "\nIMPORTANT: Reference EVERY component from the manifest. Each must be identifiable and match exactly." : ""}

## Prompt C — The Video Transition

${effect.promptC}
${manifest ? "\nIMPORTANT: Reference specific components from the manifest in the transition description." : ""}

## Best Practices
- Consistency is key — assembled and ${effect.label.toLowerCase()} must look like the same object (same materials, colors, lighting, angle)
- White background always — critical for clean video transition${eindEffect === "context" ? " (except for the context end frame)" : ""}
- Component accuracy — ${manifest ? "use ONLY the components from the manifest, reference each by name" : "don't make up parts, use real components"}
- The video prompt is model-agnostic — works in Higgsfield, Runway, Kling, Pika

## Output format

Return ONLY a JSON object with these exact fields, no markdown, no explanation:
{
  "promptA": "...",
  "promptB": "...",
  "promptC": "...",
  "objectNaam": "...",
  "tabANaam": "Assembled Shot",
  "tabBNaam": "${effect.label}"
}`;
}

export async function POST(req: NextRequest) {
  const { url, product, imageBase64, mediaType, eindEffect, manifest, stylePrompt } = await req.json() as {
    url?: string;
    product?: string;
    imageBase64?: string;
    mediaType?: string;
    eindEffect?: string;
    manifest?: string;
    stylePrompt?: string;
  };

  const effectKey = eindEffect && eindEffect in EIND_EFFECTEN ? eindEffect : "exploded";

  let bronLabel = product ?? url ?? "afbeelding";
  let userContent: MessageParam["content"] = [];

  if (imageBase64 && mediaType) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: imageBase64 },
      },
      {
        type: "text",
        text: product
          ? `Analyseer dit product/logo en genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2. Gebruik de exacte kleuren, materialen en vormen die je ziet in de afbeelding.\n\nExtra instructies: ${product}`
          : "Analyseer dit product/logo en genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2. Gebruik de exacte kleuren, materialen en vormen die je ziet in de afbeelding.",
      },
    ];
    bronLabel = product ?? "geüploade afbeelding";
  } else if (url) {
    try {
      const scraped = await scrapeUrl(url);
      userContent = [{ type: "text", text: `Genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2 op basis van:\n\nWebsite content:\n${scraped}` }];
      bronLabel = url;
    } catch {
      return NextResponse.json({ error: "Kon URL niet scrapen. Probeer een productnaam." }, { status: 400 });
    }
  } else if (product) {
    userContent = [{ type: "text", text: `Genereer 3 scroll-stop prompts voor Higgsfield Nano Banana 2 op basis van:\n\nProduct: ${product}` }];
  } else {
    return NextResponse.json({ error: "Geef een URL, productnaam of afbeelding op." }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: buildSystemPrompt(effectKey, manifest, stylePrompt),
    messages: [{ role: "user", content: userContent }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  // Strip markdown code fences if present
  const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*$/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Geen geldige prompts gegenereerd." }, { status: 500 });

  let prompts: {
    promptA: string;
    promptB: string;
    promptC: string;
    objectNaam: string;
    tabANaam: string;
    tabBNaam: string;
  };
  try {
    prompts = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Kon JSON niet parsen uit response." }, { status: 500 });
  }

  return NextResponse.json({ ...prompts, bron: bronLabel });
}
