import type { BannerIcon, BannerIllustration } from "@/types/content";

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
