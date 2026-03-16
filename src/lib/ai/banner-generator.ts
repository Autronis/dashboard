import Anthropic from "@anthropic-ai/sdk";
import type { BannerIcon, BannerIllustration } from "@/types/content";
import { BANNER_ICONS, BANNER_ILLUSTRATIONS } from "@/types/content";

export interface TopicAnalysis {
  icon: BannerIcon;
  illustration: BannerIllustration;
  capsuleText: string;
}

interface RawTopicAnalysis {
  icon: unknown;
  illustration: unknown;
  capsuleText: unknown;
}

function buildAnalyzePrompt(onderwerp: string): string {
  return `Given the topic "${onderwerp}", choose:
1. The best icon from: ${BANNER_ICONS.join(", ")}
2. The best background illustration from: ${BANNER_ILLUSTRATIONS.join(", ")}
3. Clean capsule text (short, max 3 words, like "Process Automation")

Icon guide:
- cog: process, workflow, automation, system
- brain: AI, machine learning, intelligence
- bar-chart: data, analytics, reporting, statistics
- link: integrations, API, connections, linking
- lightbulb: tips, insights, ideas, advice
- target: goals, sales, conversion, targeting
- git-branch: development, branches, workflows
- zap: speed, instant, fast automation, triggers
- plug: connections, integrations, plugins
- users: team, clients, collaboration, people
- euro: finance, revenue, costs, pricing
- shield: security, reliability, protection

Illustration guide:
- gear: process automation, workflows
- brain: AI, machine learning
- nodes: integrations, connections, network
- chart: data, analytics, growth
- target: goals, sales, lead generation
- flow: workflows, processes, pipelines
- circuit: tech, development, systems
- lightbulb: tips, insights, ideas

Return ONLY valid JSON, no explanation, no markdown:
{"icon":"cog","illustration":"gear","capsuleText":"Process Automation"}`;
}

export async function analyzeTopic(onderwerp: string): Promise<TopicAnalysis> {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-haiku-4-20250514",
    max_tokens: 150,
    messages: [{ role: "user", content: buildAnalyzePrompt(onderwerp) }],
  });

  const rawText = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  let parsed: RawTopicAnalysis;
  try {
    parsed = JSON.parse(rawText) as RawTopicAnalysis;
  } catch {
    const match = rawText.match(/\{[\s\S]*?\}/);
    if (!match) {
      return { ...getDefaults(onderwerp), capsuleText: onderwerp };
    }
    parsed = JSON.parse(match[0]) as RawTopicAnalysis;
  }

  const icon: BannerIcon = (BANNER_ICONS as readonly string[]).includes(parsed.icon as string)
    ? (parsed.icon as BannerIcon)
    : getDefaults(onderwerp).icon;

  const illustration: BannerIllustration = (BANNER_ILLUSTRATIONS as readonly string[]).includes(parsed.illustration as string)
    ? (parsed.illustration as BannerIllustration)
    : getDefaults(onderwerp).illustration;

  const capsuleText =
    typeof parsed.capsuleText === "string" && parsed.capsuleText.length > 0
      ? parsed.capsuleText
      : onderwerp;

  return { icon, illustration, capsuleText };
}

export function getDefaults(onderwerp: string): { icon: BannerIcon; illustration: BannerIllustration } {
  const lower = onderwerp.toLowerCase();

  if (/ai|machine|neural|model|leren|intelligence/.test(lower)) {
    return { icon: "brain", illustration: "brain" };
  }
  if (/data|dashboard|rapport|statistiek|analytics|chart|grafiek/.test(lower)) {
    return { icon: "bar-chart", illustration: "chart" };
  }
  if (/integrat|koppel|api|connect|systeem|sync/.test(lower)) {
    return { icon: "link", illustration: "nodes" };
  }
  if (/tip|inzicht|advies|idee|learning/.test(lower)) {
    return { icon: "lightbulb", illustration: "lightbulb" };
  }
  if (/doel|target|sales|lead|conversie|klant/.test(lower)) {
    return { icon: "target", illustration: "target" };
  }
  if (/flow|workflow|pipeline|proces|process/.test(lower)) {
    return { icon: "git-branch", illustration: "flow" };
  }
  if (/snel|snelheid|speed|zap|trigger|instant/.test(lower)) {
    return { icon: "zap", illustration: "circuit" };
  }
  if (/geld|euro|prijs|omzet|financ/.test(lower)) {
    return { icon: "euro", illustration: "chart" };
  }
  if (/team|mensen|gebruiker|klanten|samenwerk/.test(lower)) {
    return { icon: "users", illustration: "nodes" };
  }
  if (/beveiliging|security|shield|bescherm/.test(lower)) {
    return { icon: "shield", illustration: "circuit" };
  }

  // Default: automation
  return { icon: "cog", illustration: "gear" };
}
