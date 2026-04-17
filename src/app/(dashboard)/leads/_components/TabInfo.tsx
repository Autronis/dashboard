"use client";

import type { LucideIcon } from "lucide-react";

export interface TabInfoTip {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function TabInfo({ tips }: { tips: TabInfoTip[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {tips.map((tip, index) => {
        const Icon = tip.icon;
        return (
          <div
            key={index}
            className="flex items-start gap-2.5 rounded-lg border border-autronis-border bg-autronis-card/30 px-3 py-2.5"
          >
            <div className="w-7 h-7 rounded-md bg-autronis-accent/10 text-autronis-accent flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-autronis-text-primary leading-tight">
                {tip.title}
              </div>
              <div className="text-[11px] text-autronis-text-tertiary mt-0.5 leading-snug">
                {tip.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
