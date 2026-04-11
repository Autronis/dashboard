"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Receipt, Landmark, TrendingUp, BarChart3, CreditCard, Euro, Link2, Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { UitgavenTab } from "./uitgaven-tab";
import { BankImportTab } from "./bank-import-tab";
import { LiquiditeitTab } from "./liquiditeit-tab";
import { AbonnementenTab } from "./abonnementen-tab";
import { ProfitProjectenTab } from "./profit-projecten-tab";
import { NietGematchtTab } from "./niet-gematcht-tab";
import { TerugkerendTab } from "./terugkerend-tab";

type Tab = "uitgaven" | "abonnementen" | "profit" | "bank" | "matching" | "liquiditeit" | "terugkerend";

const TABS: { key: Tab; label: string; icon: typeof Euro }[] = [
  { key: "uitgaven", label: "Uitgaven", icon: Receipt },
  { key: "abonnementen", label: "Abonnementen", icon: CreditCard },
  { key: "terugkerend", label: "Terugkerend", icon: Repeat },
  { key: "profit", label: "Profit / Project", icon: TrendingUp },
  { key: "bank", label: "Bank Import", icon: Landmark },
  { key: "matching", label: "Matching", icon: Link2 },
  { key: "liquiditeit", label: "Liquiditeit", icon: BarChart3 },
];

export default function FinancienPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "uitgaven";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-autronis-text-primary">Financiën</h1>
          <p className="text-base text-autronis-text-secondary mt-1">
            Uitgaven, bankimport en liquiditeit
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center",
                  activeTab === tab.key
                    ? "bg-autronis-accent text-autronis-bg shadow-lg shadow-autronis-accent/20"
                    : "text-autronis-text-secondary hover:text-autronis-text-primary hover:bg-autronis-bg/50"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "uitgaven" && <UitgavenTab />}
        {activeTab === "abonnementen" && <AbonnementenTab />}
        {activeTab === "profit" && <ProfitProjectenTab />}
        {activeTab === "bank" && <BankImportTab />}
        {activeTab === "matching" && <NietGematchtTab />}
        {activeTab === "liquiditeit" && <LiquiditeitTab />}
        {activeTab === "terugkerend" && <TerugkerendTab />}
      </div>
    </PageTransition>
  );
}
