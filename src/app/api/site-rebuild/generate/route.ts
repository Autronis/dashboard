import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { scrapePage } from "@/lib/scraper";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

// POST /api/site-rebuild/generate
// Body: {
//   mode: "url" | "logo",
//   url?: string,
//   logoBase64?: string,        // data URL or base64 (required when mode="logo")
//   brandName: string,
//   accent: string,              // hex color like "#17B8A5"
//   notes?: string,
// }
// Response: {
//   html: string,                // full standalone HTML for iframe preview
//   jsxBody: string,              // JSX body to inject into a Next.js page.tsx
//   brandName: string,
//   accent: string,
//   source: { kind: "url" | "logo", url?: string, title?: string | null },
// }

const SYSTEM_PROMPT = `You are a senior frontend designer at Autronis, a studio that builds premium landing pages for product and tech companies.

You generate ONE complete dark-premium landing page. Every page you write follows this aesthetic:
- Jet-black background (#0a0a0b) with subtle ambient glows
- Large display headlines (Space Grotesk, clamp(3rem, 8vw, 7rem))
- Body copy in Inter (Google Fonts CDN is loaded by the host page)
- One accent color used sparingly for CTAs, underlines, key numbers, and hover states
- Generous whitespace, 8pt grid, no clutter
- Sections flow top-to-bottom: hero → proof bar → features (3-column) → specs (numbers that count) → testimonial (if data available) → CTA
- No stock photos. Use CSS gradients, geometric shapes, emoji, or svg glyphs
- Fully responsive via Tailwind utility classes

You always return TWO artifacts:
1. \`html\`: A complete, standalone HTML document (doctype through </html>) using Tailwind via CDN (https://cdn.tailwindcss.com) so the host can render it in an iframe preview. Include Google Fonts link for Inter + Space Grotesk. Fully self-contained — opens anywhere, no build step.
2. \`jsxBody\`: The same page's body as JSX, meant to be the inside of a default export React component (no "export default" wrapper, no imports, no function signature — just the returned JSX). Uses the SAME Tailwind classes as the html version so the look matches. This JSX will be dropped into a Next.js 15 app/page.tsx that already imports globals.css with Tailwind preconfigured.

Return STRICT JSON with exactly these two keys, no prose around it, no markdown fences.

Formatting rules for BOTH artifacts:
- Use the exact accent color from the user's request wherever an accent is called for
- Do NOT invent facts — if features, specs, testimonials, or pricing are not in the provided source content, leave those sections out or use honest placeholders ("Coming soon", "tbd")
- Copy comes FROM the source content, polished and rewritten for punch — never from your imagination
- Keep the JSX valid: use className (not class), self-closing tags, curly braces for expressions, no semicolons that break JSX
- No external JS dependencies in the HTML preview — plain markup only
- Include at least one CTA button that glows on hover

Output format (strict):
{"html": "<!doctype html>...", "jsxBody": "return (<main>...</main>);"}
`;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const mode: "url" | "logo" = body?.mode;
    const url: string | undefined = body?.url;
    const logoBase64: string | undefined = body?.logoBase64;
    const brandName: string | undefined = body?.brandName?.trim();
    const accentInput: string = typeof body?.accent === "string" ? body.accent.trim() : "";
    const accent: string = accentInput || "#17B8A5"; // fallback voor direct-generate (JSX heeft een concreet hex nodig)
    const notes: string = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!brandName) {
      return NextResponse.json({ fout: "Brand naam is verplicht" }, { status: 400 });
    }

    if (mode !== "url" && mode !== "logo") {
      return NextResponse.json({ fout: "mode moet 'url' of 'logo' zijn" }, { status: 400 });
    }

    let sourceMarkdown = "";
    let sourceTitle: string | null = null;
    let sourceUrl: string | undefined = undefined;

    if (mode === "url") {
      if (!url?.trim()) {
        return NextResponse.json({ fout: "URL is verplicht bij mode=url" }, { status: 400 });
      }
      const scraped = await scrapePage(url.trim());
      sourceMarkdown = scraped.markdown;
      sourceTitle = scraped.title;
      sourceUrl = scraped.url;
    } else {
      if (!logoBase64) {
        return NextResponse.json({ fout: "Logo is verplicht bij mode=logo" }, { status: 400 });
      }
    }

    const anthropic = Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userContent: Array<
      | { type: "text"; text: string }
      | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/webp"; data: string } }
    > = [];

    if (mode === "url") {
      userContent.push({
        type: "text",
        text: `Brand name: ${brandName}
Accent color: ${accent}
Extra notes from the user: ${notes || "(none)"}

Source website content (markdown, scraped from ${sourceUrl}):
---
${sourceMarkdown}
---

Upgrade this into a jaw-dropping dark premium landing page using the rules above. Pull real copy from the source. Return strict JSON only.`,
      });
    } else {
      // Logo mode — strip data URL prefix if present
      const match = logoBase64!.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
      const mediaType = (match ? match[1] : "image/png") as "image/png" | "image/jpeg" | "image/webp";
      const data = match ? match[2] : logoBase64!;

      userContent.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
      userContent.push({
        type: "text",
        text: `Brand name: ${brandName}
Accent color: ${accent}
Extra notes from the user: ${notes || "(none)"}

There is no existing website. Above is the brand logo. Extract the vibe (industry, tone, what the company might do) from the logo + brand name + notes, then design a minimal dark premium landing page with honest placeholder copy where needed. Return strict JSON only.`,
      });
    }

    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 12000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    const first = resp.content[0];
    if (!first || first.type !== "text") {
      return NextResponse.json({ fout: "Claude gaf geen tekst terug" }, { status: 500 });
    }

    // Parse JSON — be tolerant of ```json fences
    let raw = first.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    }
    let parsed: { html?: string; jsxBody?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { fout: "Claude output kon niet geparsed worden als JSON", detail: raw.slice(0, 500) },
        { status: 500 }
      );
    }

    if (!parsed.html || !parsed.jsxBody) {
      return NextResponse.json(
        { fout: "Claude output miste 'html' of 'jsxBody'" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      html: parsed.html,
      jsxBody: parsed.jsxBody,
      brandName,
      accent,
      source: { kind: mode, url: sourceUrl, title: sourceTitle },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Onbekende fout";
    return NextResponse.json(
      { fout: msg },
      {
        status:
          error instanceof Error && error.message === "Niet geauthenticeerd" ? 401 : 500,
      }
    );
  }
}
