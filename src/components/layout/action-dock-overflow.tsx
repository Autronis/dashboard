"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoundAction } from "@/hooks/use-action-shortcuts";

interface ActionDockOverflowProps {
  open: boolean;
  onClose: () => void;
  actions: BoundAction[];
}

export function ActionDockOverflow({ open, onClose, actions }: ActionDockOverflowProps) {
  const [query, setQuery] = useState("");

  // Reset query when closing, and close on Escape.
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleRun = (action: BoundAction) => {
    onClose();
    setTimeout(() => action.run(), 50);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Mobile: bottom sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-autronis-border bg-autronis-card shadow-2xl"
            style={{ maxHeight: "80vh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="text-base font-semibold text-autronis-text-primary">Alle acties</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-autronis-text-secondary hover:bg-autronis-bg"
                aria-label="Sluiten"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 rounded-xl border border-autronis-border bg-autronis-bg px-3 py-2">
                <Search className="w-4 h-4 text-autronis-text-secondary" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Zoek actie..."
                  className="flex-1 bg-transparent text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto px-2 pb-4" style={{ maxHeight: "calc(80vh - 120px)" }}>
              <div className="grid grid-cols-1 gap-1">
                {filtered.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleRun(action)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left text-autronis-text-primary hover:bg-autronis-bg transition-colors"
                  >
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-autronis-bg text-autronis-accent">
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-autronis-text-secondary py-6">
                    Geen acties gevonden
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Desktop: centered popover */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="hidden md:block fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[420px] max-h-[70vh] rounded-2xl border border-autronis-border bg-autronis-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-autronis-border px-4 py-3">
              <Search className="w-4 h-4 text-autronis-text-secondary" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek actie..."
                className="flex-1 bg-transparent text-sm text-autronis-text-primary placeholder:text-autronis-text-secondary focus:outline-none"
                autoFocus
              />
              <button
                onClick={onClose}
                className="text-autronis-text-secondary hover:text-autronis-text-primary"
                aria-label="Sluiten"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-2" style={{ maxHeight: "calc(70vh - 56px)" }}>
              <div className="grid grid-cols-1 gap-1">
                {filtered.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleRun(action)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-autronis-text-primary",
                      "hover:bg-autronis-accent/10 hover:text-autronis-accent transition-colors"
                    )}
                  >
                    <action.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{action.label}</span>
                    {action.shortcut && (
                      <span className="ml-auto text-xs text-autronis-text-secondary">
                        {action.shortcut}
                      </span>
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-autronis-text-secondary py-6">
                    Geen acties gevonden
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
