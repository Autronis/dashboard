"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { OverzichtTab } from "../_tabs/OverzichtTab";
import { ContactenTab } from "../_tabs/ContactenTab";
import { EnrichmentTab } from "../_tabs/EnrichmentTab";

type TabKey = "overzicht" | "contacten" | "enrichment";

const TABS: { key: TabKey; label: string; href: string }[] = [
  { key: "overzicht", label: "Overzicht", href: "/leads" },
  { key: "contacten", label: "Contacten", href: "/leads/contacts" },
  { key: "enrichment", label: "Enrichment", href: "/leads/enrichment" },
];

export function LeadsLayout({ active }: { active: TabKey }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 bg-autronis-bg/95 backdrop-blur-sm border-b border-autronis-border">
        <div className="flex items-end gap-1 px-6 pt-4">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
                  isActive
                    ? "text-autronis-accent border-autronis-accent bg-autronis-card/40"
                    : "text-autronis-text-secondary border-transparent hover:text-autronis-text-primary hover:bg-autronis-card/20"
                )}
              >
                {tab.label}
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
