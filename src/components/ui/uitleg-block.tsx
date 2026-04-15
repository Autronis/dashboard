"use client";

import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Generic, dismissible explainer block. Use this anywhere a page benefits
// from inline tips, rules or context that the user wants to read once and
// then collapse out of the way. The collapse state persists per `id` in
// localStorage, so on a return visit the user gets back exactly the state
// they left it in.
//
// Usage:
//   <UitlegBlock
//     id="kilometers-regels"
//     titel="Wat telt als zakelijke kilometer?"
//     subtitel="Klik voor de regels — €0,23/km aftrek"
//   >
//     ...content...
//   </UitlegBlock>
//
// Default state is "open" first visit, "closed" after first manual collapse.

interface Props {
  id: string;
  titel: string;
  subtitel?: string;
  children: ReactNode;
  // Optional accent — defaults to blue. Use "amber" for warnings,
  // "emerald" for success-ish, etc.
  accent?: "blue" | "emerald" | "amber" | "rose" | "accent";
  // Default open state on first visit (before user interacts). Default true.
  defaultOpen?: boolean;
}

const ACCENT_STYLES = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-400" },
  accent: { bg: "bg-autronis-accent/10", text: "text-autronis-accent" },
} as const;

export function UitlegBlock({
  id,
  titel,
  subtitel,
  children,
  accent = "blue",
  defaultOpen = true,
}: Props) {
  const storageKey = `uitlegblok:${id}`;
  const [open, setOpen] = useState(defaultOpen);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted state on mount (client only, avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "open") setOpen(true);
      else if (stored === "closed") setOpen(false);
    } catch {
      // localStorage may be blocked — fall back to defaultOpen
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "open" : "closed");
    } catch {
      // ignore
    }
  }

  const accentStyle = ACCENT_STYLES[accent];

  return (
    <div className="bg-autronis-card border border-autronis-border rounded-2xl overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-autronis-bg/40 transition-colors"
      >
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", accentStyle.bg)}>
          <Info className={cn("w-4 h-4", accentStyle.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-autronis-text-primary">{titel}</p>
          {subtitel && (
            <p className="text-[11px] text-autronis-text-secondary mt-0.5">
              {open ? "Klik om in te klappen" : subtitel}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-autronis-text-secondary transition-transform flex-shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {hydrated && open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 space-y-5 border-t border-autronis-border/50 pt-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
