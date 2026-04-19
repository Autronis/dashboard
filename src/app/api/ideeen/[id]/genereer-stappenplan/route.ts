import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ideeen } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Je bent een senior full-stack engineer die voor Autronis (Sem & Syb, Nederlands tech-bedrijf) een concreet implementatie-plan schrijft.

Autronis stack die je kent:
- Next.js 16 (App Router, Turbopack, TypeScript)
- Turso (libsql/SQLite) via Drizzle ORM
- Vercel (Hobby tier: 60s function timeout, daily crons only)
- Anthropic SDK (Claude Sonnet/Opus/Haiku)
- OpenAI voor Whisper + vision backup
- n8n automation op Hostinger (Atlas bot infra)
- iron-session auth, Tailwind v4, shadcn/ui patterns
- Python voor CLI tools (yt-knowledge-pipeline als voorbeeld)

Doel: gegeven een idee (titel + omschrijving + eventuele extra context), genereer een actionable 8-15 stappen-plan dat Sem of Syb letterlijk kan uitvoeren. Geen video-stappen overnemen — schrijf wat ZIJ moeten doen om dit idee te bouwen in hun stack.

Output format (pure markdown, geen JSON, geen code fences):

## 🎯 Implementatie-plan voor Autronis

**Tech-keuzes:**
- [1-3 bullets: welke Autronis-componenten komen hier bij kijken]

**Stappen:**
1. **[Stap titel]** — [concrete actie, 1-2 zinnen; noem exact bestandspad, package, of endpoint als relevant]
2. **[...]**
...

**Geschatte bouwtijd:** [X uur/dagen]

**Risico's / aandachtspunten:**
- [realistische blockers zoals API-limieten, scraping-fragility, timeouts]

Regels:
- Wees SPECIFIEK: noem exact bestandspaden (src/app/api/..., src/lib/...), package namen, env vars
- Geen "consider using X" — schrijf "gebruik X"
- Als iets buiten Vercel moet (Whisper downloads, n8n workflow), zeg dat expliciet
- Als het idee al half bestaat in de codebase (bv. Insta Knowledge heeft al een adapter-interface), noem het als starting point
- Houd het nuchter — 8-15 stappen, elk 1-2 zinnen`;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAuth();
  const { id } = await params;

  const idee = await db.select().from(ideeen).where(eq(ideeen.id, Number(id))).get();
  if (!idee) return NextResponse.json({ fout: "Idee niet gevonden" }, { status: 404 });

  const context = [
    `Titel: ${idee.naam}`,
    idee.omschrijving ? `Omschrijving: ${idee.omschrijving}` : "",
    idee.uitwerking ? `Bestaande uitwerking/context:\n${idee.uitwerking}` : "",
    idee.bron ? `Bron: ${idee.bron}` : "",
  ].filter(Boolean).join("\n\n");

  const anthropic = Anthropic(undefined, "/api/ideeen/genereer-stappenplan");
  let plan: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Schrijf het implementatie-plan voor dit idee:\n\n${context}` }],
    });
    plan = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  } catch (e) {
    return NextResponse.json({ fout: `Claude call faalde: ${e instanceof Error ? e.message : "onbekend"}` }, { status: 500 });
  }
  if (!plan) return NextResponse.json({ fout: "Claude gaf lege response" }, { status: 500 });

  // Replace existing plan block if present, else append.
  const header = "## 🎯 Implementatie-plan voor Autronis";
  const existing = idee.uitwerking || "";
  const stripped = existing.includes(header)
    ? existing.slice(0, existing.indexOf(header)).replace(/\n+$/, "")
    : existing;
  const nieuweUitwerking = stripped
    ? `${stripped}\n\n---\n\n${plan}`
    : plan;

  await db
    .update(ideeen)
    .set({ uitwerking: nieuweUitwerking, bijgewerktOp: new Date().toISOString() })
    .where(eq(ideeen.id, Number(id)))
    .run();

  return NextResponse.json({ succes: true, plan });
}
