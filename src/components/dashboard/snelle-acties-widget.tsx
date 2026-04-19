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
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

interface Actie {
  label: string;
  sub: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: string; // tailwind class bracket (text + bg tinten)
}

// Zes pure shortcuts naar de plekken waar Sem dagelijks input dropt of werk begint.
// Bedoeld om context-switch te elimineren — vanaf de home met één klik naar de
// actie zelf, niet eerst door de sidebar navigeren.
const ACTIES: Actie[] = [
  {
    label: "YouTube kennis",
    sub: "Video URL toevoegen",
    href: "/yt-knowledge",
    icon: Youtube,
    accent: "text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-500/20",
  },
  {
    label: "Instagram kennis",
    sub: "Reel of post toevoegen",
    href: "/insta-knowledge",
    icon: Instagram,
    accent: "text-pink-400 bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/20",
  },
  {
    label: "Sales scan",
    sub: "Website AI-scannen",
    href: "/sales-engine",
    icon: Rocket,
    accent: "text-autronis-accent bg-autronis-accent/10 hover:bg-autronis-accent/20 border-autronis-accent/20",
  },
  {
    label: "Rebuild demo",
    sub: "Landing page voor lead",
    href: "/leads/rebuild-prep",
    icon: Wand2,
    accent: "text-fuchsia-300 bg-fuchsia-500/10 hover:bg-fuchsia-500/20 border-fuchsia-500/20",
  },
  {
    label: "Nieuw idee",
    sub: "Invallen vastleggen",
    href: "/ideeen",
    icon: Lightbulb,
    accent: "text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20",
  },
  {
    label: "AI assistent",
    sub: "Suggestie of vraag",
    href: "/ai-assistent",
    icon: Bot,
    accent: "text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/20",
  },
  {
    label: "Website leads",
    sub: "Lijst scrapen",
    href: "/leads/website-leads",
    icon: Globe,
    accent: "text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  {
    label: "Nieuwe taak",
    sub: "Todo vastleggen",
    href: "/taken",
    icon: CheckCircle2,
    accent: "text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20",
  },
];

export function SnelleActiesWidget() {
  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Rocket className="w-4 h-4 text-autronis-accent" />
          Snelle acties
        </h2>
        <span className="text-[11px] text-autronis-text-secondary">
          één klik naar input of start-actie
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
        {ACTIES.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className={`group flex flex-col items-start gap-2 px-3 py-3 rounded-xl border transition-colors ${a.accent}`}
              title={a.sub}
            >
              <Icon className="w-4 h-4" />
              <div className="min-w-0 w-full">
                <div className="text-[13px] font-semibold text-autronis-text-primary truncate leading-tight">
                  {a.label}
                </div>
                <div className="text-[11px] text-autronis-text-secondary truncate leading-tight mt-0.5">
                  {a.sub}
                </div>
              </div>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity self-end -mt-1" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
