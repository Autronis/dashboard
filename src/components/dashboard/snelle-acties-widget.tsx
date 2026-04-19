"use client";

import Link from "next/link";
import {
  Youtube,
  Instagram,
  Globe,
  Lightbulb,
  Bot,
  CheckCircle2,
  Rocket,
  Wand2,
  ArrowRight,
  Zap,
  Sparkles,
  Inbox,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

interface Actie {
  label: string;
  voorbeeld: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: string;
  variant: "input" | "actie";
}

// Gesorteerd op variant — input = droppen (kennis, ideeën, taken),
// actie = uitvoeren (scan, rebuild, AI triggeren).
const ACTIES: Actie[] = [
  // INPUT — dingen droppen voor later
  {
    label: "YouTube kennis",
    voorbeeld: "Video over n8n MCP templates toevoegen",
    href: "/yt-knowledge",
    icon: Youtube,
    accent: "text-red-400",
    variant: "input",
  },
  {
    label: "Instagram kennis",
    voorbeeld: "Reel van concurrent analyseren",
    href: "/insta-knowledge",
    icon: Instagram,
    accent: "text-pink-400",
    variant: "input",
  },
  {
    label: "Idee vastleggen",
    voorbeeld: "Inval over automation opschrijven",
    href: "/ideeen",
    icon: Lightbulb,
    accent: "text-amber-300",
    variant: "input",
  },
  {
    label: "Nieuwe taak",
    voorbeeld: "Todo met deadline vastleggen",
    href: "/taken",
    icon: CheckCircle2,
    accent: "text-purple-300",
    variant: "input",
  },
  {
    label: "Website leads",
    voorbeeld: "Nieuwe lijst scrapen + enrichen",
    href: "/leads/website-leads",
    icon: Globe,
    accent: "text-emerald-300",
    variant: "input",
  },

  // ACTIE — dingen NU uitvoeren
  {
    label: "Sales scan",
    voorbeeld: "Nieuwe prospect AI-scannen",
    href: "/sales-engine",
    icon: Rocket,
    accent: "text-autronis-accent",
    variant: "actie",
  },
  {
    label: "Rebuild demo",
    voorbeeld: "Landing page voor lead bouwen",
    href: "/leads/rebuild-prep",
    icon: Wand2,
    accent: "text-fuchsia-300",
    variant: "actie",
  },
  {
    label: "Voer idee uit",
    voorbeeld: "Volgende gevalideerde idee oppakken",
    href: "/ideeen?filter=klaar",
    icon: Zap,
    accent: "text-yellow-300",
    variant: "actie",
  },
  {
    label: "AI assistent",
    voorbeeld: "Vraag of brainstorm triggeren",
    href: "/ai-assistent",
    icon: Bot,
    accent: "text-sky-300",
    variant: "actie",
  },
  {
    label: "Bekijk inbox",
    voorbeeld: "Open intakes & open mails",
    href: "/dagritme",
    icon: Inbox,
    accent: "text-cyan-300",
    variant: "actie",
  },
];

interface Props {
  compact?: boolean;
  variant?: "input" | "actie" | "all";
}

export function SnelleActiesWidget({ compact = true, variant = "all" }: Props) {
  const items = variant === "all" ? ACTIES : ACTIES.filter((a) => a.variant === variant);

  if (!compact) {
    return (
      <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
        <Header variant={variant} />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          {items.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col items-start gap-2 px-3 py-3 rounded-xl border border-autronis-border hover:border-autronis-accent/40 bg-autronis-bg/40 hover:bg-autronis-bg transition-colors"
                title={a.voorbeeld}
              >
                <Icon className={`w-4 h-4 ${a.accent}`} />
                <div className="min-w-0 w-full">
                  <div className="text-[13px] font-semibold text-autronis-text-primary truncate leading-tight">
                    {a.label}
                  </div>
                  <div className="text-[11px] text-autronis-text-secondary truncate leading-tight mt-0.5">
                    {a.voorbeeld}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  // Compact variant — kleine rijen, past in smalle kolommen
  return (
    <div className="bg-autronis-bg/50 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-autronis-text-primary mb-2 flex items-center gap-1.5">
        {variant === "actie" ? (
          <Zap className="w-3.5 h-3.5 text-autronis-accent" />
        ) : variant === "input" ? (
          <Sparkles className="w-3.5 h-3.5 text-autronis-accent" />
        ) : (
          <Rocket className="w-3.5 h-3.5 text-autronis-accent" />
        )}
        {variant === "actie" ? "Nu uitvoeren" : variant === "input" ? "Snel droppen" : "Snelle acties"}
      </h3>
      <div className="space-y-1">
        {items.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md hover:bg-autronis-card/60 transition-colors"
              title={a.voorbeeld}
            >
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${a.accent}`} />
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-autronis-text-primary flex-shrink-0 group-hover:text-autronis-accent transition-colors">
                  {a.label}
                </span>
                <span className="text-[11px] text-autronis-text-secondary truncate hidden md:inline italic">
                  {a.voorbeeld}
                </span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-autronis-accent transition-opacity flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Header({ variant }: { variant: "input" | "actie" | "all" }) {
  const title = variant === "actie" ? "Nu uitvoeren" : variant === "input" ? "Snel droppen" : "Snelle acties";
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
        <Rocket className="w-4 h-4 text-autronis-accent" />
        {title}
      </h2>
      <span className="text-[11px] text-autronis-text-secondary">
        één klik naar actie
      </span>
    </div>
  );
}
