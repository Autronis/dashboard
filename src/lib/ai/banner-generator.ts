import { TrackedAnthropic as Anthropic } from "@/lib/ai/tracked-anthropic";
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
- cog: process, workflow, automation, system, mechanism
- brain: AI, machine learning, intelligence, neural
- bar-chart: data, analytics, reporting, statistics, charts
- link: integrations, API, connections, linking, chains
- lightbulb: tips, insights, ideas, advice, innovation
- target: goals, sales, conversion, targeting, KPI
- git-branch: development, branches, workflows, versioning
- zap: speed, instant, fast automation, triggers, electric
- plug: connections, integrations, plugins, connectors
- users: team, clients, collaboration, people, HR
- euro: finance, revenue, costs, pricing, money
- shield: security, reliability, protection, compliance
- database: databases, storage, data management, SQL
- mail: email, outreach, communication, campaigns, inbox
- globe: web, international, online presence, SaaS, domain
- rocket: launch, growth, startup, scale, boost
- clock: scheduling, time management, planning, deadlines
- layers: multi-layer, stack, architecture, systems, tiers
- trending-up: growth, KPIs, performance, metrics, upward
- cpu: tech, infrastructure, processing, computing, hardware
- cloud: cloud services, SaaS, hosting, backup, AWS
- calendar: planning, scheduling, agenda, events, dates
- key: access, authentication, permissions, security, login
- heart: customer satisfaction, loyalty, NPS, care, love
- workflow: branching flow, pipelines, automation steps
- api: API endpoints, developer, REST, GraphQL, integrations
- chat: messaging, support, communication, chatbot, dialogue
- check: done, completed, approved, verified, confirmed
- settings: configuration, admin, setup, parameters
- search: find, discover, lookup, query, search engine
- star: favorite, rating, premium, top, excellence
- diamond: value, premium, crystal, precious, quality
- code: software, development, programming, code review
- truck: logistics, delivery, transport, shipping, supply chain
- building: company, office, real estate, enterprise, B2B
- chart-pie: distribution, percentages, market share, breakdown
- filter: filtering, segmentation, refining, criteria
- repeat: recurring, automation loop, retry, cycle, subscription
- send: outreach, publish, deliver, submit, dispatch
- wifi: connectivity, wireless, online, network, IoT

Illustration guide:
- gear: process automation, workflows, systems, mechanisms
- brain: AI, machine learning, neural networks, intelligence
- nodes: integrations, connections, network, graph, topology
- chart: data, analytics, growth, metrics, dashboards
- target: goals, sales, lead generation, KPIs, conversion
- flow: workflows, processes, pipelines, decision trees
- circuit: tech, development, infrastructure, electronics
- lightbulb: tips, insights, ideas, innovation, creativity
- puzzle: integrations, system fitting, SaaS, combining parts
- cloud: cloud, SaaS, hosting, backup, data transfer
- rocket: launch, growth, scaling, startup, acceleration
- calendar: planning, scheduling, time management, agenda
- magnet: lead generation, attraction, marketing, pull
- handshake: partnerships, deals, collaboration, clients, B2B

Return ONLY valid JSON, no explanation, no markdown:
{"icon":"cog","illustration":"gear","capsuleText":"Process Automation"}`;
}

export async function analyzeTopic(onderwerp: string): Promise<TopicAnalysis> {
  const client = Anthropic();

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

  if (/ai|machine|neural|model|leren|intelligence|gpt|llm/.test(lower)) {
    return { icon: "brain", illustration: "brain" };
  }
  if (/data|dashboard|rapport|statistiek|analytics|chart|grafiek|kpi|metric|pie|taart/.test(lower)) {
    return { icon: "trending-up", illustration: "chart" };
  }
  if (/integrat|koppel|api|connect|systeem|sync|puzzle|rest|graphql/.test(lower)) {
    return { icon: "api", illustration: "nodes" };
  }
  if (/tip|inzicht|advies|idee|learning|kennis/.test(lower)) {
    return { icon: "lightbulb", illustration: "lightbulb" };
  }
  if (/doel|target|sales|lead|conversie|klant|magnet|attract/.test(lower)) {
    return { icon: "target", illustration: "magnet" };
  }
  if (/flow|workflow|pipeline|proces|process|stap|step/.test(lower)) {
    return { icon: "workflow", illustration: "flow" };
  }
  if (/code|develop|programmeer|software|git|branch|deploy/.test(lower)) {
    return { icon: "code", illustration: "circuit" };
  }
  if (/snel|snelheid|speed|zap|trigger|instant|auto/.test(lower)) {
    return { icon: "zap", illustration: "circuit" };
  }
  if (/geld|euro|prijs|omzet|financ|revenue|kosten|budget/.test(lower)) {
    return { icon: "euro", illustration: "chart" };
  }
  if (/team|mensen|gebruiker|klanten|samenwerk|partner|handshake|hr/.test(lower)) {
    return { icon: "users", illustration: "handshake" };
  }
  if (/beveiliging|security|shield|bescherm|key|toegang|compliance/.test(lower)) {
    return { icon: "shield", illustration: "circuit" };
  }
  if (/cloud|saas|hosting|backup|server|aws|azure/.test(lower)) {
    return { icon: "cloud", illustration: "cloud" };
  }
  if (/launch|lanceer|groei|scale|startup|rocket/.test(lower)) {
    return { icon: "rocket", illustration: "rocket" };
  }
  if (/plan|agenda|kalend|schedule|datum|event/.test(lower)) {
    return { icon: "calendar", illustration: "calendar" };
  }
  if (/email|mail|outreach|campagne|nieuwsbrief|verstuur|send/.test(lower)) {
    return { icon: "send", illustration: "nodes" };
  }
  if (/database|opslag|storage|db|sql|postgres/.test(lower)) {
    return { icon: "database", illustration: "circuit" };
  }
  if (/web|website|online|globaal|international|domain/.test(lower)) {
    return { icon: "globe", illustration: "nodes" };
  }
  if (/tijd|uur|deadline|snelheid|timer|herhaal|repeat|recur/.test(lower)) {
    return { icon: "repeat", illustration: "flow" };
  }
  if (/infrastructuur|stack|architectuur|layers|systemen/.test(lower)) {
    return { icon: "layers", illustration: "circuit" };
  }
  if (/chat|gesprek|support|bericht|message|bot/.test(lower)) {
    return { icon: "chat", illustration: "nodes" };
  }
  if (/logistiek|transport|bezorg|levering|truck|shipping/.test(lower)) {
    return { icon: "truck", illustration: "flow" };
  }
  if (/bedrijf|kantoor|gebouw|enterprise|b2b|onderneming/.test(lower)) {
    return { icon: "building", illustration: "handshake" };
  }
  if (/filter|segment|verfijn|criteria|search|zoek/.test(lower)) {
    return { icon: "filter", illustration: "nodes" };
  }
  if (/ster|premium|top|kwaliteit|excel|rating/.test(lower)) {
    return { icon: "star", illustration: "target" };
  }
  if (/wifi|netwerk|verbinding|iot|wireless|online/.test(lower)) {
    return { icon: "wifi", illustration: "nodes" };
  }
  if (/check|klaar|done|afgerond|compleet|goedgekeurd/.test(lower)) {
    return { icon: "check", illustration: "flow" };
  }
  if (/instelling|configuratie|admin|setup|beheer/.test(lower)) {
    return { icon: "settings", illustration: "gear" };
  }

  // Default: automation
  return { icon: "cog", illustration: "gear" };
}
