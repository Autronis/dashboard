"use client";

import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActionShortcuts, type BoundAction } from "@/hooks/use-action-shortcuts";
import { ActionDockOverflow } from "./action-dock-overflow";

export function ActionDock() {
  const { visible, all } = useActionShortcuts();
  const [overflowOpen, setOverflowOpen] = useState(false);

  const handleRun = (action: BoundAction) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
    action.run();
  };

  return (
    <>
      {/* Mobile bottom bar */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-autronis-border bg-autronis-card/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <LayoutGroup id="action-dock-mobile">
          <div className="flex items-stretch justify-around px-1 pt-2 pb-2">
            <AnimatePresence mode="popLayout">
              {visible.map((action) => (
                <motion.button
                  key={action.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleRun(action)}
                  className="flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl text-autronis-text-secondary active:bg-autronis-accent/10 active:text-autronis-accent transition-colors"
                  aria-label={action.label}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium truncate max-w-full px-1">
                    {action.label}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
            <button
              onClick={() => setOverflowOpen(true)}
              className="flex-1 min-w-0 min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-xl text-autronis-text-secondary active:bg-autronis-accent/10 active:text-autronis-accent transition-colors"
              aria-label="Meer acties"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">Meer</span>
            </button>
          </div>
        </LayoutGroup>
      </div>

      {/* Desktop floating pill */}
      <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <LayoutGroup id="action-dock-desktop">
          <div className="flex items-center gap-1 rounded-2xl border border-autronis-border bg-autronis-card/90 backdrop-blur-xl px-2 py-2 shadow-2xl shadow-autronis-accent/10">
            <AnimatePresence mode="popLayout">
              {visible.map((action) => (
                <motion.button
                  key={action.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleRun(action)}
                  className={cn(
                    "group relative w-11 h-11 flex items-center justify-center rounded-xl",
                    "text-autronis-text-secondary hover:bg-autronis-accent/10 hover:text-autronis-accent",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-autronis-accent",
                    "transition-colors"
                  )}
                  aria-label={action.label}
                  title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-autronis-bg border border-autronis-border px-2 py-1 text-xs text-autronis-text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.label}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
            <div className="w-px self-stretch bg-autronis-border mx-1" />
            <button
              onClick={() => setOverflowOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-autronis-text-secondary hover:bg-autronis-accent/10 hover:text-autronis-accent transition-colors"
              aria-label="Meer acties"
              title="Meer acties"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </LayoutGroup>
      </div>

      <ActionDockOverflow
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        actions={all}
      />
    </>
  );
}
