"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Split, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ParallelData {
  titel: string;
  duurMin?: number;
  pijler?: string;
  cluster?: string;
}

interface Props {
  open: boolean;
  parallel: ParallelData | null;
  parentTitel: string | null;
  parentItemId: number | null;
  onClose: () => void;
  onOpenParent: () => void;
}

const PIJLER_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  sales_engine: { bg: "bg-green-500/15", text: "text-green-300", border: "border-green-500/30" },
  content: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30" },
  inbound: { bg: "bg-teal-500/15", text: "text-teal-300", border: "border-teal-500/30" },
  netwerk: { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/30" },
  delivery: { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/30" },
  intern: { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/30" },
  admin: { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/30" },
};

export function ParallelDetailModal({ open, parallel, parentTitel, onClose, onOpenParent }: Props) {
  const pijlerStyle = parallel?.pijler ? PIJLER_STYLE[parallel.pijler] ?? PIJLER_STYLE.intern : null;

  return (
    <AnimatePresence>
      {open && parallel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass-modal border border-autronis-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Split className="w-4 h-4 text-autronis-accent" />
                <h3 className="text-base font-semibold text-autronis-text-primary">
                  Parallel — terwijl Claude draait
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-autronis-text-secondary hover:text-autronis-text-primary rounded-lg hover:bg-autronis-bg/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {parallel.pijler && pijlerStyle && (
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-md border capitalize", pijlerStyle.bg, pijlerStyle.text, pijlerStyle.border)}>
                    {parallel.pijler}
                  </span>
                )}
                {parallel.cluster && (
                  <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-500/15 text-slate-300 border border-slate-500/30">
                    {parallel.cluster}
                  </span>
                )}
                {parallel.duurMin && (
                  <span className="text-xs text-autronis-text-secondary inline-flex items-center gap-1 tabular-nums ml-auto">
                    <Clock className="w-3 h-3" />
                    {parallel.duurMin} min
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-autronis-border bg-autronis-bg/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-autronis-text-secondary mb-1.5">
                  Wat je nu doet
                </div>
                <p className="text-base text-autronis-text-primary font-medium leading-snug">
                  {parallel.titel}
                </p>
              </div>

              {parentTitel && (
                <button
                  onClick={onOpenParent}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-autronis-border hover:border-autronis-accent/40 bg-autronis-card/40 hover:bg-autronis-card/70 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-autronis-text-secondary mb-0.5">
                      Hoort bij Claude-taak
                    </div>
                    <div className="text-sm text-autronis-text-primary font-medium truncate">
                      {parentTitel}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-autronis-text-secondary shrink-0" />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
