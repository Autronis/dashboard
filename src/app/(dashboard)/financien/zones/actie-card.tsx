"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ActieCardProps {
  titel: string;
  count: number;
  subtitel?: string;
  children: ReactNode;
}

export function ActieCard({ titel, count, subtitel, children }: ActieCardProps) {
  const [open, setOpen] = useState(false);
  const isLeeg = count === 0;

  return (
    <div
      className={cn(
        "border rounded-2xl overflow-hidden transition-colors",
        isLeeg
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-orange-500/5 border-orange-500/20"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full p-5 flex items-center justify-between hover:brightness-110 transition"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          {isLeeg ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
          )}
          <div className="text-left">
            <h3 className="text-sm font-semibold text-autronis-text-primary">{titel}</h3>
            {isLeeg ? (
              <p className="text-xs text-emerald-400 mt-1">Niks te doen</p>
            ) : (
              <p className="text-xs text-orange-400 mt-1 tabular-nums">
                {count} {count === 1 ? "item" : "items"}
                {subtitel && ` · ${subtitel}`}
              </p>
            )}
          </div>
        </div>
        {!isLeeg && (
          <ChevronDown
            className={cn(
              "w-4 h-4 text-autronis-text-secondary transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && !isLeeg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-autronis-border/30"
          >
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
