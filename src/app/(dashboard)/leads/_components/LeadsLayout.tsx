"use client";

import Link from "next/link";
import { Target, Users, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverzichtTab } from "../_tabs/OverzichtTab";
import { ContactenTab } from "../_tabs/ContactenTab";
import { EnrichmentTab } from "../_tabs/EnrichmentTab";

type TabKey = "overzicht" | "contacten" | "enrichment";

interface TabDef {
  key: TabKey;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const TABS: TabDef[] = [
  {
    key: "overzicht",
    label: "Overzicht",
    href: "/leads",
    icon: Target,
    description: "Alles in één lijst — bulk scannen, mailen of weg",
  },
  {
    key: "contacten",
    label: "Contacten",
    href: "/leads/contacts",
    icon: Users,
    description: "Filter + CSV export — bouw je outreach-lijst",
  },
  {
    key: "enrichment",
    label: "Enrichment",
    href: "/leads/enrichment",
    icon: Sparkles,
    description: "Vul ontbrekende email/telefoon/website aan",
  },
];

export function LeadsLayout({ active }: { active: TabKey }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 bg-autronis-bg/95 backdrop-blur-md border-b border-autronis-border">
        <div className="flex flex-wrap items-stretch gap-2 px-6 pt-4 pb-3">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            const Icon = tab.icon;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  "group flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all",
                  isActive
                    ? "border-autronis-accent bg-autronis-accent/10 shadow-[0_0_0_1px_rgba(23,184,165,0.3)]"
                    : "border-autronis-border bg-autronis-card/30 hover:border-autronis-accent/40 hover:bg-autronis-card/60"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    isActive
                      ? "bg-autronis-accent text-autronis-bg"
                      : "bg-autronis-bg text-autronis-text-secondary group-hover:text-autronis-accent"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isActive ? "text-autronis-text-primary" : "text-autronis-text-primary/90"
                    )}
                  >
                    {tab.label}
                  </span>
                  <span className="text-[11px] text-autronis-text-tertiary mt-0.5">
                    {tab.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div>
        {active === "overzicht" && <OverzichtTab />}
        {active === "contacten" && <ContactenTab />}
        {active === "enrichment" && <EnrichmentTab />}
      </div>
    </div>
  );
}
