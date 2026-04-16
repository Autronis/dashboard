import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projectIntakes, projecten } from "@/lib/db/schema";
import { requireAuthOrApiKey } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_EIGENAAR = new Set(["sem", "syb", "team", "vrij"]);

interface Invalshoek {
  naam: string;
  beschrijving: string;
  impact: string;
  aanpak: string;
}

// POST /api/projecten/intake/chat-start
//
// One-call intake starter for Claude Code / Claude API clients. Creates the
// intake row, optionally runs the Claude-powered invalshoeken generation,
// optionally creates the projecten row (if naam+eigenaar given), and returns
// a dashboardUrl the caller can paste into the chat so Sem/Syb can open the
// wizard to finish the remaining steps.
//
// Body:
//   {
//     klantConcept: string        // required, min 20 chars
//     eigenaar?: "sem"|"syb"|"team"|"vrij"  // if set + naam set, project is created
//     naam?: string               // project name, used together with eigenaar
//     omschrijving?: string       // optional project description override
//     genereerInvalshoeken?: boolean  // default true — also runs AI call
//     scanId?: number             // optional — links the intake to a Sales Engine scan
//   }
//
// Response:
//   {
//     intake: { id, stap, ... }
//     project?: { id, naam, ... } // only if naam+eigenaar were given
//     invalshoeken?: Invalshoek[] // only if genereerInvalshoeken !== false
//     dashboardUrl: string        // https://.../projecten/intake?id=X
//   }
export async function POST(req: NextRequest) {
  try {
    const gebruiker = await requireAuthOrApiKey(req);
    const body = await req.json().catch(() => ({}));

    const klantConcept: string = (body.klantConcept || "").trim();
    if (klantConcept.length < 20) {
      return NextResponse.json(
        { fout: "klantConcept is verplicht en minimaal 20 tekens lang" },
        { status: 400 }
      );
    }

    const genereerInvalshoeken = body.genereerInvalshoeken !== false;
    const scanId: number | undefined = typeof body.scanId === "number" ? body.scanId : undefined;

    // Optional project creation — both naam + eigenaar must be set
    const naam: string | undefined = body.naam ? String(body.naam).trim() : undefined;
    const eigenaar: string | undefined = body.eigenaar ? String(body.eigenaar).trim() : undefined;
    const wantsProject = !!(naam && eigenaar);
    if (wantsProject && !VALID_EIGENAAR.has(eigenaar!)) {
      return NextResponse.json(
        { fout: `Eigenaar moet sem|syb|team|vrij zijn, kreeg: ${eigenaar}` },
        { status: 400 }
      );
    }

    // 1. Create intake row
    const [intake] = await db
      .insert(projectIntakes)
      .values({
        klantConcept,
        scanId: scanId ?? null,
        bron: "chat",
        stap: "concept",
        aangemaaktDoor: gebruiker.id,
      })
      .returning();

    // 2. Generate invalshoeken (AI) unless opted out
    let invalshoeken: Invalshoek[] | undefined;
    if (genereerInvalshoeken) {
      try {
        const client = Anthropic();
        const response = await client.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: `Je bent een senior automation consultant bij Autronis. Op basis van onderstaande klantinformatie, genereer 3 tot 5 creatieve richtingen (invalshoeken) waarop Autronis waarde kan leveren. Elke richting is een ander angle/hoek — geen variaties op hetzelfde thema.

KLANT INFORMATIE:
${klantConcept}

Lever JSON terug in exact dit formaat, geen markdown, geen uitleg eromheen:
{
  "invalshoeken": [
    {
      "naam": "Korte pakkende naam (max 6 woorden)",
      "beschrijving": "Wat we bouwen/automatiseren, 1-2 zinnen",
      "impact": "Waarom dit waardevol is voor de klant, 1 zin",
      "aanpak": "Hoe we het in hoofdlijnen aanpakken, 1 zin"
    }
  ]
}

Regels:
- Geef 3 tot 5 invalshoeken, niet meer
- Elke invalshoek moet een HELE ANDERE aanpak zijn
- Wees concreet, niet vaag
- Denk in meetbare impact (tijdwinst, omzet, foutreductie)
- Stack: n8n, Claude API, Supabase, Next.js waar passend`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === "text") {
          const raw = content.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          const parsed = JSON.parse(raw) as { invalshoeken: Invalshoek[] };
          if (Array.isArray(parsed.invalshoeken) && parsed.invalshoeken.length >= 3) {
            invalshoeken = parsed.invalshoeken;
            await db
              .update(projectIntakes)
              .set({
                creatieveIdeeen: JSON.stringify(invalshoeken),
                stap: "invalshoeken",
                bijgewerktOp: new Date().toISOString(),
              })
              .where(eq(projectIntakes.id, intake.id));
          }
        }
      } catch (aiErr) {
        // Non-fatal — intake still exists, just no invalshoeken yet.
        console.error("[chat-start] invalshoeken AI call failed:", aiErr);
      }
    }

    // 3. Optional project creation
    let project: typeof projecten.$inferSelect | undefined;
    if (wantsProject) {
      const omschrijving: string | null =
        body.omschrijving && typeof body.omschrijving === "string"
          ? body.omschrijving
          : klantConcept;
      const [created] = await db
        .insert(projecten)
        .values({
          naam: naam!,
          eigenaar: eigenaar! as "sem" | "syb" | "team" | "vrij",
          omschrijving,
          aangemaaktDoor: gebruiker.id,
        })
        .returning();
      project = created;

      await db
        .update(projectIntakes)
        .set({
          projectId: created.id,
          stap: "scope",
          bijgewerktOp: new Date().toISOString(),
        })
        .where(eq(projectIntakes.id, intake.id));
    }

    // 4. Fire-and-forget: genereer slimme taken suggesties voor dit project
    if (project) {
      const cronSecret = process.env.CRON_SECRET;
      const suggestUrl = new URL("/api/cron/slimme-taken-suggest", req.url);
      suggestUrl.searchParams.set("bron", `project:${naam}`);
      suggestUrl.searchParams.set("projectContext", `${naam}: ${klantConcept}`);
      suggestUrl.searchParams.set("aantal", "3");
      fetch(suggestUrl.toString(), {
        headers: cronSecret ? { authorization: `Bearer ${cronSecret}` } : {},
      }).catch(() => {});
    }

    // 5. Refetch final intake state and build response
    const [finalIntake] = await db
      .select()
      .from(projectIntakes)
      .where(eq(projectIntakes.id, intake.id));

    const base =
      process.env.NEXT_PUBLIC_URL ||
      req.headers.get("origin") ||
      "https://dashboard.autronis.nl";
    const dashboardUrl = `${base.replace(/\/$/, "")}/projecten/intake?id=${intake.id}`;

    return NextResponse.json({
      intake: finalIntake,
      project,
      invalshoeken,
      dashboardUrl,
    });
  } catch (error) {
    console.error("[chat-start]", error);
    return NextResponse.json(
      {
        fout: error instanceof Error ? error.message : "chat-start mislukt",
      },
      { status: 500 }
    );
  }
}
