"use client";

import Link from "next/link";
import { Instagram, Linkedin, ArrowRight, Megaphone } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

interface Pijler {
  dag: string;
  tijd: string;
  kanaal: "LinkedIn" | "Instagram";
  type: string;
  prompt: string;
  voorbeeld: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  accent: string;
}

// Roster uit go-to-market-plan.html — elke werkdag een pijler uit de 5.
// Zie /docs/go-to-market-plan.html#content voor de strategie.
const ROOSTER: Record<number, Pijler> = {
  1: {
    dag: "Maandag",
    tijd: "10:00",
    kanaal: "LinkedIn",
    type: "Sales Engine live scan",
    prompt: "Kies publiek bedrijf, run scan, carousel van 5-8 slides",
    voorbeeld: "\"Ik scande [Tony's Chocolonely] in 90 sec — 8 plekken gevonden\"",
    icon: Linkedin,
    accent: "text-sky-400",
  },
  2: {
    dag: "Dinsdag",
    tijd: "09:30",
    kanaal: "LinkedIn",
    type: "Build-in-public",
    prompt: "Screenshot van workflow/dashboard/agent + 1 zin context",
    voorbeeld: "\"Vandaag briefing automation gebouwd in 2u — n8n + Discord + Claude\"",
    icon: Linkedin,
    accent: "text-sky-400",
  },
  3: {
    dag: "Woensdag",
    tijd: "11:00",
    kanaal: "Instagram",
    type: "Behind-the-scenes",
    prompt: "30-sec reel of carousel — team/proces/koffie/agent-gesprek",
    voorbeeld: "Sem + Bas agent samen een prompt ontwerpen, voiceover erbij",
    icon: Instagram,
    accent: "text-pink-400",
  },
  4: {
    dag: "Donderdag",
    tijd: "09:00",
    kanaal: "LinkedIn",
    type: "Educational / contrarian",
    prompt: "Long-form tegen-de-stroom-in take (200-400 woorden)",
    voorbeeld: "\"Make/Zapier breekt bij 5 workflows — hier wat in plaats daarvan\"",
    icon: Linkedin,
    accent: "text-sky-400",
  },
  5: {
    dag: "Vrijdag",
    tijd: "10:30",
    kanaal: "LinkedIn",
    type: "Voor/na storytelling",
    prompt: "Klant-case — probleem → oplossing → meetbaar resultaat",
    voorbeeld: "\"Klant 12u/week aan offertes. Nu 1u/week. Hier hoe.\"",
    icon: Linkedin,
    accent: "text-sky-400",
  },
};

const WEEKEND_FALLBACK: Pijler = {
  dag: "Weekend",
  tijd: "1u",
  kanaal: "LinkedIn",
  type: "Batch posts voor volgende week",
  prompt: "Skill(post) aanroepen, 5 posts schrijven en schedulen",
  voorbeeld: "Maandag-t/m-vrijdag content klaarzetten voor één-klik posten",
  icon: Megaphone,
  accent: "text-amber-300",
};

export function ContentVandaagWidget() {
  const vandaag = new Date().getDay(); // 0=zondag, 1=maandag, ... 6=zaterdag
  const pijler = ROOSTER[vandaag] ?? WEEKEND_FALLBACK;
  const Icon = pijler.icon;

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl p-5 card-glow h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-autronis-text-primary flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-autronis-accent" />
          Content vandaag
        </h3>
        <Link
          href="/content"
          className="text-xs text-autronis-accent hover:text-autronis-accent-hover font-medium inline-flex items-center gap-1"
        >
          Kalender <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-wider text-autronis-text-secondary">
          {pijler.dag} · {pijler.tijd}
        </span>
        <Icon className={`w-3.5 h-3.5 ${pijler.accent}`} />
        <span className={`text-[11px] font-semibold ${pijler.accent}`}>
          {pijler.kanaal}
        </span>
      </div>

      <div className="text-base font-semibold text-autronis-text-primary mb-2 leading-snug">
        {pijler.type}
      </div>

      <p className="text-xs text-autronis-text-secondary mb-3 leading-relaxed">
        {pijler.prompt}
      </p>

      <div className="bg-autronis-bg/50 rounded-lg p-2.5 text-[11px] text-autronis-text-secondary italic leading-relaxed mb-3 border-l-2 border-autronis-accent/40">
        {pijler.voorbeeld}
      </div>

      <Link
        href="/content"
        className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg bg-autronis-accent text-black text-xs font-semibold hover:bg-autronis-accent-hover transition"
      >
        Post maken
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
