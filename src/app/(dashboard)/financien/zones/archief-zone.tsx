"use client";

import { useState } from "react";
import { ChevronDown, Archive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AbonnementenTab } from "../abonnementen-tab";
import { TerugkerendTab } from "../terugkerend-tab";
import { LiquiditeitTab } from "../liquiditeit-tab";
import { ProfitProjectenTab } from "../profit-projecten-tab";
import { BankImportTab } from "../bank-import-tab";

type Sectie = "abonnementen" | "liquiditeit" | "profit" | "bank";

const SECTIES: { key: Sectie; label: string }[] = [
  { key: "abonnementen", label: "Abonnementen & terugkerend" },
  { key: "liquiditeit", label: "Liquiditeit / Cash forecast" },
  { key: "profit", label: "Profit per project" },
  { key: "bank", label: "Bank CSV import" },
];

export function ArchiefZone() {
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState<Sectie>("abonnementen");

  return (
    <div className="space-y-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 bg-autronis-card border border-autronis-border rounded-2xl hover:brightness-110 transition"
      >
        <div className="flex items-center gap-3">
          <Archive className="w-4 h-4 text-autronis-text-secondary" />
          <span className="text-sm font-medium text-autronis-text-primary">Archief & overige tools</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-autronis-text-secondary transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-1 bg-autronis-card border border-autronis-border rounded-xl p-1 overflow-x-auto">
                {SECTIES.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setActief(s.key)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap",
                      actief === s.key
                        ? "bg-autronis-accent text-autronis-bg"
                        : "text-autronis-text-secondary hover:text-autronis-text-primary"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {actief === "abonnementen" && (
                <div className="space-y-6">
                  <AbonnementenTab />
                  <TerugkerendTab />
                </div>
              )}
              {actief === "liquiditeit" && <LiquiditeitTab />}
              {actief === "profit" && <ProfitProjectenTab />}
              {actief === "bank" && <BankImportTab />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
